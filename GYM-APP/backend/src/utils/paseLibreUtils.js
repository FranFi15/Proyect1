/**
 * Calendar-day helpers for Acceso Libre validity vs class dates.
 * Compares YYYY-MM-DD so time-of-day / timezone on `paseLibreDesde` cannot
 * reject a class that falls on a valid calendar day.
 */

export const toDateKey = (value) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().substring(0, 10);
};

/**
 * @returns {{ valid: boolean, reason: 'ok'|'none'|'before_start'|'after_end', desde?: Date, hasta?: Date }}
 */
export const evaluatePaseLibreForClassDate = (user, classFecha) => {
    const turnoKey = toDateKey(classFecha);
    const hastaKey = toDateKey(user?.paseLibreHasta);

    if (!turnoKey || !hastaKey) {
        return { valid: false, reason: 'none' };
    }

    if (turnoKey > hastaKey) {
        return { valid: false, reason: 'after_end', hasta: user.paseLibreHasta };
    }

    const desdeKey = toDateKey(user?.paseLibreDesde);
    if (desdeKey && turnoKey < desdeKey) {
        return { valid: false, reason: 'before_start', desde: user.paseLibreDesde, hasta: user.paseLibreHasta };
    }

    return { valid: true, reason: 'ok', desde: user.paseLibreDesde, hasta: user.paseLibreHasta };
};

export const hasValidPaseLibreForDate = (user, classFecha) =>
    evaluatePaseLibreForClassDate(user, classFecha).valid;
