import { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import type { LoadRun } from '../lib/github';
import { useRun } from '../lib/use-run';
import { statusStyle } from '../lib/format';
import Dashboard, { visibleJobCount } from './Dashboard';

const filters = ['all', 'running', 'failed', 'queued'] as const;

export default function App({ load, interval, demo }: { load: LoadRun; interval: number; demo: boolean }) {
  const { exit } = useApp();
  const { columns, rows } = useWindowSize();
  const [paused, setPaused] = useState(false);
  const { snapshot, error, busy, updatedAt, refresh } = useRun(load, interval, paused);
  const [selectedId, setSelectedId] = useState<number>();
  const [stepOffset, setStepOffset] = useState(0);
  const [details, setDetails] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filterIndex, setFilterIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const filter = filters[filterIndex]!;
  const jobs = useMemo(() => snapshot?.jobs.filter(job => {
    if (!job.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'running') return job.status === 'in_progress';
    if (filter === 'failed') return statusStyle(job.status, job.conclusion).color === 'red';
    if (filter === 'queued') return job.status !== 'completed' && job.status !== 'in_progress';
    return true;
  }) ?? [], [snapshot, query, filter]);
  const selected = Math.max(0, jobs.findIndex(job => job.id === selectedId));

  useEffect(() => {
    if (paused || snapshot?.run.status === 'completed') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paused, snapshot?.run.status]);

  useInput((input, key) => {
    if (searching) {
      if (key.escape || key.return) setSearching(false);
      else if (key.backspace || key.delete) setQuery(value => value.slice(0, -1));
      else if (!key.ctrl && !key.meta) setQuery(value => value + input.replace(/[\x00-\x1f\x7f]/g, ''));
      setStepOffset(0);
      return;
    }
    if (input === 'q' || key.escape) { exit(); return; }
    if (input === ' ') setPaused(value => !value);
    if (input === 'r') refresh();
    if (input === '/') setSearching(true);
    if (key.tab || key.return) setDetails(value => !value);
    if (input === 'f') { setFilterIndex(value => (value + 1) % filters.length); setStepOffset(0); }
    if (key.leftArrow) setStepOffset(value => Math.max(0, value - 1));
    if (key.rightArrow) setStepOffset(value => Math.min(Math.max(0, (jobs[selected]?.steps?.length ?? 1) - 1), value + 1));
    let next = selected;
    if (key.downArrow || input === 'j') next++;
    if (key.upArrow || input === 'k') next--;
    if (key.pageDown) next += visibleJobCount(rows);
    if (key.pageUp) next -= visibleJobCount(rows);
    if (key.home || input === 'g') next = 0;
    if (key.end || input === 'G') next = jobs.length - 1;
    if (next !== selected) {
      setSelectedId(jobs[Math.max(0, Math.min(jobs.length - 1, next))]?.id);
      setStepOffset(0);
    }
  });

  if (!snapshot) return <Box flexDirection="column" padding={1}>
    <Text bold color="cyan">◈ gha-watcher {demo ? '[DEMO]' : ''}</Text>
    <Text color={error ? 'red' : undefined}>{error ?? 'Fetching workflow and jobs...'}</Text>
    <Text dimColor>r retry · q quit</Text>
  </Box>;

  return <Dashboard snapshot={snapshot} jobs={jobs} selected={selected} stepOffset={stepOffset}
    columns={columns} rows={rows} now={now} demo={demo} paused={paused} busy={busy}
    error={error} updatedAt={updatedAt} query={query} searching={searching} filter={filter} interval={interval} details={details} />;
}
