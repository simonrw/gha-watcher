import { expect, test } from 'bun:test';
import { renderToString } from 'ink';
import Dashboard from '../components/Dashboard';
import { demoSnapshot } from '../lib/demo';

const now = Date.parse('2026-10-21T12:00:00Z');

test.each([[120, 32], [100, 24], [80, 24], [48, 24]])('ten thousand jobs fit a %i by %i terminal', (columns, rows) => {
  const snapshot = demoSnapshot(now, 0, 10_000);
  snapshot.jobs[0]!.name = 'Offscreen first job';
  const output = renderToString(<Dashboard snapshot={snapshot} selected={9999} columns={columns} rows={rows} now={now} />, { columns });
  expect({
    fits: output.split('\n').length <= rows,
    selectedVisible: output.includes('shard 1429'),
    total: output.includes('of 10000'),
    offscreen: output.includes('Offscreen first job'),
  }).toEqual({ fits: true, selectedVisible: true, total: true, offscreen: false });
});

test('a narrow terminal can show selected job steps and a fetch error without losing data', () => {
  const output = renderToString(<Dashboard snapshot={demoSnapshot(now)} columns={80} rows={24} now={now}
    selected={4} details stepOffset={2} error="Connection unavailable" updatedAt={now - 5000} />, { columns: 80 });
  expect({ job: output.includes('Integration tests'), step: output.includes('Run checks'), failure: output.includes('failure'), stale: output.includes('showing last update') })
    .toEqual({ job: true, step: true, failure: true, stale: true });
});

test('the demo ends with a failed run and all jobs settled', () => {
  const snapshot = demoSnapshot(now, 20_000);
  const output = renderToString(<Dashboard snapshot={snapshot} columns={100} rows={30} now={now} demo />, { columns: 100 });
  expect({ completed: output.includes('COMPLETE'), count: output.includes('7/7 complete'), failed: output.includes('failure'), settled: snapshot.jobs.every(job => job.status === 'completed') })
    .toEqual({ completed: true, count: true, failed: true, settled: true });
});

test('empty job lists show a waiting state', () => {
  const snapshot = demoSnapshot(now, 0, 0);
  const output = renderToString(<Dashboard snapshot={snapshot} columns={100} rows={24} now={now} />, { columns: 100 });
  expect(output).toContain('Waiting for jobs to be scheduled');
});
