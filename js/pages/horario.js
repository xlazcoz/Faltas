/**
 * Horario — rejilla semanal, widget de ahora/próxima clase y apuntes.
 */
import { mountShell } from '../ui/shell.js';
import * as Store from '../core/store.js';
import {
    currentClassInfo, calcSubjectStats, weeklyHours, currentEval,
    nonTeachingForDate
} from '../core/stats.js';
import {
    todayISO, addDays, fromISO, weekdayIndex, WEEKDAYS, WEEKDAYS_SHORT,
    fmtDateShort, fmtDateLong, relativeDays
} from '../core/dates.js';
import { timeToMin, durationHours, minToTime } from '../core/model.js';
import {
    icon, escapeHtml, progress, stateBadge, subjectName, subjectColor, formatHours,
    toast, emptyState
} from '../ui/ui.js';
import { openFaltaForm } from '../ui/forms.js';

const content = mountShell({ active: 'horario', title: 'Horario', subtitle: 'Semana, clases y apuntes' });
const state = { selected: null };

function profile() { return Store.getActiveProfile(); }
function data() { return Store.getData(); }

function daysToShow() {
    const p = profile();
    const max = Math.max(5, ...(p.horario || []).map(b => Number(b.dia) || 1));
    return Array.from({ length: Math.min(7, max) }, (_, i) => i + 1);
}

const SLOT_MIN = 15;
const ROW_HEIGHT = 16;

function scheduleRange(p) {
    const blocks = (p.horario || []).filter(b => b.inicio && b.fin);
    const rawStart = blocks.length ? Math.min(...blocks.map(b => timeToMin(b.inicio))) : 8 * 60;
    const rawEnd = blocks.length ? Math.max(...blocks.map(b => timeToMin(b.fin))) : 14 * 60;
    const start = Math.floor(Math.min(rawStart, 8 * 60) / SLOT_MIN) * SLOT_MIN;
    const end = Math.ceil(Math.max(rawEnd, 14 * 60) / SLOT_MIN) * SLOT_MIN;
    return { start, end };
}

function nowWidget() {
    const p = profile();
    const info = currentClassInfo(p);
    if (info.nonTeaching) {
        return `<div class="now-card now-card--idle">
            <span class="now-dot" style="background:var(--text-3)"></span>
            <div><span class="now-label">Hoy no hay clase</span><span class="now-title">${escapeHtml(info.nonTeaching.motivo)}</span></div>
        </div>`;
    }
    if (info.current) {
        const b = info.current;
        if (b.tipo !== 'clase') {
            const next = info.next;
            return `<div class="now-card now-card--idle">
                <span class="now-dot" style="background:var(--warn)"></span>
                <div><span class="now-label">${b.tipo === 'descanso' ? 'Descanso' : 'Hueco libre'}</span><span class="now-title">${b.tipo === 'descanso' ? '☕ Descanso' : 'Sin clase'}${next ? ` · Siguiente: ${escapeHtml(subjectName(p, next.asignaturaId))} a las ${next.inicio}` : ''}</span></div>
            </div>`;
        }
        const color = subjectColor(p, b.asignaturaId);
        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        const remaining = Math.max(0, timeToMin(b.fin) - mins);
        return `<div class="now-card now-card--live" style="--asig-color:${color}">
            <span class="now-pulse"></span>
            <div>
                <span class="now-label">En clase ahora</span>
                <span class="now-title">${escapeHtml(subjectName(p, b.asignaturaId))} <span class="now-prof">· ${escapeHtml(p.asignaturas.find(a => a.id === b.asignaturaId)?.profesor || '')}</span></span>
            </div>
            <div class="now-time"><span class="now-time__val">${remaining} min</span><span class="now-time__label">hasta ${b.fin}</span></div>
        </div>`;
    }
    if (info.next) {
        const b = info.next;
        const color = subjectColor(p, b.asignaturaId);
        return `<div class="now-card now-card--idle">
            <span class="now-dot" style="background:${color}"></span>
            <div><span class="now-label">Ahora libre</span><span class="now-title">Próxima: ${escapeHtml(subjectName(p, b.asignaturaId))} a las ${b.inicio}</span></div>
        </div>`;
    }
    return `<div class="now-card now-card--idle">
        <span class="now-dot" style="background:var(--text-3)"></span>
        <div><span class="now-label">Ya no quedan clases hoy</span></div>
    </div>`;
}

function blockProgress(b) {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const start = timeToMin(b.inicio);
    const end = timeToMin(b.fin);
    if (mins < start || mins > end || end <= start) return 0;
    return Math.max(0, Math.min(100, ((mins - start) / (end - start)) * 100));
}

