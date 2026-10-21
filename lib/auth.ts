import { secrets } from 'bun';
import { emitKeypressEvents } from 'node:readline';
import type { Key } from 'node:readline';

const githubCredential = { service: 'gha-watcher', name: 'github.com' };

export class AuthError extends Error {}

export async function getToken(env = process.env, credential = githubCredential): Promise<string | undefined> {
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  if (token) return token;
  try {
    return await secrets.get(credential) || undefined;
  } catch {
    // Public runs still work on machines without a keychain service.
    process.stderr.write('gha-watcher: Could not read the system keychain. Unlock it or set GH_TOKEN for authenticated access.\n');
    return undefined;
  }
}

export async function saveToken(token: string, credential = githubCredential): Promise<void> {
  token = token.trim();
  if (!token || /\s|[\x00-\x1f\x7f]/.test(token)) throw new AuthError('Enter a non-empty personal access token without whitespace.');
  try {
    await secrets.set({ ...credential, value: token });
  } catch {
    throw new AuthError('Could not save the token in the system keychain. Unlock it and try again. On Linux, a running Secret Service is required.');
  }
}

export async function logout(credential = githubCredential): Promise<boolean> {
  try {
    return await secrets.delete(credential);
  } catch {
    throw new AuthError('Could not remove the token from the system keychain. Unlock it and try again.');
  }
}

export function promptToken(): Promise<string> {
  const input = process.stdin;
  const output = process.stderr;
  if (!input.isTTY || !output.isTTY) {
    throw new AuthError('Run login in a terminal to enter a token securely. For scripts, set GH_TOKEN or GITHUB_TOKEN.');
  }
  const wasRaw = input.isRaw;
  const wasFlowing = input.readableFlowing === true;
  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  return new Promise((resolve, reject) => {
    let token = '';
    const cleanup = () => {
      input.removeListener('keypress', onKey);
      input.removeListener('end', onEnd);
      input.removeListener('error', onEnd);
      input.setRawMode(wasRaw);
      if (!wasFlowing) input.pause();
      output.write('\n');
    };
    const onEnd = () => {
      cleanup();
      reject(new AuthError('Token entry cancelled.'));
    };
    const onKey = (text: string | undefined, key: Key) => {
      if (key.ctrl && (key.name === 'c' || key.name === 'd')) { onEnd(); return; }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(token.trim());
      } else if (key.name === 'backspace') {
        token = token.slice(0, -1);
      } else if (key.ctrl && key.name === 'u') {
        token = '';
      } else if (!key.ctrl && !key.meta && text && /^[\x20-\x7e]+$/.test(text)) {
        token += text;
      }
    };
    input.on('keypress', onKey);
    input.once('end', onEnd);
    input.once('error', onEnd);
    output.write('GitHub PAT (hidden; Enter skips, Ctrl+C cancels): ');
  });
}
