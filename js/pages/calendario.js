/**
 * Calendario — vista mensual unificada de faltas, exámenes y días no lectivos.
 */
import { mountShell } from '../ui/shell.js';
import * as Store from '../core/store.js';
import {
    nonTeachingForDate, periodForDate, evalForDate, classBlocksForDate,
    examsForDate, absencesForDate, faldaHours
} from '../core/stats.js';
import {
    todayISO, monthMatrix, fromISO, fmtMonthYear, fmtDateLong, fmtDateShort,
    WEEKDAYS_SHORT, relativeDays
} from '../core/dates.js';
import {
    icon, escapeHtml, emptyState, subjectName, subjectShort, subjectColor, formatHours,
    toast, confirmDialog
} from '../ui/ui.js';
import { openFaltaForm, openExamenForm } from '../ui/forms.js';
import { PERIOD_COLOR } from '../core/model.js';

const content = mountShell({ active: 'calendario', title: 'Calendario', subtitle: 'Faltas, exámenes y festivos' });
const now = new Date();
const state = {
    year: now.getFullYear(),
    month: now.getMonth(),
    selected: todayISO(),
    showAbsences: true,
    showExams: true
};

function profile() { return Store.getActiveProfile(); }
function data() { return Store.getData(); }

function monthStats() {
    const p = profile();
    const d = data();
    const prefix = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
    const abs = (d.faltas || []).filter(f => f.fecha.startsWith(prefix));
    const exams = (d.examenes || []).filter(e => e.fecha.startsWith(prefix));
    const cells = monthMatrix(state.year, state.month).filter(Boolean);
    const classDays = cells.filter(iso => !nonTeachingForDate(p, iso) && classBlocksForDate(p, iso).length).length;
    return {
        absHours: abs.reduce((s, f) => s + faldaHours(f), 0),
        absCount: abs.length,
        exams: exams.length,
        classDays
    };
}

function eventsForCell(iso) {
    const p = profile();
    const d = data();
    const events = [];
    if (state.showExams) {
        examsForDate(d, iso).forEach(e => events.push({
            kind: 'exam',
            id: e.id,
            text: e.titulo,
            meta: `${e.horaInicio}–${e.horaFin} · ${subjectShort(p, e.asignaturaId)}`,
            short: `EX ${subjectShort(p, e.asignaturaId)}`,
            title: `${e.titulo} · ${subjectName(p, e.asignaturaId)} · ${e.horaInicio}–${e.horaFin}`,
            color: subjectColor(p, e.asignaturaId)
        }));
    }
    if (state.showAbsences) {
        absencesForDate(d, iso).forEach(f => events.push({
            kind: 'abs',
            id: f.id,
            text: `${subjectName(p, f.asignaturaId)} · ${formatHours(f.horas)} h`,
            short: subjectShort(p, f.asignaturaId),
            title: `${subjectName(p, f.asignaturaId)} · ${formatHours(f.horas)} h`,
            color: subjectColor(p, f.asignaturaId)
        }));
    }
    return events;
}

