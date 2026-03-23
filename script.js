/**
 * Control de Asistencia — CIFP USURBIL
 * Módulos: Config → Auth → DB → State → UI → Modals → Toast → Actions → Events → Init
 */

/* ============================================================
   1. CONFIGURACIÓN
   ============================================================ */
const CONFIG = {
    asignaturas: {
        "Mar":    { nombre: "Markatze Lengoaiak (Mar)",  eval: { 1: 46,  2: 38, 3: 26 } },
        "Gar":    { nombre: "Garapena (Gar)",            eval: { 1: 34,  2: 29, 3: 19 } },
        "BBDD":   { nombre: "Datu-baseak (BBDD)",        eval: { 1: 66,  2: 56, 3: 42 } },
        "Prog":   { nombre: "Programazioa (Prog)",       eval: { 1: 90,  2: 78, 3: 52 } },
        "Ingles": { nombre: "Ingeles Teknikoa (Ingles)", eval: { 1: 24,  2: 22, 3: 12 } },
        "Digi":   { nombre: "Digitalizazioa (Digi)",     eval: { 1: 24,  2: 22, 3: 10 } },
        "Irau":   { nombre: "Iraunkortasuna (Irau)",     eval: { 1: 12,  2: 11, 3:  5 } }
    },
    limitePct: 20,
    colors: {
        "Mar":    "#00d4ff",
        "Gar":    "#39ff6e",
        "BBDD":   "#ffb830",
        "Prog":   "#ff2d9b",
        "Ingles": "#b794f4",
        "Digi":   "#ff6b35",
        "Irau":   "#00ffcc"
    },

    // Fechas de fin de cada evaluación
    evalFin: {
        1: '2025-11-21',
        2: '2026-03-06',
        3: '2026-06-05'
    },

    // Semanas de examen completas (no cuentan)
    semanasExamen: [
        { start: '2025-11-17', end: '2025-11-21', label: 'Fin 1ª Evaluación' },
        { start: '2026-03-02', end: '2026-03-06', label: 'Fin 2ª Evaluación' },
        { start: '2026-06-01', end: '2026-06-05', label: 'Fin 3ª Evaluación' },
    ],

    // Días festivos individuales y rangos
    festivos: (() => {
        const dias = [];
        const rango = (inicio, fin) => {
            const d = new Date(inicio + 'T00:00:00');
            const f = new Date(fin   + 'T00:00:00');
            while (d <= f) {
                const y  = d.getFullYear();
                const m  = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                dias.push(`${y}-${m}-${dd}`);
                d.setDate(d.getDate() + 1);
            }
        };
        rango('2025-12-08', '2025-12-08'); // Inmaculada Concepción
        rango('2025-12-20', '2026-01-06'); // Navidades (desde el 20 dic) + Reyes (6 ene)
        rango('2026-01-19', '2026-01-20'); // Tamborrada San Sebastián (19) + festivo (20)
        rango('2026-02-16', '2026-02-22'); // Carnaval
        rango('2026-03-19', '2026-03-20'); // Día del Padre (19) + puente (20)
        rango('2026-03-30', '2026-04-12'); // Semana Santa
        rango('2026-05-01', '2026-05-01'); // Día del Trabajo
        return dias;
    })(),

    // Prácticas de empresa (no cuentan en Eval 3)
    practicas: { start: '2026-05-04', end: '2026-05-25', label: 'Prácticas en empresa' },

    // Horas por asignatura cada día de la semana (1=Lunes…5=Viernes)
    horasDiarias: {
        1: { Mar: 2, Prog: 2, BBDD: 2 },
        2: { Gar: 2, BBDD: 2, Prog: 2 },
        3: { BBDD: 2, Prog: 2 },
        4: { Mar: 2, Ingles: 2 },
        5: { Gar: 1, Prog: 2, Digi: 2, Irau: 1 }
    }
};

/* ============================================================
   HELPERS DE CALENDARIO
   ============================================================ */

/** Devuelve info sobre qué tipo de día especial es (o null si lectivo normal) */
function tipoDia(dateStr) {
    const d   = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay(); // 0=dom, 6=sab

    if (dow === 0 || dow === 6) return { tipo: 'finde', label: 'Fin de semana' };

    for (const s of CONFIG.semanasExamen) {
        if (dateStr >= s.start && dateStr <= s.end) return { tipo: 'examen', label: s.label };
    }
    if (dateStr >= CONFIG.practicas.start && dateStr <= CONFIG.practicas.end) {
        return { tipo: 'practica', label: CONFIG.practicas.label };
    }
    if (CONFIG.festivos.includes(dateStr)) return { tipo: 'festivo', label: 'Festivo / No lectivo' };

    return null; // día lectivo normal
}

