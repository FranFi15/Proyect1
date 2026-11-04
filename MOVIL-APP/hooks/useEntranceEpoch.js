import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { FadeInUp } from 'react-native-reanimated';

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

/**
 * Web static/SSR: skip entrance animations until after hydration so Reanimated
 * doesn't emit opacity/transform that diverge from the server HTML (React #418).
 */
export const useEntranceAllowed = () => {
    const [allowed, setAllowed] = useState(() => Platform.OS !== 'web');
    useEffect(() => {
        setAllowed(true);
    }, []);
    return allowed;
};

/** Staggered FadeInUp helper for forms/screens; no-op until web has hydrated. */
export const useStaggerEnter = (stepMs = 45, duration = 280) => {
    const allowed = useEntranceAllowed();
    return (index = 0) =>
        allowed
            ? FadeInUp.delay(Math.min(Number(index) || 0, 8) * stepMs).duration(duration)
            : undefined;
};

/** Flipped true after web hydration (see RootLayout). Native stays ready. */
let webEntrancesReady = Platform.OS !== 'web';

export const markWebEntrancesReady = () => {
    webEntrancesReady = true;
};

/** Module-level set so recycled FlatList rows don't re-fire entrance animations. */
const seenEntrances = new Set();

export const shouldPlayEntrance = (token, allowed = true) => {
    if (Platform.OS === 'web' && !webEntrancesReady) return false;
    if (!allowed || !token || seenEntrances.has(token)) return false;
    seenEntrances.add(token);
    // Soft cap so long sessions don't grow forever
    if (seenEntrances.size > 800) {
        const keep = [...seenEntrances].slice(-400);
        seenEntrances.clear();
        keep.forEach((k) => seenEntrances.add(k));
    }
    return true;
};
