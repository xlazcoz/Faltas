/**
 * horario.js — Horario interactivo (usa shared.js: CONFIG, DB, Auth, Toast, tipoDia)
 */

/* ============================================================
   ESTADO
   ============================================================ */
const HState = {
    faltas: [],
    notas: {},
    selected: null // key de asignatura seleccionada
};

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const SLOT_LABELS = [
    '08:00','08:30','09:00','09:30','10:00','10:30','11:00',
    '11:30','12:00','12:30','13:00','13:30','14:00'
]; // 13 slots de 30 min, slot i = inicio de bloque

function currentEval() {
    const t = new Date();
    const y = t.getFullYear(), m = String(t.getMonth()+1).padStart(2,'0'), d = String(t.getDate()).padStart(2,'0');
    return evalForDate(`${y}-${m}-${d}`);
}

function calcStatsFor(key, evalNum) {
    const asig = CONFIG.asignaturas[key];
    const totalH = asig.eval[evalNum];
    const lista  = HState.faltas.filter(f => f.asignatura === key && Number(f.evaluacion) === evalNum);
    const horasFaltadas  = lista.reduce((s, f) => s + (f.horas || 0), 0);
    const pct            = totalH > 0 ? (horasFaltadas / totalH) * 100 : 0;
    const limiteH        = Math.floor(totalH * CONFIG.limitePct / 100);
    const horasRestantes = Math.max(0, limiteH - horasFaltadas);
    let estado = 'ok';
    if (horasFaltadas >= limiteH)          estado = 'danger';
    else if (horasFaltadas >= limiteH / 2) estado = 'warning';
    return { horasFaltadas, totalH, pct, limiteH, horasRestantes, estado };
}