function renderCell(iso) {
    if (!iso) return '<div class="cal-cell cal-cell--empty"></div>';
    const p = profile();
    const nt = nonTeachingForDate(p, iso);
    const per = periodForDate(p, iso);
    const examWeek = (p.periodos || []).find(x => x.tipo === 'examenes' && iso >= x.inicio && iso <= x.fin) || null;
    const dow = fromISO(iso).getDay();
    const events = eventsForCell(iso);
    const shown = events.slice(0, 2);
    const more = events.length - shown.length;
    const isToday = iso === todayISO();
    const selected = iso === state.selected;
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = nt && (nt.tipo === 'festivo' || nt.tipo === 'vacaciones');
    const isPractice = nt && nt.tipo === 'practicas';
    const isHolidayLike = isHoliday || (isWeekend && !examWeek);
    const badge = examWeek
        ? 'EXAMEN'
        : nt
            ? (isHoliday ? '✕' : isPractice ? 'PRÁCT.' : '✕')
            : (isWeekend ? '✕' : (per && per.inicio === iso ? per.nombre : ''));
    const badgeColor = examWeek
        ? 'var(--exam-week)'
        : isHolidayLike
            ? 'var(--danger)'
            : isPractice
                ? 'var(--warn)'
                : (dow === 0 || dow === 6)
                    ? 'var(--text-3)'
                    : PERIOD_COLOR;
    return `<div class="cal-cell ${nt ? 'cal-cell--off' : ''} ${examWeek ? 'cal-cell--examweek' : ''} ${isHolidayLike ? 'cal-cell--holiday' : ''} ${isPractice ? 'cal-cell--practice' : ''} ${isWeekend ? 'cal-cell--weekend' : ''} ${isToday ? 'cal-cell--today' : ''} ${selected ? 'cal-cell--selected' : ''}" data-date="${iso}" role="button" tabindex="0" aria-label="${fmtDateLong(iso)}${nt ? ` — ${escapeHtml(nt.motivo)}` : ''}${isWeekend ? ' — Fin de semana' : ''}${examWeek ? ` — ${escapeHtml(examWeek.nombre)}` : ''}">
        <div class="cal-cell__top">
            <span class="cal-cell__num">${fromISO(iso).getDate()}</span>
            <span class="cal-cell__badge" style="color:${badgeColor}" title="${escapeHtml(nt?.motivo || examWeek?.nombre || per?.nombre || (isWeekend ? 'Fin de semana' : ''))}">${escapeHtml(badge)}</span>
        </div>
        <div class="cal-cell__events">
            ${shown.map(ev => `<span class="cal-event cal-event--${ev.kind}" style="--event-color:${ev.color}" title="${escapeHtml(ev.title || ev.text)}">
                ${ev.kind === 'exam' ? `<span class="cal-event__icon">${icon('exam', 12)}</span>` : `<span class="subject-dot" style="background:${ev.color};width:5px;height:5px"></span>`}
                <span class="cal-event__body">
                    <span class="cal-event__text">${escapeHtml(ev.text)}</span>
                    ${ev.meta ? `<span class="cal-event__meta">${escapeHtml(ev.meta)}</span>` : ''}
                </span>
                <span class="cal-event__short">${escapeHtml(ev.short || ev.text)}</span>
            </span>`).join('')}
            ${more > 0 ? `<span class="cal-cell__more">+${more} más</span>` : ''}
        </div>
    </div>`;
}

