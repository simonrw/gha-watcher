import type { Job, LoadRun, Snapshot } from './github';

export function demoSnapshot(now = Date.now(), elapsed = 0, jobCount = 7): Snapshot {
  const start = now - elapsed - 142_000;
  const date = (seconds: number) => new Date(start + seconds * 1000).toISOString();
  const finished = elapsed >= 20_000;
  function job(id: number, name: string, state: 'success' | 'failure' | 'in_progress' | 'queued' | 'skipped', duration: number): Job {
    const completed = ['success', 'failure', 'skipped'].includes(state);
    const active = state === 'in_progress';
    const stepNames = ['Set up job', 'Check out repository', 'Install dependencies', 'Run checks', 'Post checkout', 'Complete job'];
    return {
      id, name,
      status: completed ? 'completed' : state as 'queued' | 'in_progress',
      conclusion: state === 'success' || state === 'failure' || state === 'skipped' ? state : null,
      started_at: state === 'queued' || state === 'skipped' ? null : date(0),
      completed_at: completed && state !== 'skipped' ? date(duration) : null,
      labels: ['ubuntu-latest'],
      runner_name: state === 'queued' || state === 'skipped' ? null : 'GitHub Actions 12',
      steps: state === 'queued' || state === 'skipped' ? [] : stepNames.map((name, index) => {
        const pending = active && index > 3;
        const running = active && index === 3;
        return {
          name, number: index + 1,
          status: pending ? 'queued' : running ? 'in_progress' : 'completed',
          conclusion: pending || running ? null : state === 'failure' && index === 3 ? 'failure' : 'success',
          started_at: pending ? null : date(index > 3 ? duration - (6 - index) * 4 : index * 4),
          completed_at: pending || running ? null : date(index >= 3 ? duration - (5 - index) * 4 : index * 4 + 3),
        };
      }),
    };
  }
  const examples = [
    job(1, 'Lint & formatting', 'success', 28),
    job(2, 'Typecheck', 'success', 43),
    job(3, 'Unit tests / ubuntu', 'success', 86),
    job(4, 'Unit tests / macos', finished ? 'success' : 'in_progress', 158),
    job(5, 'Integration tests', 'failure', 112),
    job(6, 'Build packages', finished ? 'success' : 'in_progress', 162),
    job(7, 'Publish preview', finished ? 'skipped' : 'queued', 0),
  ];
  return {
    run: {
      id: 123456789, name: 'CI', display_title: 'Simplify workflow configuration',
      repository: 'acme/rocket', actor: 'octocat', run_number: 248, run_attempt: 1,
      event: 'pull_request', head_branch: 'simplify-workflows', head_sha: 'e8b4c2a1f739d602a9c4f1f39a1eb3d4a1234567',
      status: finished ? 'completed' : 'in_progress', conclusion: finished ? 'failure' : null,
      html_url: 'https://github.com/acme/rocket/actions/runs/123456789',
      created_at: date(0), run_started_at: date(0), updated_at: finished ? date(162) : new Date(now).toISOString(),
    },
    jobs: Array.from({ length: jobCount }, (_, index) => {
      const example = examples[index % examples.length]!;
      return { ...example, id: index + 1, name: index < 7 ? example.name : `${example.name} / shard ${Math.floor(index / 7) + 1}` };
    }),
  };
}

export function createDemoLoader(jobCount = 7): LoadRun {
  const started = Date.now();
  return async () => demoSnapshot(Date.now(), Date.now() - started, jobCount);
}
