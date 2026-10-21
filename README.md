# gha-watcher

An Ink terminal UI for a GitHub Actions run, using Octokit. Browse jobs and steps, search large job matrices, and follow status changes.

Install with mise:

```toml
[tools]
bun = "latest"
"npm:github:simonrw/gha-watcher" = "branch:main"
```

```sh
mise install
gha-watcher --demo
gha-watcher login
gha-watcher RUN_ID
gha-watcher RUN_ID --repo OWNER/REPO
```

The npm package installs the `gha-watcher` command, which runs with Bun. Use `branch:main` for Git installs: mise 2026.10.14's shell hook can report `latest` as missing even when `mise exec` works. To refresh the installed copy from main, run `mise install --force npm:github:simonrw/gha-watcher@branch:main`.

To run from a checkout:

```sh
bun install
bun demo
bun demo --demo-jobs 1000
```

The demo makes no network requests. It includes running, queued, successful, failed, and skipped jobs, and finishes after 20 seconds.

Watch a real run when ready:

```sh
bun start https://github.com/OWNER/REPO/actions/runs/RUN_ID
bun start RUN_ID --repo OWNER/REPO
bun start RUN_ID --repo OWNER/REPO --interval 15
```

Use a numeric run ID in place of `RUN_ID`. When you omit `--repo`, gha-watcher uses the GitHub repository from the current checkout's `origin` remote, including from subdirectories. HTTPS and SSH remotes are supported. Use `--repo OWNER/REPO` to override it or when outside a checkout.

Save a personal access token once, then watch runs without passing it again:

```sh
bun start login
bun start RUN_ID --repo OWNER/REPO
```

The login prompt hides your input and stores the PAT in the system keychain under service `gha-watcher`, account `github.com`. It uses [Bun's Secrets API](https://bun.sh/docs/runtime/secrets): macOS Keychain, Linux Secret Service, or Windows Credential Manager. Linux needs a running service such as GNOME Keyring or KWallet. The app never writes the PAT to a file or invokes `gh` or `op`.

Create a [fine-grained PAT](https://github.com/settings/personal-access-tokens/new) with access to the repositories you want to watch and repository permission **Actions: Read-only**. Login saves the token; repository access is checked when you watch a run.

Authentication uses `GH_TOKEN`, then `GITHUB_TOKEN`, then the saved PAT. Interactive runs prompt when no token is available. Press Enter to continue anonymously for a public repository. `--once` and piped runs use existing credentials without prompting. Demo and help do not access the keychain.

Run `bun start login` again to replace an expired or revoked PAT. Empty input leaves the saved token unchanged. Run `bun start logout` to remove the saved token locally; environment tokens still apply. Revoke the PAT in GitHub settings if you also want to disable it on GitHub.

Press up/down or `j`/`k` to select jobs, Page Up/Down to page, and `g`/`G` to jump to the first/last job. Press `/` to search by name, then Enter to finish editing. Press `f` to cycle through all, running, failed, and queued jobs. Clear a search using backspace in search mode.

The selected job's steps appear alongside the list at 100 columns or wider. Tab or Enter switches focus between jobs and steps at any width; the active pane has a cyan border. In the steps pane, up/down or `j`/`k` scrolls steps, Page Up/Down pages, and `g`/`G` jumps to the start/end. Left/right also scrolls steps. Space pauses automatic refresh, `r` refreshes manually, and `q` or Escape quits. Ctrl+C also quits while editing a search.

With the steps pane focused, press `l` to open the whole job's raw logs in your default browser. This requests a fresh download link using your existing credentials; the app does not download or parse the logs. Logs may be unavailable until the job finishes, after retention expires, or without repository access. Press `l` again to retry. Demo mode does not open a browser or request logs.

`--once` prints a snapshot and exits. Piped output uses this mode automatically. Exit status indicates whether the snapshot was fetched, not whether the workflow succeeded.

Each refresh fetches the run and its current attempt's jobs in pages of 100, with at most four job-page requests in flight. Polling never fetches annotations or logs and never makes per-job requests. Log links are requested only when you press `l`. Only visible job and step rows are rendered. Ink updates changed terminal lines, and job totals are cached between refreshes.

Polling waits five seconds after each completed fetch by default, stops when the run completes, and backs off after errors. The last successful snapshot stays visible if a refresh fails. Every request times out after 15 seconds. Large runs still require every job page on each refresh, so increase `--interval` to reduce API usage.

Local checks:

```sh
bun run typecheck
bun test
bun run bench
```

Tests use offline data and a real pseudo-terminal. The benchmark measures rendering at 120 columns by 32 rows for 10, 1,000, and 10,000 jobs. It does not measure API latency. The live GitHub integration has not been exercised yet.

`GHA_WATCHER_TEST_KEYCHAIN=1 bun test tests/auth.test.ts` also checks storage, reuse, replacement, and deletion in the real system keychain. It uses a random test service and a synthetic token, then removes the entry. This check requires an unlocked keychain and is skipped by default.