function renderDetail() {
    if (!state.selected) return `<div class="card cal-detail"><p class="text-muted small">Selecciona un día del calendario para ver sus clases y eventos.</p></div>`;
    const p = profile();
    const d = data();
    const iso = state.selected;
    const nt = nonTeachingForDate(p, iso);
    const per = periodForDate(p, iso);
    const ev = evalForDate(p, iso);
    const blocks = classBlocksForDate(p, iso);
    const exams = examsForDate(d, iso);
    const abs = absencesForDate(d, iso);
    const isWeekend = [0, 6].includes(fromISO(iso).getDay());

    const blockRows = blocks.map(b => {
        const absF = abs.find(f => f.asignaturaId === b.asignaturaId);
        return `<div class="list-item">
            <span class="subject-dot" style="background:${subjectColor(p, b.asignaturaId)}"></span>
            <div class="list-item__body">
                <div class="list-item__title">${escapeHtml(subjectName(p, b.asignaturaId))}</div>
                <div class="list-item__meta"><span class="mono">${b.inicio}–${b.fin}</span>${b.aula ? `<span>${escapeHtml(b.aula)}</span>` : ''}${absF ? '<span class="badge badge--danger">Falta registrada</span>' : ''}</div>
            </div>
            ${absF ? `<button class="btn-icon" data-edit-falta="${absF.id}" title="Editar falta">${icon('edit', 15)}</button>` : `<button class="btn btn--ghost btn--sm" data-add-abs="${b.asignaturaId}" data-start="${b.inicio}" data-end="${b.fin}">+ Falta</button>`}
        </div>`;
    }).join('');

    const examRows = exams.map(e => `<div class="list-item">
        <span class="subject-dot" style="background:${subjectColor(p, e.asignaturaId)}"></span>
        <div class="list-item__body">
            <div class="list-item__title">${escapeHtml(e.titulo)}</div>
            <div class="list-item__meta"><span>${escapeHtml(subjectName(p, e.asignaturaId))}</span><span class="mono">${e.horaInicio}–${e.horaFin}</span>${e.aula ? `<span>${escapeHtml(e.aula)}</span>` : ''}${e.nota !== null ? `<span class="badge ${e.nota >= 5 ? 'badge--ok' : 'badge--danger'}">${e.nota}</span>` : ''}</div>
        </div>
        <button class="btn-icon" data-edit-exam="${e.id}" title="Editar examen">${icon('edit', 15)}</button>
    </div>`).join('');

    const absRows = abs.map(f => `<div class="list-item">
        <span class="subject-dot" style="background:${subjectColor(p, f.asignaturaId)}"></span>
        <div class="list-item__body">
            <div class="list-item__title">${escapeHtml(subjectName(p, f.asignaturaId))}</div>
            <div class="list-item__meta"><span>${formatHours(f.horas)} h</span><span class="badge ${f.tipo === 'justificada' ? 'badge--info' : f.tipo === 'retraso' ? 'badge--warning' : 'badge--muted'}">${f.tipo}</span>${f.nota ? `<span>${escapeHtml(f.nota)}</span>` : ''}</div>
        </div>
        <div class="flex">
            <button class="btn-icon" data-edit-falta="${f.id}" title="Editar falta">${icon('edit', 15)}</button>
            <button class="btn-icon btn-icon--danger" data-del-falta="${f.id}" title="Eliminar falta">${icon('trash', 15)}</button>
        </div>
    </div>`).join('');

    return `<section class="card cal-detail">
        <div class="flex flex--between flex--wrap">
            <div>
                <h3>${escapeHtml(fmtDateLong(iso))}</h3>
                <div class="flex flex--wrap mt-8">
                    ${ev ? `<span class="badge badge--info">${escapeHtml(ev.nombre)}</span>` : ''}
                    ${per ? `<span class="badge" style="color:${per.tipo === 'examenes' ? 'var(--exam-week)' : PERIOD_COLOR};border-color:${per.tipo === 'examenes' ? 'var(--exam-week)' : PERIOD_COLOR};background:transparent">${escapeHtml(per.nombre)}</span>` : ''}
                    ${nt ? `<span class="badge ${nt.tipo === 'festivo' || nt.tipo === 'vacaciones' ? 'badge--danger' : 'badge--warning'}">${escapeHtml(nt.motivo)}</span>` : ''}
                    ${isWeekend && !nt ? '<span class="badge badge--danger">Fin de semana</span>' : ''}
                    <span class="small text-muted">${relativeDays(iso)}</span>
                </div>
            </div>
            <div class="flex flex--wrap">
                <button class="btn btn--ghost btn--sm" data-add-abs="">${icon('plus', 15)} Falta</button>
                <button class="btn btn--primary btn--sm" data-add-exam-date>${icon('plus', 15)} Examen</button>
            </div>
        </div>

        ${nt ? `<div class="calc-alert ${nt.tipo === 'festivo' || nt.tipo === 'vacaciones' ? 'calc-alert--danger' : 'calc-alert--warning'} mt-16">${icon('info', 16)} <span>${escapeHtml(nt.motivo)}. No hay clases programadas este día.</span></div>` : isWeekend ? `<div class="calc-alert calc-alert--danger mt-16">${icon('info', 16)} <span>Fin de semana. No hay clases programadas este día.</span></div>` : ''}

        ${blocks.length ? `<div class="cal-detail__section mt-16"><h4>Clases (${blocks.length})</h4><div class="list">${blockRows}</div></div>` : ''}
        ${exams.length ? `<div class="cal-detail__section mt-16"><h4>Exámenes y entregas</h4><div class="list">${examRows}</div></div>` : ''}
        ${abs.length ? `<div class="cal-detail__section mt-16"><h4>Faltas registradas</h4><div class="list">${absRows}</div></div>` : ''}
        ${!blocks.length && !exams.length && !abs.length && !nt ? '<p class="small text-muted mt-16">No hay eventos para este día.</p>' : ''}
    </section>`;
}