function renderGrid() {
    const p = profile();
    if (!(p.horario || []).length) {
        return emptyState({
            iconName: 'schedule',
            title: 'Sin horario configurado',
            text: 'Añade tus bloques de clase para calcular horas y ver la semana.',
            action: '<a class="btn btn--primary" href="ajustes.html#horario">Configurar horario</a>'
        });
    }
    const days = daysToShow();
    const range = scheduleRange(p);
    const slots = (range.end - range.start) / SLOT_MIN;
    const todayDow = weekdayIndex(todayISO());
    const nowInfo = currentClassInfo(p);
    const nowId = nowInfo.current?.id;
    const minWidth = 56 + days.length * 120;
    const selected = state.selected;

    let html = `<div class="schedule-grid" style="grid-template-columns:56px repeat(${days.length},minmax(120px,1fr));grid-template-rows:auto repeat(${slots},${ROW_HEIGHT}px);min-width:${minWidth}px">`;
    html += '<div class="sg-corner"></div>';
    days.forEach(d => {
        html += `<div class="sg-day-header ${d === todayDow ? 'sg-day-header--today' : ''}">${WEEKDAYS[d - 1]}${d === todayDow ? '<span class="sg-today-dot"></span>' : ''}</div>`;
    });

    if (todayDow >= 1 && todayDow <= days.length) {
        html += `<div class="sg-today-band" style="grid-column:${todayDow + 1};grid-row:2 / span ${slots}"></div>`;
    }

    for (let m = range.start; m < range.end; m += 30) {
        const row = (m - range.start) / SLOT_MIN + 2;
        html += `<div class="sg-time" style="grid-column:1;grid-row:${row}">${minToTime(m)}</div>`;
    }

    (p.horario || []).forEach(b => {
        if (!days.includes(Number(b.dia))) return;
        const startMin = Math.max(range.start, timeToMin(b.inicio));
        const endMin = Math.min(range.end, timeToMin(b.fin));
        if (endMin <= startMin) return;
        const row = Math.round((startMin - range.start) / SLOT_MIN) + 2;
        const span = Math.max(1, Math.round((endMin - startMin) / SLOT_MIN));
        const isBreak = b.tipo === 'descanso';
        const isFree = b.tipo === 'libre';
        const color = b.asignaturaId ? subjectColor(p, b.asignaturaId) : 'var(--border-strong)';
        const name = b.asignaturaId ? subjectName(p, b.asignaturaId) : (isBreak ? '☕' : 'Libre');
        const prof = b.asignaturaId ? p.asignaturas.find(a => a.id === b.asignaturaId)?.profesor : '';
        const isNow = b.id === nowId;
        const progress = isNow ? blockProgress(b) : 0;
        const active = selected && b.asignaturaId === selected ? ' sg-block--active' : '';
        const dimmed = selected && b.asignaturaId !== selected ? ' sg-block--dimmed' : '';
        const cls = isBreak ? 'sg-block--break' : isFree ? 'sg-block--libre' : 'sg-block--clase';
        const showProf = !isBreak && !isFree && span >= 4 && prof;
        const showTitle = !(isBreak && span < 2);
        const title = `${name} · ${b.inicio}–${b.fin}`;
        html += `<div class="sg-block ${cls}${active}${dimmed}${isNow ? ' sg-block--now' : ''}"
            style="grid-column:${Number(b.dia) + 1};grid-row:${row} / span ${span};--asig-color:${color}"
            ${b.tipo === 'clase' ? `data-subject="${b.asignaturaId}" role="button" tabindex="0"` : ''}
            title="${escapeHtml(title)}">
            ${isNow ? `<span class="sg-fill" style="height:${progress.toFixed(1)}%"></span>` : ''}
            ${showTitle ? `<span class="sg-block__title">${escapeHtml(name)}</span>` : ''}
            ${showProf ? `<span class="sg-block__prof">${escapeHtml(prof)}</span>` : ''}
        </div>`;
    });

    html += '</div>';
    return html;
}

