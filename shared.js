/**
 * shared.js — Módulo compartido entre faltas.html y horario.html
 * Contiene: CONFIG, helpers de calendario, Auth, Offline cache, DB, Toast
 */

/* ============================================================
   HORARIO SEMANAL (fuente de verdad — bloques con horas exactas)
   ============================================================ */
// slot = índice de bloque de 30 min empezando en las 08:00 (slot 0 = 08:00-08:30)
const HORARIO_BLOQUES = {
    1: [ // Lunes
        { key: 'Zerb', start: 0,  span: 4 }, // 08:00-10:00
        { key: 'Info', start: 4,  span: 2 }, // 10:00-11:00
        { key: '_desc', start: 6, span: 1 }, // 11:00-11:30
        { key: 'Info', start: 7,  span: 2 }, // 11:30-12:30
        { key: 'Py', start: 9,  span: 4 }, // 12:30-14:30
    ],
    2: [ // Martes
        { key: 'Info', start: 0, span: 2 }, // 08:00-09:00
        { key: 'Bezer', start: 2, span: 4 }, // 09:00-11:00
        { key: '_desc', start: 6, span: 1 },
        { key: 'WAH',   start: 7, span: 2 }, // 11:30-12:30
        { key: '_libre', start: 9, span: 4 }, // 12:30-14:30
    ],
    3: [ // Miércoles
        { key: 'WI',   start: 0, span: 2 }, // 08:00-09:00
        { key: 'Bezer', start: 2, span: 4 }, // 09:00-11:00
        { key: '_desc', start: 6, span: 1 },
        { key: 'Zerb', start: 7, span: 4 }, // 11:30-13:30
        { key: '_libre', start: 11, span: 2 }, // 13:30-14:30
    ],
    4: [ // Jueves
        { key: 'Zerb', start: 0, span: 4 }, // 08:00-10:00
        { key: 'WI',   start: 4, span: 2 }, // 10:00-11:00
        { key: '_desc', start: 6, span: 1 },
        { key: 'Zerb', start: 7, span: 2 }, // 11:30-12:30
        { key: 'Py', start: 9, span: 4 }, // 12:30-14:30
    ],
    5: [ // Viernes
        { key: 'WI',   start: 0, span: 4 }, // 08:00-10:00
        { key: 'Info', start: 4, span: 2 }, // 10:00-11:00
        { key: '_desc', start: 6, span: 1 },
        { key: 'Info', start: 7, span: 2 }, // 11:30-12:30
        { key: 'WAH',  start: 9, span: 4 }, // 12:30-14:30
    ],
};

// Genera las horas diarias por asignatura a partir de los bloques (fuente única de verdad)
function derivarHorasDiarias() {
    const out = {};
    Object.entries(HORARIO_BLOQUES).forEach(([dow, blocks]) => {
        out[dow] = {};
        blocks.forEach(b => {
            if (b.key.startsWith('_')) return; // descanso / libre no cuentan
            out[dow][b.key] = (out[dow][b.key] || 0) + b.span * 0.5;
        });
    });
    return out;
}

/* ============================================================
   CONFIGURACIÓN GENERAL
   ============================================================ */
