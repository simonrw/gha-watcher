import { expect, test } from 'bun:test';
import { getToken, logout, saveToken } from '../lib/auth';

test('environment credentials take precedence', async () => {
  expect([
    await getToken({ GH_TOKEN: 'primary', GITHUB_TOKEN: 'secondary' }),
    await getToken({ GH_TOKEN: '', GITHUB_TOKEN: 'secondary' }),
  ]).toEqual(['primary', 'secondary']);
});

test.skipIf(process.env.GHA_WATCHER_TEST_KEYCHAIN !== '1')('save, reuse, replace, and remove a PAT in the system keychain', async () => {
  const credential = { service: `gha-watcher-test-${crypto.randomUUID()}`, name: 'github.com' };
  try {
    await saveToken('  synthetic_token_one  ', credential);
    const saved = await getToken({}, credential);
    await saveToken('synthetic_token_two', credential);
    const replaced = await getToken({}, credential);
    let rejectedEmpty = false;
    try { await saveToken('', credential); } catch { rejectedEmpty = true; }
    const unchanged = await getToken({}, credential);
    const deleted = await logout(credential);
    const missing = await getToken({}, credential);
    const deletedAgain = await logout(credential);
    expect({ saved, replaced, rejectedEmpty, unchanged, deleted, missing, deletedAgain }).toEqual({
      saved: 'synthetic_token_one', replaced: 'synthetic_token_two', rejectedEmpty: true,
      unchanged: 'synthetic_token_two', deleted: true, missing: undefined, deletedAgain: false,
    });
  } finally {
    await logout(credential);
  }
});

for (const scenario of [
  { name: 'accepts hidden input and backspace', input: 'synthetic_tokenX\x7f\r', expected: 'synthetic_token', cancelled: false },
  { name: 'skips on empty input', input: '\r', expected: '', cancelled: false },
  { name: 'cancels with Ctrl+C', input: 'synthetic_token\x03', expected: '', cancelled: true },
]) {
  test(`the PAT prompt ${scenario.name} and restores the terminal`, async () => {
    let output = '';
    const child = Bun.spawn([process.execPath, 'tests/fixtures/prompt.ts'], {
      cwd: import.meta.dir + '/..',
      env: { ...process.env, EXPECTED_TOKEN: scenario.expected },
      terminal: { cols: 100, rows: 24, data: (_, data) => { output += new TextDecoder().decode(data); } },
    });
    try {
      const deadline = Date.now() + 3000;
      while (!output.includes('Ctrl+C cancels')) {
        if (Date.now() > deadline) throw new Error('PAT prompt did not appear.');
        await Bun.sleep(10);
      }
      child.terminal!.write(scenario.input);
      const code = await child.exited;
      expect({
        code,
        result: output.includes(scenario.cancelled ? '"cancelled":true' : '"accepted":true'),
        restored: output.includes('"restored":true'),
        leaked: output.includes('synthetic_token'),
      }).toEqual({ code: 0, result: true, restored: true, leaked: false });
    } finally {
      child.kill();
      child.terminal!.close();
      await child.exited;
    }
  });
}
