/**
 * dates.js — Utilidades de fechas en formato ISO local (YYYY-MM-DD).
 * Se evita Date.parse de cadenas sin hora para no depender de la zona horaria.
 */

export function toISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromISO(iso) {
    if (!iso) return new Date(NaN);
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO() {
    return toISO(new Date());
}

export function addDays(iso, days) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + days);
    return toISO(d);
}

export function eachDate(inicio, fin, callback) {
    if (!inicio || !fin) return;
    const end = fromISO(fin);
    let cur = fromISO(inicio);
    let guard = 0;
    while (cur <= end && guard++ < 4000) {
        callback(toISO(cur));
        cur.setDate(cur.getDate() + 1);
    }
}

export function daysBetween(a, b) {
    return Math.round((fromISO(b) - fromISO(a)) / 86400000);
}

export function isBetween(iso, inicio, fin) {
    return !!iso && iso >= inicio && iso <= fin;
}

export function startOfWeek(iso) {
    const d = fromISO(iso);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return toISO(d);
}

export function weekdayIndex(iso) {
    const dow = fromISO(iso).getDay();
    return dow === 0 ? 7 : dow; // 1 lunes ... 7 domingo
}

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function fmtDate(iso, options = {}) {
    if (!iso) return '—';
    return fromISO(iso).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...options
    });
}

export function fmtDateShort(iso) {
    return fmtDate(iso, { year: undefined });
}

export function fmtDateLong(iso) {
    if (!iso) return '—';
    const s = fromISO(iso).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtMonthYear(year, month) {
    const s = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtTimeRange(inicio, fin) {
    return `${inicio || '—'}–${fin || '—'}`;
}

export function relativeDays(iso) {
    const diff = daysBetween(todayISO(), iso);
    if (Number.isNaN(diff)) return '';
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'mañana';
    if (diff === -1) return 'ayer';
    if (diff > 1) return `en ${diff} días`;
    return `hace ${Math.abs(diff)} días`;
}

export function monthMatrix(year, month) {
    const first = new Date(year, month, 1);
    const firstDow = (first.getDay() + 6) % 7; // 0 = lunes
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

export function sortByDate(a, b, key = 'fecha') {
    return String(a[key] || '').localeCompare(String(b[key] || ''));
}

export function isoToDateTime(iso, time) {
    return `${iso}T${time || '00:00'}:00`;
}

export function icsDate(iso, time) {
    return `${iso.replaceAll('-', '')}T${(time || '00:00').replace(':', '')}00`;
}
