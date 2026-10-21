import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, useWindowSize } from 'ink';
import { describeLogError, type LoadRun, type OpenLogs } from '../lib/github';
import { useRun } from '../lib/use-run';
import { statusStyle } from '../lib/format';
import Dashboard, { visibleJobCount } from './Dashboard';

const filters = ['all', 'running', 'failed', 'queued'] as const;

export default function App({ load, openLogs, interval, demo }: { load: LoadRun; openLogs?: OpenLogs; interval: number; demo: boolean }) {
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
  const [logMessage, setLogMessage] = useState<string>();
  const logRequest = useRef<AbortController | undefined>(undefined);
  const filter = filters[filterIndex]!;
  const jobs = useMemo(() => snapshot?.jobs.filter(job => {
    if (!job.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'running') return job.status === 'in_progress';
    if (filter === 'failed') return statusStyle(job.status, job.conclusion).color === 'red';
    if (filter === 'queued') return job.status !== 'completed' && job.status !== 'in_progress';
    return true;
  }) ?? [], [snapshot, query, filter]);
  const selected = Math.max(0, jobs.findIndex(job => job.id === selectedId));
  const job = jobs[selected];
  const stepCount = Math.max(1, visibleJobCount(rows) - 3);
  const maxStepOffset = Math.max(0, (job?.steps?.length ?? 0) - stepCount);

  useEffect(() => {
    setLogMessage(undefined);
    setStepOffset(0);
    return () => {
      logRequest.current?.abort();
      logRequest.current = undefined;
    };
  }, [job?.id]);

  async function showLogs() {
    if (!job || logRequest.current) return;
    if (demo || !openLogs) { setLogMessage('Raw logs are unavailable in demo mode.'); return; }
    const controller = new AbortController();
    logRequest.current = controller;
    setLogMessage('Opening raw job logs...');
    try {
      await openLogs(job.id, controller.signal);
      if (!controller.signal.aborted) setLogMessage('Raw job logs opened in your browser.');
    } catch (error) {
      if (!controller.signal.aborted) setLogMessage(describeLogError(error));
    } finally {
      if (logRequest.current === controller) logRequest.current = undefined;
    }
  }

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
    if (input === ' ') { setPaused(value => !value); setLogMessage(undefined); }
    if (input === 'r') { refresh(); setLogMessage(undefined); }
    if (input === '/') { setSearching(true); setDetails(false); }
    if (key.tab || key.return) setDetails(value => !value);
    if (input === 'l' && details) { void showLogs(); return; }
    if (input === 'f') { setFilterIndex(value => (value + 1) % filters.length); setStepOffset(0); return; }
    if (details || key.leftArrow || key.rightArrow) {
      let next = Math.min(stepOffset, maxStepOffset);
      if (key.downArrow || input === 'j' || key.rightArrow) next++;
      if (key.upArrow || input === 'k' || key.leftArrow) next--;
      if (key.pageDown) next += stepCount;
      if (key.pageUp) next -= stepCount;
      if (key.home || input === 'g') next = 0;
      if (key.end || input === 'G') next = maxStepOffset;
      setStepOffset(Math.max(0, Math.min(maxStepOffset, next)));
      return;
    }
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
    error={error} logMessage={logMessage} updatedAt={updatedAt} query={query} searching={searching} filter={filter} interval={interval} details={details} />;
}
