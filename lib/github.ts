import type { Octokit } from 'octokit';
import type { RunTarget } from './cli';

type ApiRun = Awaited<ReturnType<Octokit['rest']['actions']['getWorkflowRun']>>['data'];
type ApiJob = Awaited<ReturnType<Octokit['rest']['actions']['listJobsForWorkflowRunAttempt']>>['data']['jobs'][number];

export type Run = Pick<ApiRun, 'id' | 'name' | 'display_title' | 'run_number' | 'run_attempt' | 'event' | 'head_branch' | 'head_sha' | 'status' | 'conclusion' | 'html_url' | 'created_at' | 'run_started_at' | 'updated_at'> & { repository: string; actor: string };
export type Job = Pick<ApiJob, 'id' | 'name' | 'status' | 'conclusion' | 'completed_at' | 'steps' | 'labels' | 'runner_name'> & { started_at: string | null };
export type Snapshot = { run: Run; jobs: Job[] };
export type LoadRun = (signal: AbortSignal) => Promise<Snapshot>;
export type OpenLogs = (jobId: number, signal: AbortSignal) => Promise<void>;

export async function createGitHubSource(target: RunTarget, token?: string, baseUrl = 'https://api.github.com') {
  const { Octokit } = await import('octokit');
  const client = new Octokit({
    auth: token,
    baseUrl,
    retry: { enabled: false },
    throttle: { enabled: false },
  });
  const load: LoadRun = async signal => {
    const request = () => ({ signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
    const params = { owner: target.owner, repo: target.repo, run_id: target.runId };
    const { data: run } = await client.rest.actions.getWorkflowRun({ ...params, request: request() });
    const jobParams = {
      ...params,
      attempt_number: run.run_attempt ?? 1,
      per_page: 100,
    };
    const fetchPage = (page: number) => client.rest.actions.listJobsForWorkflowRunAttempt({ ...jobParams, page, request: request() });
    const first = await fetchPage(1);
    const jobs = [...first.data.jobs];
    const pages = Math.ceil(first.data.total_count / 100);
    // A large matrix needs pages, never a request per job or per annotation.
    for (let page = 2; page <= pages; page += 4) {
      const batch = Array.from({ length: Math.min(4, pages - page + 1) }, (_, index) =>
        fetchPage(page + index),
      );
      // Finish this batch before retrying, including when one of its requests fails.
      for (const response of await Promise.allSettled(batch)) {
        if (response.status === 'rejected') throw response.reason;
        jobs.push(...response.value.data.jobs);
      }
    }
    return {
      run: { ...run, repository: `${target.owner}/${target.repo}`, actor: run.actor?.login ?? 'unknown' },
      jobs,
    };
  };
  return { load, logUrl: (jobId: number, signal: AbortSignal) => getJobLogUrl(client, target, jobId, signal) };
}

async function getJobLogUrl(client: Octokit, target: RunTarget, jobId: number, signal: AbortSignal): Promise<string> {
  const response = await client.rest.actions.downloadJobLogsForWorkflowRun({
    owner: target.owner, repo: target.repo, job_id: jobId,
    request: { redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) },
  });
  const location = response.headers.location;
  if (!location || new URL(location).protocol !== 'https:') throw new Error('GitHub did not return a secure log URL.');
  return location;
}

export function describeLogError(error: unknown): string {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 404 || status === 410) return 'Logs unavailable. They may not be ready, may have expired, or require repository access.';
  if (status === 401) return 'Log access denied. Check your token or run gha-watcher login.';
  if (status === 403 || status === 429) return 'Log access denied or rate limited. Check token permissions or retry later.';
  return 'Could not open logs. Check your connection and default browser, then press l to retry.';
}

export function describeError(error: unknown): string {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 401) return 'Authentication failed. Run gha-watcher login to replace the saved PAT, or check GH_TOKEN / GITHUB_TOKEN if set.';
  if (status === 404) return 'Run not found. Check the repository, run ID, and token access. Use gha-watcher login to save a PAT.';
  if (status === 403 || status === 429) return 'GitHub denied the request or rate limited it. Check token permissions or retry later.';
  if (typeof status === 'number') return `GitHub returned HTTP ${status}. Press r to retry.`;
  return 'Could not fetch the run. Check your connection and press r to retry.';
}
