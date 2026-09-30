/**
 * Control de Asistencia — CIFP USURBIL
 * Usa shared.js para: CONFIG, tipoDia, horasLectivasRestantes, asignaturasDelDia,
 * Auth, Offline, DB, Toast, setDbStatus
 * Este archivo: State → UI → Modals → Actions → Events → Init (específico de esta página)
 */

// Alias de compatibilidad: Offline con clave fija para faltas
const OfflineFaltas = {
    save(faltas) { Offline.save('ca_faltas_cache', faltas); },
    load()       { return Offline.load('ca_faltas_cache') || []; }
};

/* ============================================================
   PAPELERA
   ============================================================ */
const Trash = {
    KEY: 'ca_papelera',
    DAYS: 7,

    getAll() {
        try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
        catch(e) { return []; }
    },

    add(falta) {
        const items = this.getAll();
        // Evitar duplicados
        if (items.find(f => f.id === falta.id)) return;
        items.push({ ...falta, deletedAt: new Date().toISOString() });
        localStorage.setItem(this.KEY, JSON.stringify(items));
        this.updateBadge();
    },

    remove(id) {
        const items = this.getAll().filter(f => f.id !== id);
        localStorage.setItem(this.KEY, JSON.stringify(items));
        this.updateBadge();
    },

    clear() {
        localStorage.removeItem(this.KEY);
        this.updateBadge();
    },

    cleanOld() {
        const cutoff = Date.now() - this.DAYS * 24 * 60 * 60 * 1000;
        const items = this.getAll().filter(f => new Date(f.deletedAt).getTime() > cutoff);
        localStorage.setItem(this.KEY, JSON.stringify(items));
        this.updateBadge();
    },

    count() { return this.getAll().length; },

    updateBadge() {
        const badge = document.getElementById('trash-count');
        if (!badge) return;
        const n = this.count();
        badge.style.display = n > 0 ? 'flex' : 'none';
        badge.textContent = n;
    },

    render() {
        const container = document.getElementById('trash-list');
        if (!container) return;
        const items = this.getAll().sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state">La papelera está vacía</div>';
            return;
        }

        container.innerHTML = items.map(f => {
            const asig  = CONFIG.asignaturas[f.asignatura];
            const nombre = asig ? asig.nombre : f.asignatura;
            const color  = CONFIG.colors[f.asignatura] || '#64748b';
            const fecha  = f.fecha ? new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—';
            const delDate = new Date(f.deletedAt);
            const daysLeft = Math.max(0, Math.ceil((delDate.getTime() + Trash.DAYS * 86400000 - Date.now()) / 86400000));
            const delStr = delDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

            return `
            <div class="falta-item" style="opacity:0.75">
                <div class="falta-item__dot" style="background:${color};box-shadow:0 0 5px ${color}"></div>
                <div class="falta-item__info">
                    <div class="falta-item__asig">${nombre}</div>
                    <div class="falta-item__meta">
                        <span>${fecha}</span>·<span>${f.horas}h</span>
                        <span class="falta-item__eval-badge">E${f.evaluacion || '?'}</span>
                        <span style="color:var(--amber);font-size:0.68rem">Eliminado ${delStr} · expira en ${daysLeft}d</span>
                    </div>
                    ${f.nota ? `<div class="falta-item__nota">${f.nota}</div>` : ''}
                </div>
                <div class="falta-item__btns">
                    <button class="btn-ghost btn-sm" onclick="Actions.restaurarFalta('${f.id}')">↩ Restaurar</button>
                    <button class="btn-micro btn-micro--danger" onclick="Actions.eliminarDefinitivo('${f.id}')" title="Eliminar definitivamente">✕</button>
                </div>
            </div>`;
        }).join('');
    }
};

const WeekSummary = {
    render() {
        const container = document.getElementById('week-summary');
        if (!container) return;

        const now = new Date();
        const dow = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // Total lectivo hours this week
        const horasSemanales = [1,2,3,4,5].reduce((total, d) => {
            return total + Object.values(CONFIG.horasDiarias[d] || {}).reduce((s, h) => s + h, 0);
        }, 0);

        const thisWeekFaltas = State.faltasVisibles.filter(f => {
            if (!f.fecha) return false;
            const fd = new Date(f.fecha + 'T00:00:00');
            return fd >= weekStart && fd <= weekEnd;
        });
        const horasFaltadas = thisWeekFaltas.reduce((s, f) => s + (f.horas || 0), 0);

        const dayLabels = ['L', 'M', 'X', 'J', 'V'];
        const dayDates  = Array.from({ length: 5 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d;
        });

        const pills = dayDates.map((d, i) => {
            const y  = d.getFullYear();
            const m  = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const ds = `${y}-${m}-${dd}`;
            const td      = tipoDia(ds);
            const isToday = d.toDateString() === now.toDateString();
            const faltasDay = thisWeekFaltas.filter(f => f.fecha === ds);
            const hasFaltas = faltasDay.length > 0;
            const isNoLectivo = td && td.tipo !== 'finde';
            const isFinde     = td && td.tipo === 'finde';

            // Colored dots like calendar
            const dots = faltasDay.map(f => {
                const c = CONFIG.colors[f.asignatura] || '#64748b';
                return `<span style="width:7px;height:7px;border-radius:50%;background:${c};box-shadow:0 0 4px ${c};display:inline-block;flex-shrink:0"></span>`;
            }).join('');

            const numColor = isNoLectivo || isFinde ? '#ff4060' :
                             hasFaltas ? 'var(--red)' :
                             isToday   ? 'var(--cyan)' : 'var(--txt-secondary)';

            let cls = 'week-day';
            if (isToday)     cls += ' week-day--today';
            if (hasFaltas)   cls += ' week-day--faltas';
            if (isNoLectivo) cls += ' week-day--special';

            return `<div class="${cls}" title="${d.toLocaleDateString('es-ES')}${isNoLectivo ? ' — ' + td.label : ''}${hasFaltas ? ' — ' + faltasDay.reduce((s,f)=>s+f.horas,0) + 'h faltadas' : ''}">
                <span class="week-day__label">${dayLabels[i]}</span>
                <span class="week-day__num" style="color:${numColor}">${d.getDate()}</span>
                <div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;min-height:14px">
                    ${isNoLectivo ? `<span style="font-size:0.65rem;opacity:0.5">${td.tipo === 'festivo' ? '✕' : td.tipo === 'examen' ? '📝' : '🏢'}</span>` : dots}
                </div>
            </div>`;
        }).join('');

        container.innerHTML = `
            <div class="week-summary-inner">
                <div class="week-label">Esta semana</div>
                <div class="week-days">${pills}</div>
                <div class="week-stats">
                    <span class="week-stat">
                        <span class="week-stat__val" style="color:${horasFaltadas > 0 ? 'var(--red)' : 'var(--lime)'}">${horasFaltadas}h</span>
                        <span class="week-stat__label">faltadas</span>
                    </span>
                    <span class="week-stat">
                        <span class="week-stat__val">${horasSemanales}h</span>
                        <span class="week-stat__label">lectivas</span>
                    </span>
                </div>
            </div>`;
    }
};

/* ============================================================
   COMPACT VIEW
   ============================================================ */
const CompactView = {
    active: false,
    toggle() {
        this.active = !this.active;
        document.getElementById('tabla-resumen')?.classList.toggle('tabla-compacta', this.active);
        const btn = document.getElementById('btn-compact');
        if (btn) btn.textContent = this.active ? '⊞ Expandir' : '⊟ Compactar';
        Toast.show(this.active ? 'Vista compacta activada' : 'Vista expandida', 'info', 1500);
    }
};

/* ============================================================
   SHORTCUTS
   ============================================================ */
const Shortcuts = {
    init() {
        document.addEventListener('keydown', e => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            switch (e.key) {
                case 'n': case 'N': e.preventDefault(); Modals.registro.open(); break;
                case '1': Actions.cambiarEvaluacion(1); break;
                case '2': Actions.cambiarEvaluacion(2); break;
                case 'g': case 'G': if (!e.shiftKey) Actions.cambiarEvaluacion('total'); break;
                case 'r': case 'R': UI.switchTab('resumen'); break;
                case 'p': case 'P': UI.switchTab('grafico'); break;
                case 'c': case 'C':
                    if (e.shiftKey) CompactView.toggle();
                    else UI.switchTab('calendario');
                    break;
                case 'k': case 'K': UI.switchTab('calculadora'); break;
                case 't': case 'T': Modals.trash.open(); break;
                case '?': document.getElementById('shortcuts-modal')?.classList.add('open'); break;
            }
        });
    }
};

/* ============================================================
   CONEXIÓN FIREBASE (usa DB/Auth/Offline de shared.js)
   ============================================================ */
function initFirebaseFaltas() {
    DB.init(
        // onReady
        () => {
            setDbStatus('Conectando…', 'connecting');
            DB.faltas.listen(
                data => {
                    State.faltas = data;
                    OfflineFaltas.save(State.faltas);
                    setDbStatus('Conectado', 'connected');
                    UI.render();
                },
                err => {
                    const cached = OfflineFaltas.load();
                    if (cached.length > 0) {
                        State.faltas = cached;
                        setDbStatus('Offline (caché)', 'connecting');
                        Toast.show('Sin conexión — mostrando datos guardados', 'info');
                        UI.render();
                    } else {
                        setDbStatus('Error', 'error');
                        Toast.show('Error al conectar con Firestore', 'error');
                    }
                }
            );
        },
        // onMissing
        () => {
            const cached = OfflineFaltas.load();
            if (cached.length > 0) {
                State.faltas = cached;
                setDbStatus('Offline (sin config)', 'connecting');
                Toast.show('Firebase sin configurar — mostrando caché local', 'info');
                UI.render();
            } else {
                setDbStatus('Sin configurar', 'error');
                Modals.firebase.open();
            }
        }
    );
}