const CONFIG = {
    nombres: {
        Zerb:  'Zerbitzari-inguruneko web-garapena',
        Info:  'Informatika-sistemak',
        Py:    'Hautazko Modulua Python',
        Bezer: 'Bezero-inguruneko web-garapena',
        WAH:   'Web-aplikazioen hedapena',
        WI:    'Web interfazeen diseinua',
    },
    profesores: {
        Zerb:  'Mikel Arregi',
        Info:  'Iker Olkoz',
        Py:    'Iker Olkoz',
        Bezer: 'Iker Olkoz',
        WAH:   'Jon Rubio',
        WI:    'Jon Rubio',
    },
    colors: {
        Zerb:  '#00d4ff',
        Info:  '#39ff6e',
        Py:    '#ffb830',
        Bezer: '#ff2d9b',
        WAH:   '#b794f4',
        WI:    '#00ffcc',
    },
    limitePct: 20,

    // Solo 2 evaluaciones este curso
    numEvaluaciones: 2,

    // El viernes 4 de sept ya es lectivo normal este curso, cuenta desde ese día.
    // La 2ª eval se extiende hasta el 27 de feb (última semana de clase antes de las prácticas).
    // Curso 2026-2027
    evalInicio: { 1: '2026-09-04', 2: '2026-11-16' },
    evalFin:    { 1: '2026-11-13', 2: '2027-02-27' },

    // Semanas de examen — SOLO informativo (icono en calendario), NO se excluyen de las horas
    semanasExamen: [
        { start: '2026-11-09', end: '2026-11-13', label: 'Semana de exámenes 1ª Eval' },
        { start: '2027-02-15', end: '2027-02-19', label: 'Semana de exámenes 2ª Eval' },
    ],

    // Festivos individuales y rangos — estos SÍ se excluyen de las horas
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
        rango('2026-10-12', '2026-10-12'); // Día de la Hispanidad
        rango('2026-12-07', '2026-12-08'); // Puente Constitución + Inmaculada
        rango('2026-12-19', '2027-01-06'); // Navidades + Reyes
        rango('2027-01-20', '2027-01-20'); // Tamborrada
        rango('2027-02-08', '2027-02-14'); // Semana de Carnaval
        rango('2027-03-25', '2027-03-26'); // Jueves y Viernes Santo
        rango('2027-03-29', '2027-03-29'); // Lunes de Pascua (Aberri Eguna)
        return dias;
    })(),

    // Prácticas de empresa (FCT) — 3 meses desde el 1 de marzo (la semana del 22-27 feb sigue siendo lectiva y cuenta para las faltas)
    practicas: { start: '2027-03-01', end: '2027-05-28', label: 'Prácticas en empresa (FCT)' },

    // Horas por asignatura cada día de la semana — derivado del horario real
    horasDiarias: derivarHorasDiarias(),

    horario: HORARIO_BLOQUES,

    // Se rellena más abajo con las horas totales calculadas por evaluación
    asignaturas: {}
};

/* ============================================================
   HELPERS DE CALENDARIO
   ============================================================ */
/**
 * Devuelve el tipo especial de un día, o null si es lectivo normal.
 * bloqueante:true → no cuenta horas, no se puede registrar falta (finde/festivo/práctica)
 * bloqueante:false → sigue siendo lectivo, solo se marca visualmente (examen)
 */
function tipoDia(dateStr) {
    const d   = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay();

    // Festivo explícito tiene prioridad — se marca como tal aunque caiga en fin de semana
    if (CONFIG.festivos.includes(dateStr)) return { tipo: 'festivo', label: 'Festivo / No lectivo', bloqueante: true };

    if (dow === 0 || dow === 6) return { tipo: 'finde', label: 'Fin de semana', bloqueante: true };

    if (dateStr >= CONFIG.practicas.start && dateStr <= CONFIG.practicas.end) {
        return { tipo: 'practica', label: CONFIG.practicas.label, bloqueante: true };
    }

    for (const s of CONFIG.semanasExamen) {
        if (dateStr >= s.start && dateStr <= s.end) return { tipo: 'examen', label: s.label, bloqueante: false };
    }

    return null;
}

function asignaturasDelDia(date) {
    const dow = date.getDay();
    return Object.keys(CONFIG.horasDiarias[dow] || {});
}

/** Calcula el total de horas lectivas de una asignatura entre dos fechas (ambas incluidas), respetando solo días bloqueantes */
function computeHorasEnRango(key, inicioStr, finStr) {
    const inicio = new Date(inicioStr + 'T00:00:00');
    const fin    = new Date(finStr    + 'T00:00:00');
    let total = 0;
    const cur = new Date(inicio);
    while (cur <= fin) {
        const y  = cur.getFullYear();
        const m  = String(cur.getMonth() + 1).padStart(2, '0');
        const d  = String(cur.getDate()).padStart(2, '0');
        const ds = `${y}-${m}-${d}`;
        const td = tipoDia(ds);
        if (!td || !td.bloqueante) {
            total += CONFIG.horasDiarias[cur.getDay()]?.[key] || 0;
        }
        cur.setDate(cur.getDate() + 1);
    }
    return total;
}

/** Horas lectivas restantes de una asignatura desde hoy hasta el fin de una evaluación */
function horasLectivasRestantes(key, evalNum) {
    const finStr = CONFIG.evalFin[evalNum];
    if (!finStr) return 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(finStr + 'T00:00:00');
    if (hoy > fin) return 0;
    const y = hoy.getFullYear(), m = String(hoy.getMonth()+1).padStart(2,'0'), d = String(hoy.getDate()).padStart(2,'0');
    return computeHorasEnRango(key, `${y}-${m}-${d}`, finStr);
}

