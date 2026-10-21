import type { Octokit } from 'octokit';
import type { RunTarget } from './cli';

type ApiRun = Awaited<ReturnType<Octokit['rest']['actions']['getWorkflowRun']>>['data'];
type ApiJob = Awaited<ReturnType<Octokit['rest']['actions']['listJobsForWorkflowRunAttempt']>>['data']['jobs'][number];

export type Run = Pick<ApiRun, 'id' | 'name' | 'display_title' | 'run_number' | 'run_attempt' | 'event' | 'head_branch' | 'head_sha' | 'status' | 'conclusion' | 'html_url' | 'created_at' | 'run_started_at' | 'updated_at'> & { repository: string; actor: string };
export type Job = Pick<ApiJob, 'id' | 'name' | 'status' | 'conclusion' | 'completed_at' | 'steps' | 'labels' | 'runner_name'> & { started_at: string | null };
export type Snapshot = { run: Run; jobs: Job[] };
export type LoadRun = (signal: AbortSignal) => Promise<Snapshot>;

export async function createGitHubLoader(target: RunTarget, token?: string): Promise<LoadRun> {
  const { Octokit } = await import('octokit');
  const client = new Octokit({
    auth: token,
    retry: { enabled: false },
    throttle: { enabled: false },
  });
  return async signal => {
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
}

export function describeError(error: unknown): string {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 401) return 'Authentication failed. Run bun start login to replace the saved PAT, or check GH_TOKEN / GITHUB_TOKEN if set.';
  if (status === 404) return 'Run not found. Check the repository, run ID, and token access. Use bun start login to save a PAT.';
  if (status === 403 || status === 429) return 'GitHub denied the request or rate limited it. Check token permissions or retry later.';
  if (typeof status === 'number') return `GitHub returned HTTP ${status}. Press r to retry.`;
  return 'Could not fetch the run. Check your connection and press r to retry.';
}
