import { renderToString } from 'ink';
import Dashboard from '../components/Dashboard';
import { demoSnapshot } from '../lib/demo';

// Measures local layout/rendering only, never GitHub or network performance.
for (const count of [10, 1000, 10_000]) {
  const snapshot = demoSnapshot(Date.now(), 0, count);
  const samples: number[] = [];
  for (let iteration = 0; iteration < 31; iteration++) {
    const start = performance.now();
    renderToString(<Dashboard snapshot={snapshot} selected={Math.floor(count / 2)} columns={120} rows={32} now={Date.now()} />, { columns: 120 });
    if (iteration > 0) samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  console.log(`${count.toLocaleString()} jobs: median ${samples[15]!.toFixed(1)}ms, p95 ${samples[28]!.toFixed(1)}ms (120 x 32 terminal)`);
}
