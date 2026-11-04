import { useMemo } from 'react';

/**
 * Builds a stable entrance epoch for list animations.
 * When deps change (date/filter/tab), cards can animate again.
 */
export const useEntranceEpoch = (...parts) =>
    useMemo(
        () => parts.map((p) => (p == null ? 'x' : String(p))).join('|'),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        parts
    );

/** Module-level set so recycled FlatList rows don't re-fire entrance animations. */
const seenEntrances = new Set();

export const shouldPlayEntrance = (token) => {
    if (!token || seenEntrances.has(token)) return false;
    seenEntrances.add(token);
    // Soft cap so long sessions don't grow forever
    if (seenEntrances.size > 800) {
        const keep = [...seenEntrances].slice(-400);
        seenEntrances.clear();
        keep.forEach((k) => seenEntrances.add(k));
    }
    return true;
};
