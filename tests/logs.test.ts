import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

test('open selected job logs on demand, retry unavailable logs, and ignore duplicate requests', async () => {
  const requests: { path: string; auth: string | null }[] = [];
  const logUrl = 'https://logs.example.invalid/raw.txt?signature=example';
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(request) {
      requests.push({ path: new URL(request.url).pathname, auth: request.headers.get('authorization') });
      if (requests.length === 1) return Response.json({ message: 'Not Found' }, { status: 404 });
      await ready;
      return new Response(null, { status: 302, headers: { location: logUrl } });
    },
  });
  const directory = await mkdtemp(join(tmpdir(), 'gha-watcher-logs-'));
  const openedUrl = join(directory, 'opened-url');
  let output = '';
  const child = Bun.spawn([process.execPath, 'tests/fixtures/logs.tsx', server.url.href, openedUrl], {
    cwd: import.meta.dir + '/..',
    env: { ...process.env, CI: 'false', TERM: 'xterm-256color' },
    terminal: { cols: 120, rows: 24, data: (_, data) => { output += new TextDecoder().decode(data); } },
  });
  async function waitFor(text: string) {
    const deadline = Date.now() + 3000;
    while (!stripVTControlCharacters(output).includes(text)) {
      if (Date.now() > deadline) throw new Error(`Did not see ${text}. Output: ${stripVTControlCharacters(output).slice(-3000)}`);
      await Bun.sleep(20);
    }
    output = '';
  }
  try {
    await waitFor('tab steps');
    child.terminal!.write('l');
    await Bun.sleep(50);
    child.terminal!.write('j');
    await waitFor('Typecheck');
    child.terminal!.write('\t');
    await waitFor('l raw job logs');
    child.terminal!.write('j');
    await waitFor('2-5 of 6 steps');
    child.terminal!.write('l');
    await waitFor('Logs unavailable.');
    child.terminal!.write('l');
    await waitFor('Opening raw job logs...');
    child.terminal!.write('l');
    await Bun.sleep(100);
    release();
    await waitFor('Raw job logs opened in your browser.');
    child.terminal!.write('/');
    await waitFor('Search >');
    child.terminal!.write('no matching jobs');
    await waitFor('No jobs match.');
    child.terminal!.write('\r');
    await waitFor('/ search:');
    child.terminal!.write('\t');
    await waitFor('l raw job logs');
    child.terminal!.write('l');
    await Bun.sleep(50);
    child.terminal!.write('q');
    const exitCode = await child.exited;
    expect({ requests, opened: await Bun.file(openedUrl).text(), exitCode }).toEqual({
      requests: Array.from({ length: 2 }, () => ({ path: '/repos/acme/rocket/actions/jobs/2/logs', auth: 'token test-token' })),
      opened: logUrl,
      exitCode: 0,
    });
  } finally {
    release();
    child.kill();
    child.terminal!.close();
    await child.exited;
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}, 10_000);
