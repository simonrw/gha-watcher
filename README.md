# gha-watcher

An Ink terminal UI for a GitHub Actions run, using Octokit. Browse jobs and steps, search large job matrices, and follow status changes.

Install and try the offline demo:

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

Use a numeric run ID in place of `RUN_ID`. Authentication comes from `GH_TOKEN`, then `GITHUB_TOKEN`. Public repositories can be read without a token. Private repositories require a token with access to the repository and Actions read permission. The app does not invoke `gh` or credential tools.

Press up/down or `j`/`k` to select jobs, Page Up/Down to page, and `g`/`G` to jump to the first/last job. Press `/` to search by name, then Enter to finish editing. Press `f` to cycle through all, running, failed, and queued jobs. Clear a search using backspace in search mode.

The selected job's steps appear alongside the list at 100 columns or wider. On narrower terminals, Tab or Enter switches between jobs and steps. Left/right scrolls the steps. Space pauses automatic refresh, `r` refreshes manually, and `q` or Escape quits. Ctrl+C also quits while editing a search.

`--once` prints a snapshot and exits. Piped output uses this mode automatically. Exit status indicates whether the snapshot was fetched, not whether the workflow succeeded.

Each refresh fetches the run and its current attempt's jobs in pages of 100, with at most four job-page requests in flight. It never fetches annotations or logs and never makes per-job requests. Only visible job and step rows are rendered. Ink updates changed terminal lines, and job totals are cached between refreshes.

Polling waits five seconds after each completed fetch by default, stops when the run completes, and backs off after errors. The last successful snapshot stays visible if a refresh fails. Every request times out after 15 seconds. Large runs still require every job page on each refresh, so increase `--interval` to reduce API usage.

Local checks:

```sh
bun run typecheck
bun test
bun run bench
```

Tests use offline data and a real pseudo-terminal. The benchmark measures rendering at 120 columns by 32 rows for 10, 1,000, and 10,000 jobs. It does not measure API latency. The live GitHub integration has not been exercised yet.
