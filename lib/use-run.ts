import { useEffect, useRef, useState } from 'react';
import { describeError } from './github';
import type { LoadRun, Snapshot } from './github';

export function useRun(load: LoadRun, interval: number, paused: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number>();
  const refresh = useRef(() => {});

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let loading = false;
    let failures = 0;
    async function fetchRun() {
      if (loading || controller.signal.aborted) return;
      clearTimeout(timer);
      loading = true;
      setBusy(true);
      let complete = false;
      try {
        const next = await load(controller.signal);
        if (controller.signal.aborted) return;
        setSnapshot(next);
        setUpdatedAt(Date.now());
        setError(undefined);
        failures = 0;
        complete = next.run.status === 'completed';
      } catch (error) {
        if (controller.signal.aborted) return;
        failures++;
        setError(describeError(error));
      } finally {
        loading = false;
        if (!controller.signal.aborted) {
          setBusy(false);
          if (!paused && !complete) timer = setTimeout(fetchRun, Math.max(interval, Math.min(interval * 2 ** failures, 300_000)));
        }
      }
    }
    refresh.current = () => { void fetchRun(); };
    if (!paused) void fetchRun();
    else setBusy(false);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load, interval, paused]);

  return { snapshot, error, busy, updatedAt, refresh: () => refresh.current() };
}
