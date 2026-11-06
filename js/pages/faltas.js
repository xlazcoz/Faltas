/**
 * Faltas — resumen, gráfico, calculadora e historial.
 */
import { mountShell } from '../ui/shell.js';
import * as Store from '../core/store.js';
import {
    calcSubjectStats, calcPeriodStats, subjectStatsList, summaryForEval,
    currentEval, remainingLectivas, evalForDate
} from '../core/stats.js';
import { fmtDate, fmtDateShort, todayISO, relativeDays } from '../core/dates.js';
import {
    icon, escapeHtml, stateBadge, stateLabel, progress, emptyState, subjectName,
    subjectColor, formatHours, toast, confirmDialog, openModal, download
} from '../ui/ui.js';
import { openFaltaForm } from '../ui/forms.js';
import { PERIOD_COLOR, EXAM_WEEK_COLOR } from '../core/model.js';

const content = mountShell({ active: 'faltas', title: 'Faltas', subtitle: 'Asistencia, riesgo y calculadora' });

const state = {
    evalId: currentEval(Store.getActiveProfile())?.id || 'global',
    tab: 'resumen',
    filter: 'all',
    search: '',
    compact: false,
    calc: null
};

function profile() { return Store.getActiveProfile(); }
function data() { return Store.getData(); }

