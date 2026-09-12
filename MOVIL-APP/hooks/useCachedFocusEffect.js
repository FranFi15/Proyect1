import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

const DEFAULT_TTL_MS = 60_000;

/**
 * Runs a loader when the screen gains focus, but skips the network call
 * when a recent fetch already completed for this screen.
 *
 * load({ isInitial }) — isInitial is true before the first successful load
 * (use that for full-screen spinners). Pull-to-refresh should use refresh().
 */
export function useCachedFocusEffect(load, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const lastFetchedAt = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const invalidate = useCallback(() => {
    lastFetchedAt.current = 0;
  }, []);

  const runLoad = useCallback(async ({ force = false } = {}) => {
    const hasLoaded = lastFetchedAt.current > 0;
    const isFresh = Date.now() - lastFetchedAt.current < ttlMs;
    if (!force && hasLoaded && isFresh) return;

    const result = await loadRef.current({ isInitial: !hasLoaded });
    // Allow loaders to abort without caching (e.g. user not ready yet)
    if (result === false) return;
    lastFetchedAt.current = Date.now();
  }, [ttlMs]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!active) return;
        await runLoad({ force: false });
      })();
      return () => {
        active = false;
      };
    }, [runLoad])
  );

  const refresh = useCallback(async () => {
    await runLoad({ force: true });
  }, [runLoad]);

  return { invalidate, refresh };
}

export { DEFAULT_TTL_MS };