/* ============================================================
   4. ESTADO
   ============================================================ */
const State = {
    faltas: [],
    evaluacion: 1,        // 1 | 2 | 'total'
    filtroActivo: 'all',
    activeTab: 'resumen',
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),

    /** Calcula stats para una asignatura. extraHoras: para simulación */
    calcStats(key, extraHoras = 0) {
        const asig = CONFIG.asignaturas[key];
        let totalH, lista;

        if (this.evaluacion === 'total') {
            totalH = asig.eval[1] + asig.eval[2];
            lista = this.faltas.filter(f => f.asignatura === key);
        } else {
            totalH = asig.eval[this.evaluacion];
            lista  = this.faltas.filter(f => f.asignatura === key && Number(f.evaluacion) === this.evaluacion);
        }

        const horasFaltadas  = lista.reduce((s, f) => s + (f.horas || 0), 0) + extraHoras;
        const pct            = totalH > 0 ? (horasFaltadas / totalH) * 100 : 0;
        const limiteH        = Math.floor(totalH * CONFIG.limitePct / 100);
        const horasRestantes = Math.max(0, limiteH - horasFaltadas);

        let estado = 'ok';
        if (horasFaltadas >= limiteH)          estado = 'danger';
        else if (horasFaltadas >= limiteH / 2) estado = 'warning';

        return { horasFaltadas, totalH, pct, limiteH, horasRestantes, estado };
    },

    /** Stats agregadas de una erronka (solo lectura): suma TODAS las asignaturas en su periodo */
    calcErronkaStats(er, extraHoras = 0) {
        const totalH = er.totalHoras || 0;
        const lista  = this.faltas.filter(f => f.fecha >= er.start && f.fecha <= er.end);
        const horasFaltadas  = lista.reduce((s, f) => s + (f.horas || 0), 0) + extraHoras;
        const pct            = totalH > 0 ? (horasFaltadas / totalH) * 100 : 0;
        const limiteH        = Math.floor(totalH * CONFIG.limitePct / 100);
        const horasRestantes = Math.max(0, limiteH - horasFaltadas);

        let estado = 'ok';
        if (horasFaltadas >= limiteH)          estado = 'danger';
        else if (horasFaltadas >= limiteH / 2) estado = 'warning';

        return { horasFaltadas, totalH, pct, limiteH, horasRestantes, estado };
    },

    get faltasVisibles() {
        if (this.evaluacion === 'total') return [...this.faltas];
        return this.faltas.filter(f => Number(f.evaluacion) === this.evaluacion);
    }
};

/* ============================================================
   5. UI
   ============================================================ */
