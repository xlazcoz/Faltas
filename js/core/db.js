/**
 * db.js — Sincronización opcional con Firebase Firestore.
 * La app funciona siempre en local. Si hay configuración, escucha cambios y
 * empuja las modificaciones locales sin bloquear la interfaz.
 */
import * as Store from './store.js';
import { setDbStatus, toast } from '../ui/ui.js';

const KEY_API = 'firebase_apiKey';
const KEY_PROJECT = 'firebase_projectId';
const SDK_APP = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
const SDK_FS = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js';

let db = null;
let started = false;
let warned = false;

export function getConfig() {
    return {
        apiKey: localStorage.getItem(KEY_API) || '',
        projectId: localStorage.getItem(KEY_PROJECT) || ''
    };
}

export function hasConfig() {
    const c = getConfig();
    return Boolean(c.apiKey && c.projectId);
}

export function saveConfig(apiKey, projectId) {
    localStorage.setItem(KEY_API, apiKey.trim());
    localStorage.setItem(KEY_PROJECT, projectId.trim());
}

export function clearConfig() {
    localStorage.removeItem(KEY_API);
    localStorage.removeItem(KEY_PROJECT);
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(s);
    });
}

async function ensureFirebase() {
    if (window.firebase?.firestore) return;
    await loadScript(SDK_APP);
    await loadScript(SDK_FS);
}

function legacyProfileId() {
    return (Store.getProfiles().find(p => p.legacy) || Store.getProfiles()[0])?.id || null;
}

function cleanForCloud(item) {
    const out = {};
    Object.entries(item || {}).forEach(([k, v]) => {
        if (k.startsWith('_')) return;
        if (v === undefined) return;
        out[k] = v;
    });
    return out;
}

function pushItem(collection, item, profileId) {
    if (!db || !profileId) return;
    const ref = db.collection(collection === 'notas' ? 'notas' : collection).doc(item.id);
    const payload = cleanForCloud({ ...item, perfilId: profileId });
    ref.set(payload, { merge: true })
        .then(() => Store.markSynced(collection, collection === 'notas' ? item.asignaturaId : item.id, profileId))
        .catch(err => {
            console.warn('No se pudo sincronizar', collection, err);
            setDbStatus('Offline (local)', 'offline');
        });
}

function deleteItem(collection, id) {
    if (!db) return;
    db.collection(collection).doc(id).delete().catch(() => {});
}

async function pushPending(profileId) {
    const data = Store.getData(profileId);
    for (const f of data.faltas) {
        if (f._synced !== true) pushItem('faltas', f, profileId);
    }
    for (const e of data.examenes) {
        if (e._synced !== true) pushItem('examenes', e, profileId);
    }
    for (const [subjectId, nota] of Object.entries(data.notas)) {
        if (nota._synced !== true) {
            const id = `${profileId}__${subjectId}`;
            pushItem('notas', { id, asignaturaId: subjectId, ...nota }, profileId);
        }
    }
}

function listenCollection(name) {
    db.collection(name).onSnapshot(snapshot => {
        const grouped = {};
        snapshot.docs.forEach(doc => {
            const raw = { id: doc.id, ...doc.data() };
            let pid = raw.perfilId;
            if (!pid) {
                if (name === 'notas' && !doc.id.includes('__')) {
                    pid = legacyProfileId();
                    raw.asignaturaId = raw.asignaturaId || doc.id;
                } else if (doc.id.includes('__')) {
                    pid = doc.id.split('__')[0];
                } else {
                    pid = legacyProfileId();
                }
            }
            if (!pid) return;
            raw.perfilId = pid;
            if (!grouped[pid]) grouped[pid] = [];
            grouped[pid].push(raw);
        });
        Object.entries(grouped).forEach(([pid, items]) => {
            Store.applyRemote(pid, name, items);
            pushPending(pid);
        });
        setDbStatus('Conectado', 'connected');
    }, err => {
        console.warn('Firestore:', err);
        setDbStatus('Offline (local)', 'offline');
        if (!warned) {
            warned = true;
            toast('Sin conexión con Firestore. Todo se guarda en este dispositivo.', 'info', 4500);
        }
    });
}

export async function initFirebase() {
    if (started) return;
    started = true;
    if (!hasConfig()) {
        setDbStatus('Local', 'local');
        return;
    }
    setDbStatus('Conectando…', 'connecting');
    try {
        await ensureFirebase();
        const { apiKey, projectId } = getConfig();
        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey,
                projectId,
                authDomain: `${projectId}.firebaseapp.com`
            });
        }
        db = firebase.firestore();
        db.enablePersistence?.({ synchronizeTabs: true }).catch(() => {});

        listenCollection('faltas');
        listenCollection('examenes');
        listenCollection('notas');

        Store.subscribe(event => {
            if (event.source !== 'local') return;
            if (!event.collection || !event.profileId) return;
            if (event.collection === 'notas') {
                if (event.type === 'upsert' && event.item) {
                    const id = `${event.profileId}__${event.item.asignaturaId}`;
                    pushItem('notas', { ...event.item, id }, event.profileId);
                } else if (event.type === 'delete' && event.item?.asignaturaId) {
                    deleteItem('notas', `${event.profileId}__${event.item.asignaturaId}`);
                    if (Store.getProfile(event.profileId)?.legacy) {
                        deleteItem('notas', event.item.asignaturaId);
                    }
                }
                return;
            }
            if (event.type === 'upsert' && event.item) {
                pushItem(event.collection, event.item, event.profileId);
            } else if (event.type === 'delete' && event.item?.id) {
                deleteItem(event.collection, event.item.id);
            }
        });

        Store.getProfiles().forEach(p => pushPending(p.id));
    } catch (e) {
        console.warn('Firebase no disponible:', e);
        setDbStatus('Offline (local)', 'offline');
    }
}
