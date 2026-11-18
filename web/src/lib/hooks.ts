import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Load async data. `deps` re-trigger the load. Optional `pollMs` refreshes in
 * the background (no loading flash). Returns { data, error, loading, reload, setData }.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (background: boolean) => {
    if (!background) setLoading(true);
    try {
      const v = await fnRef.current();
      setData(v);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run(false);
    if (!opts.pollMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") run(true);
    }, opts.pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: () => run(true), setData };
}

/** Persist a small piece of UI state per browser (e.g. last project, chart range). */
export function useLocalState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setV(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
    },
    [key],
  );
  return [v, set] as const;
}