const UI = {
    setStatus(msg, type) {
        const dot  = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        if (dot)  dot.className   = `status-dot ${type}`;
        if (text) text.textContent = msg;
    },

    renderTabs() {
        document.querySelectorAll('.eval-tab').forEach(btn => {
            btn.classList.toggle('active', String(State.evaluacion) === String(btn.dataset.eval));
        });
        const label = State.evaluacion === 'total' ? 'Global' : `Eval ${State.evaluacion}`;
        const el = document.getElementById('historial-eval-label');
        if (el) el.textContent = label;

        const evalInput = document.getElementById('evaluacion-input');
        if (evalInput && State.evaluacion !== 'total') evalInput.value = State.evaluacion;
    },

    renderTabla() {
        const container = document.getElementById('tabla-resumen');
        if (!container) return;
        const sufijo = State.evaluacion === 'total' ? 'Global' : `Eval ${State.evaluacion}`;
        const evalNum = State.evaluacion === 'total' ? null : State.evaluacion;

        let rowsHTML = '';
        Object.entries(CONFIG.asignaturas).forEach(([key, asig]) => {
            const s = State.calcStats(key);
            if (State.filtroActivo === 'warning' && s.estado !== 'warning') return;
            if (State.filtroActivo === 'danger'  && s.estado !== 'danger')  return;

            const trClass   = s.estado === 'danger'  ? 'tr-danger'  : s.estado === 'warning' ? 'tr-warning' : '';
            const bdgClass  = s.estado === 'danger'  ? 'badge--danger' : s.estado === 'warning' ? 'badge--warning' : 'badge--ok';
            const bdgLabel  = s.estado === 'danger'  ? '⛔ Peligro'  : s.estado === 'warning' ? '⚠ Riesgo'   : '✓ Correcto';
            const fillClass = s.estado === 'danger'  ? 'progress-fill--danger' : s.estado === 'warning' ? 'progress-fill--warn' : '';
            const fillPct   = Math.min(100, s.limiteH > 0 ? (s.horasFaltadas / s.limiteH * 100) : 0).toFixed(0);
            const color     = CONFIG.colors[key] || '#64748b';
            const quedanColor = s.horasRestantes === 0 ? 'var(--red)' : 'var(--lime)';

            // Horas lectivas restantes (solo si hay eval concreta y no es pasado)
            let lectivasHTML = '<span style="color:var(--txt-muted)">—</span>';
            if (evalNum) {
                const lect = horasLectivasRestantes(key, evalNum);
                if (lect > 0) {
                    lectivasHTML = `<span style="font-family:var(--font-mono);font-size:0.83rem;color:var(--txt-secondary)">${lect}h</span>`;
                } else {
                    lectivasHTML = `<span style="color:var(--txt-muted);font-size:0.8rem">Eval terminada</span>`;
                }
            }

            rowsHTML += `
            <tr class="${trClass}">
                <td><div class="td-asig"><span class="td-dot" style="background:${color};box-shadow:0 0 5px ${color}"></span>${asig.nombre}</div></td>
                <td class="td-mono">${s.horasFaltadas} / ${s.totalH}h</td>
                <td>
                    <div class="progress-wrap">
                        <div class="progress-bar"><div class="progress-fill ${fillClass}" style="width:${fillPct}%"></div></div>
                        <span class="progress-pct td-mono">${s.pct.toFixed(1)}%</span>
                    </div>
                </td>
                <td><span class="badge ${bdgClass}">${bdgLabel}</span></td>
                <td class="td-mono">${s.limiteH}h máx</td>
                <td class="td-mono" style="color:${quedanColor};">${s.horasRestantes === 0 ? '⚠ 0h' : `+${s.horasRestantes}h`}</td>
                <td>${lectivasHTML}</td>
            </tr>`;
        });

        if (!rowsHTML) {
            rowsHTML = `<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--txt-muted);">Sin resultados para este filtro</td></tr>`;
        }

        container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Asignatura</th>
                    <th>Horas ${sufijo}</th>
                    <th>Progreso</th>
                    <th>Estado</th>
                    <th>Límite (20%)</th>
                    <th>Disponibles</th>
                    <th title="Horas lectivas que quedan hasta fin de evaluación">Quedan en eval</th>
                </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
        </table>`;
    },

    renderErronkas() {
        const container = document.getElementById('tabla-erronkas');
        if (!container) return;

        let erronkas = CONFIG.erronkas;
        if (State.evaluacion !== 'total') {
            erronkas = erronkas.filter(er => er.evaluacion === State.evaluacion);
        }

        let rowsHTML = '';
        erronkas.forEach(er => {
            const s = State.calcErronkaStats(er);
            if (State.filtroActivo === 'warning' && s.estado !== 'warning') return;
            if (State.filtroActivo === 'danger'  && s.estado !== 'danger')  return;

            const trClass   = s.estado === 'danger'  ? 'tr-danger'  : s.estado === 'warning' ? 'tr-warning' : '';
            const bdgClass  = s.estado === 'danger'  ? 'badge--danger' : s.estado === 'warning' ? 'badge--warning' : 'badge--ok';
            const bdgLabel  = s.estado === 'danger'  ? '⛔ Peligro'  : s.estado === 'warning' ? '⚠ Riesgo'   : '✓ Correcto';
            const fillClass = s.estado === 'danger'  ? 'progress-fill--danger' : s.estado === 'warning' ? 'progress-fill--warn' : '';
            const fillPct   = Math.min(100, s.limiteH > 0 ? (s.horasFaltadas / s.limiteH * 100) : 0).toFixed(0);
            const quedanColor = s.horasRestantes === 0 ? 'var(--red)' : 'var(--lime)';

            const fIni = new Date(er.start + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            const fFin = new Date(er.end   + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

            rowsHTML += `
            <tr class="${trClass}">
                <td><div class="td-asig"><span class="td-dot td-dot--erronka"></span>${er.nombre}</div></td>
                <td class="td-mono">${fIni} → ${fFin}</td>
                <td class="td-mono">${s.horasFaltadas} / ${s.totalH}h</td>
                <td>
                    <div class="progress-wrap">
                        <div class="progress-bar"><div class="progress-fill ${fillClass}" style="width:${fillPct}%"></div></div>
                        <span class="progress-pct td-mono">${s.pct.toFixed(1)}%</span>
                    </div>
                </td>
                <td><span class="badge ${bdgClass}">${bdgLabel}</span></td>
                <td class="td-mono">${s.limiteH}h máx</td>
                <td class="td-mono" style="color:${quedanColor};">${s.horasRestantes === 0 ? '⚠ 0h' : `+${s.horasRestantes}h`}</td>
            </tr>`;
        });

        if (!rowsHTML) {
            rowsHTML = `<tr><td colspan="7" style="text-align:center;padding:36px;color:var(--txt-muted);">Sin resultados para este filtro</td></tr>`;
        }

        container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Erronka</th>
                    <th>Periodo</th>
                    <th>Horas</th>
                    <th>Progreso</th>
                    <th>Estado</th>
                    <th>Límite (20%)</th>
                    <th>Disponibles</th>
                </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
        </table>`;
    },

    renderHistorial() {
        const container = document.getElementById('lista-faltas-container');
        if (!container) return;
        const lista = State.faltasVisibles.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (lista.length === 0) {
            container.innerHTML = `<div class="empty-state">No hay faltas registradas</div>`;
            return;
        }

        container.innerHTML = lista.map(f => {
            const asig   = CONFIG.asignaturas[f.asignatura];
            const nombre = asig ? asig.nombre : f.asignatura;
            const fecha  = f.fecha
                ? new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
                : '—';
            const color   = CONFIG.colors[f.asignatura] || '#64748b';
            const esJusti = f.tipo === 'justificada';

            return `
            <div class="falta-item">
                <div class="falta-item__dot" style="background:${color};box-shadow:0 0 6px ${color}"></div>
                <div class="falta-item__info">
                    <div class="falta-item__asig">${nombre}</div>
                    <div class="falta-item__meta">
                        <span>${fecha}</span>·<span>${f.horas}h</span>
                        <span class="falta-item__eval-badge">E${f.evaluacion || '?'}</span>
                        <span class="tipo-badge ${esJusti ? 'tipo-j' : 'tipo-i'}">${esJusti ? 'J' : 'I'}</span>
                    </div>
                    ${f.nota ? `<div class="falta-item__nota">${f.nota}</div>` : ''}
                </div>
                <div class="falta-item__btns">
                    <button class="btn-micro" onclick="Actions.editarFalta('${f.id}')" title="Editar">✏</button>
                    <button class="btn-micro btn-micro--danger" onclick="Actions.pedirEliminarFalta('${f.id}')" title="Eliminar">✕</button>
                </div>
            </div>`;
        }).join('');
    },

    renderStats() {
        let totalH = 0, faltadasH = 0, enRiesgo = 0;
        Object.keys(CONFIG.asignaturas).forEach(key => {
            const s = State.calcStats(key);
            totalH    += s.totalH;
            faltadasH += s.horasFaltadas;
            if (s.estado !== 'ok') enRiesgo++;
        });

        const g = id => document.getElementById(id);
        if (g('total-horas')) g('total-horas').textContent = totalH;
        if (g('total-faltas')) g('total-faltas').textContent = faltadasH;
        if (g('asignaturas-riesgo')) {
            g('asignaturas-riesgo').textContent = enRiesgo;
            g('asignaturas-riesgo').style.color = enRiesgo > 0 ? 'var(--red)' : 'var(--lime)';
        }
        const pill = g('riesgo-pill');
        if (pill) pill.style.borderColor = enRiesgo > 0 ? 'rgba(255,64,96,0.4)' : 'rgba(57,255,110,0.25)';
    },

    renderChart() {
        if (State.activeTab !== 'grafico') return;
        const canvas = document.getElementById('chart-canvas');
        if (!canvas) return;

        if (typeof Chart === 'undefined') {
            canvas.parentElement.innerHTML = '<p style="color:var(--txt-muted);text-align:center;padding:60px 0;">Chart.js no disponible</p>';
            return;
        }
        if (window._chartInstance) { window._chartInstance.destroy(); window._chartInstance = null; }

        // Entradas del gráfico: asignaturas + erronkas (según la evaluación activa)
        const entries = [];

        Object.entries(CONFIG.asignaturas).forEach(([key, asig]) => {
            const s = State.calcStats(key);
            entries.push({
                label: asig.nombre.replace(/\s*\(.*\)/, ''),
                pct: s.pct,
                horasFaltadas: s.horasFaltadas,
                totalH: s.totalH,
                horasRestantes: s.horasRestantes,
                estado: s.estado,
                isErronka: false,
                periodo: null
            });
        });

        let erronkasChart = CONFIG.erronkas;
        if (State.evaluacion !== 'total') {
            erronkasChart = erronkasChart.filter(er => er.evaluacion === State.evaluacion);
        }
        erronkasChart.forEach(er => {
            const s = State.calcErronkaStats(er);
            const fIni = new Date(er.start + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            const fFin = new Date(er.end   + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            entries.push({
                label: '🗂 ' + er.nombre,
                pct: s.pct,
                horasFaltadas: s.horasFaltadas,
                totalH: s.totalH,
                horasRestantes: s.horasRestantes,
                estado: s.estado,
                isErronka: true,
                periodo: `${fIni} → ${fFin}`
            });
        });

        const labels   = entries.map(e => e.label);
        const data     = entries.map(e => parseFloat(e.pct.toFixed(1)));

        const bgColors = entries.map(e => {
            if (e.estado === 'danger')  return 'rgba(255,64,96,0.65)';
            if (e.estado === 'warning') return 'rgba(255,184,48,0.65)';
            return 'rgba(57,255,110,0.65)';
        });
        const bdColors = entries.map(e => {
            if (e.estado === 'danger')  return '#ff4060';
            if (e.estado === 'warning') return '#ffb830';
            return '#39ff6e';
        });

        // Plugin: reference lines at 10% (warning) and 20% (danger)
        const refLines = {
            id: 'refLines',
            afterDraw(chart) {
                const { ctx, chartArea, scales: { x } } = chart;
                [[10, 'rgba(255,184,48,0.55)', '10% riesgo'], [20, 'rgba(255,64,96,0.7)', '20% peligro']].forEach(([val, color, label]) => {
                    const px = x.getPixelForValue(val);
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(px, chartArea.top);
                    ctx.lineTo(px, chartArea.bottom);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = val === 20 ? 2 : 1.5;
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
            data: { labels, datasets: [{ data, backgroundColor: bgColors, borderColor: bdColors, borderWidth: 1.5, borderRadius: 6, borderSkipped: false }] },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                const e = entries[ctx.dataIndex];
                                const lines = [`  ${e.pct.toFixed(1)}% faltado`, `  ${e.horasFaltadas}h de ${e.totalH}h`, `  Quedan: ${e.horasRestantes}h`];
                                if (e.isErronka && e.periodo) lines.push(`  ${e.periodo}`);
                                return lines;
                            },
                            title(ctx) { return ctx[0].label; }
                        },
                        backgroundColor: '#0f1320', borderColor: 'rgba(0,212,255,0.2)', borderWidth: 1,
                        titleColor: '#f0f4ff', bodyColor: '#8b96b0', padding: 12, cornerRadius: 8,
                    }
                },
                scales: {
                    x: {
                        min: 0, max: 30,
                        ticks: { color: '#3d4a63', font: { family: 'JetBrains Mono', size: 11 }, callback: v => v + '%' },
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        border: { color: 'rgba(255,255,255,0.06)' }
                    },
                    y: {
                        ticks: { color: '#8b96b0', font: { family: 'DM Sans', size: 12 } },
                        grid: { display: false },
                        border: { color: 'rgba(255,255,255,0.06)' }
                    }
                }
            },
            plugins: [refLines]
        });
    },

    renderCalendar() {
        if (State.activeTab !== 'calendario') return;
        const { calYear: year, calMonth: month } = State;

        // Title
        const titleEl = document.getElementById('cal-title');
        if (titleEl) {
            titleEl.textContent = new Date(year, month, 1)
                .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        }

        // Legend
        const legendEl = document.getElementById('cal-legend');
        if (legendEl) {
            const asigLegend = Object.entries(CONFIG.colors).map(([key, color]) => `
                <span class="cal-legend-item">
                    <span class="cal-dot" style="background:${color};box-shadow:0 0 4px ${color}"></span>
                    <span>${CONFIG.asignaturas[key].nombre.replace(/\s*\(.*\)/, '')}</span>
                </span>`).join('');

            const specialLegend = `
                <span class="cal-legend-item"><span class="cal-legend-sq cal-legend-sq--festivo"></span><span>Festivo</span></span>
                <span class="cal-legend-item"><span class="cal-legend-sq cal-legend-sq--examen"></span><span>Semana examen</span></span>
                <span class="cal-legend-item"><span class="cal-legend-sq cal-legend-sq--practica"></span><span>Prácticas empresa</span></span>
            `;
            legendEl.innerHTML = asigLegend + '<span style="flex-basis:100%;height:0"></span>' + specialLegend;
        }

        // Grid
        const grid = document.getElementById('cal-grid');
        if (!grid) return;

        const today    = new Date();
        const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Monday
        const lastDay  = new Date(year, month + 1, 0).getDate();

        // Group faltas by day number
        const faltasByDay = {};
        State.faltas.forEach(f => {
            if (!f.fecha) return;
            const d = new Date(f.fecha + 'T00:00:00');
            if (d.getFullYear() === year && d.getMonth() === month) {
                const n = d.getDate();
                if (!faltasByDay[n]) faltasByDay[n] = [];
                faltasByDay[n].push(f);
            }
        });

        const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        let html = dayNames.map(d => `<div class="cal-day-header">${d}</div>`).join('');

        // Empty cells
        for (let i = 0; i < firstDow; i++) html += `<div class="cal-day cal-day--empty"></div>`;

        // Days
        for (let day = 1; day <= lastDay; day++) {
            const ds       = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isToday  = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const faltas   = faltasByDay[day] || [];
            const td       = tipoDia(ds);
            const hasFaltas = faltas.length > 0;

            let extraClass = '';
            let tooltip    = '';
            let clickable  = true;

            if (td) {
                if (td.tipo === 'finde')    { extraClass = 'cal-day--finde';    clickable = false; }
                if (td.tipo === 'festivo')  { extraClass = 'cal-day--festivo';  tooltip = td.label; clickable = false; }
                if (td.tipo === 'examen')   { extraClass = 'cal-day--examen';   tooltip = td.label; /* sigue siendo lectivo */ }
                if (td.tipo === 'practica') { extraClass = 'cal-day--practica'; tooltip = td.label; clickable = hasFaltas; }
            }

            const dots = faltas.map(f => {
                const c = CONFIG.colors[f.asignatura] || '#64748b';
                return `<span class="cal-dot" style="background:${c};box-shadow:0 0 3px ${c}"></span>`;
            }).join('');

            const dayOfWeek    = new Date(year, month, day).getDay();
            // Un día es lectivo si no hay tipoDia, o si es examen (que sigue contando)
            const esBloqueante = td && td.bloqueante;
            const isLectivo    = !esBloqueante && dayOfWeek >= 1 && dayOfWeek <= 5;
            const titleAttr    = tooltip ? `title="${tooltip}${td && !td.bloqueante ? ' — sigue contando como lectivo' : ''}"` : (isLectivo ? `title="Click: ver faltas · Doble click: añadir falta"` : '');
            const onclickAttr  = (clickable || hasFaltas) ? `onclick="Actions.showCalDay(${day}, ${year}, ${month})"` : '';
            const dblclickAttr = isLectivo ? `ondblclick="Actions.showDaySchedule(${day}, ${year}, ${month})"` : '';

            html += `
            <div class="cal-day${isToday ? ' cal-day--today' : ''}${hasFaltas ? ' cal-day--has-faltas' : ''}${isLectivo ? ' cal-day--lectivo' : ''} ${extraClass}"
                 ${titleAttr} ${onclickAttr} ${dblclickAttr}>
                <span class="cal-day__num">${day}</span>
                ${td && td.tipo === 'examen'
                    ? `<span class="cal-day__label" style="opacity:0.6">📝</span><div class="cal-day__dots">${dots}</div>`
                    : td && td.tipo !== 'finde' && !hasFaltas
                        ? `<span class="cal-day__label">${
                            td.tipo === 'festivo'  ? '✕' :
                            td.tipo === 'practica' ? '🏢' : ''
                          }</span>`
                        : `<div class="cal-day__dots">${dots}</div>`
                }
                ${isLectivo ? `<span class="cal-day__hint">+</span>` : ''}
            </div>`;
        }

        grid.innerHTML = html;

        // Reset detail
        const detail = document.getElementById('cal-detail');
        if (detail) detail.style.display = 'none';
    },

    switchTab(tab) {
        State.activeTab = tab;
        document.querySelectorAll('.content-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

        if (tab === 'grafico')    this.renderChart();
        if (tab === 'calendario') this.renderCalendar();
        if (tab === 'calculadora') {
            const r = document.getElementById('calc-result');
            if (r) r.style.display = 'none';
        }
    },

    render() {
        this.renderTabs();
        this.renderTabla();
        this.renderErronkas();
        this.renderHistorial();
        this.renderStats();
        WeekSummary.render();
        if (State.activeTab === 'grafico')    this.renderChart();
        if (State.activeTab === 'calendario') this.renderCalendar();
    }
};