function renderMobile() {
    const p = profile();
    if (!(p.horario || []).length) return '';
    const days = daysToShow();
    const todayDow = weekdayIndex(todayISO());
    const nowInfo = currentClassInfo(p);
    const nowId = nowInfo.current?.id;
    const selected = state.selected;
    return `<div class="mobile-list">${days.map(d => {
        const blocks = (p.horario || []).filter(b => Number(b.dia) === d).sort((a, b) => timeToMin(a.inicio) - timeToMin(b.inicio));
        if (!blocks.length) return '';
        return `<div class="ml-day ${d === todayDow ? 'ml-day--today' : ''}">
            <div class="ml-day__header">${WEEKDAYS[d - 1]}${d === todayDow ? '<span class="ml-today-badge">Hoy</span>' : ''}</div>
            <div class="ml-day__cards">
                ${blocks.map(b => {
                    if (b.tipo === 'libre') return '';
                    const isBreak = b.tipo === 'descanso';
                    const color = b.asignaturaId ? subjectColor(p, b.asignaturaId) : 'var(--text-3)';
                    const active = selected && b.asignaturaId === selected ? ' ml-card--active' : selected && b.asignaturaId !== selected ? ' ml-card--dimmed' : '';
                    if (isBreak) {
                        return `<div class="ml-card ml-card--break"><span class="ml-card__time">${b.inicio}–${b.fin}</span><span>☕ Descanso</span></div>`;
                    }
                    return `<div class="ml-card ml-card--clase${b.id === nowId ? ' ml-card--now' : ''}${active}" style="--asig-color:${color}" data-subject="${b.asignaturaId}" role="button" tabindex="0">
                        <span class="ml-card__time">${b.inicio}–${b.fin}</span>
                        <span class="ml-card__body"><span class="ml-card__title">${escapeHtml(subjectName(p, b.asignaturaId))}</span><span class="ml-card__prof">${escapeHtml(p.asignaturas.find(a => a.id === b.asignaturaId)?.profesor || '')}</span></span>
                        ${b.id === nowId ? '<span class="ml-now-tag">Ahora</span>' : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('')}</div>`;
}

function renderLegend() {
    const p = profile();
    const hours = weeklyHours(p);
    const max = Math.max(1, ...Object.values(hours));
    return `<div class="legend-list">${[...(p.asignaturas || [])].sort((a, b) => (hours[b.id] || 0) - (hours[a.id] || 0)).map(a => `
        <button class="legend-row ${state.selected === a.id ? 'legend-row--active' : ''}" data-subject="${a.id}" type="button">
            <span class="legend-dot" style="background:${a.color}"></span>
            <span class="legend-name">${escapeHtml(a.nombre)}</span>
            <span class="legend-bar-wrap"><span class="legend-bar" style="width:${(hours[a.id] || 0) / max * 100}%;background:${a.color}"></span></span>
            <span class="legend-hours">${formatHours(hours[a.id] || 0)} h</span>
        </button>`).join('')}</div>`;
}

function nextOccurrence(p, dow, from = todayISO()) {
    let cursor = from;
    for (let i = 0; i < 28; i++) {
        const iso = addDays(cursor, i === 0 ? 0 : 1);
        cursor = iso;
        if (weekdayIndex(iso) !== dow) continue;
        if (nonTeachingForDate(p, iso)) continue;
        return iso;
    }
    return null;
}

function renderInfo() {
    const p = profile();
    const d = data();
    const key = state.selected;
    if (!key) return '';
    const a = (p.asignaturas || []).find(x => x.id === key);
    if (!a) return '';
    const ev = currentEval(p);
    const evalId = ev?.id || 'global';
    const s = calcSubjectStats(p, d, key, evalId);
    const nota = Store.getNota(key);
    const blocks = (p.horario || []).filter(b => b.asignaturaId === key && b.tipo === 'clase');
    const occurrences = blocks.map(b => {
        const iso = nextOccurrence(p, Number(b.dia));
        return { b, iso };
    }).filter(x => x.iso);

    return `<section class="card subject-info mt-24" style="--subject-color:${a.color}" id="subject-info">
        <div class="subject-info__head">
            <span class="subject-info__mark">${escapeHtml((a.corto || a.nombre).slice(0, 3))}</span>
            <div style="flex:1;min-width:0">
                <h3>${escapeHtml(a.nombre)}</h3>
                <p class="small text-muted">${escapeHtml(a.profesor || 'Sin profesor asignado')}${a.limitePct ? ` · Límite ${a.limitePct}%` : ''}</p>
            </div>
            <a class="btn btn--ghost btn--sm" href="faltas.html">Ver en Faltas ${icon('arrowRight', 14)}</a>
            <button class="btn-icon" data-close-subject aria-label="Cerrar">${icon('x', 16)}</button>
        </div>

        <div class="grid grid--2 mt-16">
            <div class="card card--soft">
                <span class="small text-muted">${escapeHtml(ev?.nombre || 'Global')} · horas faltadas</span>
                <div class="stat-card__value" style="font-size:1.55rem">${formatHours(s.horasFaltadas)}<small> / ${formatHours(s.totalH)} h</small></div>
                <div class="flex flex--between mt-8">${stateBadge(s.estado)}<span class="mono small">${s.pct.toFixed(1)}% · quedan ${formatHours(s.horasRestantes)} h</span></div>
                <div class="mt-8">${progress(s.horasFaltadas, s.limiteH || s.totalH, s.estado)}</div>
            </div>
            <div class="card card--soft">
                <span class="small text-muted">Próximas clases</span>
                ${occurrences.length ? `<div class="list mt-8">${occurrences.map(({ b, iso }) => `
                    <div class="list-item">
                        <div class="list-item__body">
                            <div class="list-item__title">${WEEKDAYS[Number(b.dia) - 1]} · ${b.inicio}–${b.fin}</div>
                            <div class="list-item__meta"><span>${fmtDateShort(iso)} · ${relativeDays(iso)}</span>${b.aula ? `<span>${escapeHtml(b.aula)}</span>` : ''}</div>
                        </div>
                        <button class="btn btn--ghost btn--sm" data-quick-falta="${key}" data-quick-date="${iso}" data-quick-hours="${durationHours(b.inicio, b.fin)}">+ Falta</button>
                    </div>`).join('')}</div>` : '<p class="small text-muted mt-8">No hay más clases programadas.</p>'}
            </div>
        </div>

        <div class="notes-grid mt-16">
            <div class="field"><label for="notes-content">Contenido dado / temario</label><textarea id="notes-content" rows="4" placeholder="Lo que se ha explicado en clase…">${escapeHtml(nota.contenido || '')}</textarea></div>
            <div class="field"><label for="notes-pending">Pendiente / deberes</label><textarea id="notes-pending" rows="4" placeholder="Lo que falta por hacer…">${escapeHtml(nota.pendiente || '')}</textarea></div>
        </div>
        <div class="flex flex--wrap mt-12">
            <button class="btn btn--primary btn--sm" data-save-notes="${key}">${icon('save', 15)} Guardar apuntes</button>
            ${nota.updatedAt ? `<span class="small text-muted">Última edición: ${new Date(nota.updatedAt).toLocaleString('es-ES')}</span>` : ''}
        </div>
    </section>`;
}

function renderAll() {
    const p = profile();
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Horario semanal</h2>
                <p>${escapeHtml(p.nombre)}${p.grupo ? ` · ${escapeHtml(p.grupo)}` : ''}. Pulsa una asignatura para ver sus faltas, próximas clases y apuntes.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn--ghost" data-print>${icon('printer', 16)} Imprimir</button>
                <a class="btn" href="ajustes.html#horario">${icon('edit', 16)} Editar horario</a>
                <button class="btn btn--primary" data-add-falta>${icon('plus', 16)} Registrar falta</button>
            </div>
        </div>
        <div id="now-widget">${nowWidget()}</div>
        ${(p.horario || []).length ? `
            <section class="card schedule-panel"><div class="panel-inner">${renderGrid()}</div></section>
            <section class="card schedule-panel-mobile"><div class="panel-inner">${renderMobile()}</div></section>
        ` : `<section class="card">${renderGrid()}</section>`}
        <div class="section">
            <section class="card">
                <div class="section-header" style="margin-bottom:10px"><h3>Horas semanales</h3><span class="small text-muted">Pulsa una asignatura para seleccionarla</span></div>
                ${renderLegend()}
            </section>
        </div>
        ${renderInfo()}
    `;
}

/* Eventos */
content.addEventListener('click', e => {
    const subject = e.target.closest('[data-subject]');
    if (subject) {
        state.selected = state.selected === subject.dataset.subject ? null : subject.dataset.subject;
        renderAll();
        if (state.selected) document.getElementById('subject-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    if (e.target.closest('[data-close-subject]')) { state.selected = null; renderAll(); return; }
    if (e.target.closest('[data-add-falta]')) { openFaltaForm({ onSaved: () => renderAll() }); return; }
    if (e.target.closest('[data-print]')) { window.print(); return; }

    const quick = e.target.closest('[data-quick-falta]');
    if (quick) {
        openFaltaForm({
            date: quick.dataset.quickDate,
            initial: {
                asignaturaId: quick.dataset.quickFalta,
                fecha: quick.dataset.quickDate,
                horas: Number(quick.dataset.quickHours),
                tipo: 'injustificada'
            },
            onSaved: () => renderAll()
        });
        return;
    }

    const save = e.target.closest('[data-save-notes]');
    if (save) {
        Store.setNota(save.dataset.saveNotes, {
            contenido: document.getElementById('notes-content')?.value || '',
            pendiente: document.getElementById('notes-pending')?.value || ''
        });
        toast('Apuntes guardados', 'success');
        renderAll();
    }
});

content.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-subject]')) {
        e.preventDefault();
        e.target.click();
    }
});

document.addEventListener('keydown', e => {
    if (e.key === 'n' || e.key === 'N') {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
        openFaltaForm({ onSaved: () => renderAll() });
    }
});

Store.subscribe(event => {
    if (event.source === 'remote') renderAll();
});

renderAll();
setInterval(() => {
    const el = document.getElementById('now-widget');
    if (el) el.innerHTML = nowWidget();
}, 60000);
