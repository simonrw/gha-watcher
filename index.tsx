import { render, renderToString } from 'ink';
import App from './components/App';
import Dashboard from './components/Dashboard';
import { help, parseOptions } from './lib/cli';
import { createDemoLoader } from './lib/demo';
import { createGitHubLoader, describeError } from './lib/github';

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
  const load = options.demo
    ? createDemoLoader(options.demoJobs)
    : await createGitHubLoader(options.target!, process.env.GH_TOKEN || process.env.GITHUB_TOKEN);

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
  process.stderr.write(`gha-watcher: ${describeError(error)}\n`);
  process.exitCode = 1;
}

