import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOptions } from '../lib/cli';

const temporaryDirectories: string[] = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'gha-watcher-cli-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test('a URL and a repository-qualified run ID identify the same run', () => {
  const url = parseOptions(['https://github.com/acme/rocket/actions/runs/123?check_suite_focus=true']);
  const id = parseOptions(['123', '-R', 'acme/rocket', '-i', '10']);
  expect({ url: url.target, id: id.target, interval: id.interval }).toEqual({
    url: { owner: 'acme', repo: 'rocket', runId: 123 },
    id: { owner: 'acme', repo: 'rocket', runId: 123 },
    interval: 10_000,
  });
});

for (const args of [
  ['123', '-R', 'invalid'], ['0', '-R', 'acme/rocket'], ['9007199254740992', '-R', 'acme/rocket'],
  ['https://example.com/acme/rocket/actions/runs/123'],
  ['--demo', '--interval', 'NaN'], ['--demo', '--interval', '1'],
  ['--demo', '123'], ['--demo', '--demo-jobs', '10001'],
  ['login', '--demo'], ['logout', '--once'], ['login', '123'], ['logout', '-R', 'acme/rocket'],
]) {
  test(`rejects invalid invocation ${args.join(' ')}`, () => {
    expect(() => parseOptions(args)).toThrow();
  });
}

for (const remote of [
  'https://github.com/acme/rocket.git',
  'https://github.com/acme/rocket',
  'git@github.com:acme/rocket.git',
  'ssh://git@github.com/acme/rocket.git',
]) {
  test(`defaults to the current repository with remote ${remote}`, () => {
    const cwd = temporaryDirectory();
    execFileSync('git', ['init', '--quiet', cwd]);
    execFileSync('git', ['remote', 'add', 'origin', remote], { cwd });
    const nested = join(cwd, 'nested');
    mkdirSync(nested);
    expect({
      root: parseOptions(['123'], cwd).target,
      nested: parseOptions(['123'], nested).target,
      override: parseOptions(['123', '--repo', 'other/project'], cwd).target,
      url: parseOptions(['https://github.com/other/project/actions/runs/456'], cwd).target,
    }).toEqual({
      root: { owner: 'acme', repo: 'rocket', runId: 123 },
      nested: { owner: 'acme', repo: 'rocket', runId: 123 },
      override: { owner: 'other', repo: 'project', runId: 123 },
      url: { owner: 'other', repo: 'project', runId: 456 },
    });
  });
}

test('requires an explicit repository when the current directory has no GitHub origin', () => {
  const cwd = temporaryDirectory();
  expect(() => parseOptions(['123'], cwd)).toThrow('Use --repo owner/repo');
  execFileSync('git', ['init', '--quiet', cwd]);
  expect(() => parseOptions(['123'], cwd)).toThrow('Use --repo owner/repo');
  execFileSync('git', ['remote', 'add', 'origin', 'https://gitlab.com/acme/rocket.git'], { cwd });
  expect(() => parseOptions(['123'], cwd)).toThrow('Use --repo owner/repo');
  expect(parseOptions(['123', '-R', 'acme/rocket'], cwd).target)
    .toEqual({ owner: 'acme', repo: 'rocket', runId: 123 });
});

test('login and logout are standalone commands', () => {
  expect(['login', 'logout'].map(command => parseOptions([command]).command)).toEqual(['login', 'logout']);
});

test('login refuses piped input without echoing it', async () => {
  const token = 'synthetic-secret-do-not-echo';
  const child = Bun.spawn([process.execPath, 'index.tsx', 'login'], {
    cwd: import.meta.dir + '/..', stdin: new Response(token), stdout: 'pipe', stderr: 'pipe',
  });
  const output = await new Response(child.stdout).text() + await new Response(child.stderr).text();
  expect({ code: await child.exited, actionable: output.includes('Run login in a terminal'), leaked: output.includes(token) })
    .toEqual({ code: 1, actionable: true, leaked: false });
});

test('the offline CLI prints a snapshot and exits', async () => {
  const child = Bun.spawn([process.execPath, 'index.tsx', '--demo', '--once'], {
    cwd: import.meta.dir + '/..', stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '' },
  });
  const output = await new Response(child.stdout).text();
  expect({ code: await child.exited, demo: output.includes('DEMO'), run: output.includes('acme/rocket'), jobs: output.includes('Integration tests') })
    .toEqual({ code: 0, demo: true, run: true, jobs: true });
});

test('invalid CLI input exits with an actionable message', async () => {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, '../index.tsx'), '123'], {
    cwd: temporaryDirectory(), stdout: 'pipe', stderr: 'pipe',
  });
  const error = await new Response(child.stderr).text();
  expect({ code: await child.exited, message: error.includes('--repo owner/repo') }).toEqual({ code: 1, message: true });
});
