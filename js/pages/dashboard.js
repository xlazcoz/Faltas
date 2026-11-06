/**
 * Inicio — una vista corta: hoy, próximos exámenes y un resumen mínimo.
 */
import { mountShell } from '../ui/shell.js';
import * as Store from '../core/store.js';
import {
    summaryForEval, currentEval, currentClassInfo, classBlocksForDate,
    nonTeachingForDate, upcomingExams, subjectAverage
} from '../core/stats.js';
import { todayISO, fmtDateLong, fmtDateShort, relativeDays, fromISO } from '../core/dates.js';
import { icon, escapeHtml, subjectName, subjectColor, formatHours, emptyState } from '../ui/ui.js';
import { openFaltaForm, openExamenForm } from '../ui/forms.js';

const content = mountShell({ active: 'inicio', title: 'Inicio' });
const profile = Store.getActiveProfile();
const data = Store.getData();
const today = todayISO();
const evalActual = currentEval(profile) || profile.evaluaciones[0];

function greeting() {
    const h = new Date().getHours();
    if (h < 6) return 'Buenas noches';
    if (h < 13) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
}

function nowBlock() {
    const info = currentClassInfo(profile);
    if (info.nonTeaching) {
        return `<div class="now-card">
            <span class="now-card__label">Hoy no hay clase</span>
            <span class="now-card__title">${escapeHtml(info.nonTeaching.motivo)}</span>
        </div>`;
    }
    if (info.current) {
        const b = info.current;
        if (b.tipo !== 'clase') {
            return `<div class="now-card">
                <span class="now-card__label">${b.tipo === 'descanso' ? 'Descanso' : 'Hueco libre'}</span>
                <span class="now-card__title">${b.tipo === 'descanso' ? 'Descanso' : 'Sin clase'}</span>
                <span class="now-card__time">${b.inicio}–${b.fin}</span>
            </div>`;
        }
        return `<div class="now-card now-card--live">
            <span class="now-card__label">Ahora</span>
            <span class="now-card__subject"><span class="subject-dot" style="background:${subjectColor(profile, b.asignaturaId)}"></span><span class="now-card__title">${escapeHtml(subjectName(profile, b.asignaturaId))}</span></span>
            <span class="now-card__time">${b.inicio}–${b.fin}${b.aula ? ` · ${escapeHtml(b.aula)}` : ''}</span>
        </div>`;
    }
    if (info.next) {
        const b = info.next;
        return `<div class="now-card">
            <span class="now-card__label">Siguiente clase</span>
            <span class="now-card__subject"><span class="subject-dot" style="background:${subjectColor(profile, b.asignaturaId)}"></span><span class="now-card__title">${escapeHtml(subjectName(profile, b.asignaturaId))}</span></span>
            <span class="now-card__time">${b.inicio}–${b.fin}</span>
        </div>`;
    }
    return `<div class="now-card"><span class="now-card__label">Sin más clases hoy</span><span class="now-card__title">Buen trabajo</span></div>`;
}

function examRow(exam) {
    const d = fromISO(exam.fecha);
    const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    return `<div class="list-item">
        <div class="date-tile" style="--exam-color:${subjectColor(profile, exam.asignaturaId)}"><span class="date-tile__month">${month}</span><span class="date-tile__day">${d.getDate()}</span><span class="date-tile__dow">${d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')}</span></div>
        <div class="list-item__body">
            <div class="list-item__title">${escapeHtml(exam.titulo)}</div>
            <div class="list-item__meta"><span>${escapeHtml(subjectName(profile, exam.asignaturaId))}</span><span>${exam.horaInicio}–${exam.horaFin}</span><span>${relativeDays(exam.fecha)}</span></div>
        </div>
    </div>`;
}

