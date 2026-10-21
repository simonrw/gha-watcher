import { expect, test } from 'bun:test';
import { stripVTControlCharacters } from 'node:util';

test('navigate, search, pause and quit a large offline run in a real terminal', async () => {
  let output = '';
  const child = Bun.spawn([process.execPath, 'index.tsx', '--demo', '--demo-jobs', '1000'], {
    cwd: import.meta.dir + '/..',
    env: { ...process.env, CI: 'false', TERM: 'xterm-256color', GH_TOKEN: '', GITHUB_TOKEN: '' },
    terminal: { cols: 120, rows: 32, data: (_, data) => { output += new TextDecoder().decode(data); } },
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
    await waitFor('of 1000');
    child.terminal!.write('G');
    await waitFor('shard 143');
    child.terminal!.write('/');
    await waitFor('Search >');
    child.terminal!.write('Integration tests');
    await waitFor('of 143');
    child.terminal!.write('\r');
    await waitFor('/ search:');
    child.terminal!.write('f');
    await waitFor('No jobs match');
    child.terminal!.write('f');
    await waitFor('of 143');
    child.terminal!.resize(80, 24);
    await waitFor('tab steps');
    child.terminal!.write('\t');
    await waitFor('1-4 of 6 steps');
    child.terminal!.write('\x1b[C');
    await waitFor('2-5 of 6 steps');
    child.terminal!.write(' ');
    await waitFor('PAUSED');
    child.terminal!.write(' ');
    await waitFor('LIVE');
    child.terminal!.write('q');
    expect(await child.exited).toBe(0);
  } finally {
    child.kill();
    child.terminal!.close();
    await child.exited;
  }
}, 10_000);