/* ============================================================
   6. MODALS
   ============================================================ */
const Modals = {
    registro: {
        open() {
            document.getElementById('register-modal').classList.add('open');
            const fecha = document.getElementById('fecha');
            fecha.max = CONFIG.practicas.end;
            fecha.valueAsDate = new Date();
            // Disparar autosugerencia con la fecha de hoy
            fecha.dispatchEvent(new Event('change'));
        },
        close() {
            document.getElementById('register-modal').classList.remove('open');
            const hint = document.getElementById('fecha-hint');
            if (hint) hint.remove();
        }
    },
    firebase: {
        open() {
            document.getElementById('firebase-modal').classList.add('open');
            const c = DB.credentials;
            if (c.apiKey)    document.getElementById('api-key').value    = c.apiKey;
            if (c.projectId) document.getElementById('project-id').value = c.projectId;
        },
        close() { document.getElementById('firebase-modal').classList.remove('open'); }
    },
    confirm: {
        _resolve: null,
        open(title, msg) {
            return new Promise(resolve => {
                this._resolve = resolve;
                document.getElementById('confirm-title').textContent   = title;
                document.getElementById('confirm-message').textContent = msg;
                document.getElementById('confirm-modal').classList.add('open');
            });
        },
        close(result) {
            document.getElementById('confirm-modal').classList.remove('open');
            if (this._resolve) this._resolve(result);
        }
    },
    trash: {
        open()  { Trash.cleanOld(); Trash.render(); document.getElementById('trash-modal')?.classList.add('open'); },
        close() { document.getElementById('trash-modal')?.classList.remove('open'); }
    },
    edit: {
        open(f) {
            document.getElementById('edit-id').value         = f.id;
            document.getElementById('edit-evaluacion').value = f.evaluacion || 1;
            document.getElementById('edit-fecha').max        = CONFIG.practicas.end;
            document.getElementById('edit-fecha').value      = f.fecha || '';
            document.getElementById('edit-asignatura').value = f.asignatura || '';
            document.getElementById('edit-horas').value      = f.horas || 2;
            document.getElementById('edit-tipo').value       = f.tipo || 'injustificada';
            document.getElementById('edit-nota').value       = f.nota || '';
            document.getElementById('edit-modal').classList.add('open');
        },
        close() { document.getElementById('edit-modal').classList.remove('open'); }
    }
};

/* ============================================================
   7. ACCIONES  (Toast ahora viene de shared.js)
   ============================================================ */
