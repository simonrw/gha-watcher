import { render, renderToString } from 'ink';
import App from './components/App';
import Dashboard from './components/Dashboard';
import { help, parseOptions } from './lib/cli';
import { createDemoLoader } from './lib/demo';
import { createGitHubLoader, describeError } from './lib/github';
import { AuthError, getToken, logout, promptToken, saveToken } from './lib/auth';

async function main() {
  let options;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`gha-watcher: ${error instanceof Error ? error.message : 'Invalid arguments.'}\n`);
    process.exitCode = 1;
    return;
  }
  if (options.help) { process.stdout.write(help); return; }
  if (options.command === 'login') {
    const token = await promptToken();
    if (!token) { process.stderr.write('No token entered. Saved token unchanged.\n'); return; }
    await saveToken(token);
    process.stderr.write('Token saved in the system keychain.\n');
    if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) {
      process.stderr.write('GH_TOKEN or GITHUB_TOKEN is set and will take precedence over the saved token.\n');
    }
    return;
  }
  if (options.command === 'logout') {
    process.stderr.write(await logout() ? 'Saved token removed from the system keychain.\n' : 'No saved token found.\n');
    process.stderr.write('Environment tokens still apply. To revoke the PAT, use GitHub settings.\n');
    return;
  }
  let token: string | undefined;
  if (!options.demo) {
    token = await getToken();
    if (!token && !options.once && process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY) {
      token = await promptToken() || undefined;
      if (token) {
        await saveToken(token);
        process.stderr.write('Token saved in the system keychain.\n');
      }
    }
  }
  const load = options.demo
    ? createDemoLoader(options.demoJobs)
    : await createGitHubLoader(options.target!, token);

  if (options.once || !process.stdin.isTTY || !process.stdout.isTTY) {
    const snapshot = await load(AbortSignal.timeout(60_000));
    const columns = process.stdout.columns || 100;
    process.stdout.write(renderToString(<Dashboard snapshot={snapshot} columns={columns}
      rows={snapshot.jobs.length + 24} now={Date.now()} demo={options.demo} />, { columns }) + '\n');
    return;
  }
  const app = render(<App load={load} interval={options.interval} demo={options.demo} />, {
    alternateScreen: true,
    incrementalRendering: true,
  });
  await app.waitUntilExit();
}

try {
  await main();
} catch (error) {
  process.stderr.write(`gha-watcher: ${error instanceof AuthError ? error.message : describeError(error)}\n`);
  process.exitCode = 1;
}