/** Próxima fecha (YYYY-MM-DD) en que cae un día de la semana dado (1=lunes...5=viernes), hoy incluido */
function nextDateForDow(dow) {
    const today = new Date();
    const todayDow = today.getDay() === 0 ? 7 : today.getDay(); // 1..7
    let diff = dow - todayDow;
    if (diff < 0) diff += 7;
    const target = new Date(today);
    target.setDate(today.getDate() + diff);
    const y = target.getFullYear(), m = String(target.getMonth()+1).padStart(2,'0'), d = String(target.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
}

function slotToTime(slot) {
    const totalMin = slot * 30;
    const h = 8 + Math.floor(totalMin / 60);
    const mi = totalMin % 60;
    return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
}

/* ============================================================
   WIDGET: CLASE AHORA / PRÓXIMA CLASE (en vivo)
   ============================================================ */
function getTodayDow() {
    const d = new Date().getDay();
    return d === 0 ? null : d; // domingo -> null, resto 1..6 (6=sábado tampoco tiene clase)
}

function currentSlotInfo() {
    const now = new Date();
    const dow = now.getDay();
    if (dow < 1 || dow > 5) return null; // findes

    const minutosDesde8 = (now.getHours() - 8) * 60 + now.getMinutes();
    if (minutosDesde8 < 0 || minutosDesde8 >= 390) return null; // fuera de horario (8:00-14:30)

    const slotActual = Math.floor(minutosDesde8 / 30); // 0..12
    const blocks = CONFIG.horario[dow] || [];

    let enCurso = null;
    let siguiente = null;

    for (const b of blocks) {
        const bEnd = b.start + b.span;
        if (slotActual >= b.start && slotActual < bEnd) enCurso = b;
        if (!siguiente && b.start > slotActual) siguiente = b;
    }

    return { dow, slotActual, minutosDesde8, enCurso, siguiente, blocks };
}

function renderNowWidget() {
    const el = document.getElementById('now-widget');
    if (!el) return;

    const info = currentSlotInfo();
    if (!info) {
        // Fuera de horario lectivo — mostrar próxima clase del próximo día lectivo
        const proximoDow = nextClassDow();
        if (!proximoDow) { el.innerHTML = ''; return; }
        const block = CONFIG.horario[proximoDow][0];
        const isClase = !block.key.startsWith('_');
        const nombre = isClase ? CONFIG.nombres[block.key] : 'Clase';
        const color  = isClase ? CONFIG.colors[block.key] : 'var(--txt-muted)';
        const dateStr = nextDateForDow(proximoDow);
        el.innerHTML = `
            <div class="now-card now-card--idle">
                <span class="now-dot" style="background:${color}"></span>
                <div>
                    <span class="now-label">Sin clase ahora mismo</span>
                    <span class="now-title">Próxima: ${nombre} — ${DIAS[proximoDow-1]} ${slotToTime(block.start)}</span>
                </div>
            </div>`;
        return;
    }

    const { enCurso, siguiente } = info;

    if (enCurso && !enCurso.key.startsWith('_')) {
        const color = CONFIG.colors[enCurso.key];
        const nombre = CONFIG.nombres[enCurso.key];
        const prof = CONFIG.profesores[enCurso.key];
        const finSlot = enCurso.start + enCurso.span;
        const finTime = slotToTime(finSlot);
        const minutosRestantes = (finSlot - info.slotActual) * 30 - (info.minutosDesde8 % 30);

        el.innerHTML = `
            <div class="now-card now-card--live" style="--asig-color:${color}">
                <span class="now-pulse"></span>
                <div>
                    <span class="now-label">🔴 En clase ahora</span>
                    <span class="now-title">${nombre} <span class="now-prof">· ${prof}</span></span>
                </div>
                <div class="now-time">
                    <span class="now-time__val">${minutosRestantes}min</span>
                    <span class="now-time__label">hasta ${finTime}</span>
                </div>
            </div>`;
    } else if (enCurso && enCurso.key === '_desc') {
        el.innerHTML = `
            <div class="now-card now-card--idle">
                <span class="now-dot" style="background:var(--amber)">☕</span>
                <div>
                    <span class="now-label">Descanso</span>
                    <span class="now-title">${siguiente && !siguiente.key.startsWith('_') ? `Siguiente: ${CONFIG.nombres[siguiente.key]} a las ${slotToTime(siguiente.start)}` : ''}</span>
                </div>
            </div>`;
    } else if (siguiente && !siguiente.key.startsWith('_')) {
        const color = CONFIG.colors[siguiente.key];
        const nombre = CONFIG.nombres[siguiente.key];
        const minutosHasta = (siguiente.start - info.slotActual) * 30 - (info.minutosDesde8 % 30);
        el.innerHTML = `
            <div class="now-card now-card--idle">
                <span class="now-dot" style="background:${color}"></span>
                <div>
                    <span class="now-label">Ahora libre</span>
                    <span class="now-title">Próxima: ${nombre} en ${minutosHasta}min (${slotToTime(siguiente.start)})</span>
                </div>
            </div>`;
    } else {
        el.innerHTML = `
            <div class="now-card now-card--idle">
                <span class="now-dot" style="background:var(--txt-muted)">🏁</span>
                <div><span class="now-label">Ya no quedan más clases hoy</span></div>
            </div>`;
    }
}

function nextClassDow() {
    const today = new Date().getDay();
    for (let i = 1; i <= 7; i++) {
        const d = ((today - 1 + i) % 7) + 1; // recorre 1..5 (lunes-viernes), salta findes
        if (d >= 1 && d <= 5) return d;
    }
    return null;
}

/** Calcula qué % de la clase en curso ya ha transcurrido (0-100), o null si no hay clase ahora */
function claseEnCursoProgreso() {
    const info = currentSlotInfo();
    if (!info || !info.enCurso || info.enCurso.key.startsWith('_')) return null;

    const b = info.enCurso;
    const inicioMin = b.start * 30;
    const finMin = (b.start + b.span) * 30;
    const elapsed = info.minutosDesde8 - inicioMin;
    const total = finMin - inicioMin;
    return { dow: info.dow, block: b, pct: Math.max(0, Math.min(100, (elapsed / total) * 100)) };
}

/* ============================================================
   HORAS SEMANALES POR ASIGNATURA
   ============================================================ */
function horasSemanalesPorAsignatura() {
    const totals = {};
    Object.keys(CONFIG.nombres).forEach(k => totals[k] = 0);
    Object.values(CONFIG.horario).forEach(blocks => {
        blocks.forEach(b => {
            if (!b.key.startsWith('_')) totals[b.key] = (totals[b.key] || 0) + b.span * 0.5;
        });
    });
    return totals;
}

/* ============================================================
   LEYENDA + GRÁFICO DE HORAS SEMANALES
   ============================================================ */
function renderLegend() {
    const el = document.getElementById('legend-list');
    if (!el) return;

    const totals = horasSemanalesPorAsignatura();
    const maxH = Math.max(...Object.values(totals));
    const keys = Object.keys(CONFIG.nombres).sort((a, b) => totals[b] - totals[a]);

    el.innerHTML = keys.map(key => {
        const h = totals[key];
        const pct = maxH > 0 ? (h / maxH) * 100 : 0;
        const color = CONFIG.colors[key];
        const isActive = HState.selected === key;
        return `
        <div class="legend-row${isActive ? ' legend-row--active' : ''}" onclick="Horario.selectSubject('${key}')" data-legend-key="${key}">
            <span class="legend-dot" style="background:${color}"></span>
            <span class="legend-name">${CONFIG.nombres[key]}</span>
            <div class="legend-bar-wrap">
                <div class="legend-bar" style="width:${pct}%;background:color-mix(in srgb, ${color} 55%, var(--bg-panel-3))"></div>
            </div>
            <span class="legend-hours">${h}h</span>
        </div>`;
    }).join('');
}

/* ============================================================
   VISTA MÓVIL — lista de tarjetas por día
   ============================================================ */
function renderMobileList() {
    const el = document.getElementById('mobile-list');
    if (!el) return;

    const todayDow = getTodayDow();
    const info = currentSlotInfo();

    let html = '';
    DIAS.forEach((dayName, i) => {
        const dow = i + 1;
        const isToday = dow === todayDow;
        const blocks = CONFIG.horario[dow] || [];

        html += `<div class="ml-day${isToday ? ' ml-day--today' : ''}">
            <div class="ml-day__header">${dayName}${isToday ? '<span class="ml-today-badge">Hoy</span>' : ''}</div>
            <div class="ml-day__cards">`;

        blocks.forEach(b => {
            const isBreak = b.key === '_desc';
            const isLibre = b.key === '_libre';
            const isClase = !isBreak && !isLibre;
            const horaIni = slotToTime(b.start);
            const horaFin = slotToTime(b.start + b.span);
            const esActual = isToday && info && info.enCurso === b;

            if (isLibre) return; // no mostrar huecos libres en móvil, ahorra espacio

            if (isBreak) {
                html += `<div class="ml-card ml-card--break">
                    <span class="ml-card__time">${horaIni}–${horaFin}</span>
                    <span class="ml-card__title">☕ Descanso</span>
                </div>`;
                return;
            }

            const color = CONFIG.colors[b.key];
            const nombre = CONFIG.nombres[b.key];
            const prof = CONFIG.profesores[b.key];

            html += `
            <div class="ml-card ml-card--clase${esActual ? ' ml-card--now' : ''}" style="--asig-color:${color}" onclick="Horario.selectSubject('${b.key}')">
                <span class="ml-card__time">${horaIni}–${horaFin}</span>
                <div class="ml-card__body">
                    <span class="ml-card__title">${nombre}</span>
                    <span class="ml-card__prof">${prof}</span>
                </div>
                ${esActual ? '<span class="ml-now-tag">Ahora</span>' : ''}
            </div>`;
        });

        html += `</div></div>`;
    });

    el.innerHTML = html;
}

/* ============================================================
   RENDER: GRID DEL HORARIO
   ============================================================ */
function renderScheduleGrid() {
    const grid = document.getElementById('schedule-grid');
    if (!grid) return;

    const todayDow = getTodayDow();
    const progreso = claseEnCursoProgreso(); // { dow, block, pct } | null

    // Grid template: 1 columna de horas + 5 columnas de días, 14 filas (1 header + 13 slots)
    let html = `<div class="sg-corner"></div>`;
    DIAS.forEach((d, i) => {
        const isToday = (i + 1) === todayDow;
        html += `<div class="sg-day-header${isToday ? ' sg-day-header--today' : ''}">${d}${isToday ? '<span class="sg-today-dot"></span>' : ''}</div>`;
    });

    // Time labels column
    SLOT_LABELS.forEach((t, i) => {
        html += `<div class="sg-time" style="grid-row:${i + 2}">${t}</div>`;
    });

    // Today column background band
    if (todayDow) {
        html += `<div class="sg-today-band" style="grid-column:${todayDow + 1};grid-row:2 / span 13"></div>`;
    }

    // Day blocks
    Object.entries(CONFIG.horario).forEach(([dow, blocks]) => {
        const col = Number(dow) + 1; // day 1=Lunes → column 2 (col1 = time labels)
        blocks.forEach(b => {
            const isBreak = b.key === '_desc';
            const isLibre = b.key === '_libre';
            const isClase = !isBreak && !isLibre;
            const color = isClase ? CONFIG.colors[b.key] : null;
            const nombre = isClase ? CONFIG.nombres[b.key] : (isBreak ? '☕' : 'Libre');
            const prof = isClase ? CONFIG.profesores[b.key] : null;
            const rowStart = b.start + 2; // +2 porque fila 1 es el header
            const cls = isBreak ? 'sg-block sg-block--break' : isLibre ? 'sg-block sg-block--libre' : 'sg-block sg-block--clase';

            const esActual = progreso && Number(dow) === progreso.dow && b === progreso.block;
            const fillHTML = esActual
                ? `<div class="sg-fill" style="height:${progreso.pct.toFixed(1)}%"></div>`
                : '';

            html += `
            <div class="${cls}${esActual ? ' sg-block--now' : ''}"
                 style="grid-column:${col};grid-row:${rowStart} / span ${b.span};${color ? `--asig-color:${color}` : ''}"
                 ${isClase ? `onclick="Horario.selectSubject('${b.key}')" data-key="${b.key}"` : ''}>
                ${fillHTML}
                <span class="sg-block__title">${nombre}</span>
                ${prof && b.span >= 2 ? `<span class="sg-block__prof">${prof}</span>` : ''}
            </div>`;
        });
    });

    grid.style.gridTemplateRows = `auto repeat(13, 34px)`;
    grid.innerHTML = html;
}

/* ============================================================
   HIGHLIGHT / DIM
   ============================================================ */
function applyHighlight() {
    const blocks = document.querySelectorAll('.sg-block--clase');
    blocks.forEach(b => {
        const key = b.dataset.key;
        b.classList.remove('sg-block--active', 'sg-block--dimmed');
        if (!HState.selected) return;
        if (key === HState.selected) b.classList.add('sg-block--active');
        else b.classList.add('sg-block--dimmed');
    });

    document.querySelectorAll('.legend-row').forEach(row => {
        row.classList.toggle('legend-row--active', row.dataset.legendKey === HState.selected);
    });

    document.querySelectorAll('.ml-card--clase').forEach(card => {
        const key = card.getAttribute('onclick')?.match(/selectSubject\('(\w+)'\)/)?.[1];
        card.classList.remove('ml-card--active', 'ml-card--dimmed');
        if (!HState.selected || !key) return;
        card.classList.add(key === HState.selected ? 'ml-card--active' : 'ml-card--dimmed');
    });
}

/* ============================================================
   INFO PANEL
   ============================================================ */
const Horario = {
    selectSubject(key) {
        HState.selected = HState.selected === key ? null : key;
        applyHighlight();
        renderInfoPanel();
    },

    async guardarNotas(key) {
        const contenido = document.getElementById('notas-contenido').value;
        const pendiente = document.getElementById('notas-pendiente').value;
        try {
            await DB.notas.set(key, { contenido, pendiente, updatedAt: new Date().toISOString() });
            Toast.show('Apuntes guardados', 'success');
        } catch(e) { console.error(e); Toast.show('Error al guardar apuntes', 'error'); }
    },

    quickRegister(key, dateStr, horas, evalNum) {
        document.getElementById('register-modal').classList.add('open');
        setTimeout(() => {
            document.getElementById('fecha').value            = dateStr;
            document.getElementById('asignatura').value       = key;
            document.getElementById('horas').value             = horas;
            document.getElementById('evaluacion-input').value  = evalNum;
        }, 30);
    }
};
window.Horario = Horario;

function renderInfoPanel() {
    const panel   = document.getElementById('info-panel');
    const empty   = document.getElementById('empty-hint');
    const content = document.getElementById('info-content');
    const key     = HState.selected;

    if (!key) {
        panel.style.display = 'none';
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';
    panel.style.display = 'block';

    const asig  = CONFIG.asignaturas[key];
    const color = CONFIG.colors[key];
    const prof  = CONFIG.profesores[key];
    const ev    = currentEval();
    const s     = calcStatsFor(key, ev);

    const badgeCls = s.estado === 'danger' ? 'badge--danger' : s.estado === 'warning' ? 'badge--warning' : 'badge--ok';
    const badgeTxt = s.estado === 'danger' ? '⛔ Peligro' : s.estado === 'warning' ? '⚠ Riesgo' : '✓ Correcto';
    const fillPct  = Math.min(100, s.limiteH > 0 ? (s.horasFaltadas / s.limiteH * 100) : 0).toFixed(0);
    const fillCls  = s.estado === 'danger' ? 'progress-fill--danger' : s.estado === 'warning' ? 'progress-fill--warn' : '';

    // Ocurrencias semanales de esta asignatura
    let ocurrenciasHTML = '';
    Object.entries(CONFIG.horario).forEach(([dow, blocks]) => {
        blocks.filter(b => b.key === key).forEach(b => {
            const horas = b.span * 0.5;
            const horaIni = slotToTime(b.start);
            const horaFin = slotToTime(b.start + b.span);
            const dateStr = nextDateForDow(Number(dow));
            const dayName = DIAS[Number(dow) - 1];
            const td = tipoDia(dateStr);

            ocurrenciasHTML += `
            <div class="occ-row">
                <div class="occ-info">
                    <strong>${dayName}</strong>
                    <span class="occ-time">${horaIni}–${horaFin} (${horas}h)</span>
                    ${td && !td.bloqueante ? `<span class="occ-badge occ-badge--warn">📝 ${td.label}</span>` : ''}
                </div>
                ${td && td.bloqueante
                    ? `<span class="occ-badge occ-badge--off">${td.label}</span>`
                    : `<button class="btn-ghost btn-sm" onclick="Horario.quickRegister('${key}','${dateStr}',${horas},${ev})">+ Falta</button>`
                }
            </div>`;
        });
    });

    const nota = HState.notas[key] || {};

    content.innerHTML = `
        <div class="info-header" style="--asig-color:${color}">
            <span class="info-dot"></span>
            <div>
                <div class="info-title">${asig.nombre}</div>
                <div class="info-prof">👤 ${prof}</div>
            </div>
            <a href="faltas.html" class="btn-ghost btn-sm" style="margin-left:auto">Ver en Faltas →</a>
        </div>

        <div class="info-stats">
            <div class="info-stat-card">
                <span class="info-stat-label">Eval ${ev} — Horas faltadas</span>
                <div class="info-stat-val">${s.horasFaltadas}<span style="font-size:0.9rem;color:var(--txt-secondary)">/${s.totalH}h</span></div>
                <span class="badge ${badgeCls}">${badgeTxt}</span>
                <div class="progress-bar" style="height:6px;margin-top:10px">
                    <div class="progress-fill ${fillCls}" style="width:${fillPct}%"></div>
                </div>
                <div style="margin-top:8px;font-family:var(--font-mono);font-size:0.78rem;color:var(--txt-secondary)">
                    ${s.pct.toFixed(1)}% · quedan ${s.horasRestantes}h disponibles
                </div>
            </div>

            <div class="info-occ-card">
                <span class="info-stat-label">Próximas clases esta semana</span>
                <div class="occ-list">${ocurrenciasHTML}</div>
            </div>
        </div>

        <div class="info-notes">
            <span class="info-stat-label">📝 Apuntes de la asignatura</span>
            <div class="notes-grid">
                <div class="field">
                    <label>Contenido dado / temario</label>
                    <textarea id="notas-contenido" rows="4" placeholder="Lo que se ha explicado en clase…">${nota.contenido || ''}</textarea>
                </div>
                <div class="field">
                    <label>Pendiente / deberes</label>
                    <textarea id="notas-pendiente" rows="4" placeholder="Lo que falta por hacer…">${nota.pendiente || ''}</textarea>
                </div>
            </div>
            <button class="btn-primary btn-sm" onclick="Horario.guardarNotas('${key}')" style="margin-top:10px">💾 Guardar apuntes</button>
            ${nota.updatedAt ? `<span style="margin-left:10px;font-size:0.72rem;color:var(--txt-muted);font-family:var(--font-mono)">Última edición: ${new Date(nota.updatedAt).toLocaleString('es-ES')}</span>` : ''}
        </div>
    `;
}

/* ============================================================
   MODALS (registrar falta + confirmación) — versión mínima
   ============================================================ */
const HModals = {
    confirm: {
        _resolve: null,
        open(title, msg) {
            return new Promise(resolve => {
                this._resolve = resolve;
                document.getElementById('confirm-title').textContent = title;
                document.getElementById('confirm-message').textContent = msg;
                document.getElementById('confirm-modal').classList.add('open');
            });
        },
        close(result) {
            document.getElementById('confirm-modal').classList.remove('open');
            if (this._resolve) this._resolve(result);
        }
    }
};

async function registrarFaltaDesdeHorario() {
    const asignatura = document.getElementById('asignatura').value;
    const fecha      = document.getElementById('fecha').value;
    const horas      = parseInt(document.getElementById('horas').value);
    const evaluacion = parseInt(document.getElementById('evaluacion-input').value);
    const tipo       = document.getElementById('tipo').value;
    const nota       = document.getElementById('nota').value.trim();

    if (!asignatura) return Toast.show('Selecciona una asignatura', 'error');
    if (!fecha)      return Toast.show('Elige una fecha', 'error');
    if (isNaN(horas) || horas < 1) return Toast.show('Horas inválidas', 'error');

    try {
        await DB.faltas.add({ asignatura, fecha, horas, evaluacion, tipo, nota });
        document.getElementById('register-modal').classList.remove('open');
        document.getElementById('nota').value = '';
        Toast.show(`Falta registrada (Eval ${evaluacion})`, 'success');
    } catch(e) { console.error(e); Toast.show('Error al guardar', 'error'); }
}

function populateAsigSelect() {
    const sel = document.getElementById('asignatura');
    if (!sel) return;
    const placeholder = sel.querySelector('option[value=""]');
    const optionsHTML = Object.entries(CONFIG.asignaturas)
        .map(([key, asig]) => `<option value="${key}">${asig.nombre}</option>`)
        .join('');
    sel.innerHTML = (placeholder ? placeholder.outerHTML : '') + optionsHTML;
}

/* ============================================================
   EVENTOS
   ============================================================ */
function initHorarioEvents() {
    document.getElementById('register-close').addEventListener('click',    () => document.getElementById('register-modal').classList.remove('open'));
    document.getElementById('register-backdrop').addEventListener('click', () => document.getElementById('register-modal').classList.remove('open'));
    document.getElementById('btn-registrar').addEventListener('click', registrarFaltaDesdeHorario);

    document.getElementById('confirm-ok').addEventListener('click',      () => HModals.confirm.close(true));
    document.getElementById('confirm-cancel').addEventListener('click',  () => HModals.confirm.close(false));
    document.getElementById('confirm-backdrop').addEventListener('click',() => HModals.confirm.close(false));

    document.getElementById('btn-print').addEventListener('click', () => window.print());

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        document.getElementById('register-modal').classList.remove('open');
        HModals.confirm.close(false);
    });
}

