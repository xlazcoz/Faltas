/**
 * ui.js — Componentes visuales compartidos: iconos, modales, toasts y utilidades.
 */

const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
    clipboard: '<path d="M9 4h6"/><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1Z"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 11h6M9 15h6"/>',
    schedule: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M17 3l2 2M7 3 5 5"/>',
    exam: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.5.64.92.68H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
    cloud: '<path d="M17.5 19H7a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11a4 4 0 0 1-2 8Z"/>',
    cloudOff: '<path d="m2 2 20 20"/><path d="M5.8 5.8A6 6 0 0 0 5.5 17H17"/><path d="M9 5.5A6 6 0 0 1 19.3 10a4 4 0 0 1 1.2 6.8"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    alert: '<path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    graduation: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5Z"/>'
};

export function icon(name, size = 18, className = '') {
    const path = ICONS[name] || ICONS.info;
    return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function debounce(fn, ms = 250) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

export function download(filename, content, mime = 'application/json') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function ensureToastContainer() {
    let el = document.getElementById('toast-container');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast-container';
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
    }
    return el;
}

export function toast(message, type = 'info', duration = 3400) {
    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `${icon(type === 'success' ? 'check' : type === 'error' ? 'alertCircle' : 'info', 17)}<span>${escapeHtml(message)}</span>`;
    el.addEventListener('click', () => el.remove());
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast--out');
        setTimeout(() => el.remove(), 220);
    }, duration);
}

export function setDbStatus(text, type = 'local') {
    const badge = document.getElementById('db-status');
    if (!badge) return;
    badge.dataset.state = type;
    const label = badge.querySelector('[data-status-text]');
    if (label) label.textContent = text;
}

export function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

export function openModal({ title, subtitle = '', body = '', footer = '', size = '', onMount = null }) {
    let root = document.getElementById('modal-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'modal-root';
        document.body.appendChild(root);
    }
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
        <div class="modal-backdrop" data-close></div>
        <div class="modal-card ${size ? `modal-card--${size}` : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <header class="modal-header">
                <div>
                    <h2 id="modal-title">${escapeHtml(title)}</h2>
                    ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
                </div>
                <button type="button" class="btn-icon" data-close aria-label="Cerrar">${icon('x')}</button>
            </header>
            <div class="modal-body">${body}</div>
            ${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}
        </div>`;
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    document.body.classList.add('modal-open');

    const close = () => {
        wrap.classList.remove('open');
        document.body.classList.remove('modal-open');
        setTimeout(() => wrap.remove(), 180);
        document.removeEventListener('keydown', onKey);
    };
    const onKey = e => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    wrap.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));

    const firstField = wrap.querySelector('input, select, textarea, button:not([data-close])');
    setTimeout(() => firstField?.focus(), 80);

    if (onMount) onMount({ wrap, card: wrap.querySelector('.modal-card'), body: wrap.querySelector('.modal-body'), close });
    return { wrap, card: wrap.querySelector('.modal-card'), body: wrap.querySelector('.modal-body'), close };
}

export function confirmDialog({ title = '¿Confirmar?', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
    return new Promise(resolve => {
        let settled = false;
        const modal = openModal({
            title,
            body: `<p class="confirm-message">${escapeHtml(message)}</p>`,
            size: 'sm',
            footer: `
                <button type="button" class="btn btn--ghost" data-cancel>${escapeHtml(cancelText)}</button>
                <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-confirm>${escapeHtml(confirmText)}</button>`
        });
        const finish = value => {
            if (settled) return;
            settled = true;
            modal.close();
            resolve(value);
        };
        modal.card.querySelector('[data-confirm]').addEventListener('click', () => finish(true));
        modal.card.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
        modal.card.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => finish(false)));
        const onKey = e => { if (e.key === 'Escape') finish(false); };
        document.addEventListener('keydown', onKey, { once: true });
    });
}

export function stateBadge(state) {
    if (state === 'danger') return '<span class="badge badge--danger">Peligro</span>';
    if (state === 'warning') return '<span class="badge badge--warning">Riesgo</span>';
    return '<span class="badge badge--ok">Correcto</span>';
}

export function stateLabel(state) {
    return state === 'danger' ? 'Peligro' : state === 'warning' ? 'Riesgo' : 'Correcto';
}

export function progress(value, max, state = 'ok', label = '') {
    const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
    return `<div class="progress" title="${escapeHtml(label)}">
        <div class="progress__fill progress__fill--${state}" style="width:${pct.toFixed(1)}%"></div>
    </div>`;
}

export function emptyState({ iconName = 'info', title = 'Nada por aquí', text = '', action = '' }) {
    return `<div class="empty-state">
        <div class="empty-state__icon">${icon(iconName, 28)}</div>
        <h3>${escapeHtml(title)}</h3>
        ${text ? `<p>${escapeHtml(text)}</p>` : ''}
        ${action}
    </div>`;
}

export function subjectName(profile, id) {
    const subject = (profile.asignaturas || []).find(a => a.id === id);
    return subject ? subject.nombre : 'Asignatura eliminada';
}

export function subjectShort(profile, id) {
    const subject = (profile.asignaturas || []).find(a => a.id === id);
    return subject ? (subject.corto || subject.nombre) : '—';
}

export function subjectColor(profile, id) {
    const subject = (profile.asignaturas || []).find(a => a.id === id);
    return subject?.color || '#64748b';
}

export function initials(text) {
    const parts = String(text || 'MC').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'MC';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return parts.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function formatHours(n) {
    const value = Number(n) || 0;
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

export function plural(n, singular, pluralWord) {
    return `${n} ${n === 1 ? singular : pluralWord}`;
}
