import { Box, Text } from 'ink';
import { useMemo } from 'react';
import type { Job, Snapshot } from '../lib/github';
import { duration, plain, statusStyle } from '../lib/format';

export function visibleJobCount(rows: number): number {
  return Math.max(1, rows - 17);
}

type Props = {
  snapshot: Snapshot;
  jobs?: Job[];
  selected?: number;
  stepOffset?: number;
  columns: number;
  rows: number;
  now: number;
  demo?: boolean;
  paused?: boolean;
  busy?: boolean;
  error?: string;
  logMessage?: string;
  updatedAt?: number;
  query?: string;
  searching?: boolean;
  filter?: string;
  interval?: number;
  details?: boolean;
};

function Status({ status, conclusion }: { status: string | null; conclusion: string | null }) {
  const style = statusStyle(status, conclusion);
  return <Text color={style.color}>{style.icon} {style.label}</Text>;
}

export default function Dashboard({ snapshot, jobs = snapshot.jobs, selected = 0, stepOffset = 0, columns, rows, now, demo, paused, busy, error, logMessage, updatedAt, query = '', searching, filter = 'all', interval = 5000, details = false }: Props) {
  const { run } = snapshot;
  const wide = columns >= 100;
  const count = visibleJobCount(rows);
  const index = Math.min(selected, Math.max(0, jobs.length - 1));
  const offset = Math.max(0, Math.min(index - Math.floor(count / 2), jobs.length - count));
  const visible = jobs.slice(offset, offset + count);
  const job = jobs[index];
  const steps = job?.steps ?? [];
  const stepCount = Math.max(1, count - 3);
  const firstStep = Math.min(stepOffset, Math.max(0, steps.length - stepCount));
  const { completed, passed, failed, active } = useMemo(() => {
    const counts = { completed: 0, passed: 0, failed: 0, active: 0 };
    for (const job of snapshot.jobs) {
      if (job.status === 'completed') counts.completed++;
      if (job.conclusion === 'success') counts.passed++;
      if (statusStyle(job.status, job.conclusion).color === 'red') counts.failed++;
      if (job.status === 'in_progress') counts.active++;
    }
    return counts;
  }, [snapshot.jobs]);
  const progress = snapshot.jobs.length ? completed / snapshot.jobs.length : 0;
  const barSize = Math.max(8, Math.min(24, columns - 80));
  const bar = Math.round(progress * barSize);
  const state = paused ? 'PAUSED' : run.status === 'completed' ? 'COMPLETE' : 'LIVE';

  if (columns < 48 || rows < 24) {
    return <Box flexDirection="column" width={columns}>
      <Text bold color="cyan">gha-watcher {demo ? '[DEMO]' : ''}</Text>
      <Text wrap="truncate">{plain(run.repository)} #{run.run_number}</Text>
      <Status status={run.status} conclusion={run.conclusion} />
      <Text>{completed}/{snapshot.jobs.length} jobs complete</Text>
      <Text dimColor>Resize to at least 48 columns x 24 rows.</Text>
      <Text dimColor>q quit</Text>
    </Box>;
  }

  return <Box width={columns} flexDirection="column" paddingX={1}>
    <Box justifyContent="space-between">
      <Text bold color="cyan">◈ gha-watcher <Text dimColor> / actions</Text></Text>
      <Text color={paused ? 'yellow' : 'cyan'}>{demo ? 'DEMO · ' : ''}{state}</Text>
    </Box>
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
      <Text bold wrap="truncate">{plain(run.repository)} <Text dimColor> / {plain(run.name ?? 'Workflow')} #{run.run_number}</Text></Text>
      <Text wrap="truncate">{plain(run.display_title)}</Text>
      <Text dimColor wrap="truncate">{plain(run.head_branch ?? 'detached')} · {run.head_sha.slice(0, 7)} · {plain(run.event)} · @{plain(run.actor)}</Text>
      <Box justifyContent="space-between">
        <Status status={run.status} conclusion={run.conclusion} />
        <Text dimColor>attempt {run.run_attempt ?? 1} · {duration(run.run_started_at ?? run.created_at, run.status === 'completed' ? run.updated_at : null, now)}</Text>
      </Box>
    </Box>
    <Box marginTop={1}>
      <Text wrap="truncate"><Text color="cyan">{'━'.repeat(bar)}<Text color="gray">{'─'.repeat(barSize - bar)}</Text></Text> {completed}/{snapshot.jobs.length} complete{columns >= 80 && <Text dimColor> · <Text color="green">{passed} passed</Text> · <Text color="red">{failed} failed</Text> · <Text color="cyan">{active} running</Text></Text>}</Text>
    </Box>
    <Text dimColor wrap="truncate">{searching ? 'Search > ' : '/ search: '}{plain(query) || (searching ? '▏' : 'all jobs')} · f filter: {filter}</Text>
    <Box flexDirection={wide ? 'row' : 'column'} gap={wide ? 1 : 0}>
      {(wide || !details) && <Box width={wide ? '52%' : '100%'} flexDirection="column" borderStyle="round" borderColor={details ? 'gray' : 'cyan'} paddingX={1}>
        <Text bold>JOBS <Text dimColor>{jobs.length ? `${offset + 1}-${offset + visible.length} of ${jobs.length}` : '0'}</Text></Text>
        {visible.map((item, row) => {
          const style = statusStyle(item.status, item.conclusion);
          const highlighted = index === offset + row;
          return <Box key={item.id}>
            <Text color="cyan">{highlighted ? '› ' : '  '}</Text>
            <Text color={style.color}>{style.icon} </Text>
            <Box flexGrow={1} flexShrink={1}><Text bold={highlighted} color={highlighted ? 'cyan' : undefined} wrap="truncate">{plain(item.name)}</Text></Box>
            <Box width={10} justifyContent="flex-end"><Text dimColor>{duration(item.started_at, item.completed_at, now)}</Text></Box>
          </Box>;
        })}
        {!jobs.length && <Text dimColor>{snapshot.jobs.length ? 'No jobs match.' : 'Waiting for jobs to be scheduled...'}</Text>}
      </Box>}
      {(wide || details) && <Box width={wide ? undefined : '100%'} flexGrow={1} flexBasis={wide ? 0 : undefined} flexDirection="column" borderStyle="round" borderColor={details ? 'cyan' : 'gray'} paddingX={1}>
        <Text bold wrap="truncate">{job ? plain(job.name) : 'JOB DETAILS'}</Text>
        {job && <>
          <Status status={job.status} conclusion={job.conclusion} />
          <Text dimColor wrap="truncate">{plain(job.labels.join(', ')) || 'Runner pending'} · {plain(job.runner_name ?? 'unassigned')}</Text>
          {steps.slice(firstStep, firstStep + stepCount).map(step => <Box key={step.number}>
            <Text color={statusStyle(step.status, step.conclusion).color}>{statusStyle(step.status, step.conclusion).icon} </Text>
            <Box flexGrow={1} flexShrink={1}><Text wrap="truncate">{plain(step.name)}</Text></Box>
            <Box width={10} justifyContent="flex-end"><Text dimColor>{duration(step.started_at, step.completed_at, now)}</Text></Box>
          </Box>)}
          {!steps.length && <Text dimColor>No steps reported yet.</Text>}
          <Text dimColor wrap="truncate">{steps.length ? `${firstStep + 1}-${Math.min(firstStep + stepCount, steps.length)} of ${steps.length} steps · ←/→ scroll` : 'Waiting for step details'}</Text>
        </>}
      </Box>}
    </Box>
    <Text color={error && !logMessage ? 'red' : 'gray'} wrap="truncate">{logMessage ?? (error ? `! ${error} ${updatedAt ? '(showing last update)' : ''}` : busy ? 'Refreshing...' : paused ? 'Refresh paused. Press space to resume.' : run.status === 'completed' ? 'Run finished. Press r to refresh.' : `Refresh every ${interval / 1000}s · updated ${updatedAt ? Math.max(0, Math.floor((now - updatedAt) / 1000)) : 0}s ago`)}</Text>
    <Text dimColor wrap="truncate">{details ? 'l raw job logs · tab jobs · ↑/↓ scroll' : 'tab steps · ↑/↓ j/k jobs · PgUp/PgDn'} · / search · f filter · space pause · r refresh · q quit</Text>
  </Box>;
}