function hexToRgba(hex, alpha = 0.65) {
    const raw = String(hex || '#00d4ff').replace('#', '').trim();
    const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return `rgba(0, 212, 255, ${alpha})`;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function evalName(id) {
    const p = profile();
    if (id === 'global') return 'Global';
    return (p.evaluaciones || []).find(e => e.id === id)?.nombre || 'Evaluación';
}

function evalTabs() {
    const p = profile();
    return `
        <div class="tabs" role="tablist">
            ${(p.evaluaciones || []).map(e => `<button class="tab ${state.evalId === e.id ? 'is-active' : ''}" data-eval="${e.id}">${escapeHtml(e.nombre)}</button>`).join('')}
            <button class="tab ${state.evalId === 'global' ? 'is-active' : ''}" data-eval="global">Global</button>
        </div>`;
}

function summaryCards() {
    const p = profile();
    const d = data();
    const s = summaryForEval(p, d, state.evalId);
    const pct = s.totalH ? (s.horasFaltadas / s.totalH) * 100 : 0;
    return `<div class="grid grid--3">
        <article class="card stat-card"><div class="stat-card__top"><span class="stat-card__label">Horas totales</span></div><div class="stat-card__value">${formatHours(s.totalH)}<small> h</small></div><div class="stat-card__meta">${escapeHtml(evalName(state.evalId))}</div></article>
        <article class="card stat-card"><div class="stat-card__top"><span class="stat-card__label">Faltadas</span></div><div class="stat-card__value">${formatHours(s.horasFaltadas)}<small> h</small></div><div class="stat-card__meta">${pct.toFixed(1)} % del total</div></article>
        <article class="card stat-card ${s.enRiesgo ? 'stat-card--warning' : 'stat-card--ok'}"><div class="stat-card__top"><span class="stat-card__label">En riesgo</span></div><div class="stat-card__value">${s.enRiesgo}<small> asignaturas</small></div><div class="stat-card__meta">${s.enPeligro} en peligro</div></article>
    </div>`;
}

function resumenPanel() {
    const p = profile();
    const d = data();
    let list = subjectStatsList(p, d, state.evalId);
    if (state.filter === 'warning') list = list.filter(s => s.estado === 'warning');
    if (state.filter === 'danger') list = list.filter(s => s.estado === 'danger');

    const rows = list.map(s => {
        const lect = state.evalId === 'global' ? null : remainingLectivas(p, s.subjectId, state.evalId);
        return `<tr class="${s.estado === 'danger' ? 'is-danger' : s.estado === 'warning' ? 'is-warning' : ''}">
            <td data-label="Asignatura" class="cell-subject"><span class="subject-dot" style="background:${s.asig?.color}"></span>${escapeHtml(s.asig?.nombre || '')}</td>
            <td data-label="Horas" class="mono">${formatHours(s.horasFaltadas)} / ${formatHours(s.totalH)} h</td>
            <td data-label="Progreso"><div class="progress-row">${progress(s.horasFaltadas, s.limiteH || s.totalH, s.estado)}<span class="mono">${s.limiteH ? s.pct.toFixed(1) : '—'}%</span></div></td>
            <td data-label="Estado">${stateBadge(s.estado)}</td>
            <td data-label="Límite" class="mono">${formatHours(s.limiteH)} h · ${s.limitePct}%</td>
            <td data-label="Disponibles" class="mono ${s.horasRestantes === 0 ? 'text-danger' : 'text-ok'}">${formatHours(s.horasRestantes)} h</td>
            <td data-label="Quedan en eval" class="mono">${lect === null ? '—' : `${formatHours(lect)} h`}</td>
        </tr>`;
    }).join('');

    const periods = (p.periodos || [])
        .filter(per => state.evalId === 'global' || evalForDate(p, per.inicio)?.id === state.evalId)
        .map(per => {
            const s = calcPeriodStats(p, d, per);
            return `<tr class="${s.estado === 'danger' ? 'is-danger' : s.estado === 'warning' ? 'is-warning' : ''}">
                <td data-label="Periodo" class="cell-subject"><span class="subject-dot" style="background:${per.tipo === 'examenes' ? 'var(--exam-week)' : PERIOD_COLOR}"></span>${escapeHtml(per.nombre)}</td>
                <td data-label="Fechas" class="mono">${fmtDateShort(per.inicio)} → ${fmtDateShort(per.fin)}</td>
                <td data-label="Horas" class="mono">${formatHours(s.horasFaltadas)} / ${formatHours(s.totalH)} h</td>
                <td data-label="Progreso"><div class="progress-row">${progress(s.horasFaltadas, s.limiteH || s.totalH, s.estado)}<span class="mono">${s.limiteH ? s.pct.toFixed(1) : '—'}%</span></div></td>
                <td data-label="Estado">${stateBadge(s.estado)}</td>
                <td data-label="Disponibles" class="mono ${s.horasRestantes === 0 ? 'text-danger' : 'text-ok'}">${formatHours(s.horasRestantes)} h</td>
            </tr>`;
        }).join('');

    return `
        <div class="section-header">
            <h2>Resumen de asistencia</h2>
            <div class="flex flex--wrap">
                <div class="segmented">
                    <button data-filter="all" class="${state.filter === 'all' ? 'is-active' : ''}">Todas</button>
                    <button data-filter="warning" class="${state.filter === 'warning' ? 'is-active' : ''}">Riesgo</button>
                    <button data-filter="danger" class="${state.filter === 'danger' ? 'is-active' : ''}">Peligro</button>
                </div>
                <button class="btn btn--ghost btn--sm" data-toggle-compact>${icon('filter', 14)} ${state.compact ? 'Vista normal' : 'Vista compacta'}</button>
            </div>
        </div>
        <div class="table-wrap ${state.compact ? 'table-compact' : ''}">
            <table class="table table--subjects">
                <thead><tr><th>Asignatura</th><th>Horas</th><th>Progreso</th><th>Estado</th><th>Límite</th><th>Disponibles</th><th title="Horas lectivas que quedan desde hoy hasta el final de la evaluación">Quedan en eval</th></tr></thead>
                <tbody>${rows || `<tr><td colspan="7">${emptyState({ iconName: 'check', title: 'Sin resultados', text: 'No hay asignaturas que coincidan con este filtro.' })}</td></tr>`}</tbody>
            </table>
        </div>
        <p class="small text-muted mt-8"><strong>Quedan en eval</strong> son las horas de clase que aún te quedan desde hoy hasta el final de la evaluación. Las semanas de exámenes cuentan como horas lectivas.</p>

        <div class="section-header mt-24">
            <div><h2>Periodos</h2><p>Agrupan todas las asignaturas de un proyecto, trimestre, práctica o semana de exámenes.</p></div>
        </div>
        <div class="table-wrap">
            <table class="table">
                <thead><tr><th>Periodo</th><th>Fechas</th><th>Horas</th><th>Progreso</th><th>Estado</th><th>Disponibles</th></tr></thead>
                <tbody>${periods || `<tr><td colspan="6">${emptyState({ iconName: 'calendar', title: 'Sin periodos', text: 'Crea periodos en Ajustes para agrupar las faltas por proyecto o trimestre.' })}</td></tr>`}</tbody>
            </table>
        </div>`;
}

function graphPanel() {
    const p = profile();
    return `<section class="card">
        <div class="section-header">
            <div><h2>Porcentaje de faltas por asignatura</h2><p>Las líneas verticales marcan el riesgo y el límite de peligro. Las barras 🗂 son periodos.</p></div>
        </div>
        <div class="chart-container"><canvas id="chart-canvas"></canvas></div>
        <p class="small text-muted mt-12">Cada barra usa el color de su asignatura. Las erronkas se muestran en turquesa y las semanas de exámenes en amarillo.</p>
    </section>`;
}

function renderChart() {
    const canvas = document.getElementById('chart-canvas');
    if (!canvas) return;
    const p = profile();
    const d = data();

    if (typeof Chart === 'undefined') {
        canvas.parentElement.innerHTML = `<div class="empty-state"><div class="empty-state__icon">${icon('alert', 28)}</div><h3>Gráfico no disponible</h3><p>No se ha podido cargar Chart.js. Puedes seguir usando el resumen y la calculadora.</p></div>`;
        return;
    }

    const entries = subjectStatsList(p, d, state.evalId).map(s => ({
        label: s.asig?.nombre || '',
        pct: s.pct,
        state: s.estado,
        color: s.asig?.color || '#00d4ff',
        horasFaltadas: s.horasFaltadas,
        totalH: s.totalH,
        horasRestantes: s.horasRestantes,
        isPeriod: false,
        periodo: null
    }));

    const periods = (p.periodos || [])
        .filter(per => state.evalId === 'global' || evalForDate(p, per.inicio)?.id === state.evalId)
        .map(per => {
            const s = calcPeriodStats(p, d, per);
            return {
                label: `🗂 ${per.nombre}`,
                pct: s.pct,
                state: s.estado,
                color: per.tipo === 'examenes' ? EXAM_WEEK_COLOR : PERIOD_COLOR,
                horasFaltadas: s.horasFaltadas,
                totalH: s.totalH,
                horasRestantes: s.horasRestantes,
                isPeriod: true,
                periodo: `${fmtDateShort(per.inicio)} → ${fmtDateShort(per.fin)}`
            };
        });

    const all = [...entries, ...periods];
    if (!all.length) {
        canvas.parentElement.innerHTML = emptyState({ iconName: 'book', title: 'Sin datos para el gráfico', text: 'Configura asignaturas y periodos para ver el porcentaje de faltas.' });
        return;
    }

    if (window._chartInstance) {
        window._chartInstance.destroy();
        window._chartInstance = null;
    }

    const labels = all.map(e => e.label);
    const values = all.map(e => parseFloat(e.pct.toFixed(1)));
    const limit = p.limiteFaltasPct || 20;
    const warn = limit / 2;
    const max = Math.max(30, Math.ceil(Math.max(limit, ...values) / 5) * 5);
    const isLight = document.documentElement.dataset.theme === 'light';
    const chartText = isLight ? '#5c6779' : '#8b96b0';
    const chartMuted = isLight ? '#8b95a6' : '#5d6a84';
    const chartGrid = isLight ? 'rgba(30,42,60,0.08)' : 'rgba(255,255,255,0.04)';
    const chartBorder = isLight ? '#dfe4ec' : 'rgba(255,255,255,0.06)';
    const tooltipBg = isLight ? '#ffffff' : '#0f1320';
    const tooltipBorder = isLight ? '#dfe4ec' : 'rgba(0,212,255,0.2)';
    const tooltipTitle = isLight ? '#1d2430' : '#f0f4ff';
    const tooltipBody = isLight ? '#5c6779' : '#8b96b0';

    const bgColors = all.map(e => hexToRgba(e.color, 0.65));
    const bdColors = all.map(e => e.color);

    const refLines = {
        id: 'refLines',
        afterDraw(chart) {
            const { ctx, chartArea, scales: { x } } = chart;
            [
                [warn, 'rgba(255,184,48,0.55)', `${formatHours(warn)}% riesgo`, 1.5],
                [limit, 'rgba(255,64,96,0.7)', `${formatHours(limit)}% peligro`, 2]
            ].forEach(([value, color, label, width]) => {
                const px = x.getPixelForValue(value);
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(px, chartArea.top);
                ctx.lineTo(px, chartArea.bottom);
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                ctx.setLineDash([6, 4]);
                ctx.stroke();
                ctx.font = '11px JetBrains Mono, monospace';
                ctx.fillStyle = color;
                ctx.fillText(label, px + 4, chartArea.top + 14);
                ctx.restore();
            });
        }
    };

    window._chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: bgColors,
                borderColor: bdColors,
                borderWidth: 1.5,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const e = all[ctx.dataIndex];
                            const lines = [`  ${e.pct.toFixed(1)}% faltado`, `  ${formatHours(e.horasFaltadas)} h de ${formatHours(e.totalH)} h`, `  Quedan: ${formatHours(e.horasRestantes)} h`];
                            if (e.isPeriod && e.periodo) lines.push(`  ${e.periodo}`);
                            return lines;
                        },
                        title(ctx) { return ctx[0].label; }
                    },
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    titleColor: tooltipTitle,
                    bodyColor: tooltipBody,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    min: 0,
                    max,
                    ticks: {
                        color: chartMuted,
                        font: { family: 'JetBrains Mono', size: 11 },
                        callback: v => v + '%'
                    },
                    grid: { color: chartGrid },
                    border: { color: chartBorder }
                },
                y: {
                    ticks: { color: chartText, font: { family: 'DM Sans', size: 12 } },
                    grid: { display: false },
                    border: { color: chartBorder }
                }
            }
        },
        plugins: [refLines]
    });
}

