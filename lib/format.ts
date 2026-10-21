export function duration(start: string | null | undefined, end: string | null | undefined, now: number): string {
  if (!start) return '-';
  const seconds = Math.max(0, Math.floor(((end ? Date.parse(end) : now) - Date.parse(start)) / 1000));
  if (!Number.isFinite(seconds)) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
}

// Repository-controlled names must remain a single line of terminal text.
export function plain(value: string): string {
  return value.replace(/\x1b(?:\][^\x07]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~])/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, ' ');
}

export function statusStyle(status: string | null, conclusion: string | null) {
  const label = conclusion ?? status ?? 'unknown';
  if (label === 'success') return { icon: '✓', color: 'green', label: 'passed' };
  if (['failure', 'timed_out', 'startup_failure', 'action_required', 'stale'].includes(label)) return { icon: '✕', color: 'red', label: label.replaceAll('_', ' ') };
  if (label === 'in_progress') return { icon: '●', color: 'cyan', label: 'running' };
  if (['queued', 'waiting', 'pending', 'requested'].includes(label)) return { icon: '○', color: 'yellow', label };
  return { icon: label === 'skipped' ? '-' : '◇', color: 'gray', label: label.replaceAll('_', ' ') };
}
