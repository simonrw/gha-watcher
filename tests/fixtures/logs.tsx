import { render } from 'ink';
import App from '../../components/App';
import { demoSnapshot } from '../../lib/demo';
import { createGitHubSource } from '../../lib/github';

const source = await createGitHubSource({ owner: 'acme', repo: 'rocket', runId: 123 }, 'test-token', process.argv[2]);
const snapshot = demoSnapshot(Date.now(), 20_000);
const app = render(<App load={async () => snapshot} interval={5000} demo={false}
  openLogs={async (jobId, signal) => {
    const url = await source.logUrl(jobId, signal);
    await Bun.write(process.argv[3]!, url);
  }} />, { alternateScreen: true });
await app.waitUntilExit();