/* ============================================================
   CONEXIÓN FIREBASE
   ============================================================ */
function initFirebaseHorario() {
    DB.init(
        () => {
            setDbStatus('Conectando…', 'connecting');

            DB.faltas.listen(
                data => {
                    HState.faltas = data;
                    setDbStatus('Conectado', 'connected');
                    if (HState.selected) renderInfoPanel();
                },
                () => { setDbStatus('Error', 'error'); Toast.show('Error al conectar con Firestore', 'error'); }
            );

            DB.notas.listen(
                data => {
                    HState.notas = data;
                    if (HState.selected) renderInfoPanel();
                },
                () => {}
            );
        },
        () => {
            setDbStatus('Sin configurar', 'error');
            Toast.show('Configura Firebase desde la página de Faltas primero', 'error', 5000);
        }
    );
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    renderScheduleGrid();
    renderMobileList();
    renderLegend();
    renderNowWidget();
    populateAsigSelect();
    initHorarioEvents();
    document.getElementById('fecha').valueAsDate = new Date();

    initFirebaseHorario();

    // Refrescar el widget "ahora/próxima clase" y el relleno de progreso cada minuto
    setInterval(() => {
        renderNowWidget();
        renderScheduleGrid();
        renderMobileList();
        applyHighlight();
    }, 60000);
});
