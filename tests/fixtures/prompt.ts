import { AuthError, promptToken } from '../../lib/auth';

const wasRaw = Boolean(process.stdin.isRaw);
const wasFlowing = process.stdin.readableFlowing === true;
try {
  const token = await promptToken();
  process.stdout.write(JSON.stringify({ accepted: token === process.env.EXPECTED_TOKEN }) + '\n');
} catch (error) {
  process.stdout.write(JSON.stringify({ cancelled: error instanceof AuthError }) + '\n');
}
process.stdout.write(JSON.stringify({ restored: Boolean(process.stdin.isRaw) === wasRaw && (process.stdin.readableFlowing === true) === wasFlowing }) + '\n');
