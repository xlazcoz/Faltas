/**
 * model.js — Perfil de curso, valores por defecto y migración del modelo antiguo.
 * Ninguna asignatura, horario ni fecha del centro está atada al código de las páginas:
 * todo vive dentro del perfil que el usuario puede editar.
 */

export const SCHEMA_VERSION = 2;

export const SUBJECT_PALETTE = [
    '#39ff6e', '#4d8dff', '#b794f4', '#ff7a45',
    '#ffb830', '#ff2d9b', '#00ffcc', '#ff4060',
    '#f6e05e', '#ff5c8a', '#4ade80', '#c084fc'
];

export const PERIOD_COLOR = '#00ffcc';
export const EXAM_WEEK_COLOR = '#d9a300';

export function uid(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function timeToMin(time) {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

export function minToTime(min) {
    const m = Math.max(0, Math.round(min));
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function durationHours(inicio, fin) {
    return Math.max(0, (timeToMin(fin) - timeToMin(inicio)) / 60);
}

/* ============================================================
   DATOS DEL CURSO ANTIGUO (solo para migrar una vez)
   ============================================================ */
const LEGACY_NOMBRES = {
    Zerb: 'Zerbitzari-inguruneko web-garapena',
    Info: 'Informatika-sistemak',
    Py: 'Hautazko Modulua Python',
    Bezer: 'Bezero-inguruneko web-garapena',
    WAH: 'Web-aplikazioen hedapena',
    WI: 'Web interfazeen diseinua'
};

const LEGACY_PROFESORES = {
    Zerb: 'Mikel Arregi',
    Info: 'Iker Olkoz',
    Py: 'Iker Olkoz',
    Bezer: 'Iker Olkoz',
    WAH: 'Jon Rubio',
    WI: 'Jon Rubio'
};

const LEGACY_COLORS = {
    Zerb: '#39ff6e',   // Zerbitzari: verde
    Info: '#4d8dff',   // Sistemak: azul
    Py: '#b794f4',     // Python: morado
    Bezer: '#ff7a45',  // Bezero: naranja
    WAH: '#ffb830',    // Hedapena: amarillo
    WI: '#ff2d9b'      // Interfazeak: rosa
};

const LEGACY_COLOR_SCHEME = 3;

// slot = bloque de 30 min desde las 08:00
const LEGACY_BLOQUES = {
    1: [
        { key: 'Zerb', start: 0, span: 4 },
        { key: 'Info', start: 4, span: 2 },
        { key: '_desc', start: 6, span: 1 },
        { key: 'Info', start: 7, span: 2 },
        { key: 'Py', start: 9, span: 4 }
    ],
    2: [
        { key: 'Info', start: 0, span: 2 },
        { key: 'Bezer', start: 2, span: 4 },
        { key: '_desc', start: 6, span: 1 },
        { key: 'WAH', start: 7, span: 2 },
        { key: '_libre', start: 9, span: 4 }
    ],
    3: [
        { key: 'WI', start: 0, span: 2 },
        { key: 'Bezer', start: 2, span: 4 },
        { key: '_desc', start: 6, span: 1 },
        { key: 'Zerb', start: 7, span: 4 },
        { key: '_libre', start: 11, span: 2 }
    ],
    4: [
        { key: 'Zerb', start: 0, span: 4 },
        { key: 'WI', start: 4, span: 2 },
        { key: '_desc', start: 6, span: 1 },
        { key: 'Zerb', start: 7, span: 2 },
        { key: 'Py', start: 9, span: 4 }
    ],
    5: [
        { key: 'WI', start: 0, span: 4 },
        { key: 'Info', start: 4, span: 2 },
        { key: '_desc', start: 6, span: 1 },
        { key: 'WAH', start: 7, span: 2 },
        { key: 'Info', start: 9, span: 2 },
        { key: 'WAH', start: 11, span: 2 }
    ]
};

const LEGACY_EVAL_INICIO = { 1: '2026-09-04', 2: '2026-11-16' };
const LEGACY_EVAL_FIN = { 1: '2026-11-13', 2: '2027-02-27' };

const LEGACY_FESTIVOS = [
    ['2026-10-12', '2026-10-12', 'Día de la Hispanidad'],
    ['2026-12-07', '2026-12-08', 'Puente de la Constitución'],
    ['2026-12-19', '2027-01-06', 'Navidades y Reyes'],
    ['2027-01-20', '2027-01-20', 'Tamborrada'],
    ['2027-02-08', '2027-02-14', 'Semana de Carnaval'],
    ['2027-03-25', '2027-03-26', 'Jueves y Viernes Santo'],
    ['2027-03-29', '2027-03-29', 'Lunes de Pascua']
];

const LEGACY_ERRONKAS = [
    { nombre: '6. Erronka', start: '2026-09-04', end: '2026-09-08' },
    { nombre: '7. Erronka', start: '2026-09-09', end: '2026-11-13' },
    { nombre: '8. Erronka', start: '2026-11-16', end: '2027-01-15' },
    { nombre: '9. Erronka', start: '2027-01-18', end: '2027-02-19' }
];

const LEGACY_SEMANAS_EXAMEN = [
    { start: '2026-11-09', end: '2026-11-13', label: 'Semana de exámenes 1ª Eval' },
    { start: '2027-02-15', end: '2027-02-19', label: 'Semana de exámenes 2ª Eval' }
];

function readJson(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function legacyOverrides() {
    const over = readJson('ca_config_curso', {}) || {};
    const evalInicio = { ...LEGACY_EVAL_INICIO, ...(over.evalInicio || {}) };
    const evalFin = { ...LEGACY_EVAL_FIN, ...(over.evalFin || {}) };
    const erronkas = Array.isArray(over.erronkas) && over.erronkas.length ? over.erronkas : LEGACY_ERRONKAS;
    const festivos = Array.isArray(over.festivosRangos) && over.festivosRangos.length
        ? over.festivosRangos.map(r => [r[0], r[1], 'Festivo'])
        : LEGACY_FESTIVOS;
    const practicas = over.practicas && over.practicas.start
        ? over.practicas
        : { start: '2027-03-01', end: '2027-05-28', label: 'Prácticas en empresa (FCT)' };
    return { evalInicio, evalFin, erronkas, festivos, practicas };
}

export function legacyProfile() {
    const { evalInicio, evalFin, erronkas, festivos, practicas } = legacyOverrides();

    const evaluaciones = Object.keys(evalInicio)
        .sort((a, b) => Number(a) - Number(b))
        .map(n => ({
            id: `e${n}`,
            nombre: `${n}ª Evaluación`,
            inicio: evalInicio[n],
            fin: evalFin[n]
        }));

    const asignaturas = Object.keys(LEGACY_NOMBRES).map((key, i) => ({
        id: key,
        nombre: LEGACY_NOMBRES[key],
        corto: key,
        profesor: LEGACY_PROFESORES[key],
        color: LEGACY_COLORS[key] || SUBJECT_PALETTE[i % SUBJECT_PALETTE.length],
        limitePct: null
    }));

    const horario = [];
    Object.entries(LEGACY_BLOQUES).forEach(([dia, bloques]) => {
        bloques.forEach((b, i) => {
            horario.push({
                id: `blk-${dia}-${i}`,
                dia: Number(dia),
                inicio: minToTime(b.start * 30 + 8 * 60),
                fin: minToTime((b.start + b.span) * 30 + 8 * 60),
                tipo: b.key === '_desc' ? 'descanso' : b.key === '_libre' ? 'libre' : 'clase',
                asignaturaId: b.key.startsWith('_') ? null : b.key,
                aula: ''
            });
        });
    });

    const periodos = erronkas.map((er, i) => ({
        id: `periodo-${i + 1}`,
        nombre: er.nombre,
        tipo: 'erronka',
        inicio: er.start,
        fin: er.end
    }));

    LEGACY_SEMANAS_EXAMEN.forEach((s, i) => {
        periodos.push({
            id: `periodo-examenes-${i + 1}`,
            nombre: s.label,
            tipo: 'examenes',
            inicio: s.start,
            fin: s.end
        });
    });

    const noLectivos = festivos.map((f, i) => ({
        id: `festivo-${i + 1}`,
        inicio: f[0],
        fin: f[1],
        motivo: f[2] || 'Festivo',
        tipo: 'festivo'
    }));

    noLectivos.push({
        id: 'practicas',
        inicio: practicas.start,
        fin: practicas.end,
        motivo: practicas.label || 'Prácticas',
        tipo: 'practicas'
    });

    const starts = evaluaciones.map(e => e.inicio).sort();
    const ends = evaluaciones.map(e => e.fin).sort();

    return normalizeProfile({
        id: 'perfil-2daw-2026',
        schemaVersion: SCHEMA_VERSION,
        legacy: true,
        nombre: '2026/27 · 2DDAW3',
        centro: 'CIFP Usurbil',
        grupo: '2DDAW3 · Web Aplikazioen Garapena',
        inicioCurso: starts[0] || '2026-09-04',
        finCurso: ends[ends.length - 1] || '2027-05-28',
        branding: { iniciales: 'CA', colorPrimario: '#00d4ff' },
        tema: 'dark',
        limiteFaltasPct: 20,
        contarJustificadas: true,
        contarRetrasos: true,
        evaluaciones,
        asignaturas,
        horario,
        periodos,
        noLectivos,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

/* ============================================================
   PLANTILLAS
   ============================================================ */
const TEMPLATE_SUBJECTS = [
    ['mat', 'Matemáticas', 'Mat', 'Matemáticas', '#00d4ff'],
    ['len', 'Lengua y Literatura', 'Len', 'Lengua', '#ff2d9b'],
    ['ing', 'Inglés', 'Ing', 'Inglés', '#39ff6e'],
    ['cie', 'Ciencias', 'Cie', 'Ciencias', '#ffb830'],
    ['his', 'Geografía e Historia', 'His', 'Historia', '#b794f4'],
    ['efi', 'Educación Física', 'EF', 'Ed. Física', '#00ffcc']
];

function templateSchedule(asignaturas) {
    const pattern = [
        { inicio: '08:00', fin: '09:00', tipo: 'clase' },
        { inicio: '09:00', fin: '10:00', tipo: 'clase' },
        { inicio: '10:00', fin: '10:30', tipo: 'descanso' },
        { inicio: '10:30', fin: '11:30', tipo: 'clase' },
        { inicio: '11:30', fin: '12:30', tipo: 'clase' },
        { inicio: '12:30', fin: '13:30', tipo: 'clase' }
    ];
    const blocks = [];
    for (let dia = 1; dia <= 5; dia++) {
        let classIndex = 0;
        pattern.forEach(p => {
            const asignatura = p.tipo === 'clase'
                ? asignaturas[(dia + classIndex++) % asignaturas.length]
                : null;
            blocks.push({
                id: uid('blk'),
                dia,
                inicio: p.inicio,
                fin: p.fin,
                tipo: p.tipo,
                asignaturaId: asignatura?.id || null,
                aula: ''
            });
        });
    }
    return blocks;
}

export function starterProfile({ nombre = 'Mi curso', centro = '', grupo = '', inicioCurso = '', finCurso = '' } = {}) {
    const asignaturas = TEMPLATE_SUBJECTS.map(([id, nombreAsig, corto, profesor, color]) => ({
        id,
        nombre: nombreAsig,
        corto,
        profesor,
        color,
        limitePct: null
    }));
    const hoy = new Date();
    const y = hoy.getMonth() >= 7 ? hoy.getFullYear() : hoy.getFullYear() - 1;
    const inicio = inicioCurso || `${y}-09-08`;
    const fin = finCurso || `${y + 1}-06-19`;
    const split1 = `${y + 1}-01-15`;
    const split2 = `${y + 1}-04-10`;

    return normalizeProfile({
        id: uid('perfil'),
        schemaVersion: SCHEMA_VERSION,
        legacy: false,
        nombre: nombre || `Curso ${y}/${String(y + 1).slice(-2)}`,
        centro,
        grupo,
        inicioCurso: inicio,
        finCurso: fin,
        branding: { iniciales: (centro || nombre || 'MC').slice(0, 2).toUpperCase(), colorPrimario: '#00d4ff' },
        tema: 'dark',
        limiteFaltasPct: 20,
        contarJustificadas: true,
        contarRetrasos: true,
        evaluaciones: [
            { id: 'e1', nombre: '1ª Evaluación', inicio, fin: split1 },
            { id: 'e2', nombre: '2ª Evaluación', inicio: split1, fin: split2 },
            { id: 'e3', nombre: '3ª Evaluación', inicio: split2, fin }
        ],
        asignaturas,
        horario: templateSchedule(asignaturas),
        periodos: [
            { id: 'p1', nombre: '1º Trimestre', tipo: 'trimestre', inicio, fin: split1 },
            { id: 'p2', nombre: '2º Trimestre', tipo: 'trimestre', inicio: split1, fin: split2 },
            { id: 'p3', nombre: '3º Trimestre', tipo: 'trimestre', inicio: split2, fin }
        ],
        noLectivos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

export function emptyProfile({ nombre = 'Curso vacío', centro = '', grupo = '', inicioCurso = '', finCurso = '' } = {}) {
    const hoy = new Date();
    const y = hoy.getMonth() >= 7 ? hoy.getFullYear() : hoy.getFullYear() - 1;
    const inicio = inicioCurso || `${y}-09-08`;
    const fin = finCurso || `${y + 1}-06-19`;
    return normalizeProfile({
        id: uid('perfil'),
        schemaVersion: SCHEMA_VERSION,
        legacy: false,
        nombre,
        centro,
        grupo,
        inicioCurso: inicio,
        finCurso: fin,
        branding: { iniciales: (nombre || 'MC').slice(0, 2).toUpperCase(), colorPrimario: '#00d4ff' },
        tema: 'dark',
        limiteFaltasPct: 20,
        contarJustificadas: true,
        contarRetrasos: true,
        evaluaciones: [{ id: 'e1', nombre: '1ª Evaluación', inicio, fin }],
        asignaturas: [],
        horario: [],
        periodos: [],
        noLectivos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

/* ============================================================
   NORMALIZACIÓN
   ============================================================ */
export function normalizeProfile(input) {
    const p = { ...input };
    p.schemaVersion = SCHEMA_VERSION;
    p.id = p.id || uid('perfil');
    p.nombre = p.nombre || 'Mi curso';
    p.centro = p.centro || '';
    p.grupo = p.grupo || '';
    p.tema = p.tema === 'light' ? 'light' : 'dark';
    p.branding = { iniciales: 'CA', colorPrimario: '#00d4ff', ...(p.branding || {}) };
    p.limiteFaltasPct = Number.isFinite(Number(p.limiteFaltasPct)) ? Number(p.limiteFaltasPct) : 20;
    p.contarJustificadas = p.contarJustificadas !== false;
    p.contarRetrasos = p.contarRetrasos !== false;

    p.evaluaciones = Array.isArray(p.evaluaciones) ? p.evaluaciones : [];
    p.evaluaciones = p.evaluaciones
        .filter(e => e && e.inicio && e.fin)
        .map((e, i) => ({
            id: e.id || `e${i + 1}`,
            nombre: e.nombre || `${i + 1}ª Evaluación`,
            inicio: e.inicio,
            fin: e.fin
        }))
        .sort((a, b) => a.inicio.localeCompare(b.inicio));

    if (!p.evaluaciones.length) {
        p.evaluaciones = [{
            id: 'e1',
            nombre: '1ª Evaluación',
            inicio: p.inicioCurso || new Date().toISOString().slice(0, 10),
            fin: p.finCurso || new Date().toISOString().slice(0, 10)
        }];
    }

    p.inicioCurso = p.inicioCurso || p.evaluaciones[0].inicio;
    p.finCurso = p.finCurso || p.evaluaciones[p.evaluaciones.length - 1].fin;

    p.asignaturas = Array.isArray(p.asignaturas) ? p.asignaturas : [];
    p.asignaturas = p.asignaturas.map((a, i) => ({
        id: a.id || uid('asig'),
        nombre: a.nombre || `Asignatura ${i + 1}`,
        corto: a.corto || a.nombre || `A${i + 1}`,
        profesor: a.profesor || '',
        color: a.color || SUBJECT_PALETTE[i % SUBJECT_PALETTE.length],
        limitePct: a.limitePct === null || a.limitePct === undefined || a.limitePct === ''
            ? null
            : Number(a.limitePct)
    }));

    // Actualiza una sola vez los colores del perfil antiguo para no pisar
    // personalizaciones posteriores del usuario.
    if (p.legacy && p.colorScheme !== LEGACY_COLOR_SCHEME) {
        p.asignaturas = p.asignaturas.map(a =>
            LEGACY_COLORS[a.id] ? { ...a, color: LEGACY_COLORS[a.id] } : a
        );
        p.colorScheme = LEGACY_COLOR_SCHEME;
    }

    const subjectIds = new Set(p.asignaturas.map(a => a.id));
    p.horario = Array.isArray(p.horario) ? p.horario : [];
    p.horario = p.horario
        .filter(b => b && b.inicio && b.fin)
        .map((b, i) => ({
            id: b.id || `blk-${i + 1}`,
            dia: Math.min(7, Math.max(1, Number(b.dia) || 1)),
            inicio: b.inicio,
            fin: b.fin,
            tipo: ['clase', 'descanso', 'libre'].includes(b.tipo) ? b.tipo : 'clase',
            asignaturaId: b.tipo === 'clase' && subjectIds.has(b.asignaturaId) ? b.asignaturaId : null,
            aula: b.aula || ''
        }))
        .sort((a, b) => a.dia - b.dia || timeToMin(a.inicio) - timeToMin(b.inicio));

    p.periodos = Array.isArray(p.periodos) ? p.periodos : [];
    p.periodos = p.periodos
        .filter(per => per && per.inicio && per.fin)
        .map((per, i) => ({
            id: per.id || `periodo-${i + 1}`,
            nombre: per.nombre || `Periodo ${i + 1}`,
            tipo: per.tipo || 'otro',
            inicio: per.inicio,
            fin: per.fin
        }))
        .sort((a, b) => a.inicio.localeCompare(b.inicio));

    p.noLectivos = Array.isArray(p.noLectivos) ? p.noLectivos : [];
    p.noLectivos = p.noLectivos
        .filter(n => n && n.inicio && n.fin)
        .map((n, i) => ({
            id: n.id || `nol-${i + 1}`,
            inicio: n.inicio,
            fin: n.fin,
            motivo: n.motivo || 'No lectivo',
            tipo: n.tipo || 'festivo'
        }))
        .sort((a, b) => a.inicio.localeCompare(b.inicio));

    return p;
}

export function normalizeFalta(raw, profile) {
    const evals = profile?.evaluaciones || [];
    let evaluacionId = raw.evaluacionId || null;
    if (!evaluacionId && raw.evaluacion) {
        const idx = Math.max(0, Number(raw.evaluacion) - 1);
        evaluacionId = evals[idx]?.id || evals[0]?.id || null;
    }
    if (!evaluacionId && raw.fecha) {
        evaluacionId = evals.find(e => raw.fecha >= e.inicio && raw.fecha <= e.fin)?.id || evals[0]?.id || null;
    }
    const asignaturaId = raw.asignaturaId || raw.asignatura || null;
    return {
        id: raw.id || uid('falta'),
        perfilId: raw.perfilId || profile?.id || null,
        asignaturaId,
        asignatura: asignaturaId,
        fecha: raw.fecha || new Date().toISOString().slice(0, 10),
        horas: Number(raw.horas) || 0,
        minutosRetraso: Number(raw.minutosRetraso) || 0,
        evaluacionId,
        evaluacion: evals.findIndex(e => e.id === evaluacionId) + 1 || 1,
        tipo: ['injustificada', 'justificada', 'retraso'].includes(raw.tipo) ? raw.tipo : 'injustificada',
        nota: raw.nota || '',
        timestamp: raw.timestamp || new Date().toISOString(),
        updatedAt: raw.updatedAt || null,
        _pending: raw._pending === true
    };
}

export function normalizeExamen(raw, profile) {
    const evals = profile?.evaluaciones || [];
    const asignaturaId = raw.asignaturaId || raw.asignatura || null;
    const fecha = raw.fecha || new Date().toISOString().slice(0, 10);
    const evaluacionId = raw.evaluacionId
        || evals.find(e => fecha >= e.inicio && fecha <= e.fin)?.id
        || evals[0]?.id
        || null;
    return {
        id: raw.id || uid('examen'),
        perfilId: raw.perfilId || profile?.id || null,
        asignaturaId,
        asignatura: asignaturaId,
        evaluacionId,
        titulo: raw.titulo || 'Examen',
        fecha,
        horaInicio: raw.horaInicio || '09:00',
        horaFin: raw.horaFin || '10:00',
        aula: raw.aula || '',
        tipo: ['examen', 'entrega', 'presentacion', 'practica', 'otro'].includes(raw.tipo) ? raw.tipo : 'examen',
        temario: raw.temario || '',
        peso: raw.peso === '' || raw.peso === null || raw.peso === undefined ? null : Number(raw.peso),
        nota: raw.nota === '' || raw.nota === null || raw.nota === undefined ? null : Number(raw.nota),
        notas: raw.notas || '',
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || null,
        _pending: raw._pending === true
    };
}

export function cloneProfile(profile, { nombre, copyData = false } = {}) {
    return normalizeProfile({
        ...structuredClone(profile),
        id: uid('perfil'),
        nombre: nombre || `${profile.nombre} (copia)`,
        legacy: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}