const Actions = {
    async registrarFalta() {
        const asignatura = document.getElementById('asignatura').value;
        const fecha      = document.getElementById('fecha').value;
        const horas      = parseInt(document.getElementById('horas').value);
        const evaluacion = parseInt(document.getElementById('evaluacion-input').value);
        const tipo       = document.getElementById('tipo').value;
        const nota       = document.getElementById('nota').value.trim();

        if (!asignatura) return Toast.show('Selecciona una asignatura', 'error');
        if (!fecha)      return Toast.show('Elige una fecha', 'error');
        if (isNaN(horas) || horas < 1) return Toast.show('Horas inválidas', 'error');
        if (fecha > CONFIG.practicas.end) {
            return Toast.show(`No hay clases después del ${new Date(CONFIG.practicas.end + 'T00:00:00').toLocaleDateString('es-ES')} (fin de curso)`, 'error', 4500);
        }

        const statsBefore = State.calcStats(asignatura);

        try {
            await DB.faltas.add({ asignatura, fecha, horas, evaluacion, tipo, nota });
            Modals.registro.close();
            document.getElementById('asignatura').value = '';
            document.getElementById('nota').value = '';

            // Notificaciones proactivas de estado
            const statsAfter = State.calcStats(asignatura);
            if (statsAfter.estado === 'danger' && statsBefore.estado !== 'danger') {
                Toast.show(`⛔ Límite alcanzado en ${CONFIG.asignaturas[asignatura].nombre.replace(/\s*\(.*\)/, '')}`, 'error', 5500);
            } else if (statsAfter.estado === 'warning' && statsBefore.estado !== 'warning') {
                Toast.show(`⚠ A mitad del límite en ${CONFIG.asignaturas[asignatura].nombre.replace(/\s*\(.*\)/, '')}`, 'info', 4500);
            } else {
                const erronka = erronkaForDate(fecha);
                Toast.show(`Falta registrada (Eval ${evaluacion})${erronka ? ' · ' + erronka.nombre : ''}`, 'success');
            }
        } catch(e) { console.error(e); Toast.show('Error al guardar', 'error'); }
    },

    async pedirEliminarFalta(id) {
        const ok = await Modals.confirm.open('Eliminar falta', '¿Seguro? Se moverá a la papelera durante 7 días y podrás recuperarla.');
        if (!ok) return;
        const falta = State.faltas.find(f => f.id === id);
        if (falta) Trash.add(falta);
        try {
            await DB.faltas.delete(id);
            Toast.show('Movida a la papelera — puedes recuperarla con T', 'info', 4000);
        } catch(e) { Toast.show('Error al eliminar', 'error'); }
    },

    async restaurarFalta(id) {
        const falta = Trash.getAll().find(f => f.id === id);
        if (!falta) return Toast.show('No encontrada en papelera', 'error');
        try {
            const { id: _id, deletedAt, ...data } = falta;
            await DB.faltas.add(data);
            Trash.remove(id);
            Trash.render();
            Toast.show('Falta restaurada', 'success');
        } catch(e) { Toast.show('Error al restaurar', 'error'); }
    },

    eliminarDefinitivo(id) {
        Trash.remove(id);
        Trash.render();
        Toast.show('Eliminada definitivamente', 'info');
    },

    editarFalta(id) {
        const f = State.faltas.find(f => f.id === id);
        if (!f) return Toast.show('No encontrada', 'error');
        Modals.edit.open(f);
    },

    async guardarEdicion() {
        const id         = document.getElementById('edit-id').value;
        const evaluacion = parseInt(document.getElementById('edit-evaluacion').value);
        const fecha      = document.getElementById('edit-fecha').value;
        const asignatura = document.getElementById('edit-asignatura').value;
        const horas      = parseInt(document.getElementById('edit-horas').value);
        const tipo       = document.getElementById('edit-tipo').value;
        const nota       = document.getElementById('edit-nota').value.trim();

        if (!fecha || !asignatura || isNaN(horas)) return Toast.show('Rellena todos los campos', 'error');
        if (fecha > CONFIG.practicas.end) {
            return Toast.show(`No hay clases después del ${new Date(CONFIG.practicas.end + 'T00:00:00').toLocaleDateString('es-ES')} (fin de curso)`, 'error', 4500);
        }
        try {
            await DB.faltas.update(id, { evaluacion, fecha, asignatura, horas, tipo, nota });
            Modals.edit.close();
            Toast.show('Falta actualizada', 'success');
            // Si el calendario está activo, refrescar el detalle del día visible
            if (State.activeTab === 'calendario') {
                setTimeout(() => UI.renderCalendar(), 300);
            }
        } catch(e) { Toast.show('Error al actualizar', 'error'); }
    },

    async limpiarBD() {
        const ok = await Modals.confirm.open('⚠ Limpiar base de datos', 'Se eliminarán TODAS las faltas de todas las evaluaciones. Irreversible.');
        if (!ok) return;
        try { await DB.faltas.deleteAll(); Toast.show('Base de datos limpiada', 'info'); }
        catch(e) { Toast.show('Error al limpiar', 'error'); }
    },

    exportarJSON() {
        const blob = new Blob([JSON.stringify({ exportado: new Date().toISOString(), faltas: State.faltas }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `asistencia-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        Toast.show('JSON exportado', 'success');
    },

    importarJSON(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async e => {
            try {
                const data = JSON.parse(e.target.result);
                const faltas = data.faltas || data;
                if (!Array.isArray(faltas)) throw new Error('Formato inválido');

                const ok = await Modals.confirm.open('Importar JSON', `Se importarán ${faltas.length} faltas. ¿Continuar?`);
                if (!ok) return;

                let errores = 0;
                for (const f of faltas) {
                    if (!f.asignatura || !f.fecha || !f.horas) { errores++; continue; }
                    try {
                        await DB.faltas.add({ asignatura: f.asignatura, fecha: f.fecha, horas: f.horas, evaluacion: f.evaluacion || 1, tipo: f.tipo || 'injustificada', nota: f.nota || '' });
                    } catch { errores++; }
                }
                Toast.show(`Importadas ${faltas.length - errores} faltas${errores ? ` (${errores} errores)` : ''}`, 'success');
            } catch(e) { Toast.show('Error al importar JSON', 'error'); }
        };
        reader.readAsText(file);
    },

    cambiarEvaluacion(val) {
        State.evaluacion = val === 'total' ? 'total' : parseInt(val);
        UI.render();
    },

    cambiarFiltro(filtro) {
        State.filtroActivo = filtro;
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === filtro));
        UI.renderTabla();
        UI.renderErronkas();
    },

    guardarConfigFirebase() {
        const key = document.getElementById('api-key').value.trim();
        const id  = document.getElementById('project-id').value.trim();
        if (!key || !id) return Toast.show('Completa ambos campos', 'error');
        localStorage.setItem('firebase_apiKey', key);
        localStorage.setItem('firebase_projectId', id);
        Toast.show('Guardado. Recargando…', 'success');
        setTimeout(() => location.reload(), 1200);
    },

    calPrev() {
        State.calMonth--;
        if (State.calMonth < 0) { State.calMonth = 11; State.calYear--; }
        UI.renderCalendar();
    },

    calNext() {
        State.calMonth++;
        if (State.calMonth > 11) { State.calMonth = 0; State.calYear++; }
        UI.renderCalendar();
    },

    showDaySchedule(day, year, month) {
        const detail = document.getElementById('cal-detail');
        if (!detail) return;

        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const date    = new Date(dateStr + 'T00:00:00');
        const dow     = date.getDay(); // 1=Mon…5=Fri
        const schedule = CONFIG.horasDiarias[dow] || {};
        const keys    = Object.keys(schedule);
        const dateFormatted = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        // Already existing faltas on this day
        const existingFaltas = State.faltas.filter(f => f.fecha === dateStr);

        if (keys.length === 0) {
            detail.style.display = 'block';
            detail.innerHTML = `<div class="cal-detail__title">${dateFormatted}</div>
                <div style="color:var(--txt-muted);font-size:0.85rem;padding:8px 0">No hay clases este día.</div>`;
            return;
        }

        // Detect eval for this date
        const evalNum = evalForDate(dateStr);

        const scheduleRows = keys.map(key => {
            const color   = CONFIG.colors[key] || '#64748b';
            const horas   = schedule[key];
            const asig    = CONFIG.asignaturas[key];
            const yaFaltó = existingFaltas.find(f => f.asignatura === key);
            const s       = State.calcStats(key);
            const badgeCls = s.estado === 'danger' ? 'badge--danger' : s.estado === 'warning' ? 'badge--warning' : 'badge--ok';
            const badgeTxt = s.estado === 'danger' ? '⛔' : s.estado === 'warning' ? '⚠' : '✓';

            return `
            <div class="schedule-row${yaFaltó ? ' schedule-row--done' : ''}"
                 onclick="Actions.quickRegister('${key}', '${dateStr}', ${horas}, ${evalNum})"
                 title="Click para registrar falta de ${key}">
                <span class="td-dot" style="background:${color};box-shadow:0 0 6px ${color};width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0"></span>
                <div style="flex:1">
                    <div style="font-weight:600;font-size:0.88rem;color:var(--txt-primary)">${asig.nombre}</div>
                    <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--txt-secondary)">${horas}h · ${s.horasRestantes}h disponibles</div>
                </div>
                <span class="badge ${badgeCls}" style="font-size:0.68rem">${badgeTxt}</span>
                ${yaFaltó
                    ? `<span style="font-size:0.72rem;color:var(--txt-muted);font-family:var(--font-mono)">ya registrado</span>`
                    : `<button class="btn-ghost btn-sm" style="font-size:0.72rem" onclick="event.stopPropagation();Actions.quickRegister('${key}','${dateStr}',${horas},${evalNum})">+ Falta</button>`
                }
            </div>`;
        }).join('');

        // Total hours that day
        const totalHorasDia = keys.reduce((s, k) => s + schedule[k], 0);

        detail.style.display = 'block';
        detail.innerHTML = `
            <div class="cal-detail__title">
                📅 ${dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1)}
                <span style="font-size:0.75rem;color:var(--txt-muted);font-weight:400;margin-left:8px;font-family:var(--font-mono)">${totalHorasDia}h de clase</span>
            </div>
            <div style="font-size:0.72rem;color:var(--txt-muted);font-family:var(--font-mono);margin-bottom:12px">
                Click en una asignatura para registrar falta · Doble click en el día para esta vista
            </div>
            ${scheduleRows}
            <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
                <button class="btn-primary btn-full" onclick="Actions.faltarTodoDia('${dateStr}', ${evalNum})"
                    style="font-size:0.85rem;padding:10px">
                    📋 Faltar todo el día (${totalHorasDia}h)
                </button>
            </div>`;
    },

    quickRegister(key, dateStr, horas, evalNum) {
        // Open register modal pre-filled
        Modals.registro.open();
        setTimeout(() => {
            document.getElementById('fecha').value            = dateStr;
            document.getElementById('asignatura').value       = key;
            document.getElementById('horas').value            = horas;
            document.getElementById('evaluacion-input').value = evalNum;
            // Trigger hint update
            document.getElementById('fecha').dispatchEvent(new Event('change'));
        }, 50);
    },

    async faltarTodoDia(dateStr, evalNum) {
        const date  = new Date(dateStr + 'T00:00:00');
        const dow   = date.getDay();
        const sched = CONFIG.horasDiarias[dow] || {};
        const keys  = Object.keys(sched);
        if (keys.length === 0) return Toast.show('No hay clases este día', 'info');

        const dateFormatted = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const totalH = keys.reduce((s, k) => s + sched[k], 0);

        const ok = await Modals.confirm.open(
            '📋 Faltar todo el día',
            `¿Registrar falta en todas las asignaturas del ${dateFormatted}? (${keys.join(', ')} — ${totalH}h en total)`
        );
        if (!ok) return;

        let registradas = 0;
        for (const key of keys) {
            try {
                await DB.faltas.add({ asignatura: key, fecha: dateStr, horas: sched[key], evaluacion: evalNum, tipo: 'injustificada', nota: '' });
                registradas++;
            } catch(e) { console.error(e); }
        }

        Toast.show(`${registradas} faltas registradas (${totalH}h)`, 'success');
    },

    showCalDay(day, year, month) {
        const detail = document.getElementById('cal-detail');
        if (!detail) return;

        const faltas = State.faltas.filter(f => {
            if (!f.fecha) return false;
            const d = new Date(f.fecha + 'T00:00:00');
            return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        });

        if (faltas.length === 0) { detail.style.display = 'none'; return; }

        const dateStr = new Date(year, month, day)
            .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        detail.style.display = 'block';
        detail.innerHTML = `
            <div class="cal-detail__title">${dateStr}</div>
            ${faltas.map(f => {
                const color = CONFIG.colors[f.asignatura] || '#64748b';
                const esJ   = f.tipo === 'justificada';
                return `
                <div class="cal-detail__item">
                    <span class="cal-dot" style="background:${color};box-shadow:0 0 5px ${color};flex-shrink:0;margin-top:3px"></span>
                    <div style="flex:1;min-width:0">
                        <strong>${CONFIG.asignaturas[f.asignatura]?.nombre || f.asignatura}</strong>
                        <span class="tipo-badge ${esJ ? 'tipo-j' : 'tipo-i'}" style="margin-left:8px">${esJ ? 'Justificada' : 'Injustificada'}</span>
                        <br><small>${f.horas}h${f.nota ? ` · <em>${f.nota}</em>` : ''}</small>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
                        <button class="btn-micro" onclick="Actions.editarFalta('${f.id}')" title="Editar falta">✏</button>
                        <button class="btn-micro btn-micro--danger" onclick="Actions.pedirEliminarFalta('${f.id}')" title="Eliminar falta">✕</button>
                    </div>
                </div>`;
            }).join('')}`;
    },

    simular() {
        const key        = document.getElementById('calc-asignatura').value;
        const horas      = parseInt(document.getElementById('calc-horas').value);
        const erronkaSel = document.getElementById('calc-erronka');
        const erronkaIdx = erronkaSel ? erronkaSel.value : '';

        if (!key)                      return Toast.show('Selecciona una asignatura', 'error');
        if (isNaN(horas) || horas < 1) return Toast.show('Horas inválidas', 'error');

        const evalNum = State.evaluacion === 'total' ? null : State.evaluacion;
        const antes   = State.calcStats(key);
        const despues = State.calcStats(key, horas);
        const asig    = CONFIG.asignaturas[key];
        const color   = CONFIG.colors[key] || '#64748b';
        const erronka = erronkaIdx !== '' ? CONFIG.erronkas[parseInt(erronkaIdx)] : null;

        const estadoIcon  = s => s.estado === 'danger' ? '⛔' : s.estado === 'warning' ? '⚠️' : '✅';
        const estadoLabel = s => s.estado === 'danger' ? 'Peligro' : s.estado === 'warning' ? 'Riesgo' : 'Correcto';
        const estadoColor = s => s.estado === 'danger' ? 'var(--red)' : s.estado === 'warning' ? 'var(--amber)' : 'var(--lime)';
        const badgeCls    = s => s.estado === 'danger' ? 'badge--danger' : s.estado === 'warning' ? 'badge--warning' : 'badge--ok';

        const pBar = (horasF, limiteH, estado) => {
            const pct = limiteH > 0 ? Math.min(100, horasF / limiteH * 100) : 0;
            const cls = estado === 'danger' ? 'progress-fill--danger' : estado === 'warning' ? 'progress-fill--warn' : '';
            return `
            <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
                <div class="progress-bar" style="flex:1;height:7px">
                    <div class="progress-fill ${cls}" style="width:${pct.toFixed(0)}%"></div>
                </div>
                <span style="font-family:var(--font-mono);font-size:0.78rem;color:${estadoColor({estado})};min-width:38px;text-align:right">${pct.toFixed(1)}%</span>
            </div>`;
        };

        // Cuántas clases completas puedes faltar aún tras la simulación
        const margenDespues = despues.horasRestantes;
        const horasPorSesion = Math.min(...Object.values(CONFIG.horasDiarias)
            .map(d => d[key] || 0)
            .filter(h => h > 0));
        const clasesPermitidas = horasPorSesion > 0
            ? Math.floor(margenDespues / horasPorSesion)
            : '—';

        // Cuántas horas llevas faltando ya (antes de esta simulación)
        const yaFaltadas = antes.horasFaltadas;

        // Alerta principal
        let alertaHTML = '';
        if (despues.horasFaltadas >= despues.limiteH) {
            alertaHTML = `
            <div class="calc-alert calc-alert--danger">
                ⛔ <strong>Límite superado.</strong> Con esta falta habrás agotado tu margen en ${asig.nombre.replace(/\s*\(.*\)/,'')}. No puedes faltar ni una hora más.
            </div>`;
        } else if (despues.estado === 'warning' && antes.estado === 'ok') {
            alertaHTML = `
            <div class="calc-alert calc-alert--warning">
                ⚠️ <strong>Entraste en zona de riesgo.</strong> Te quedan solo ${margenDespues}h de margen (${clasesPermitidas} clase(s) más que puedes faltar).
            </div>`;
        } else if (despues.estado === 'danger' && antes.estado !== 'danger') {
            alertaHTML = `
            <div class="calc-alert calc-alert--danger">
                ⛔ <strong>¡Peligro!</strong> Superarías el límite del 20%. Te quedan 0h disponibles tras esta falta.
            </div>`;
        } else {
            alertaHTML = `
            <div class="calc-alert calc-alert--ok">
                ✅ <strong>Sin cambio de estado.</strong> Seguirías en ${estadoLabel(despues)}. Te quedarían <strong>${margenDespues}h</strong> de margen.
            </div>`;
        }

        // Bloque de erronka (opcional): impacto de la simulación en la erronka seleccionada
        let erronkaHTML = '';
        if (erronka) {
            const fIni = new Date(erronka.start + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            const fFin = new Date(erronka.end   + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            const eAntes   = State.calcErronkaStats(erronka);
            const eDespues = State.calcErronkaStats(erronka, horas);

            erronkaHTML = `
            <div class="calc-erronka-divider"></div>

            <div class="calc-asig-header">
                <span class="td-dot td-dot--erronka" style="width:12px;height:12px;border-radius:50%;display:inline-block"></span>
                <strong style="font-family:var(--font-display);font-size:1.05rem">${erronka.nombre}</strong>
                <span style="color:var(--txt-secondary);font-size:0.82rem;font-family:var(--font-mono)">${fIni} → ${fFin}</span>
            </div>

            <div class="calc-compare">
                <div class="calc-card">
                    <span class="calc-card__label">Estado actual</span>
                    <div style="display:flex;align-items:baseline;gap:8px;margin:10px 0 4px">
                        <span class="calc-card__hours">${eAntes.horasFaltadas}h</span>
                        <span style="color:var(--txt-muted);font-family:var(--font-mono);font-size:0.82rem">/ ${eAntes.limiteH}h límite</span>
                    </div>
                    <span class="badge ${badgeCls(eAntes)}">${estadoIcon(eAntes)} ${estadoLabel(eAntes)}</span>
                    ${pBar(eAntes.horasFaltadas, eAntes.limiteH, eAntes.estado)}
                    <div style="margin-top:10px;font-family:var(--font-mono);font-size:0.75rem;color:var(--txt-secondary)">
                        Disponibles: <span style="color:${estadoColor(eAntes)};font-weight:700">${eAntes.horasRestantes}h</span>
                    </div>
                </div>

                <div class="calc-arrow">→</div>

                <div class="calc-card calc-card--projected">
                    <span class="calc-card__label">Tras faltar ${horas}h</span>
                    <div style="display:flex;align-items:baseline;gap:8px;margin:10px 0 4px">
                        <span class="calc-card__hours" style="color:${estadoColor(eDespues)}">${eDespues.horasFaltadas}h</span>
                        <span style="color:var(--txt-muted);font-family:var(--font-mono);font-size:0.82rem">/ ${eDespues.limiteH}h límite</span>
                    </div>
                    <span class="badge ${badgeCls(eDespues)}">${estadoIcon(eDespues)} ${estadoLabel(eDespues)}</span>
                    ${pBar(eDespues.horasFaltadas, eDespues.limiteH, eDespues.estado)}
                    <div style="margin-top:10px;font-family:var(--font-mono);font-size:0.75rem;color:var(--txt-secondary)">
                        Disponibles: <span style="color:${estadoColor(eDespues)};font-weight:700">${eDespues.horasRestantes}h</span>
                    </div>
                </div>
            </div>

            <div class="calc-stats-row">
                <div class="calc-stat">
                    <span class="calc-stat__label">Margen restante (erronka)</span>
                    <span class="calc-stat__val" style="color:${estadoColor(eDespues)}">${eDespues.horasRestantes}h</span>
                </div>
                <div class="calc-stat">
                    <span class="calc-stat__label">% faltado (erronka)</span>
                    <span class="calc-stat__val">${eDespues.pct.toFixed(1)}%</span>
                </div>
            </div>`;
        }

        const result = document.getElementById('calc-result');
        result.style.display = 'block';
        result.innerHTML = `

            <!-- Cabecera con asignatura -->
            <div class="calc-asig-header">
                <span class="td-dot" style="background:${color};box-shadow:0 0 8px ${color};width:12px;height:12px;border-radius:50%;display:inline-block"></span>
                <strong style="font-family:var(--font-display);font-size:1.05rem">${asig.nombre}</strong>
                <span style="color:var(--txt-secondary);font-size:0.82rem;font-family:var(--font-mono)">+${horas}h simuladas</span>
            </div>

            <!-- Comparativa antes / después -->
            <div class="calc-compare">

                <div class="calc-card">
                    <span class="calc-card__label">Estado actual</span>
                    <div style="display:flex;align-items:baseline;gap:8px;margin:10px 0 4px">
                        <span class="calc-card__hours">${antes.horasFaltadas}h</span>
                        <span style="color:var(--txt-muted);font-family:var(--font-mono);font-size:0.82rem">/ ${antes.limiteH}h límite</span>
                    </div>
                    <span class="badge ${badgeCls(antes)}">${estadoIcon(antes)} ${estadoLabel(antes)}</span>
                    ${pBar(antes.horasFaltadas, antes.limiteH, antes.estado)}
                    <div style="margin-top:10px;font-family:var(--font-mono);font-size:0.75rem;color:var(--txt-secondary)">
                        Disponibles: <span style="color:${estadoColor(antes)};font-weight:700">${antes.horasRestantes}h</span>
                    </div>
                </div>

                <div class="calc-arrow">→</div>

                <div class="calc-card calc-card--projected">
                    <span class="calc-card__label">Tras faltar ${horas}h</span>
                    <div style="display:flex;align-items:baseline;gap:8px;margin:10px 0 4px">
                        <span class="calc-card__hours" style="color:${estadoColor(despues)}">${despues.horasFaltadas}h</span>
                        <span style="color:var(--txt-muted);font-family:var(--font-mono);font-size:0.82rem">/ ${despues.limiteH}h límite</span>
                    </div>
                    <span class="badge ${badgeCls(despues)}">${estadoIcon(despues)} ${estadoLabel(despues)}</span>
                    ${pBar(despues.horasFaltadas, despues.limiteH, despues.estado)}
                    <div style="margin-top:10px;font-family:var(--font-mono);font-size:0.75rem;color:var(--txt-secondary)">
                        Disponibles: <span style="color:${estadoColor(despues)};font-weight:700">${margenDespues}h</span>
                    </div>
                </div>
            </div>

            <!-- Stats extra -->
            <div class="calc-stats-row">
                <div class="calc-stat">
                    <span class="calc-stat__label">Margen restante</span>
                    <span class="calc-stat__val" style="color:${estadoColor(despues)}">${margenDespues}h</span>
                </div>
                <div class="calc-stat">
                    <span class="calc-stat__label">Clases que aún puedes faltar</span>
                    <span class="calc-stat__val" style="color:${clasesPermitidas === 0 ? 'var(--red)' : 'var(--txt-primary)'}">${clasesPermitidas === 0 ? '⛔ 0' : clasesPermitidas}</span>
                </div>
                <div class="calc-stat">
                    <span class="calc-stat__label">% del total eval</span>
                    <span class="calc-stat__val">${despues.pct.toFixed(1)}%</span>
                </div>
                <div class="calc-stat">
                    <span class="calc-stat__label">Horas ya faltadas</span>
                    <span class="calc-stat__val" style="color:var(--txt-secondary)">${yaFaltadas}h</span>
                </div>
            </div>

            ${erronkaHTML}
            ${alertaHTML}
        `;
    }
};

window.Actions = Actions;

/* ============================================================
   AJUSTES DEL CURSO (pantalla para editar fechas)
   ============================================================ */
const ConfigSettings = {
    open() {
        this.build();
        document.getElementById('config-modal').classList.add('open');
    },
    close() {
        document.getElementById('config-modal').classList.remove('open');
    },

    build() {
        const el = document.getElementById('config-content');
        if (!el) return;

        const evalsHTML = Object.keys(CONFIG.evalInicio).map(n => `
            <div class="cfg-group">
                <div class="cfg-group__title">Evaluación ${n}</div>
                <div class="cfg-grid">
                    <div class="field">
                        <label>Inicio</label>
                        <input type="date" data-cfg="evalInicio-${n}" value="${CONFIG.evalInicio[n]}">
                    </div>
                    <div class="field">
                        <label>Fin</label>
                        <input type="date" data-cfg="evalFin-${n}" value="${CONFIG.evalFin[n]}">
                    </div>
                </div>
            </div>`).join('');

        const erronkasHTML = CONFIG.erronkas.map(er => `
            <div class="cfg-row" data-cfg-row="erronka">
                <input type="text" class="cfg-row__name" data-name placeholder="Nombre" value="${er.nombre}">
                <input type="date" data-start value="${er.start}">
                <span class="cfg-row__sep">→</span>
                <input type="date" data-end value="${er.end}">
                <button type="button" class="btn-micro btn-micro--danger" data-remove title="Quitar">✕</button>
            </div>`).join('');

        const festivosHTML = CONFIG.festivosRangos.map(r => `
            <div class="cfg-row" data-cfg-row="festivo">
                <input type="date" data-start value="${r[0]}">
                <span class="cfg-row__sep">→</span>
                <input type="date" data-end value="${r[1]}">
                <button type="button" class="btn-micro btn-micro--danger" data-remove title="Quitar">✕</button>
            </div>`).join('');

        el.innerHTML = `
            <p class="modal-hint">Personaliza las fechas del curso. Se guardan en este dispositivo y se aplican a Faltas y Horario.</p>

            <div class="cfg-section">
                <h4 class="cfg-section__title">📅 Evaluaciones</h4>
                ${evalsHTML}
            </div>

            <div class="cfg-section">
                <h4 class="cfg-section__title">🗂 Erronkas</h4>
                <div class="cfg-list" id="cfg-erronkas">${erronkasHTML}</div>
                <button type="button" class="btn-ghost btn-sm" id="cfg-add-erronka">+ Añadir erronka</button>
            </div>

            <div class="cfg-section">
                <h4 class="cfg-section__title">🏢 Prácticas (FCT)</h4>
                <div class="cfg-grid">
                    <div class="field">
                        <label>Inicio</label>
                        <input type="date" data-cfg="practicas-start" value="${CONFIG.practicas.start}">
                    </div>
                    <div class="field">
                        <label>Fin</label>
                        <input type="date" data-cfg="practicas-end" value="${CONFIG.practicas.end}">
                    </div>
                </div>
            </div>

            <div class="cfg-section">
                <h4 class="cfg-section__title">🎉 Festivos (rangos)</h4>
                <div class="cfg-list" id="cfg-festivos">${festivosHTML}</div>
                <button type="button" class="btn-ghost btn-sm" id="cfg-add-festivo">+ Añadir festivo</button>
            </div>

            <div class="confirm-buttons" style="margin-top:8px">
                <button type="button" class="btn-danger-ghost" id="cfg-reset">↺ Restablecer por defecto</button>
                <span style="flex:1"></span>
                <button type="button" class="btn-ghost" id="cfg-cancel">Cancelar</button>
                <button type="button" class="btn-primary" id="cfg-save">💾 Guardar</button>
            </div>`;

        document.getElementById('cfg-add-erronka').addEventListener('click', () => this.addRow('erronka'));
        document.getElementById('cfg-add-festivo').addEventListener('click', () => this.addRow('festivo'));
        document.getElementById('cfg-cancel').addEventListener('click', () => this.close());
        document.getElementById('cfg-save').addEventListener('click', () => this.save());
        document.getElementById('cfg-reset').addEventListener('click', () => this.reset());

        el.querySelectorAll('[data-remove]').forEach(b => {
            b.addEventListener('click', () => b.closest('.cfg-row').remove());
        });
    },

    addRow(tipo) {
        const wrap = document.getElementById(tipo === 'erronka' ? 'cfg-erronkas' : 'cfg-festivos');
        const div = document.createElement('div');
        div.className = 'cfg-row';
        div.dataset.cfgRow = tipo;

        const nameInput = tipo === 'erronka'
            ? `<input type="text" class="cfg-row__name" data-name placeholder="Nombre" value="Nueva Erronka">`
            : '';

        div.innerHTML = `
            ${nameInput}
            <input type="date" data-start>
            <span class="cfg-row__sep">→</span>
            <input type="date" data-end>
            <button type="button" class="btn-micro btn-micro--danger" data-remove title="Quitar">✕</button>`;
        div.querySelector('[data-remove]').addEventListener('click', () => div.remove());
        wrap.appendChild(div);
    },

    save() {
        const val = dataCfg => {
            const inp = document.querySelector(`[data-cfg="${dataCfg}"]`);
            return inp ? inp.value : '';
        };

        const evalInicio = {}, evalFin = {};
        for (const n of Object.keys(CONFIG.evalInicio)) {
            evalInicio[n] = val(`evalInicio-${n}`);
            evalFin[n]    = val(`evalFin-${n}`);
        }

        const erronkas = [];
        document.querySelectorAll('#cfg-erronkas .cfg-row').forEach(row => {
            const nombre = row.querySelector('[data-name]').value.trim();
            const start  = row.querySelector('[data-start]').value;
            const end    = row.querySelector('[data-end]').value;
            if (nombre && start && end) erronkas.push({ nombre, start, end });
        });

        const festivosRangos = [];
        document.querySelectorAll('#cfg-festivos .cfg-row').forEach(row => {
            const start = row.querySelector('[data-start]').value;
            const end   = row.querySelector('[data-end]').value;
            if (start && end) festivosRangos.push([start, end]);
        });

        const practicas = {
            start: val('practicas-start'),
            end:   val('practicas-end'),
            label: CONFIG.practicas.label
        };

        // Validación mínima
        for (const n of Object.keys(evalInicio)) {
            if (!evalInicio[n] || !evalFin[n]) return Toast.show(`Completa las fechas de la evaluación ${n}`, 'error');
            if (evalInicio[n] > evalFin[n])    return Toast.show(`La evaluación ${n} tiene el inicio posterior al fin`, 'error');
        }
        if (!practicas.start || !practicas.end) return Toast.show('Completa las fechas de prácticas', 'error');
        if (erronkas.length === 0) return Toast.show('Añade al menos una erronka', 'error');

        guardarConfigCurso({ evalInicio, evalFin, erronkas, festivosRangos, practicas });
        Toast.show('Ajustes guardados. Recargando…', 'success');
        setTimeout(() => location.reload(), 900);
    },

    reset() {
        resetearConfigCurso();
        Toast.show('Valores por defecto restaurados. Recargando…', 'success');
        setTimeout(() => location.reload(), 900);
    }
};

/* ============================================================
   9. EVENTOS
   ============================================================ */
function initEvents() {
    // Eval tabs
    document.querySelectorAll('.eval-tab').forEach(btn =>
        btn.addEventListener('click', () => Actions.cambiarEvaluacion(btn.dataset.eval)));

    // Content tabs
    document.querySelectorAll('.content-tab').forEach(btn =>
        btn.addEventListener('click', () => UI.switchTab(btn.dataset.tab)));

    // Filtros
    document.querySelectorAll('.btn-filter').forEach(btn =>
        btn.addEventListener('click', () => Actions.cambiarFiltro(btn.dataset.filter)));

    // Registro modal
    document.getElementById('btn-abrir-registro').addEventListener('click', () => Modals.registro.open());
    document.getElementById('register-close').addEventListener('click',    () => Modals.registro.close());
    document.getElementById('register-backdrop').addEventListener('click', () => Modals.registro.close());
    document.getElementById('btn-registrar').addEventListener('click',     () => Actions.registrarFalta());

    // Autosugerencia de asignatura al cambiar fecha
    document.getElementById('fecha').addEventListener('change', e => {
        if (!e.target.value) return;
        const d   = new Date(e.target.value + 'T00:00:00');
        const td  = tipoDia(e.target.value);
        const sel = document.getElementById('asignatura');

        // Limpiar hint previo
        let hint = document.getElementById('fecha-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'fecha-hint';
            // Insertar justo antes del botón registrar
            const btn = document.getElementById('btn-registrar');
            btn.parentElement.insertBefore(hint, btn);
        }

        // Reset estilos opciones
        Array.from(sel.options).forEach(opt => {
            opt.style.color = ''; opt.style.fontWeight = '';
        });

        if (td && td.tipo !== 'finde') {
            hint.style.cssText = 'font-size:0.8rem;color:var(--amber);padding:8px 12px;background:rgba(255,184,48,0.08);border:1px solid rgba(255,184,48,0.2);border-radius:8px;font-family:var(--font-mono);margin-bottom:4px;';
            hint.textContent = `⚠ ${td.label} — día no lectivo`;
            return;
        }

        const dow      = d.getDay(); // 0=dom … 6=sab
        const asigHoy  = asignaturasDelDia(d);

        if (asigHoy.length === 0 || dow === 0 || dow === 6) {
            hint.style.cssText = 'font-size:0.8rem;color:var(--txt-muted);padding:8px 12px;border-radius:8px;font-family:var(--font-mono);margin-bottom:4px;';
            hint.textContent = 'Sin clases este día';
            return;
        }

        // Hint verde con asignaturas del día
        hint.style.cssText = 'font-size:0.8rem;color:var(--cyan);padding:8px 12px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.18);border-radius:8px;font-family:var(--font-mono);margin-bottom:4px;';
        const diasNombre = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        hint.textContent = `${diasNombre[dow]}: ${asigHoy.join(', ')}`;

        // Resaltar asignaturas del día en el select
        Array.from(sel.options).forEach(opt => {
            if (!opt.value) return;
            const esDia = asigHoy.includes(opt.value);
            opt.style.color      = esDia ? '#f0f4ff' : '#3d4a63';
            opt.style.fontWeight = esDia ? '700' : '400';
        });

        // Preseleccionar si solo hay una asignatura y el select está vacío
        if (asigHoy.length === 1 && !sel.value) sel.value = asigHoy[0];

        // Autodetectar evaluación según fecha
        const dateStr = e.target.value;
        const evalSugerida = evalForDate(dateStr);
        document.getElementById('evaluacion-input').value = evalSugerida;
    });

    // Trash
    document.getElementById('btn-trash')?.addEventListener('click', () => Modals.trash.open());
    document.getElementById('trash-close')?.addEventListener('click', () => Modals.trash.close());
    document.getElementById('trash-backdrop')?.addEventListener('click', () => Modals.trash.close());
    document.getElementById('btn-trash-clear')?.addEventListener('click', async () => {
        const ok = await Modals.confirm.open('Vaciar papelera', '¿Eliminar todas las faltas de la papelera definitivamente?');
        if (!ok) return;
        Trash.clear();
        Trash.render();
        Toast.show('Papelera vaciada', 'info');
    });

    // Shortcuts modal
    document.getElementById('btn-shortcuts')?.addEventListener('click', () => document.getElementById('shortcuts-modal')?.classList.add('open'));
    document.getElementById('shortcuts-close')?.addEventListener('click', () => document.getElementById('shortcuts-modal')?.classList.remove('open'));
    document.getElementById('shortcuts-backdrop')?.addEventListener('click', () => document.getElementById('shortcuts-modal')?.classList.remove('open'));

    // Compact view
    document.getElementById('btn-compact')?.addEventListener('click', () => CompactView.toggle());

    // Logout
    // Logout eliminado — la app ya no requiere login

    // Firebase modal
    document.getElementById('btn-settings').addEventListener('click',   () => Modals.firebase.open());
    document.getElementById('modal-close').addEventListener('click',    () => Modals.firebase.close());
    document.getElementById('modal-backdrop').addEventListener('click', () => Modals.firebase.close());
    document.getElementById('btn-guardar-config').addEventListener('click', () => Actions.guardarConfigFirebase());

    // Ajustes del curso (fechas)
    document.getElementById('btn-ajustes').addEventListener('click',    () => ConfigSettings.open());
    document.getElementById('config-close').addEventListener('click',    () => ConfigSettings.close());
    document.getElementById('config-backdrop').addEventListener('click', () => ConfigSettings.close());

    // Edit modal
    document.getElementById('edit-close').addEventListener('click',   () => Modals.edit.close());
    document.getElementById('edit-cancel').addEventListener('click',  () => Modals.edit.close());
    document.getElementById('edit-backdrop').addEventListener('click',() => Modals.edit.close());
    document.getElementById('edit-save').addEventListener('click',    () => Actions.guardarEdicion());

    // Confirm modal
    document.getElementById('confirm-ok').addEventListener('click',     () => Modals.confirm.close(true));
    document.getElementById('confirm-cancel').addEventListener('click',  () => Modals.confirm.close(false));
    document.getElementById('confirm-backdrop').addEventListener('click',() => Modals.confirm.close(false));

    // Exportar / importar / limpiar
    document.getElementById('btn-exportar').addEventListener('click', () => Actions.exportarJSON());
    const fileEl = document.getElementById('file-importar');
    document.getElementById('btn-importar').addEventListener('click', () => fileEl.click());
    fileEl.addEventListener('change', e => { Actions.importarJSON(e.target.files[0]); e.target.value = ''; });
    document.getElementById('btn-limpiar').addEventListener('click', () => Actions.limpiarBD());

    // Calendario
    document.getElementById('cal-prev').addEventListener('click', () => Actions.calPrev());
    document.getElementById('cal-next').addEventListener('click', () => Actions.calNext());

    // Calculadora
    document.getElementById('btn-simular').addEventListener('click', () => Actions.simular());

    // Escape — all modals
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        Modals.registro.close(); Modals.firebase.close();
        Modals.confirm.close(false); Modals.edit.close();
        Modals.trash.close(); ConfigSettings.close();
        document.getElementById('shortcuts-modal')?.classList.remove('open');
    });
}

/* ============================================================
   10. UTILIDAD
   ============================================================ */
function populateAsigSelects() {
    document.querySelectorAll('select.asig-select').forEach(sel => {
        const hasPlaceholder = sel.querySelector('option[value=""]');
        const placeholderHTML = hasPlaceholder ? hasPlaceholder.outerHTML : '';
        const optionsHTML = Object.entries(CONFIG.asignaturas)
            .map(([key, asig]) => `<option value="${key}">${asig.nombre}</option>`)
            .join('');
        sel.innerHTML = placeholderHTML + optionsHTML;
    });
}

function populateErronkaSelect() {
    const sel = document.getElementById('calc-erronka');
    if (!sel) return;
    const placeholder = sel.querySelector('option[value=""]');
    const optionsHTML = CONFIG.erronkas
        .map((er, i) => `<option value="${i}">${er.nombre}</option>`)
        .join('');
    sel.innerHTML = (placeholder ? placeholder.outerHTML : '') + optionsHTML;
}

function autoSetEval() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const ds = `${y}-${m}-${d}`;

    State.evaluacion = evalForDate(ds);
}

/* ============================================================
   11. INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e));
    }

    // Init trash badge
    Trash.cleanOld();
    Trash.updateBadge();

    // Init keyboard shortcuts
    Shortcuts.init();

    autoSetEval();
    populateAsigSelects();
    initEvents();
    UI.render();
    initFirebaseFaltas();
});