function calcular() {
    const p = profile();
    const d = data();
    const subjectId = document.getElementById('calc-subject')?.value;
    const horas = Number(document.getElementById('calc-hours')?.value);
    const periodId = document.getElementById('calc-period')?.value || '';
    if (!subjectId) return toast('Selecciona una asignatura', 'error');
    if (!(horas > 0)) return toast('Indica un número de horas válido', 'error');

    const before = calcSubjectStats(p, d, subjectId, state.evalId);
    const after = calcSubjectStats(p, d, subjectId, state.evalId, horas);
    const sessionHours = Math.min(...(p.horario || []).filter(b => b.asignaturaId === subjectId && b.tipo === 'clase').map(b => {
        const [h1, m1] = b.inicio.split(':').map(Number);
        const [h2, m2] = b.fin.split(':').map(Number);
        return Math.max(0.5, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
    }), 99);
    const classesLeft = sessionHours > 0 ? Math.floor(after.horasRestantes / sessionHours) : null;
    const period = (p.periodos || []).find(x => x.id === periodId);
    const pBefore = period ? calcPeriodStats(p, d, period) : null;
    const pAfter = period ? calcPeriodStats(p, d, period, horas) : null;

    state.calc = { subjectId, horas, before, after, classesLeft, period, pBefore, pAfter };
    render();
}

function calcPanel() {
    const p = profile();
    const s = state.calc;
    const subjectOptions = p.asignaturas.map(a => `<option value="${a.id}" ${s?.subjectId === a.id ? 'selected' : ''}>${escapeHtml(a.nombre)}</option>`).join('');
    const periodOptions = (p.periodos || []).map(per => `<option value="${per.id}">${escapeHtml(per.nombre)}</option>`).join('');

    return `<div class="section-header"><div><h2>Calculadora predictiva</h2><p>Simula cuántas horas puedes faltar antes de entrar en riesgo o superar el límite.</p></div></div>
        <div class="card">
            <div class="form-grid">
                <div class="field"><label for="calc-subject">Asignatura</label><select id="calc-subject"><option value="">— Seleccionar —</option>${subjectOptions}</select></div>
                <div class="field"><label for="calc-hours">Horas a simular</label><input type="number" id="calc-hours" min="0.5" max="60" step="0.5" value="${s?.horas || 2}"></div>
                <div class="field"><label for="calc-period">Periodo (opcional)</label><select id="calc-period"><option value="">— Ninguno —</option>${periodOptions}</select></div>
                <div class="field" style="justify-content:flex-end"><button class="btn btn--primary" data-calc>${icon('arrowRight', 16)} Simular</button></div>
            </div>
        </div>
        ${s ? calcResult(s) : `<div class="empty-state mt-16"><div class="empty-state__icon">${icon('graduation', 28)}</div><h3>Sin simulación todavía</h3><p>Selecciona una asignatura y pulsa Simular para ver el impacto.</p></div>`}`;
}

function calcResult(s) {
    const stateColor = x => x === 'danger' ? 'var(--danger)' : x === 'warning' ? 'var(--warn)' : 'var(--ok)';
    const alert = s.after.estado === 'danger'
        ? `<div class="calc-alert calc-alert--danger">${icon('alert', 16)} <span><strong>Límite superado.</strong> Con esas ${formatHours(s.horas)} h agotarías el margen de ${escapeHtml(s.before.asig?.nombre || '')}.</span></div>`
        : s.after.estado === 'warning' && s.before.estado === 'ok'
            ? `<div class="calc-alert calc-alert--warning">${icon('alert', 16)} <span><strong>Entrarías en riesgo.</strong> Te quedarían ${formatHours(s.after.horasRestantes)} h de margen.</span></div>`
            : `<div class="calc-alert calc-alert--ok">${icon('check', 16)} <span><strong>Sin cambio de estado.</strong> Te quedarían ${formatHours(s.after.horasRestantes)} h de margen.</span></div>`;

    const card = (st, title) => `<div class="calc-card">
        <span class="calc-card__label">${title}</span>
        <div class="calc-card__big" style="color:${stateColor(st.estado)}">${formatHours(st.horasFaltadas)}<small> / ${formatHours(st.limiteH)} h límite</small></div>
        <div class="flex flex--between"><span class="badge ${st.estado === 'danger' ? 'badge--danger' : st.estado === 'warning' ? 'badge--warning' : 'badge--ok'}">${stateLabel(st.estado)}</span><span class="mono small">${st.pct.toFixed(1)}%</span></div>
        <div class="mt-8">${progress(st.horasFaltadas, st.limiteH || st.totalH, st.estado)}</div>
        <div class="small text-muted mt-8">Disponibles: ${formatHours(st.horasRestantes)} h</div>
    </div>`;

    return `<div class="calc-result mt-16">
        <div class="flex flex--between flex--wrap">
            <h3>${escapeHtml(s.before.asig?.nombre || '')}</h3>
            <span class="badge badge--info">${escapeHtml(evalName(state.evalId))}</span>
        </div>
        <div class="calc-grid mt-12">${card(s.before, 'Ahora')}<div class="calc-arrow">${icon('arrowRight', 20)}</div>${card(s.after, `Tras faltar ${formatHours(s.horas)} h`)}</div>
        <div class="calc-stats mt-12">
            <div><span class="calc-stat__label">Margen restante</span><strong style="color:${stateColor(s.after.estado)}">${formatHours(s.after.horasRestantes)} h</strong></div>
            <div><span class="calc-stat__label">Clases completas que aún puedes faltar</span><strong>${s.classesLeft === null ? '—' : s.classesLeft}</strong></div>
            <div><span class="calc-stat__label">Horas ya faltadas</span><strong>${formatHours(s.before.horasFaltadas)} h</strong></div>
        </div>
        ${s.period && s.pBefore ? `<div class="calc-period mt-16"><div class="flex flex--between"><h4>${escapeHtml(s.period.nombre)}</h4><span class="mono small">${formatHours(s.pAfter.horasFaltadas)} / ${formatHours(s.pAfter.limiteH)} h</span></div>${progress(s.pAfter.horasFaltadas, s.pAfter.limiteH || s.pAfter.totalH, s.pAfter.estado)}<div class="small text-muted mt-8">Antes: ${formatHours(s.pBefore.horasFaltadas)} h · Después: ${formatHours(s.pAfter.horasFaltadas)} h</div></div>` : ''}
        ${alert}
    </div>`;
}

function historyPanel() {
    const p = profile();
    const d = data();
    let list = (d.faltas || []).filter(f => state.evalId === 'global' || f.evaluacionId === state.evalId);
    if (state.search) {
        const q = state.search.toLowerCase();
        list = list.filter(f => subjectName(p, f.asignaturaId).toLowerCase().includes(q) || (f.nota || '').toLowerCase().includes(q) || f.fecha.includes(q));
    }
    list.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.timestamp || '').localeCompare(a.timestamp || ''));

    return `<div class="section-header">
        <div><h2>Historial de faltas</h2><p>${list.length} ${list.length === 1 ? 'registro' : 'registros'} · ${escapeHtml(evalName(state.evalId))}</p></div>
        <div class="flex flex--wrap">
            <div class="search-box">${icon('search', 16)}<input id="history-search" type="search" placeholder="Buscar por asignatura, fecha o nota…" value="${escapeHtml(state.search)}"></div>
        </div>
    </div>
    ${list.length ? `<div class="list">${list.map(f => {
        const tipoClass = f.tipo === 'justificada' ? 'badge--info' : f.tipo === 'retraso' ? 'badge--warning' : 'badge--muted';
        return `<div class="list-item">
            <span class="subject-dot" style="background:${subjectColor(p, f.asignaturaId)}"></span>
            <div class="list-item__body">
                <div class="list-item__title">${escapeHtml(subjectName(p, f.asignaturaId))}</div>
                <div class="list-item__meta">
                    <span>${fmtDate(f.fecha)}</span>
                    <span>${f.tipo === 'retraso' ? `${f.minutosRetraso || Math.round(f.horas * 60)} min` : `${formatHours(f.horas)} h`}</span>
                    <span class="badge ${tipoClass}">${f.tipo === 'justificada' ? 'Justificada' : f.tipo === 'retraso' ? 'Retraso' : 'Injustificada'}</span>
                    ${f.nota ? `<span>${escapeHtml(f.nota)}</span>` : ''}
                </div>
            </div>
            <div class="list-item__action flex">
                <button class="btn-icon" data-edit-falta="${f.id}" title="Editar">${icon('edit', 16)}</button>
                <button class="btn-icon btn-icon--danger" data-del-falta="${f.id}" title="Eliminar">${icon('trash', 16)}</button>
            </div>
        </div>`;
    }).join('')}</div>` : emptyState({ iconName: 'clipboard', title: 'Sin faltas registradas', text: state.search ? 'No hay resultados para esa búsqueda.' : 'Cuando registres una falta aparecerá aquí.' })}
    <div class="flex flex--wrap mt-16">
        <button class="btn btn--ghost" data-trash>${icon('trash', 16)} Papelera (${(d.papelera || []).length})</button>
        <button class="btn btn--ghost" data-export-json>${icon('download', 16)} Exportar JSON</button>
        <button class="btn btn--ghost" data-export-csv>${icon('download', 16)} Exportar CSV</button>
        <button class="btn btn--ghost" data-import>${icon('upload', 16)} Importar</button>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-clear>${icon('trash', 16)} Limpiar faltas</button>
    </div>`;
}

