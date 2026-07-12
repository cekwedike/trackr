import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Runs an async loader whenever the screen gains focus (and on demand via reload).
 * Keeps screens in sync with the local database after mutations.
 */
export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await loader();
      setData(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => {
        if (!active) return;
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  return { data, loading, error, reload: load, setData };
}
