/**
 * store.js — Estado local-first de toda la aplicación.
 * Guarda perfiles, faltas, exámenes, apuntes y papelera en localStorage.
 * Firebase es opcional y se conecta desde db.js sin bloquear la app.
 */
import {
    legacyProfile, normalizeProfile, normalizeFalta, normalizeExamen,
    cloneProfile, uid
} from './model.js';
import { todayISO } from './dates.js';

const ROOT_KEY = 'ca_v2_state';
const LEGACY_CACHE = 'ca_faltas_cache';
const LEGACY_TRASH = 'ca_papelera';

let state = null;
const listeners = new Set();

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function emptyData() {
    return { faltas: [], examenes: [], notas: {}, papelera: [] };
}

function ensureData(profileId) {
    if (!state.data[profileId]) state.data[profileId] = emptyData();
    const d = state.data[profileId];
    d.faltas = Array.isArray(d.faltas) ? d.faltas : [];
    d.examenes = Array.isArray(d.examenes) ? d.examenes : [];
    d.notas = d.notas && typeof d.notas === 'object' ? d.notas : {};
    d.papelera = Array.isArray(d.papelera) ? d.papelera : [];
    return d;
}

function migrateLegacy() {
    const profile = legacyProfile();
    const data = emptyData();

    const cached = readJSON(LEGACY_CACHE, []);
    if (Array.isArray(cached)) {
        data.faltas = cached.map(f => normalizeFalta(f, profile));
    }

    const trash = readJSON(LEGACY_TRASH, []);
    if (Array.isArray(trash)) {
        data.papelera = trash.map(f => ({
            ...normalizeFalta(f, profile),
            deletedAt: f.deletedAt || new Date().toISOString()
        }));
    }

    return {
        version: 2,
        migratedFromLegacy: true,
        migratedAt: new Date().toISOString(),
        activeProfileId: profile.id,
        profiles: [profile],
        data: { [profile.id]: data },
        settings: { theme: profile.tema === 'light' ? 'light' : 'dark' }
    };
}

function normalizeState(raw) {
    if (!raw || !Array.isArray(raw.profiles) || !raw.profiles.length) return migrateLegacy();
    const profiles = raw.profiles.map(normalizeProfile);
    const ids = new Set(profiles.map(p => p.id));
    let activeProfileId = ids.has(raw.activeProfileId) ? raw.activeProfileId : profiles[0].id;
    const data = {};
    profiles.forEach(p => {
        const d = raw.data?.[p.id] || {};
        data[p.id] = {
            faltas: Array.isArray(d.faltas) ? d.faltas.map(f => normalizeFalta(f, p)) : [],
            examenes: Array.isArray(d.examenes) ? d.examenes.map(e => normalizeExamen(e, p)) : [],
            notas: d.notas && typeof d.notas === 'object' ? d.notas : {},
            papelera: Array.isArray(d.papelera) ? d.papelera.map(f => ({
                ...normalizeFalta(f, p),
                deletedAt: f.deletedAt || new Date().toISOString()
            })) : []
        };
    });
    return {
        version: 2,
        migratedFromLegacy: raw.migratedFromLegacy === true,
        migratedAt: raw.migratedAt || null,
        activeProfileId,
        profiles,
        data,
        settings: { theme: raw.settings?.theme === 'light' ? 'light' : 'dark' }
    };
}

function load() {
    const raw = readJSON(ROOT_KEY, null);
    state = raw ? normalizeState(raw) : migrateLegacy();
    state.profiles.forEach(p => ensureData(p.id));
    save({ silent: true });
    return state;
}