// Calcular el total de horas lectivas de cada asignatura por evaluación
// iterando día a día desde evalInicio a evalFin (respeta festivos que bloquean
// y semanas de examen que SÍ cuentan este año — misma lógica que "horas restantes").
Object.keys(CONFIG.nombres).forEach(key => {
    CONFIG.asignaturas[key] = {
        nombre: CONFIG.nombres[key],
        eval: {
            1: Math.round(computeHorasEnRango(key, CONFIG.evalInicio[1], CONFIG.evalFin[1]) * 10) / 10,
            2: Math.round(computeHorasEnRango(key, CONFIG.evalInicio[2], CONFIG.evalFin[2]) * 10) / 10,
        }
    };
});

/** Devuelve 1 o 2 según la evaluación a la que pertenece una fecha (YYYY-MM-DD) */
function evalForDate(dateStr) {
    if (dateStr >= CONFIG.evalInicio[2]) return 2;
    return 1;
}

/* ============================================================
   AUTH
   ============================================================ */
/* ============================================================
   OFFLINE CACHE
   ============================================================ */
const Offline = {
    save(key, data) {
        try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
    },
    load(key) {
        try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; }
        catch(e) { return null; }
    }
};

/* ============================================================
   BASE DE DATOS (Firebase wrapper genérico)
   ============================================================ */
const DB = {
    instance: null,

    get credentials() {
        return {
            apiKey:    localStorage.getItem('firebase_apiKey'),
            projectId: localStorage.getItem('firebase_projectId')
        };
    },

    /** Inicializa Firebase. onReady() se llama si hay conexión, onMissing() si falta config */
    init(onReady, onMissing) {
        const { apiKey, projectId } = this.credentials;
        if (!apiKey || !projectId) { if (onMissing) onMissing(); return; }
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp({ apiKey, projectId, authDomain: `${projectId}.firebaseapp.com` });
            }
            this.instance = firebase.firestore();
            if (onReady) onReady();
        } catch(e) { console.error(e); if (onMissing) onMissing(e); }
    },

    // --- Colección genérica: faltas ---
    faltas: {
        listen(onData, onError) {
            if (!DB.instance) return;
            DB.instance.collection('faltas').onSnapshot(
                snap => onData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
                err  => { console.error(err); if (onError) onError(err); }
            );
        },
        async add(data) {
            if (!DB.instance) throw new Error('DB no inicializada');
            await DB.instance.collection('faltas').add({ ...data, timestamp: new Date().toISOString() });
        },
        async update(id, data) {
            if (!DB.instance) throw new Error('DB no inicializada');
            await DB.instance.collection('faltas').doc(id).update(data);
        },
        async delete(id) {
            if (!DB.instance) throw new Error('DB no inicializada');
            await DB.instance.collection('faltas').doc(id).delete();
        },
        async deleteAll() {
            if (!DB.instance) throw new Error('DB no inicializada');
            const snap = await DB.instance.collection('faltas').get();
            const batch = DB.instance.batch();
            snap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    },

    // --- Colección genérica: notas por asignatura ---
    notas: {
        listen(onData, onError) {
            if (!DB.instance) return;
            DB.instance.collection('notas').onSnapshot(
                snap => {
                    const out = {};
                    snap.docs.forEach(doc => { out[doc.id] = doc.data(); });
                    onData(out);
                },
                err => { console.error(err); if (onError) onError(err); }
            );
        },
        async set(key, data) {
            if (!DB.instance) throw new Error('DB no inicializada');
            await DB.instance.collection('notas').doc(key).set(data, { merge: true });
        }
    }
};

/* ============================================================
   TOASTS
   ============================================================ */
const Toast = {
    show(msg, type = 'info', duration = 3200) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        el.textContent = msg;
        el.addEventListener('click', () => el.remove());
        container.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'all 0.25s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateX(22px)';
            setTimeout(() => el.remove(), 260);
        }, duration);
    }
};

/* ============================================================
   STATUS INDICATOR (compartido, requiere #status-dot / #status-text)
   ============================================================ */
function setDbStatus(msg, type) {
    const dot  = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (dot)  dot.className   = `status-dot ${type}`;
    if (text) text.textContent = msg;
}