function render() {
    const p = profile();
    const cells = monthMatrix(state.year, state.month);
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Calendario</h2>
                <p>Faltas, exámenes, festivos y periodos en una sola vista. Pulsa un día para ver el detalle.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn--ghost" data-print>${icon('printer', 16)} Imprimir</button>
                <button class="btn btn--primary" data-add-exam>${icon('plus', 16)} Nuevo examen</button>
            </div>
        </div>

        <section class="card">
            <div class="calendar-toolbar">
                <div class="flex">
                    <button class="btn-icon" data-prev aria-label="Mes anterior">${icon('chevronLeft')}</button>
                    <span class="calendar-title">${fmtMonthYear(state.year, state.month)}</span>
                    <button class="btn-icon" data-next aria-label="Mes siguiente">${icon('chevronRight')}</button>
                    <button class="btn btn--ghost btn--sm" data-today>Hoy</button>
                </div>
                <div class="flex flex--wrap">
                    <button class="btn btn--ghost btn--sm ${state.showAbsences ? 'is-on' : ''}" data-toggle-abs>${icon('clipboard', 14)} Faltas</button>
                    <button class="btn btn--ghost btn--sm ${state.showExams ? 'is-on' : ''}" data-toggle-exams>${icon('exam', 14)} Exámenes</button>
                </div>
            </div>
            <div class="calendar-legend mt-12">
                <span class="calendar-legend__item"><span class="subject-dot" style="background:var(--danger)"></span> Falta</span>
                <span class="calendar-legend__item" style="color:var(--accent)">${icon('exam', 13)} Examen</span>
                <span class="calendar-legend__item"><span class="cal-legend-square cal-legend-square--holiday"></span> Festivo / fin de semana</span>
                <span class="calendar-legend__item"><span class="cal-legend-square cal-legend-square--exam"></span> Semana de exámenes</span>
                <span class="calendar-legend__item"><span class="cal-legend-square cal-legend-square--practice"></span> Prácticas</span>
            </div>
            <div class="calendar mt-12">
                <div class="calendar__head">${WEEKDAYS_SHORT.map(d => `<div>${d}</div>`).join('')}</div>
                <div class="calendar__grid">${cells.map(renderCell).join('')}</div>
            </div>
        </section>

        ${renderDetail()}
    `;
}

content.addEventListener('click', async e => {
    const cell = e.target.closest('[data-date]');
    if (cell) { state.selected = cell.dataset.date; render(); return; }
    if (e.target.closest('[data-prev]')) {
        state.month--;
        if (state.month < 0) { state.month = 11; state.year--; }
        state.selected = `${state.year}-${String(state.month + 1).padStart(2, '0')}-01`;
        render();
        return;
    }
    if (e.target.closest('[data-next]')) {
        state.month++;
        if (state.month > 11) { state.month = 0; state.year++; }
        state.selected = `${state.year}-${String(state.month + 1).padStart(2, '0')}-01`;
        render();
        return;
    }
    if (e.target.closest('[data-today]')) {
        const t = new Date();
        state.year = t.getFullYear();
        state.month = t.getMonth();
        state.selected = todayISO();
        render();
        return;
    }
    if (e.target.closest('[data-toggle-abs]')) { state.showAbsences = !state.showAbsences; render(); return; }
    if (e.target.closest('[data-toggle-exams]')) { state.showExams = !state.showExams; render(); return; }
    if (e.target.closest('[data-print]')) { window.print(); return; }
    if (e.target.closest('[data-add-exam]') || e.target.closest('[data-add-exam-date]')) {
        openExamenForm({ date: state.selected, onSaved: () => render() });
        return;
    }
    if (e.target.closest('[data-add-abs]')) {
        const btn = e.target.closest('[data-add-abs]');
        const start = btn.dataset.start;
        const end = btn.dataset.end;
        const horas = start && end ? Math.max(0.5, (Number(end.split(':')[0]) * 60 + Number(end.split(':')[1]) - Number(start.split(':')[0]) * 60 - Number(start.split(':')[1])) / 60) : 2;
        openFaltaForm({
            date: state.selected,
            initial: btn.dataset.addAbs ? { asignaturaId: btn.dataset.addAbs, fecha: state.selected, horas, tipo: 'injustificada' } : null,
            onSaved: () => render()
        });
        return;
    }
    const edit = e.target.closest('[data-edit-falta]');
    if (edit) {
        const f = data().faltas.find(x => x.id === edit.dataset.editFalta);
        if (f) openFaltaForm({ initial: f, onSaved: () => render() });
        return;
    }
    const editExam = e.target.closest('[data-edit-exam]');
    if (editExam) {
        const exam = data().examenes.find(x => x.id === editExam.dataset.editExam);
        if (exam) openExamenForm({ initial: exam, onSaved: () => render() });
        return;
    }
    const del = e.target.closest('[data-del-falta]');
    if (del) {
        const ok = await confirmDialog({ title: 'Eliminar falta', message: 'Se moverá a la papelera durante 7 días.', confirmText: 'Eliminar', danger: true });
        if (!ok) return;
        Store.deleteFalta(del.dataset.delFalta);
        render();
        toast('Falta movida a la papelera', 'info');
    }
});

content.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-date]')) {
        e.preventDefault();
        e.target.click();
    }
});

Store.subscribe(event => {
    if (event.source === 'remote') render();
});

render();
