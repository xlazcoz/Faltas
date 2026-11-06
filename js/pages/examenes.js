/**
 * Exámenes — planificación, notas y media ponderada.
 */
import { mountShell } from '../ui/shell.js';
import * as Store from '../core/store.js';
import { currentEval, subjectAverage, evalForDate } from '../core/stats.js';
import { todayISO, addDays, fmtDateShort, fmtDateLong, relativeDays, icsDate, fromISO } from '../core/dates.js';
import {
    icon, escapeHtml, emptyState, subjectName, subjectColor, formatHours,
    toast, confirmDialog, download, openModal
} from '../ui/ui.js';
import { openExamenForm } from '../ui/forms.js';

const content = mountShell({ active: 'examenes', title: 'Exámenes', subtitle: 'Fechas, entregas y notas' });
const state = { view: 'upcoming', subject: 'all', evalId: 'all' };

function profile() { return Store.getActiveProfile(); }
function data() { return Store.getData(); }

function filtered() {
    const p = profile();
    const d = data();
    const today = todayISO();
    return (d.examenes || [])
        .filter(e => {
            if (state.view === 'upcoming' && e.fecha < today) return false;
            if (state.view === 'past' && e.fecha >= today) return false;
            if (state.subject !== 'all' && e.asignaturaId !== state.subject) return false;
            if (state.evalId !== 'all' && e.evaluacionId !== state.evalId) return false;
            return true;
        })
        .sort((a, b) => {
            const cmp = (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio);
            return state.view === 'past' ? -cmp : cmp;
        });
}

function typeLabel(t) {
    return { examen: 'Examen', entrega: 'Entrega', presentacion: 'Presentación', practica: 'Práctica', otro: 'Otro' }[t] || 'Examen';
}

function summary() {
    const p = profile();
    const d = data();
    const today = todayISO();
    const exams = d.examenes || [];
    const next = exams.filter(e => e.fecha >= today).sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio))[0];
    const week = exams.filter(e => e.fecha >= today && e.fecha <= addDays(today, 7)).length;
    const pending = exams.filter(e => e.nota === null).length;
    const averages = (p.asignaturas || []).map(a => subjectAverage(p, d, a.id)).filter(v => v !== null);
    const avg = averages.length ? averages.reduce((s, v) => s + v, 0) / averages.length : null;
    return { next, week, pending, avg };
}

function examCard(exam) {
    const p = profile();
    const d = fromISO(exam.fecha);
    const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    const dow = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
    const past = exam.fecha < todayISO();
    const grade = exam.nota === null
        ? '<span class="grade--none">—</span>'
        : `<strong class="${exam.nota >= 5 ? 'grade--ok' : 'grade--bad'}">${exam.nota.toFixed(1)}</strong>`;
    return `<article class="exam-card ${past ? 'is-past' : ''}" style="--exam-color:${subjectColor(p, exam.asignaturaId)}">
        <div class="exam-card__date">
            <span class="exam-card__month">${month}</span>
            <span class="exam-card__day">${d.getDate()}</span>
            <span class="exam-card__dow">${dow}</span>
        </div>
        <div class="exam-card__body">
            <div class="exam-card__head">
                <div>
                    <div class="exam-card__title">${escapeHtml(exam.titulo)}</div>
                    <div class="exam-card__subject"><span class="subject-dot" style="background:${subjectColor(p, exam.asignaturaId)}"></span>${escapeHtml(subjectName(p, exam.asignaturaId))}</div>
                </div>
                <span class="badge badge--muted">${typeLabel(exam.tipo)}</span>
            </div>
            <div class="exam-card__meta">
                <span>${icon('clock', 13)} ${exam.horaInicio}–${exam.horaFin}</span>
                ${exam.aula ? `<span>${icon('book', 13)} ${escapeHtml(exam.aula)}</span>` : ''}
                <span>${past ? fmtDateShort(exam.fecha) : relativeDays(exam.fecha)}</span>
                ${exam.peso ? `<span>Peso ${exam.peso}%</span>` : ''}
            </div>
            ${exam.temario ? `<div class="exam-card__notes">${escapeHtml(exam.temario)}</div>` : ''}
            ${exam.notas ? `<div class="exam-card__notes text-muted">${escapeHtml(exam.notas)}</div>` : ''}
        </div>
        <div class="exam-card__grade">
            ${grade}
            <small>${exam.nota === null ? 'sin nota' : 'nota'}</small>
        </div>
        <div class="exam-card__actions">
            <button class="btn-icon" data-edit-exam="${exam.id}" title="Editar">${icon('edit', 16)}</button>
            <button class="btn-icon btn-icon--danger" data-del-exam="${exam.id}" title="Eliminar">${icon('trash', 16)}</button>
        </div>
    </article>`;
}