function render() {
    const p = profile();
    const focusedId = document.activeElement?.id;
    const selectionStart = document.activeElement?.selectionStart;

    if (window._chartInstance) {
        window._chartInstance.destroy();
        window._chartInstance = null;
    }

    content.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Control de faltas</h2>
                <p>Porcentaje por asignatura, periodos y simulación de riesgo. Los datos se guardan en este dispositivo.</p>
            </div>
            <div class="page-actions">
                <button class="btn btn--ghost" data-shortcuts title="Atajos de teclado">${icon('info', 16)} Atajos</button>
                <button class="btn btn--primary" data-add-falta>${icon('plus', 16)} Registrar falta</button>
            </div>
        </div>
        ${evalTabs()}
        <div class="section">${summaryCards()}</div>
        <div class="section">
            <div class="tabs" role="tablist">
                ${[
                    ['resumen', 'Resumen', 'clipboard'],
                    ['grafico', 'Gráfico', 'graduation'],
                    ['calculadora', 'Calculadora', 'arrowRight'],
                    ['historial', 'Historial', 'clock']
                ].map(([id, label, ic]) => `<button class="tab ${state.tab === id ? 'is-active' : ''}" data-tab="${id}">${icon(ic, 15)} ${label}</button>`).join('')}
            </div>
            <div class="mt-16">
                ${state.tab === 'resumen' ? resumenPanel() : state.tab === 'grafico' ? graphPanel() : state.tab === 'calculadora' ? calcPanel() : historyPanel()}
            </div>
        </div>
    `;

    if (state.tab === 'grafico') requestAnimationFrame(renderChart);

    if (focusedId === 'history-search') {
        const input = document.getElementById('history-search');
        if (input) {
            input.focus();
            if (selectionStart !== null && selectionStart !== undefined) input.setSelectionRange(selectionStart, selectionStart);
        }
    }
}

function openTrash() {
    const p = profile();
    const d = data();
    const items = [...(d.papelera || [])].sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    const body = items.length ? `<div class="list">${items.map(f => {
        const days = Math.max(0, Math.ceil((new Date(f.deletedAt).getTime() + 7 * 86400000 - Date.now()) / 86400000));
        return `<div class="list-item">
            <span class="subject-dot" style="background:${subjectColor(p, f.asignaturaId)}"></span>
            <div class="list-item__body">
                <div class="list-item__title">${escapeHtml(subjectName(p, f.asignaturaId))}</div>
                <div class="list-item__meta"><span>${fmtDate(f.fecha)}</span><span>${formatHours(f.horas)} h</span><span class="text-warning">Expira en ${days} d</span></div>
                ${f.nota ? `<div class="small text-muted mt-8">${escapeHtml(f.nota)}</div>` : ''}
            </div>
            <div class="list-item__action flex">
                <button class="btn btn--ghost btn--sm" data-restore="${f.id}">${icon('refresh', 14)} Restaurar</button>
                <button class="btn-icon btn-icon--danger" data-purge="${f.id}" title="Eliminar definitivamente">${icon('x', 16)}</button>
            </div>
        </div>`;
    }).join('')}</div>` : emptyState({ iconName: 'trash', title: 'Papelera vacía', text: 'Las faltas eliminadas se guardan 7 días.' });

    const modal = openModal({
        title: 'Papelera',
        subtitle: 'Las faltas eliminadas se recuperan hasta 7 días después',
        body,
        footer: `<button class="btn btn--ghost" data-close>Cerrar</button>${items.length ? '<button class="btn btn--danger" data-empty-trash>Vaciar papelera</button>' : ''}`,
        onMount: ({ card, close }) => {
            card.querySelectorAll('[data-restore]').forEach(btn => btn.addEventListener('click', () => {
                Store.restoreFalta(btn.dataset.restore);
                close();
                render();
                toast('Falta restaurada', 'success');
            }));
            card.querySelectorAll('[data-purge]').forEach(btn => btn.addEventListener('click', async () => {
                const ok = await confirmDialog({ title: 'Eliminar definitivamente', message: 'Esta acción no se puede deshacer.', confirmText: 'Eliminar', danger: true });
                if (!ok) return;
                Store.purgeTrashItem(btn.dataset.purge);
                close();
                openTrash();
                render();
            }));
            card.querySelector('[data-empty-trash]')?.addEventListener('click', async () => {
                const ok = await confirmDialog({ title: 'Vaciar papelera', message: 'Se eliminarán todas las faltas de la papelera para siempre.', confirmText: 'Vaciar', danger: true });
                if (!ok) return;
                Store.clearTrash();
                close();
                render();
                toast('Papelera vaciada', 'info');
            });
        }
    });
    return modal;
}

function exportJSON() {
    const p = profile();
    const d = data();
    const payload = {
        app: 'mi-curso',
        tipo: 'faltas',
        exportado: new Date().toISOString(),
        perfil: { id: p.id, nombre: p.nombre, centro: p.centro, grupo: p.grupo },
        evaluacion: state.evalId,
        faltas: state.evalId === 'global' ? d.faltas : d.faltas.filter(f => f.evaluacionId === state.evalId)
    };
    download(`faltas-${p.nombre.replaceAll(/\s+/g, '-').toLowerCase()}-${todayISO()}.json`, JSON.stringify(payload, null, 2));
    toast('JSON exportado', 'success');
}

function exportCSV() {
    const p = profile();
    const d = data();
    const list = state.evalId === 'global' ? d.faltas : d.faltas.filter(f => f.evaluacionId === state.evalId);
    const rows = [['Fecha', 'Asignatura', 'Evaluación', 'Tipo', 'Horas', 'Minutos retraso', 'Nota']];
    list.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).forEach(f => {
        rows.push([
            f.fecha,
            subjectName(p, f.asignaturaId),
            evalName(f.evaluacionId),
            f.tipo,
            String(f.horas),
            String(f.minutosRetraso || ''),
            f.nota || ''
        ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    download(`faltas-${todayISO()}.csv`, `\ufeff${csv}`, 'text/csv;charset=utf-8');
    toast('CSV exportado', 'success');
}

function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const raw = JSON.parse(e.target.result);
            if (raw.profiles && raw.data) {
                const ok = await confirmDialog({ title: 'Restaurar backup completo', message: 'Se sustituirán todos los cursos y datos actuales. ¿Continuar?', confirmText: 'Restaurar', danger: true });
                if (!ok) return;
                Store.importPayload(raw);
                toast('Backup restaurado', 'success');
                setTimeout(() => location.reload(), 600);
                return;
            }
            const faltas = Array.isArray(raw) ? raw : raw.faltas;
            if (!Array.isArray(faltas)) throw new Error('Formato inválido');
            const ok = await confirmDialog({ title: 'Importar faltas', message: `Se importarán ${faltas.length} faltas en el curso actual.`, confirmText: 'Importar' });
            if (!ok) return;
            let errors = 0;
            faltas.forEach(f => {
                if (!f.fecha || !(f.asignaturaId || f.asignatura) || !f.horas) { errors++; return; }
                Store.addFalta({
                    asignaturaId: f.asignaturaId || f.asignatura,
                    fecha: f.fecha,
                    horas: Number(f.horas),
                    minutosRetraso: Number(f.minutosRetraso) || 0,
                    evaluacionId: f.evaluacionId || null,
                    evaluacion: f.evaluacion || null,
                    tipo: f.tipo || 'injustificada',
                    nota: f.nota || ''
                });
            });
            toast(`Importadas ${faltas.length - errors} faltas${errors ? ` (${errors} errores)` : ''}`, errors ? 'info' : 'success');
            render();
        } catch (err) {
            console.error(err);
            toast('No se pudo importar el archivo', 'error');
        }
    };
    reader.readAsText(file);
}

/* ============================================================
   Eventos
   ============================================================ */
content.addEventListener('click', async e => {
    const evalBtn = e.target.closest('[data-eval]');
    if (evalBtn) { state.evalId = evalBtn.dataset.eval; state.calc = null; render(); return; }

    const tab = e.target.closest('[data-tab]');
    if (tab) { state.tab = tab.dataset.tab; render(); return; }

    const filter = e.target.closest('[data-filter]');
    if (filter) { state.filter = filter.dataset.filter; render(); return; }

    if (e.target.closest('[data-toggle-compact]')) { state.compact = !state.compact; render(); return; }
    if (e.target.closest('[data-add-falta]')) { openFaltaForm({ onSaved: () => render() }); return; }
    if (e.target.closest('[data-calc]')) { calcular(); return; }
    if (e.target.closest('[data-trash]')) { openTrash(); return; }
    if (e.target.closest('[data-export-json]')) { exportJSON(); return; }
    if (e.target.closest('[data-export-csv]')) { exportCSV(); return; }
    if (e.target.closest('[data-import]')) { document.getElementById('import-file')?.click(); return; }
    if (e.target.closest('[data-clear]')) {
        const ok = await confirmDialog({ title: 'Limpiar faltas', message: 'Se eliminarán todas las faltas del curso actual. Podrás recuperarlas desde la papelera solo si las borras una a una. Esta acción vacía también la papelera.', confirmText: 'Limpiar', danger: true });
        if (!ok) return;
        Store.clearFaltas();
        render();
        toast('Faltas eliminadas', 'info');
        return;
    }
    if (e.target.closest('[data-shortcuts]')) { openShortcuts(); return; }

    const edit = e.target.closest('[data-edit-falta]');
    if (edit) {
        const f = data().faltas.find(x => x.id === edit.dataset.editFalta);
        if (f) openFaltaForm({ initial: f, onSaved: () => render() });
        return;
    }
    const del = e.target.closest('[data-del-falta]');
    if (del) {
        const ok = await confirmDialog({ title: 'Eliminar falta', message: 'Se moverá a la papelera durante 7 días.', confirmText: 'Eliminar', danger: true });
        if (!ok) return;
        Store.deleteFalta(del.dataset.delFalta);
        render();
        toast('Falta movida a la papelera', 'info');
        return;
    }
});

content.addEventListener('input', e => {
    if (e.target.id === 'history-search') {
        state.search = e.target.value;
        render();
    }
});

content.addEventListener('change', e => {
    if (e.target.id === 'import-file') {
        importJSON(e.target.files?.[0]);
        e.target.value = '';
    }
});

function openShortcuts() {
    openModal({
        title: 'Atajos de teclado',
        body: `<div class="shortcut-list">
            <div><kbd>N</kbd><span>Nueva falta</span></div>
            <div><kbd>T</kbd><span>Papelera</span></div>
            <div><kbd>1</kbd><kbd>2</kbd><span>Cambiar evaluación</span></div>
            <div><kbd>G</kbd><span>Vista global</span></div>
            <div><kbd>R</kbd><span>Resumen</span></div>
            <div><kbd>P</kbd><span>Gráfico</span></div>
            <div><kbd>K</kbd><span>Calculadora</span></div>
            <div><kbd>H</kbd><span>Historial</span></div>
            <div><kbd>Esc</kbd><span>Cerrar ventana</span></div>
        </div>`,
        footer: '<button class="btn btn--ghost" data-close>Cerrar</button>'
    });
}

document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const p = profile();
    switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); openFaltaForm({ onSaved: () => render() }); break;
        case 't': openTrash(); break;
        case 'g': state.evalId = 'global'; state.calc = null; render(); break;
        case 'r': state.tab = 'resumen'; render(); break;
        case 'p': state.tab = 'grafico'; render(); break;
        case 'k': state.tab = 'calculadora'; render(); break;
        case 'h': state.tab = 'historial'; render(); break;
        default:
            if (/^[1-9]$/.test(e.key)) {
                const ev = p.evaluaciones[Number(e.key) - 1];
                if (ev) { state.evalId = ev.id; state.calc = null; render(); }
            }
    }
});

Store.subscribe(event => {
    if (event.source === 'remote') render();
});

Store.cleanTrash();
render();
