/**
 * Calendar-day helpers for Acceso Libre vs class dates.
 * Uses YYYY-MM-DD keys so time-of-day on `paseLibreDesde` cannot reject a valid day.
 */

export const toDateKey = (value) => {
    if (value == null || value === '') return null;

    // Prefer an explicit YYYY-MM-DD in strings (avoids locale parsing quirks).
    if (typeof value === 'string') {
        const isoDay = value.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (isoDay) return `${isoDay[1]}-${isoDay[2]}-${isoDay[3]}`;
    }

    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().substring(0, 10);
};

const toGymDateKey = (value, timeZone) => {
    if (!value || !timeZone) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    try {
        // en-CA → YYYY-MM-DD
        return new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(d);
    } catch {
        return null;
    }
};

const dayInRange = (dayKey, desdeKey, hastaKey) => {
    if (!dayKey || !hastaKey) return false;
    if (dayKey > hastaKey) return false;
    if (desdeKey && dayKey < desdeKey) return false;
    return true;
};

/**
 * @returns {{
 *   valid: boolean,
 *   reason: 'ok'|'none'|'before_start'|'after_end',
 *   desde?: Date,
 *   hasta?: Date,
 *   classKeys?: string[],
 *   desdeKey?: string|null,
 *   hastaKey?: string|null,
 * }}
 */
export const evaluatePaseLibreForClassDate = (user, classFecha, timeZone = 'America/Argentina/Buenos_Aires') => {
    const hastaKey = toDateKey(user?.paseLibreHasta);
    if (!hastaKey) {
        return { valid: false, reason: 'none', hastaKey: null, desdeKey: null, classKeys: [] };
    }

    const classKeys = [...new Set(
        [toDateKey(classFecha), toGymDateKey(classFecha, timeZone)].filter(Boolean)
    )];

    if (classKeys.length === 0) {
        return {
            valid: false,
            reason: 'none',
            hasta: user.paseLibreHasta,
            hastaKey,
            desdeKey: toDateKey(user?.paseLibreDesde),
            classKeys,
        };
    }

    const desdeKey = toDateKey(user?.paseLibreDesde);

    // Valid if ANY calendar interpretation of the class day falls in range.
    if (classKeys.some((key) => dayInRange(key, desdeKey, hastaKey))) {
        return {
            valid: true,
            reason: 'ok',
            desde: user.paseLibreDesde,
            hasta: user.paseLibreHasta,
            desdeKey,
            hastaKey,
            classKeys,
        };
    }

    if (classKeys.every((key) => key > hastaKey)) {
        return {
            valid: false,
            reason: 'after_end',
            hasta: user.paseLibreHasta,
            desde: user.paseLibreDesde,
            desdeKey,
            hastaKey,
            classKeys,
        };
    }

    if (desdeKey && classKeys.every((key) => key < desdeKey)) {
        return {
            valid: false,
            reason: 'before_start',
            desde: user.paseLibreDesde,
            hasta: user.paseLibreHasta,
            desdeKey,
            hastaKey,
            classKeys,
        };
    }

    return {
        valid: false,
        reason: 'none',
        desde: user.paseLibreDesde,
        hasta: user.paseLibreHasta,
        desdeKey,
        hastaKey,
        classKeys,
    };
};

export const hasValidPaseLibreForDate = (user, classFecha, timeZone) =>
    evaluatePaseLibreForClassDate(user, classFecha, timeZone).valid;

export const formatPaseEvalDebug = (paseEval, classFecha) => {
    const classRaw = classFecha instanceof Date
        ? classFecha.toISOString()
        : String(classFecha ?? '');
    return `turno=${paseEval.classKeys?.join('|') || '?'} (raw ${classRaw}) pase=${paseEval.desdeKey || '—'}→${paseEval.hastaKey || '—'}`;
};