function render() {
    if (!profile.asignaturas.length) {
        content.innerHTML = `<div class="card">
            <h2 style="font-size:1.25rem">Configura tu curso</h2>
            <p class="text-soft mt-8">Añade las asignaturas y el horario para empezar a controlar las faltas y los exámenes.</p>
            <a href="ajustes.html" class="btn btn--primary mt-16">${icon('settings', 16)} Ir a ajustes</a>
        </div>`;
        return;
    }

    const summary = summaryForEval(profile, data, evalActual?.id || 'global');
    const blocks = classBlocksForDate(profile, today);
    const exams = upcomingExams(data, profile, today, 3);
    const averages = (profile.asignaturas || []).map(s => subjectAverage(profile, data, s.id)).filter(v => v !== null);
    const average = averages.length ? averages.reduce((s, v) => s + v, 0) / averages.length : null;
    const nt = nonTeachingForDate(profile, today);

    content.innerHTML = `
        <div class="page-header">
            <div>
                <h2>${greeting()}.</h2>
                <p>${fmtDateLong(today)}${profile.grupo ? ` · ${escapeHtml(profile.grupo)}` : ''}</p>
            </div>
            <div class="page-actions">
                <button class="btn btn--ghost" data-add-exam>${icon('plus', 15)} Examen</button>
                <button class="btn btn--primary" data-add-falta>${icon('plus', 15)} Registrar falta</button>
            </div>
        </div>

        ${summary.enRiesgo ? `<div class="calm-note">
            <span>${summary.enRiesgo} ${summary.enRiesgo === 1 ? 'asignatura está' : 'asignaturas están'} en riesgo.</span>
            <a href="faltas.html">Ver detalle ${icon('arrowRight', 14)}</a>
        </div>` : ''}

        <div class="grid grid--wide">
            <section class="card">
                <div class="section-header" style="margin-bottom:12px">
                    <div><h3>Hoy</h3><p>${nt ? escapeHtml(nt.motivo) : blocks.length ? `${blocks.length} ${blocks.length === 1 ? 'clase' : 'clases'}` : 'Sin clases programadas'}</p></div>
                    <a class="small text-soft" href="horario.html">Horario →</a>
                </div>
                ${nt ? `<p class="text-muted small">No hay clases hoy.</p>` : blocks.length ? `
                    <div class="list">
                        ${blocks.map(b => `<div class="list-item">
                            <span class="subject-dot" style="background:${subjectColor(profile, b.asignaturaId)}"></span>
                            <div class="list-item__body">
                                <div class="list-item__title">${escapeHtml(subjectName(profile, b.asignaturaId))}</div>
                                <div class="list-item__meta"><span class="mono">${b.inicio}–${b.fin}</span>${b.aula ? `<span>${escapeHtml(b.aula)}</span>` : ''}</div>
                            </div>
                        </div>`).join('')}
                    </div>` : `<p class="text-muted small">No hay clases programadas para hoy.</p>`}
            </section>

            <div class="grid" style="align-content:start">
                <section class="card">
                    <div class="section-header" style="margin-bottom:10px">
                        <h3>Próximos exámenes</h3>
                        <a class="small text-soft" href="examenes.html">Todos →</a>
                    </div>
                    ${exams.length ? `<div class="list">${exams.map(examRow).join('')}</div>` : `<p class="text-muted small">No hay exámenes próximos.</p>`}
                </section>

                <section class="card">
                    <div class="section-header" style="margin-bottom:10px">
                        <h3>Resumen</h3>
                        <a class="small text-soft" href="faltas.html">Faltas →</a>
                    </div>
                    <div class="summary-line"><span>Horas faltadas</span><strong>${formatHours(summary.horasFaltadas)} / ${formatHours(summary.totalH)} h</strong></div>
                    <div class="summary-line"><span>En riesgo</span><strong class="${summary.enRiesgo ? 'text-warning' : 'text-ok'}">${summary.enRiesgo}</strong></div>
                    <div class="summary-line"><span>Media de exámenes</span><strong>${average === null ? '—' : average.toFixed(2)}</strong></div>
                </section>
            </div>
        </div>
    `;

    document.querySelector('[data-add-falta]')?.addEventListener('click', () => openFaltaForm({ onSaved: () => location.reload() }));
    document.querySelector('[data-add-exam]')?.addEventListener('click', () => openExamenForm({ onSaved: () => location.reload() }));
}

render();
