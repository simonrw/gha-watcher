import { parseArgs } from 'node:util';

export type RunTarget = { owner: string; repo: string; runId: number };
export type Options = {
  target?: RunTarget;
  demo: boolean;
  once: boolean;
  help: boolean;
  interval: number;
  demoJobs: number;
};

export const help = `gha-watcher - GitHub Actions in your terminal

Usage:
  bun start <run-url>
  bun start <run-id> --repo <owner/repo>
  bun start --demo

Options:
  --repo, -R       Repository for a numeric run ID
  --interval, -i   Refresh interval in seconds (default: 5, minimum: 2)
  --once          Print one snapshot and exit
  --demo          Use sample data, with no network requests
  --demo-jobs     Number of sample jobs (default: 7, maximum: 10000)
  --help, -h      Show this help

Keys: up/down or j/k select job; PgUp/PgDn page; g/G first/last;
      left/right scroll steps; tab toggles steps on narrow terminals;
      / search (enter to finish); f filter; space pause; r refresh; q quit.

Authentication: GH_TOKEN or GITHUB_TOKEN from your environment.
Public repositories also work without a token.
`;

export function parseOptions(args: string[]): Options {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      repo: { type: 'string', short: 'R' },
      interval: { type: 'string', short: 'i' },
      once: { type: 'boolean' },
      demo: { type: 'boolean' },
      'demo-jobs': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const options: Options = {
    demo: values.demo ?? false,
    once: values.once ?? false,
    help: values.help ?? false,
    interval: Number(values.interval ?? 5) * 1000,
    demoJobs: Number(values['demo-jobs'] ?? 7),
  };
  if (options.help) return options;
  if (!Number.isInteger(options.demoJobs) || options.demoJobs < 1 || options.demoJobs > 10_000) throw new Error('--demo-jobs must be between 1 and 10000.');
  if (values['demo-jobs'] && !options.demo) throw new Error('--demo-jobs requires --demo.');
  if (!Number.isFinite(options.interval) || options.interval < 2000 || options.interval > 3_600_000) {
    throw new Error('--interval must be between 2 and 3600 seconds.');
  }
  if (options.demo) {
    if (positionals.length || values.repo) throw new Error('--demo cannot be combined with a run or --repo.');
    return options;
  }
  if (positionals.length !== 1) throw new Error('Provide a run URL or a run ID with --repo. Try --demo to explore offline.');
  const input = positionals[0]!;
  let owner: string | undefined;
  let repo: string | undefined;
  let id: string | undefined;
  if (/^\d+$/.test(input)) {
    [owner, repo] = (values.repo ?? '').split('/');
    if (!values.repo?.match(/^[\w.-]+\/[\w.-]+$/)) throw new Error('A numeric run ID requires --repo owner/repo.');
    id = input;
  } else {
    let url: URL;
    try { url = new URL(input); } catch { throw new Error('Expected a GitHub Actions run URL or numeric run ID.'); }
    const match = url.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/actions\/runs\/(\d+)\/?$/);
    if (url.protocol !== 'https:' || url.host !== 'github.com' || url.username || url.password || !match) {
      throw new Error('Use a run URL like https://github.com/owner/repo/actions/runs/123.');
    }
    [, owner, repo, id] = match;
    if (values.repo && values.repo !== `${owner}/${repo}`) throw new Error('--repo does not match the run URL.');
  }
  const runId = Number(id);
  if (!Number.isSafeInteger(runId) || runId < 1) throw new Error('Run ID must be a positive safe integer.');
  options.target = { owner: owner!, repo: repo!, runId };
  return options;
}