function groupedList(exams) {
    if (!exams.length) {
        return emptyState({
            iconName: 'exam',
            title: state.view === 'past' ? 'Sin exámenes pasados' : 'Sin exámenes próximos',
            text: state.view === 'past' ? 'Los exámenes con nota o fecha pasada aparecerán aquí.' : 'Añade un examen con su fecha, hora y aula para planificarlo.',
            action: state.view === 'upcoming' ? '<button class="btn btn--primary" data-add-exam>Nuevo examen</button>' : ''
        });
    }
    const groups = {};
    exams.forEach(e => {
        const d = fromISO(e.fecha);
        const key = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
    });
    return Object.entries(groups).map(([month, list]) => `
        <div class="month-group">
            <div class="month-group__title">${month.charAt(0).toUpperCase() + month.slice(1)}</div>
            <div class="exam-list">${list.map(examCard).join('')}</div>
        </div>`).join('');
}

function averagesTable() {
    const p = profile();
    const d = data();
    const rows = (p.asignaturas || []).map(a => {
        const exams = (d.examenes || []).filter(e => e.asignaturaId === a.id);
        const graded = exams.filter(e => e.nota !== null);
        const avg = subjectAverage(p, d, a.id);
        return { a, total: exams.length, graded: graded.length, avg };
    });
    return `<div class="table-wrap"><table class="table">
        <thead><tr><th>Asignatura</th><th>Exámenes</th><th>Corregidos</th><th>Media ponderada</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
            <td data-label="Asignatura" class="cell-subject"><span class="subject-dot" style="background:${r.a.color}"></span>${escapeHtml(r.a.nombre)}</td>
            <td data-label="Exámenes" class="mono">${r.total}</td>
            <td data-label="Corregidos" class="mono">${r.graded}</td>
            <td data-label="Media" class="mono">${r.avg === null ? '<span class="text-muted">—</span>' : `<strong class="${r.avg >= 5 ? 'text-ok' : 'text-danger'}">${r.avg.toFixed(2)}</strong>`}</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

function render() {
    const p = profile();
    const s = summary();
    const exams = filtered();
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Exámenes y entregas</h2>
                <p>Planifica cada prueba, guarda la nota y consulta la media ponderada por asignatura.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn--ghost" data-export-ics>${icon('download', 16)} Calendario .ics</button>
                <button class="btn btn--primary" data-add-exam>${icon('plus', 16)} Nuevo examen</button>
            </div>
        </div>

        <div class="grid grid--3">
            <div class="card stat-card"><div class="stat-card__top"><span class="stat-card__label">Próximo examen</span></div><div class="stat-card__value" style="font-size:1.15rem">${s.next ? escapeHtml(relativeDays(s.next.fecha)) : '—'}</div><div class="stat-card__meta">${s.next ? `${escapeHtml(s.next.titulo)} · ${fmtDateShort(s.next.fecha)}` : 'Sin exámenes pendientes'}</div></div>
            <div class="card stat-card"><div class="stat-card__top"><span class="stat-card__label">Esta semana</span></div><div class="stat-card__value">${s.week}</div><div class="stat-card__meta">${s.pending} sin nota · próximos 7 días</div></div>
            <div class="card stat-card"><div class="stat-card__top"><span class="stat-card__label">Media global</span></div><div class="stat-card__value">${s.avg === null ? '—' : s.avg.toFixed(2)}<small> / 10</small></div><div class="stat-card__meta">media de asignaturas</div></div>
        </div>

        <div class="section">
            <div class="section-header">
                <div class="segmented">
                    <button data-view="upcoming" class="${state.view === 'upcoming' ? 'is-active' : ''}">Próximos</button>
                    <button data-view="past" class="${state.view === 'past' ? 'is-active' : ''}">Pasados</button>
                    <button data-view="all" class="${state.view === 'all' ? 'is-active' : ''}">Todos</button>
                </div>
                <div class="flex flex--wrap">
                    <select id="filter-subject" class="filter-select" aria-label="Filtrar por asignatura">
                        <option value="all">Todas las asignaturas</option>
                        ${(p.asignaturas || []).map(a => `<option value="${a.id}" ${state.subject === a.id ? 'selected' : ''}>${escapeHtml(a.nombre)}</option>`).join('')}
                    </select>
                    <select id="filter-eval" class="filter-select" aria-label="Filtrar por evaluación">
                        <option value="all">Todas las evaluaciones</option>
                        ${(p.evaluaciones || []).map(e => `<option value="${e.id}" ${state.evalId === e.id ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')}
                    </select>
                </div>
            </div>
            ${groupedList(exams)}
        </div>

        <div class="section">
            <div class="section-header"><div><h2>Media por asignatura</h2><p>Calculada con los exámenes que tienen nota y peso.</p></div></div>
            ${averagesTable()}
        </div>
    `;
}

function exportICS() {
    const p = profile();
    const exams = (data().examenes || []).filter(e => e.fecha);
    if (!exams.length) return toast('No hay exámenes para exportar', 'error');
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Mi Curso//Examenes//ES',
        'CALSCALE:GREGORIAN'
    ];
    exams.forEach(e => {
        lines.push(
            'BEGIN:VEVENT',
            `UID:${e.id}@mi-curso`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
            `DTSTART:${icsDate(e.fecha, e.horaInicio)}`,
            `DTEND:${icsDate(e.fecha, e.horaFin)}`,
            `SUMMARY:${e.titulo} — ${subjectName(p, e.asignaturaId)}`,
            `DESCRIPTION:${[typeLabel(e.tipo), e.temario, e.notas].filter(Boolean).join(' · ')}`,
            e.aula ? `LOCATION:${e.aula}` : 'LOCATION:',
            'END:VEVENT'
        );
    });
    lines.push('END:VCALENDAR');
    download(`examenes-${p.nombre.replaceAll(/\s+/g, '-').toLowerCase()}.ics`, lines.join('\r\n'), 'text/calendar;charset=utf-8');
    toast('Calendario exportado', 'success');
}

content.addEventListener('click', async e => {
    const view = e.target.closest('[data-view]');
    if (view) { state.view = view.dataset.view; render(); return; }
    if (e.target.closest('[data-add-exam]')) { openExamenForm({ onSaved: () => render() }); return; }
    if (e.target.closest('[data-export-ics]')) { exportICS(); return; }

    const edit = e.target.closest('[data-edit-exam]');
    if (edit) {
        const exam = data().examenes.find(x => x.id === edit.dataset.editExam);
        if (exam) openExamenForm({ initial: exam, onSaved: () => render() });
        return;
    }
    const del = e.target.closest('[data-del-exam]');
    if (del) {
        const ok = await confirmDialog({ title: 'Eliminar examen', message: 'Se eliminará el examen y su nota. Esta acción no se puede deshacer.', confirmText: 'Eliminar', danger: true });
        if (!ok) return;
        Store.deleteExamen(del.dataset.delExam);
        render();
        toast('Examen eliminado', 'info');
    }
});

content.addEventListener('change', e => {
    if (e.target.id === 'filter-subject') { state.subject = e.target.value; render(); }
    if (e.target.id === 'filter-eval') { state.evalId = e.target.value; render(); }
});

document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'n' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        openExamenForm({ onSaved: () => render() });
    }
});

Store.subscribe(event => {
    if (event.source === 'remote') render();
});

render();
