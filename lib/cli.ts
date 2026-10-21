import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

export type RunTarget = { owner: string; repo: string; runId: number };
export type Options = {
  command?: 'login' | 'logout';
  target?: RunTarget;
  demo: boolean;
  once: boolean;
  help: boolean;
  interval: number;
  demoJobs: number;
};

export const help = `gha-watcher - GitHub Actions in your terminal

Usage:
  gha-watcher login
  gha-watcher logout
  gha-watcher <run-url>
  gha-watcher <run-id> [--repo <owner/repo>]
  gha-watcher --demo

Options:
  --repo, -R       Repository for a numeric run ID (default: current Git origin)
  --interval, -i   Refresh interval in seconds (default: 5, minimum: 2)
  --once          Print one snapshot and exit
  --demo          Use sample data, with no network requests
  --demo-jobs     Number of sample jobs (default: 7, maximum: 10000)
  --help, -h      Show this help

Keys: up/down or j/k select job; PgUp/PgDn page; g/G first/last;
      tab/enter switches panes; arrows scroll the active pane;
      l opens raw job logs in your browser from the steps pane;
      / search (enter to finish); f filter; space pause; r refresh; q quit.

Authentication: GH_TOKEN, then GITHUB_TOKEN, then the system keychain.
Run login to save or replace a PAT with hidden input; logout removes it locally.
Interactive runs prompt when no token is saved. Enter skips for public runs.
Piped output and --once never prompt automatically.
`;

function currentRepository(cwd: string): string | undefined {
  let remote: string;
  try {
    remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
  const match = remote.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  return match ? `${match[1]}/${match[2]}` : undefined;
}

export function parseOptions(args: string[], cwd = process.cwd()): Options {
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
  if (positionals[0] === 'login' || positionals[0] === 'logout') {
    if (positionals.length !== 1 || Object.keys(values).length) {
      throw new Error('Use login or logout without run options.');
    }
    options.command = positionals[0];
    return options;
  }
  if (!Number.isInteger(options.demoJobs) || options.demoJobs < 1 || options.demoJobs > 10_000) throw new Error('--demo-jobs must be between 1 and 10000.');
  if (values['demo-jobs'] && !options.demo) throw new Error('--demo-jobs requires --demo.');
  if (!Number.isFinite(options.interval) || options.interval < 2000 || options.interval > 3_600_000) {
    throw new Error('--interval must be between 2 and 3600 seconds.');
  }
  if (options.demo) {
    if (positionals.length || values.repo) throw new Error('--demo cannot be combined with a run or --repo.');
    return options;
  }
  if (positionals.length !== 1) throw new Error('Provide a run URL or a run ID. Try --demo to explore offline.');
  const input = positionals[0]!;
  let owner: string | undefined;
  let repo: string | undefined;
  let id: string | undefined;
  if (/^\d+$/.test(input)) {
    const repository = values.repo ?? currentRepository(cwd);
    if (repository === undefined) throw new Error('Could not determine a GitHub repository from the current directory. Use --repo owner/repo.');
    if (!repository.match(/^[\w.-]+\/[\w.-]+$/)) throw new Error('--repo must be owner/repo.');
    [owner, repo] = repository.split('/');
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
