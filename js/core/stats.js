/**
 * stats.js — Cálculo de horas lectivas, asistencia, riesgo y notas.
 * Todo se deriva del perfil (horario + evaluaciones + no lectivos).
 */
import { eachDate, fromISO, todayISO, weekdayIndex } from './dates.js';
import { durationHours, timeToMin } from './model.js';

const totalsCache = new WeakMap();

export function nonTeachingForDate(profile, iso) {
    // Las semanas de exámenes son lectivas: si coinciden con un festivo o
    // un rango no lectivo, el periodo de exámenes tiene prioridad.
    const examPeriod = (profile.periodos || []).find(
        p => p.tipo === 'examenes' && iso >= p.inicio && iso <= p.fin
    );
    if (examPeriod) return null;

    return (profile.noLectivos || []).find(n => iso >= n.inicio && iso <= n.fin) || null;
}

export function evalForDate(profile, iso) {
    return (profile.evaluaciones || []).find(e => iso >= e.inicio && iso <= e.fin) || null;
}

export function periodForDate(profile, iso) {
    const periods = (profile.periodos || []).filter(p => iso >= p.inicio && iso <= p.fin);
    return periods.find(p => p.tipo === 'examenes') || periods[0] || null;
}

export function scheduleForDay(profile, iso) {
    const dow = weekdayIndex(iso);
    return (profile.horario || [])
        .filter(b => Number(b.dia) === dow)
        .sort((a, b) => timeToMin(a.inicio) - timeToMin(b.inicio));
}

export function classBlocksForDate(profile, iso) {
    if (nonTeachingForDate(profile, iso)) return [];
    return scheduleForDay(profile, iso).filter(b => b.tipo === 'clase' && b.asignaturaId);
}

export function hoursForDate(profile, subjectId, iso) {
    if (nonTeachingForDate(profile, iso)) return 0;
    return scheduleForDay(profile, iso)
        .filter(b => b.tipo === 'clase' && b.asignaturaId === subjectId)
        .reduce((sum, b) => sum + durationHours(b.inicio, b.fin), 0);
}

export function hoursBetween(profile, subjectId, inicio, fin) {
    let total = 0;
    eachDate(inicio, fin, iso => { total += hoursForDate(profile, subjectId, iso); });
    return round(total);
}

function round(n) {
    return Math.round(n * 100) / 100;
}

/** Totales por asignatura y evaluación (más el global sin duplicar días). */
export function totalsForProfile(profile) {
    if (totalsCache.has(profile)) return totalsCache.get(profile);

    const result = {};
    const evalDates = new Set();
    (profile.evaluaciones || []).forEach(e => eachDate(e.inicio, e.fin, iso => evalDates.add(iso)));
    const globalDates = [...evalDates].sort();

    (profile.asignaturas || []).forEach(asig => {
        const evals = {};
        (profile.evaluaciones || []).forEach(e => {
            evals[e.id] = hoursBetween(profile, asig.id, e.inicio, e.fin);
        });
        let global = 0;
        globalDates.forEach(iso => { global += hoursForDate(profile, asig.id, iso); });
        result[asig.id] = { evals, global: round(global) };
    });

    totalsCache.set(profile, result);
    return result;
}

export function totalForSubject(profile, subjectId, evalId = 'global') {
    const totals = totalsForProfile(profile)[subjectId];
    if (!totals) return 0;
    return evalId === 'global' ? totals.global : (totals.evals[evalId] || 0);
}

export function totalForPeriod(profile, period, subjectId = null) {
    const subjects = subjectId ? [subjectId] : (profile.asignaturas || []).map(a => a.id);
    return round(subjects.reduce((sum, id) => sum + hoursBetween(profile, id, period.inicio, period.fin), 0));
}

export function weeklyHours(profile) {
    const out = {};
    (profile.asignaturas || []).forEach(a => { out[a.id] = 0; });
    (profile.horario || []).forEach(b => {
        if (b.tipo === 'clase' && b.asignaturaId && out[b.asignaturaId] !== undefined) {
            out[b.asignaturaId] += durationHours(b.inicio, b.fin);
        }
    });
    Object.keys(out).forEach(k => { out[k] = round(out[k]); });
    return out;
}

export function faldaHours(f) {
    if (f.tipo === 'retraso' && f.minutosRetraso) return f.minutosRetraso / 60;
    return Number(f.horas) || 0;
}

export function countedAbsences(faltas, profile) {
    return faltas.filter(f => {
        if (f.tipo === 'justificada' && !profile.contarJustificadas) return false;
        if (f.tipo === 'retraso' && !profile.contarRetrasos) return false;
        return true;
    });
}

export function absencesForSubject(data, subjectId, evalId = 'global') {
    return (data.faltas || []).filter(f => {
        if (f.asignaturaId !== subjectId) return false;
        if (evalId === 'global') return true;
        return f.evaluacionId === evalId;
    });
}