/** Horas de una asignatura que quedan desde hoy hasta el fin de la evaluación dada */
function horasLectivasRestantes(key, evalNum) {
    const finStr = CONFIG.evalFin[evalNum];
    if (!finStr) return 0;
    const fin   = new Date(finStr   + 'T00:00:00');
    const hoy   = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (hoy > fin) return 0;

    let total = 0;
    const cur = new Date(hoy);
    while (cur <= fin) {
        const y  = cur.getFullYear();
        const m  = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        const ds = `${y}-${m}-${dd}`;
        const td  = tipoDia(ds);
        if (!td) {
            const dow = cur.getDay();
            total += (CONFIG.horasDiarias[dow]?.[key] || 0);
        }
        cur.setDate(cur.getDate() + 1);
    }
    return total;
}

/** Lista de asignaturas que tienen clase en un día de la semana (Date) */
function asignaturasDelDia(date) {
    const dow = date.getDay();
    return Object.keys(CONFIG.horasDiarias[dow] || {});
}

/* ============================================================
   OFFLINE CACHE
   ============================================================ */
const Offline = {
    KEY: 'ca_faltas_cache',
    save(faltas) {
        try { localStorage.setItem(this.KEY, JSON.stringify(faltas)); } catch(e) {}
    },
    load() {
        try { const d = localStorage.getItem(this.KEY); return d ? JSON.parse(d) : []; }
        catch(e) { return []; }
    }
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

/* ============================================================
   DASHBOARD (post-login)
   ============================================================ */
const Dashboard = {
    SHOWN_KEY: 'ca_dash_shown',

    shouldShow() { return !sessionStorage.getItem(this.SHOWN_KEY); },
    markShown()  { sessionStorage.setItem(this.SHOWN_KEY, '1'); },

    show() {
        if (!this.shouldShow()) return;
        this.markShown();
        const el = document.getElementById('dashboard-overlay');
        if (!el) return;
        this.build();
        el.style.display = 'flex';
        requestAnimationFrame(() => { el.style.opacity = '1'; });
    },

    hide() {
        const el = document.getElementById('dashboard-overlay');
        if (!el) return;
        el.style.opacity = '0';
        setTimeout(() => { el.style.display = 'none'; }, 350);
    },

    build() {
        const content = document.getElementById('dashboard-content');
        if (!content) return;

        const now  = new Date();
        const hour = now.getHours();
        const greeting = hour < 12 ? '🌅 Buenos días' : hour < 20 ? '☀️ Buenas tardes' : '🌙 Buenas noches';
        const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        // Today's classes
        const y  = now.getFullYear();
        const m  = String(now.getMonth() + 1).padStart(2, '0');
        const d  = String(now.getDate()).padStart(2, '0');
        const hoyStr = `${y}-${m}-${d}`;
        const tdHoy  = tipoDia(hoyStr);
        const hoyAsig = tdHoy ? [] : asignaturasDelDia(now);

        // At-risk subjects
        const enRiesgo = Object.keys(CONFIG.asignaturas).filter(k => State.calcStats(k).estado !== 'ok');

        // This week's absences
        const dow = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
        weekStart.setHours(0, 0, 0, 0);
        const thisWeekFaltas = State.faltas.filter(f => {
            if (!f.fecha) return false;
            const fd = new Date(f.fecha + 'T00:00:00');
            return fd >= weekStart && fd <= now;
        });
        const horasEstaSemana = thisWeekFaltas.reduce((s, f) => s + (f.horas || 0), 0);

        // Today's classes HTML
        let clasesHTML;
        if (tdHoy) {
            const icons = { festivo: '🎉 Hoy es festivo', examen: '📝 Semana de exámenes', practica: '🏢 Prácticas de empresa' };
            clasesHTML = `<div class="dash-no-class">${icons[tdHoy.tipo] || 'No hay clase hoy'}</div>`;
        } else if (hoyAsig.length === 0) {
            clasesHTML = '<div class="dash-no-class">No hay clase hoy</div>';
        } else {
            clasesHTML = hoyAsig.map(k => {
                const color = CONFIG.colors[k] || '#64748b';
                const horas = CONFIG.horasDiarias[now.getDay()]?.[k] || 0;
                return `<div class="dash-class-pill" style="border-color:${color}30;background:${color}10">
                    <span class="td-dot" style="background:${color};box-shadow:0 0 5px ${color};width:8px;height:8px;border-radius:50%;display:inline-block"></span>
                    <span style="font-weight:600">${k}</span>
                    <span style="color:var(--txt-muted);font-size:0.75rem;font-family:var(--font-mono)">${horas}h</span>
                </div>`;
            }).join('');
        }

        // At-risk HTML
        const riesgoHTML = enRiesgo.length === 0
            ? '<div class="dash-ok">✅ Todas las asignaturas en estado correcto</div>'
            : enRiesgo.map(k => {
                const s = State.calcStats(k);
                const color = s.estado === 'danger' ? 'var(--red)' : 'var(--amber)';
                const icon  = s.estado === 'danger' ? '⛔' : '⚠️';
                return `<div class="dash-alert-item" style="border-color:${s.estado === 'danger' ? 'rgba(255,64,96,0.25)' : 'rgba(255,184,48,0.25)'}">
                    <span>${icon}</span>
                    <span style="font-weight:600;color:${color}">${CONFIG.asignaturas[k].nombre.replace(/\s*\(.*\)/, '')}</span>
                    <span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--txt-secondary);margin-left:auto">${s.pct.toFixed(1)}% — quedan ${s.horasRestantes}h</span>
                </div>`;
            }).join('');

        content.innerHTML = `
            <div class="dash-greeting">${greeting}</div>
            <div class="dash-date">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</div>

            <div class="dash-cols">
                <div class="dash-section">
                    <div class="dash-section-title">Hoy tienes clase de</div>
                    <div class="dash-classes">${clasesHTML}</div>
                </div>
                <div class="dash-section">
                    <div class="dash-section-title">Esta semana</div>
                    <div class="dash-week-stat">
                        <span class="dash-week-num" style="color:${horasEstaSemana > 0 ? 'var(--red)' : 'var(--lime)'}">${horasEstaSemana}h</span>
                        <span class="dash-week-label">faltadas</span>
                        <span class="dash-week-num">${thisWeekFaltas.length}</span>
                        <span class="dash-week-label">registros</span>
                    </div>
                </div>
            </div>

            <div class="dash-section">
                <div class="dash-section-title">Estado de asignaturas</div>
                <div class="dash-alerts">${riesgoHTML}</div>
            </div>
        `;
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
                case '3': Actions.cambiarEvaluacion(3); break;
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

const Auth = {
    KEY: 'ca_auth_v1',
    isLoggedIn() { return sessionStorage.getItem(this.KEY) === 'ok'; },
    login(user, pass) {
        if (user === 'admin' && pass === 'admin') {
            sessionStorage.setItem(this.KEY, 'ok');
            return true;
        }
        return false;
    },
    logout() { sessionStorage.removeItem(this.KEY); location.reload(); }
};

/* ============================================================
   3. BASE DE DATOS
   ============================================================ */
const DB = {
    instance: null,
    get credentials() {
        return {
            apiKey:    localStorage.getItem('firebase_apiKey'),
            projectId: localStorage.getItem('firebase_projectId')
        };
    },
    init() {
        const { apiKey, projectId } = this.credentials;
        if (!apiKey || !projectId) {
            const cached = Offline.load();
            if (cached.length > 0) {
                State.faltas = cached;
                UI.setStatus('Offline (sin config)', 'connecting');
                Toast.show('Firebase sin configurar — mostrando caché local', 'info');
                UI.render();
            } else {
                UI.setStatus('Sin configurar', 'error');
                Modals.firebase.open();
            }
            return;
        }
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp({ apiKey, projectId, authDomain: `${projectId}.firebaseapp.com` });
            }
            this.instance = firebase.firestore();
            this.listen();
        } catch(e) { console.error(e); UI.setStatus('Error de conexión', 'error'); }
    },
    listen() {
        UI.setStatus('Conectando…', 'connecting');
        this.instance.collection('faltas').onSnapshot(
            snap => {
                State.faltas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                Offline.save(State.faltas);
                UI.setStatus('Conectado', 'connected');
                UI.render();
                Dashboard.show();
            },
            err => {
                console.error(err);
                const cached = Offline.load();
                if (cached.length > 0) {
                    State.faltas = cached;
                    UI.setStatus('Offline (caché)', 'connecting');
                    Toast.show('Sin conexión — mostrando datos guardados', 'info');
                    UI.render();
                    Dashboard.show();
                } else {
                    UI.setStatus('Error', 'error');
                    Toast.show('Error al conectar con Firestore', 'error');
                }
            }
        );
    },
    async add(data) {
        if (!this.instance) return Toast.show('Sin conexión a BD', 'error');
        await this.instance.collection('faltas').add({ ...data, timestamp: new Date().toISOString() });
    },
    async update(id, data) {
        if (!this.instance) return Toast.show('Sin conexión a BD', 'error');
        await this.instance.collection('faltas').doc(id).update(data);
    },
    async delete(id) {
        if (!this.instance) return Toast.show('Sin conexión a BD', 'error');
        await this.instance.collection('faltas').doc(id).delete();
    },
    async deleteAll() {
        if (!this.instance) return Toast.show('Sin conexión a BD', 'error');
        const snap = await this.instance.collection('faltas').get();
        const batch = this.instance.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
};

/* ============================================================
   4. ESTADO
   ============================================================ */
const State = {
    faltas: [],
    evaluacion: 1,        // 1 | 2 | 3 | 'total'
    filtroActivo: 'all',
    activeTab: 'resumen',
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),

    /** Calcula stats para una asignatura. extraHoras: para simulación */
    calcStats(key, extraHoras = 0) {
        const asig = CONFIG.asignaturas[key];
        let totalH, lista;

        if (this.evaluacion === 'total') {
            totalH = asig.eval[1] + asig.eval[2] + asig.eval[3];
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

        const keys   = Object.keys(CONFIG.asignaturas);
        const labels = keys.map(k => CONFIG.asignaturas[k].nombre.replace(/\s*\(.*\)/, ''));

        const data = keys.map(k => parseFloat(State.calcStats(k).pct.toFixed(1)));

        const bgColors = keys.map(k => {
            const s = State.calcStats(k);
            if (s.estado === 'danger')  return 'rgba(255,64,96,0.65)';
            if (s.estado === 'warning') return 'rgba(255,184,48,0.65)';
            return 'rgba(57,255,110,0.65)';
        });
        const bdColors = keys.map(k => {
            const s = State.calcStats(k);
            if (s.estado === 'danger')  return '#ff4060';
            if (s.estado === 'warning') return '#ffb830';
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
                                const s = State.calcStats(keys[ctx.dataIndex]);
                                return [`  ${s.pct.toFixed(1)}% faltado`, `  ${s.horasFaltadas}h de ${s.totalH}h`, `  Quedan: ${s.horasRestantes}h`];
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
                if (td.tipo === 'examen')   { extraClass = 'cal-day--examen';   tooltip = td.label; clickable = false; }
                if (td.tipo === 'practica') { extraClass = 'cal-day--practica'; tooltip = td.label; clickable = hasFaltas; }
            }

            const dots = faltas.map(f => {
                const c = CONFIG.colors[f.asignatura] || '#64748b';
                return `<span class="cal-dot" style="background:${c};box-shadow:0 0 3px ${c}"></span>`;
            }).join('');

            const dayOfWeek   = new Date(year, month, day).getDay(); // 0=dom…6=sab
            const isLectivo   = !td && dayOfWeek >= 1 && dayOfWeek <= 5;
            const titleAttr   = tooltip
                ? `title="${tooltip}"`
                : isLectivo ? `title="Click: ver faltas · Doble click: añadir falta"` : '';
            const onclickAttr = (clickable || hasFaltas) ? `onclick="Actions.showCalDay(${day}, ${year}, ${month})"` : '';
            const dblclickAttr = isLectivo ? `ondblclick="event.stopPropagation();Actions.showDaySchedule(${day}, ${year}, ${month})"` : '';

            html += `
            <div class="cal-day${isToday ? ' cal-day--today' : ''}${hasFaltas ? ' cal-day--has-faltas' : ''}${isLectivo ? ' cal-day--lectivo' : ''} ${extraClass}"
                 ${titleAttr} ${onclickAttr} ${dblclickAttr}>
                <span class="cal-day__num">${day}</span>
                ${td && td.tipo !== 'finde' && !hasFaltas
                    ? `<span class="cal-day__label">${
                        td.tipo === 'festivo'  ? '✕' :
                        td.tipo === 'examen'   ? '📝' :
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
   7. TOASTS
   ============================================================ */
const Toast = {
    show(msg, type = 'info', duration = 3200) {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.textContent = msg;
        el.addEventListener('click', () => el.remove());
        container.appendChild(el);
        setTimeout(() => {
            el.style.animation = 'none';
            el.style.opacity = '0';
            el.style.transform = 'translateX(22px)';
            el.style.transition = 'all 0.25s ease';
            setTimeout(() => el.remove(), 260);
        }, duration);
    }
};

/* ============================================================
   8. ACCIONES
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

        const statsBefore = State.calcStats(asignatura);

        try {
            await DB.add({ asignatura, fecha, horas, evaluacion, tipo, nota });
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
                Toast.show(`Falta registrada (Eval ${evaluacion})`, 'success');
            }
        } catch(e) { console.error(e); Toast.show('Error al guardar', 'error'); }
    },

    async pedirEliminarFalta(id) {
        const ok = await Modals.confirm.open('Eliminar falta', '¿Seguro? Se moverá a la papelera durante 7 días y podrás recuperarla.');
        if (!ok) return;
        const falta = State.faltas.find(f => f.id === id);
        if (falta) Trash.add(falta);
        try {
            await DB.delete(id);
            Toast.show('Movida a la papelera — puedes recuperarla con T', 'info', 4000);
        } catch(e) { Toast.show('Error al eliminar', 'error'); }
    },

    async restaurarFalta(id) {
        const falta = Trash.getAll().find(f => f.id === id);
        if (!falta) return Toast.show('No encontrada en papelera', 'error');
        try {
            const { id: _id, deletedAt, ...data } = falta;
            await DB.add(data);
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
        try {
            await DB.update(id, { evaluacion, fecha, asignatura, horas, tipo, nota });
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
        try { await DB.deleteAll(); Toast.show('Base de datos limpiada', 'info'); }
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
                        await DB.add({ asignatura: f.asignatura, fecha: f.fecha, horas: f.horas, evaluacion: f.evaluacion || 1, tipo: f.tipo || 'injustificada', nota: f.nota || '' });
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
        let evalNum = 1;
        if (dateStr >= '2025-11-24' && dateStr <= '2026-03-06') evalNum = 2;
        else if (dateStr >= '2026-03-09') evalNum = 3;

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
                await DB.add({ asignatura: key, fecha: dateStr, horas: sched[key], evaluacion: evalNum, tipo: 'injustificada', nota: '' });
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
        const key   = document.getElementById('calc-asignatura').value;
        const horas = parseInt(document.getElementById('calc-horas').value);

        if (!key)                      return Toast.show('Selecciona una asignatura', 'error');
        if (isNaN(horas) || horas < 1) return Toast.show('Horas inválidas', 'error');

        const evalNum = State.evaluacion === 'total' ? null : State.evaluacion;
        const antes   = State.calcStats(key);
        const despues = State.calcStats(key, horas);
        const asig    = CONFIG.asignaturas[key];
        const color   = CONFIG.colors[key] || '#64748b';

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

            ${alertaHTML}
        `;
    }
};

window.Actions = Actions;

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
        let evalSugerida = 1;
        if (dateStr >= '2025-11-24' && dateStr <= '2026-03-06') evalSugerida = 2;
        else if (dateStr >= '2026-03-09') evalSugerida = 3;
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

    // Dashboard
    document.getElementById('btn-dashboard-enter')?.addEventListener('click', () => Dashboard.hide());

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());

    // Firebase modal
    document.getElementById('btn-settings').addEventListener('click',   () => Modals.firebase.open());
    document.getElementById('modal-close').addEventListener('click',    () => Modals.firebase.close());
    document.getElementById('modal-backdrop').addEventListener('click', () => Modals.firebase.close());
    document.getElementById('btn-guardar-config').addEventListener('click', () => Actions.guardarConfigFirebase());

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
        Modals.trash.close();
        document.getElementById('shortcuts-modal')?.classList.remove('open');
    });
}

/* ============================================================
   10. LOGIN
   ============================================================ */
function initLogin() {
    const doLogin = () => {
        const user    = document.getElementById('login-user').value.trim();
        const pass    = document.getElementById('login-pass').value;
        const errorEl = document.getElementById('login-error');

        if (Auth.login(user, pass)) {
            errorEl.style.display = 'none';
            const screen = document.getElementById('login-screen');
            const app    = document.getElementById('app');

            screen.style.transition = 'opacity 0.4s ease';
            screen.style.opacity = '0';

            setTimeout(() => {
                screen.style.display = 'none';
                app.style.display = 'block';
                app.style.opacity = '0';
                app.style.transition = 'opacity 0.4s ease';
                requestAnimationFrame(() => { app.style.opacity = '1'; });

                initEvents();
                UI.render();
                DB.init();
            }, 400);
        } else {
            errorEl.style.display = 'block';
            document.getElementById('login-pass').value = '';
            document.getElementById('login-pass').focus();
        }
    };

    document.getElementById('btn-login').addEventListener('click', doLogin);
    document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    document.getElementById('login-user').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-pass').focus(); });
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

    if (Auth.isLoggedIn()) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initEvents();
        UI.render();
        DB.init();
    } else {
        initLogin();
    }
});