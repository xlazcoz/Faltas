/**
 * shell.js — Cabecera, navegación lateral, barra móvil y estado global.
 */
import * as Store from '../core/store.js';
import { initFirebase, hasConfig } from '../core/db.js';
import { applyTheme, icon, initials, setDbStatus, toast } from './ui.js';

const NAV = [
    { id: 'inicio', href: 'index.html', label: 'Inicio', icon: 'home' },
    { id: 'faltas', href: 'faltas.html', label: 'Faltas', icon: 'clipboard' },
    { id: 'horario', href: 'horario.html', label: 'Horario', icon: 'schedule' },
    { id: 'examenes', href: 'examenes.html', label: 'Exámenes', icon: 'exam' },
    { id: 'calendario', href: 'calendario.html', label: 'Calendario', icon: 'calendar' },
    { id: 'ajustes', href: 'ajustes.html', label: 'Ajustes', icon: 'settings' }
];

const MOBILE_NAV = NAV.filter(n => n.id !== 'ajustes');

export function mountShell({ active = 'inicio', title = 'Mi curso', subtitle = '' } = {}) {
    const app = document.getElementById('app');
    if (!app) throw new Error('Falta #app');
    const profile = Store.getActiveProfile();
    const settings = Store.getSettings();
    const profiles = Store.getProfiles();
    const theme = settings.theme === 'light' ? 'light' : 'dark';
    applyTheme(theme);

    app.innerHTML = `
        <div class="sidebar-scrim" data-menu-close></div>
        <aside class="sidebar" id="sidebar">
            <a class="brand" href="index.html">
                <span class="brand__mark">${initials(profile.branding?.iniciales || profile.nombre)}</span>
                <span class="brand__text">
                    <strong>${escape(profile.nombre)}</strong>
                    <small>${escape(profile.centro || 'Asistencia y exámenes')}</small>
                </span>
            </a>

            <div class="profile-picker">
                <div class="profile-picker__row">
                    <select id="profile-select" aria-label="Cambiar de curso">
                        ${profiles.map(p => `<option value="${p.id}" ${p.id === profile.id ? 'selected' : ''}>${escape(p.nombre)}</option>`).join('')}
                    </select>
                    <a href="ajustes.html#perfil" class="btn-icon" title="Gestionar cursos" aria-label="Gestionar cursos">${icon('plus')}</a>
                </div>
            </div>

            <nav class="side-nav" aria-label="Navegación principal">
                ${NAV.map(item => `
                    <a href="${item.href}" class="side-nav__item ${active === item.id ? 'is-active' : ''}" ${active === item.id ? 'aria-current="page"' : ''}>
                        ${icon(item.icon, 19)}
                        <span>${item.label}</span>
                    </a>`).join('')}
            </nav>
        </aside>

        <div class="app-main">
            <header class="topbar">
                <button class="btn-icon topbar__menu" type="button" data-menu-open aria-label="Abrir menú">${icon('menu')}</button>
                <div class="topbar__title">
                    <h1>${escape(title)}</h1>
                    <p>${escape(subtitle || profile.grupo || profile.centro || '')}</p>
                </div>
                <div class="topbar__actions">
                    <span class="db-badge" id="db-status" data-state="${hasConfig() ? 'connecting' : 'local'}" title="Estado de los datos">
                        <span class="db-badge__dot"></span>
                        <span data-status-text>${hasConfig() ? 'Conectando…' : 'Local'}</span>
                    </span>
                    <button type="button" class="btn-icon" id="theme-toggle" title="Cambiar tema" aria-label="Cambiar tema">
                        ${icon(theme === 'light' ? 'moon' : 'sun')}
                    </button>
                    <a href="ajustes.html" class="btn-icon" title="Ajustes" aria-label="Ajustes">${icon('settings')}</a>
                </div>
            </header>

            <main id="page-content" class="page" tabindex="-1"></main>
        </div>

        <nav class="mobile-nav" aria-label="Navegación">
            ${MOBILE_NAV.map(item => `
                <a href="${item.href}" class="mobile-nav__item ${active === item.id ? 'is-active' : ''}">
                    ${icon(item.icon, 21)}
                    <span>${item.label}</span>
                </a>`).join('')}
            <a href="ajustes.html" class="mobile-nav__item ${active === 'ajustes' ? 'is-active' : ''}">
                ${icon('settings', 21)}
                <span>Ajustes</span>
            </a>
        </nav>
    `;

    document.title = `${title} — ${profile.nombre}`;

    const select = document.getElementById('profile-select');
    select?.addEventListener('change', e => {
        Store.setActiveProfile(e.target.value);
        location.reload();
    });

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const next = Store.getSettings().theme === 'light' ? 'dark' : 'light';
        Store.updateSettings({ theme: next });
        applyTheme(next);
        const btn = document.getElementById('theme-toggle');
        btn.innerHTML = icon(next === 'light' ? 'moon' : 'sun');
        toast(next === 'light' ? 'Tema claro activado' : 'Tema oscuro activado', 'info', 1600);
    });

    document.querySelector('[data-menu-open]')?.addEventListener('click', () => {
        document.body.classList.add('sidebar-open');
    });
    document.querySelectorAll('[data-menu-close]').forEach(el => {
        el.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e));
    }

    initFirebase();
    setDbStatus(hasConfig() ? 'Conectando…' : 'Local', hasConfig() ? 'connecting' : 'local');

    return document.getElementById('page-content');
}

export function refreshShellProfile() {
    const profile = Store.getActiveProfile();
    const brand = document.querySelector('.brand__text');
    if (brand) {
        brand.innerHTML = `<strong>${escape(profile.nombre)}</strong><small>${escape(profile.centro || 'Asistencia y exámenes')}</small>`;
    }
}

function escape(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