export function calcSubjectStats(profile, data, subjectId, evalId = 'global', extraHours = 0) {
    const asig = (profile.asignaturas || []).find(a => a.id === subjectId);
    const totalH = totalForSubject(profile, subjectId, evalId);
    const all = absencesForSubject(data, subjectId, evalId);
    const counted = countedAbsences(all, profile);
    const horasFaltadas = round(counted.reduce((s, f) => s + faldaHours(f), 0) + extraHours);
    const horasJustificadas = round(all.filter(f => f.tipo === 'justificada').reduce((s, f) => s + faldaHours(f), 0));
    const horasInjustificadas = round(all.filter(f => f.tipo === 'injustificada').reduce((s, f) => s + faldaHours(f), 0));
    const horasRetraso = round(all.filter(f => f.tipo === 'retraso').reduce((s, f) => s + faldaHours(f), 0));
    const limitePct = asig?.limitePct ?? profile.limiteFaltasPct ?? 20;
    const limiteH = round(totalH * limitePct / 100);
    const pct = totalH > 0 ? (horasFaltadas / totalH) * 100 : 0;
    const horasRestantes = Math.max(0, round(limiteH - horasFaltadas));
    let estado = 'ok';
    if (horasFaltadas >= limiteH && limiteH > 0) estado = 'danger';
    else if (horasFaltadas >= limiteH / 2 && limiteH > 0) estado = 'warning';

    return {
        subjectId, asig, totalH, horasFaltadas, horasJustificadas, horasInjustificadas,
        horasRetraso, pct, limitePct, limiteH, horasRestantes, estado,
        pctLimite: limiteH > 0 ? Math.min(999, (horasFaltadas / limiteH) * 100) : 0,
        count: all.length
    };
}

export function calcPeriodStats(profile, data, period, extraHours = 0) {
    const totalH = totalForPeriod(profile, period);
    const all = (data.faltas || []).filter(f => f.fecha >= period.inicio && f.fecha <= period.fin);
    const counted = countedAbsences(all, profile);
    const horasFaltadas = round(counted.reduce((s, f) => s + faldaHours(f), 0) + extraHours);
    const limiteH = round(totalH * (profile.limiteFaltasPct || 20) / 100);
    const pct = totalH > 0 ? (horasFaltadas / totalH) * 100 : 0;
    const horasRestantes = Math.max(0, round(limiteH - horasFaltadas));
    let estado = 'ok';
    if (horasFaltadas >= limiteH && limiteH > 0) estado = 'danger';
    else if (horasFaltadas >= limiteH / 2 && limiteH > 0) estado = 'warning';
    return {
        period, totalH, horasFaltadas, pct, limiteH, horasRestantes, estado,
        pctLimite: limiteH > 0 ? Math.min(999, (horasFaltadas / limiteH) * 100) : 0
    };
}

export function subjectStatsList(profile, data, evalId = 'global') {
    return (profile.asignaturas || []).map(a => calcSubjectStats(profile, data, a.id, evalId));
}

export function summaryForEval(profile, data, evalId = 'global') {
    const list = subjectStatsList(profile, data, evalId);
    return {
        totalH: round(list.reduce((s, x) => s + x.totalH, 0)),
        horasFaltadas: round(list.reduce((s, x) => s + x.horasFaltadas, 0)),
        enRiesgo: list.filter(x => x.estado !== 'ok').length,
        enPeligro: list.filter(x => x.estado === 'danger').length,
        asignaturas: list.length
    };
}

export function remainingLectivas(profile, subjectId, evalId) {
    if (evalId === 'global') return 0;
    const ev = (profile.evaluaciones || []).find(e => e.id === evalId);
    if (!ev) return 0;
    const hoy = todayISO();
    if (hoy > ev.fin) return 0;
    return hoursBetween(profile, subjectId, hoy > ev.inicio ? hoy : ev.inicio, ev.fin);
}

export function currentEval(profile, iso = todayISO()) {
    return evalForDate(profile, iso) || (profile.evaluaciones || [])[0] || null;
}

export function upcomingExams(data, profile, from = todayISO(), limit = 50) {
    return (data.examenes || [])
        .filter(e => e.fecha >= from)
        .sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio))
        .slice(0, limit);
}

export function examsForDate(data, iso) {
    return (data.examenes || [])
        .filter(e => e.fecha === iso)
        .sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
}

export function absencesForDate(data, iso) {
    return (data.faltas || [])
        .filter(f => f.fecha === iso)
        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
}

export function subjectAverage(profile, data, subjectId) {
    const exams = (data.examenes || []).filter(e => e.asignaturaId === subjectId && e.nota !== null && !Number.isNaN(e.nota));
    if (!exams.length) return null;
    const weighted = exams.filter(e => Number(e.peso) > 0);
    if (weighted.length) {
        const weight = weighted.reduce((s, e) => s + Number(e.peso), 0);
        if (weight > 0) {
            return round(weighted.reduce((s, e) => s + e.nota * Number(e.peso), 0) / weight);
        }
    }
    return round(exams.reduce((s, e) => s + e.nota, 0) / exams.length);
}

/** Bloque de clase que está ocurriendo ahora mismo (o el siguiente). */
export function currentClassInfo(profile, now = new Date()) {
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (nonTeachingForDate(profile, iso)) return { iso, current: null, next: null, nonTeaching: nonTeachingForDate(profile, iso) };
    const mins = now.getHours() * 60 + now.getMinutes();
    const blocks = scheduleForDay(profile, iso);
    const current = blocks.find(b => mins >= timeToMin(b.inicio) && mins < timeToMin(b.fin)) || null;
    const next = blocks.find(b => timeToMin(b.inicio) > mins) || null;
    return { iso, current, next, nonTeaching: null };
}

export function nextClassDate(profile, from = todayISO()) {
    for (let i = 0; i < 21; i++) {
        const d = new Date(from + 'T00:00:00');
        d.setDate(d.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const blocks = classBlocksForDate(profile, iso);
        if (blocks.length) return { iso, blocks };
    }
    return null;
}

export function formatHours(n) {
    const value = Number(n) || 0;
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

export function evalOptions(profile) {
    return (profile.evaluaciones || []).map(e => ({ id: e.id, nombre: e.nombre }));
}

export function shiftDate(iso, months) {
    const d = fromISO(iso);
    d.setMonth(d.getMonth() + months);
    return d;
}