function save({ silent = false } = {}) {
    try {
        localStorage.setItem(ROOT_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('No se pudo guardar el estado local', e);
    }
    if (!silent) emit({ source: 'local', type: 'state' });
}

function emit(event) {
    listeners.forEach(fn => {
        try { fn(event); } catch (e) { console.error(e); }
    });
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function getState() {
    return state;
}

export function getProfiles() {
    return state.profiles.map(p => ({
        id: p.id, nombre: p.nombre, centro: p.centro, grupo: p.grupo, legacy: p.legacy
    }));
}

export function getActiveProfile() {
    return state.profiles.find(p => p.id === state.activeProfileId) || state.profiles[0];
}

export function getProfile(id) {
    return state.profiles.find(p => p.id === id) || null;
}

export function getData(profileId = state.activeProfileId) {
    return ensureData(profileId);
}

export function setActiveProfile(id) {
    if (!state.profiles.some(p => p.id === id)) return;
    state.activeProfileId = id;
    save();
    emit({ source: 'local', type: 'profile-active', profileId: id });
}

export function updateProfile(id, patchOrFn) {
    const profile = getProfile(id);
    if (!profile) return null;
    const patch = typeof patchOrFn === 'function' ? patchOrFn(profile) : patchOrFn;
    const updated = normalizeProfile({ ...profile, ...patch, updatedAt: new Date().toISOString() });
    const idx = state.profiles.findIndex(p => p.id === id);
    state.profiles[idx] = updated;
    ensureData(id);
    save();
    emit({ source: 'local', type: 'profile', profileId: id, item: updated });
    return updated;
}

export function createProfile(profile, { activate = true } = {}) {
    const normalized = normalizeProfile(profile);
    state.profiles.push(normalized);
    ensureData(normalized.id);
    if (activate) state.activeProfileId = normalized.id;
    save();
    emit({ source: 'local', type: 'profile-create', profileId: normalized.id, item: normalized });
    return normalized;
}

export function duplicateProfile(id, { nombre, copyData = false } = {}) {
    const original = getProfile(id);
    if (!original) return null;
    const copy = cloneProfile(original, { nombre: nombre || `${original.nombre} (copia)` });
    state.profiles.push(copy);
    ensureData(copy.id);
    if (copyData) {
        const source = getData(id);
        state.data[copy.id] = {
            faltas: structuredClone(source.faltas).map(f => ({ ...f, id: uid('falta'), perfilId: copy.id, _synced: false })),
            examenes: structuredClone(source.examenes).map(e => ({ ...e, id: uid('examen'), perfilId: copy.id, _synced: false })),
            notas: Object.fromEntries(Object.entries(source.notas).map(([k, v]) => [k, { ...v, _synced: false }])),
            papelera: []
        };
    }
    state.activeProfileId = copy.id;
    save();
    emit({ source: 'local', type: 'profile-create', profileId: copy.id, item: copy });
    return copy;
}

export function deleteProfile(id) {
    if (state.profiles.length <= 1) return false;
    state.profiles = state.profiles.filter(p => p.id !== id);
    delete state.data[id];
    if (state.activeProfileId === id) state.activeProfileId = state.profiles[0].id;
    save();
    emit({ source: 'local', type: 'profile-delete', profileId: id });
    return true;
}

/* ============================================================
   FALTAS
   ============================================================ */
export function addFalta(raw, profileId = state.activeProfileId) {
    const profile = getProfile(profileId);
    const data = ensureData(profileId);
    const item = { ...normalizeFalta(raw, profile), perfilId: profileId, id: uid('falta'), _synced: false };
    data.faltas.push(item);
    save();
    emit({ source: 'local', type: 'upsert', collection: 'faltas', profileId, item });
    return item;
}

export function updateFalta(id, patch, profileId = state.activeProfileId) {
    const profile = getProfile(profileId);
    const data = ensureData(profileId);
    const idx = data.faltas.findIndex(f => f.id === id);
    if (idx < 0) return null;
    const item = { ...normalizeFalta({ ...data.faltas[idx], ...patch }, profile), _synced: false, updatedAt: new Date().toISOString() };
    data.faltas[idx] = item;
    save();
    emit({ source: 'local', type: 'upsert', collection: 'faltas', profileId, item });
    return item;
}

export function deleteFalta(id, profileId = state.activeProfileId) {
    const data = ensureData(profileId);
    const idx = data.faltas.findIndex(f => f.id === id);
    if (idx < 0) return null;
    const [item] = data.faltas.splice(idx, 1);
    data.papelera.push({ ...item, deletedAt: new Date().toISOString() });
    save();
    emit({ source: 'local', type: 'delete', collection: 'faltas', profileId, item });
    return item;
}

export function restoreFalta(id, profileId = state.activeProfileId) {
    const profile = getProfile(profileId);
    const data = ensureData(profileId);
    const idx = data.papelera.findIndex(f => f.id === id);
    if (idx < 0) return null;
    const [item] = data.papelera.splice(idx, 1);
    const restored = { ...normalizeFalta(item, profile), _synced: false, updatedAt: new Date().toISOString() };
    delete restored.deletedAt;
    data.faltas.push(restored);
    save();
    emit({ source: 'local', type: 'upsert', collection: 'faltas', profileId, item: restored });
    return restored;
}

export function purgeTrashItem(id, profileId = state.activeProfileId) {
    const data = ensureData(profileId);
    data.papelera = data.papelera.filter(f => f.id !== id);
    save();
    emit({ source: 'local', type: 'delete', collection: 'faltas', profileId, item: { id }, permanent: true });
}

export function cleanTrash(profileId = state.activeProfileId) {
    const data = ensureData(profileId);
    const cutoff = Date.now() - 7 * 86400000;
    const removed = data.papelera.filter(f => new Date(f.deletedAt).getTime() < cutoff);
    if (!removed.length) return;
    data.papelera = data.papelera.filter(f => new Date(f.deletedAt).getTime() >= cutoff);
    save();
    removed.forEach(item => emit({ source: 'local', type: 'delete', collection: 'faltas', profileId, item, permanent: true }));
}

export function clearTrash(profileId = state.activeProfileId) {
    const data = ensureData(profileId);
    const removed = [...data.papelera];
    data.papelera = [];
    save();
    removed.forEach(item => emit({ source: 'local', type: 'delete', collection: 'faltas', profileId, item, permanent: true }));
}

export function clearFaltas(profileId = state.activeProfileId) {
    const data = ensureData(profileId);
    const removed = [...data.faltas];
    data.faltas = [];
    data.papelera = [];
    save();
    removed.forEach(item => emit({ source: 'local', type: 'delete', collection: 'faltas', profileId, item }));
}

export function clearData(profileId = state.activeProfileId) {
    const data = ensureData(profileId);
    const removedFaltas = [...data.faltas];
    const removedExamenes = [...data.examenes];
    const removedNotes = Object.keys(data.notas);
    data.faltas = [];
    data.examenes = [];
    data.notas = {};
    data.papelera = [];
    save();
    removedFaltas.forEach(item => emit({ source: 'local', type: 'delete', collection: 'faltas', profileId, item }));
    removedExamenes.forEach(item => emit({ source: 'local', type: 'delete', collection: 'examenes', profileId, item }));
    removedNotes.forEach(asignaturaId => emit({
        source: 'local', type: 'delete', collection: 'notas', profileId,
        item: { id: `${profileId}__${asignaturaId}`, asignaturaId }
    }));
    emit({ source: 'local', type: 'clear-data', profileId });
}

/* ============================================================
   EXÁMENES
   ============================================================ */
export function addExamen(raw, profileId = state.activeProfileId) {
    const profile = getProfile(profileId);
    const data = ensureData(profileId);
    const item = { ...normalizeExamen(raw, profile), perfilId: profileId, id: uid('examen'), _synced: false };
    data.examenes.push(item);
    save();
    emit({ source: 'local', type: 'upsert', collection: 'examenes', profileId, item });
    return item;
}

export function updateExamen(id, patch, profileId = state.activeProfileId) {
    const profile = getProfile(profileId);
    const data = ensureData(profileId);
    const idx = data.examenes.findIndex(e => e.id === id);
    if (idx < 0) return null;
    const item = { ...normalizeExamen({ ...data.examenes[idx], ...patch }, profile), _synced: false, updatedAt: new Date().toISOString() };
    data.examenes[idx] = item;
    save();
    emit({ source: 'local', type: 'upsert', collection: 'examenes', profileId, item });
    return item;
}

export function deleteExamen(id, profileId = state.activeProfileId) {
    const data = ensureData(profileId);
    const idx = data.examenes.findIndex(e => e.id === id);
    if (idx < 0) return null;
    const [item] = data.examenes.splice(idx, 1);
    save();
    emit({ source: 'local', type: 'delete', collection: 'examenes', profileId, item });
    return item;
}

/* ============================================================
   APUNTES
   ============================================================ */
export function getNota(subjectId, profileId = state.activeProfileId) {
    return getData(profileId).notas[subjectId] || { contenido: '', pendiente: '', updatedAt: null };
}

export function setNota(subjectId, nota, profileId = state.activeProfileId) {
    const data = ensureData(profileId);
    data.notas[subjectId] = {
        contenido: nota.contenido || '',
        pendiente: nota.pendiente || '',
        updatedAt: new Date().toISOString(),
        _synced: false
    };
    save();
    emit({ source: 'local', type: 'upsert', collection: 'notas', profileId, item: { asignaturaId: subjectId, ...data.notas[subjectId] } });
    return data.notas[subjectId];
}

/* ============================================================
   SINCRONIZACIÓN (llamadas desde db.js)
   ============================================================ */
export function markSynced(collection, id, profileId = state.activeProfileId) {
    const data = ensureData(profileId);
    if (collection === 'notas') {
        if (data.notas[id]) data.notas[id]._synced = true;
    } else if (Array.isArray(data[collection])) {
        const item = data[collection].find(x => x.id === id);
        if (item) item._synced = true;
    }
    save({ silent: true });
}

export function applyRemote(profileId, collection, items) {
    if (!state.profiles.some(p => p.id === profileId)) return;
    const data = ensureData(profileId);
    const profile = getProfile(profileId);

    if (collection === 'notas') {
        const incoming = Array.isArray(items) ? items : Object.values(items || {});
        incoming.forEach(n => {
            const local = data.notas[n.asignaturaId];
            if (local && local._synced === false) return;
            data.notas[n.asignaturaId] = {
                contenido: n.contenido || '',
                pendiente: n.pendiente || '',
                updatedAt: n.updatedAt || null,
                _synced: true
            };
        });
        save({ silent: true });
        emit({ source: 'remote', type: 'remote', collection, profileId });
        return;
    }

    if (!Array.isArray(data[collection])) return;
    const remote = (items || []).map(item => collection === 'faltas'
        ? normalizeFalta(item, profile)
        : normalizeExamen(item, profile));
    const remoteIds = new Set(remote.map(x => x.id));
    const localById = new Map(data[collection].map(x => [x.id, x]));

    // Si un elemento local está pendiente de subir, tiene prioridad sobre la copia remota.
    const mergedRemote = remote.map(item => {
        const local = localById.get(item.id);
        if (local && local._synced === false) return local;
        return { ...item, perfilId: profileId, _synced: true };
    });
    const localUnsynced = data[collection].filter(x => !remoteIds.has(x.id) && x._synced !== true);

    data[collection] = [...mergedRemote, ...localUnsynced];
    save({ silent: true });
    emit({ source: 'remote', type: 'remote', collection, profileId });
}

/* ============================================================
   IMPORT / EXPORT / RESET
   ============================================================ */
export function exportPayload() {
    return {
        app: 'mi-curso',
        version: 2,
        exportedAt: new Date().toISOString(),
        activeProfileId: state.activeProfileId,
        profiles: state.profiles,
        data: state.data,
        settings: state.settings
    };
}

export function importPayload(payload) {
    if (!payload || !Array.isArray(payload.profiles) || !payload.data) {
        throw new Error('El archivo no tiene el formato esperado');
    }
    const profiles = payload.profiles.map(normalizeProfile);
    if (!profiles.length) throw new Error('El archivo no contiene perfiles');
    const data = {};
    profiles.forEach(p => {
        const d = payload.data[p.id] || {};
        data[p.id] = {
            faltas: Array.isArray(d.faltas) ? d.faltas.map(f => ({ ...normalizeFalta(f, p), _synced: false })) : [],
            examenes: Array.isArray(d.examenes) ? d.examenes.map(e => ({ ...normalizeExamen(e, p), _synced: false })) : [],
            notas: Object.fromEntries(Object.entries(d.notas || {}).map(([k, v]) => [k, { ...v, _synced: false }])),
            papelera: Array.isArray(d.papelera) ? d.papelera.map(f => ({ ...normalizeFalta(f, p), deletedAt: f.deletedAt || new Date().toISOString() })) : []
        };
    });
    state = {
        version: 2,
        migratedFromLegacy: false,
        migratedAt: null,
        activeProfileId: profiles.some(p => p.id === payload.activeProfileId) ? payload.activeProfileId : profiles[0].id,
        profiles,
        data,
        settings: { theme: payload.settings?.theme === 'light' ? 'light' : 'dark' }
    };
    save();
    emit({ source: 'local', type: 'import' });
    return state;
}

export function resetAll() {
    state = migrateLegacy();
    state.profiles.forEach(p => ensureData(p.id));
    save();
    emit({ source: 'local', type: 'reset' });
}

export function getSettings() {
    return state.settings;
}

export function updateSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    save();
    emit({ source: 'local', type: 'settings' });
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
load();

if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
        if (e.key !== ROOT_KEY || !e.newValue) return;
        try {
            state = normalizeState(JSON.parse(e.newValue));
            state.profiles.forEach(p => ensureData(p.id));
            emit({ source: 'remote', type: 'storage' });
        } catch { /* ignorar */ }
    });
}

export const Store = {
    subscribe, getState, getProfiles, getActiveProfile, getProfile, getData,
    setActiveProfile, updateProfile, createProfile, duplicateProfile, deleteProfile,
    addFalta, updateFalta, deleteFalta, restoreFalta, purgeTrashItem, cleanTrash,
    clearTrash, clearFaltas, clearData, addExamen, updateExamen, deleteExamen,
    getNota, setNota, markSynced, applyRemote,
    exportPayload, importPayload, resetAll,
    getSettings, updateSettings
};

export { todayISO };
