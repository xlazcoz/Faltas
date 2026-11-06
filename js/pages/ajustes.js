/**
 * Ajustes — perfil, asignaturas, horario, evaluaciones, periodos, festivos, datos y Firebase.
 */
import { mountShell, refreshShellProfile } from '../ui/shell.js';
import * as Store from '../core/store.js';
import { starterProfile, emptyProfile, uid, SUBJECT_PALETTE, timeToMin, minToTime } from '../core/model.js';
import { weeklyHours, evalForDate } from '../core/stats.js';
import { todayISO, fmtDate } from '../core/dates.js';
import { getConfig, saveConfig, clearConfig, hasConfig } from '../core/db.js';
import {
    icon, escapeHtml, toast, confirmDialog, openModal, download, formatHours,
    applyTheme, subjectColor
} from '../ui/ui.js';

const content = mountShell({ active: 'ajustes', title: 'Ajustes', subtitle: 'Curso, horario y datos' });
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
let sectionObserver = null;

function profile() { return Store.getActiveProfile(); }
function data() { return Store.getData(); }

function nav(active) {
    return `<nav class="settings-nav">
        ${[
            ['perfil', 'Perfil del curso'],
            ['asignaturas', 'Asignaturas'],
            ['horario', 'Horario'],
            ['evaluaciones', 'Evaluaciones'],
            ['periodos', 'Periodos'],
            ['nolectivos', 'No lectivos'],
            ['datos', 'Datos y copias'],
            ['firebase', 'Firebase']
        ].map(([id, label]) => `<a href="#${id}" data-section-link="${id}" class="${active === id ? 'is-active' : ''}">${label}</a>`).join('')}
    </nav>`;
}

function generalSection() {
    const p = profile();
    const settings = Store.getSettings();
    return `<section class="card settings-section" id="perfil">
        <div class="section-header"><div><h2>Perfil del curso</h2><p>Estos datos identifican el curso y definen el límite de faltas.</p></div></div>
        <form id="general-form" class="form-grid">
            <div class="field"><label for="cfg-nombre">Nombre del curso</label><input id="cfg-nombre" name="nombre" value="${escapeHtml(p.nombre)}" required></div>
            <div class="field"><label for="cfg-centro">Centro</label><input id="cfg-centro" name="centro" value="${escapeHtml(p.centro)}" placeholder="Ej.: IES…"></div>
            <div class="field"><label for="cfg-grupo">Grupo / clase</label><input id="cfg-grupo" name="grupo" value="${escapeHtml(p.grupo)}" placeholder="Ej.: 2º ESO A"></div>
            <div class="field"><label for="cfg-tema">Tema visual</label><select id="cfg-tema" name="tema"><option value="dark" ${settings.theme !== 'light' ? 'selected' : ''}>Oscuro</option><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Claro</option></select></div>
            <div class="field"><label for="cfg-inicio">Inicio del curso</label><input type="date" id="cfg-inicio" name="inicioCurso" value="${p.inicioCurso}"></div>
            <div class="field"><label for="cfg-fin">Fin del curso</label><input type="date" id="cfg-fin" name="finCurso" value="${p.finCurso}"></div>
            <div class="field"><label for="cfg-limite">Límite de faltas (%)</label><input type="number" id="cfg-limite" name="limiteFaltasPct" min="1" max="100" step="1" value="${p.limiteFaltasPct}"><small>Se aplica a las asignaturas que no tengan un límite propio.</small></div>
            <div class="field"><label for="cfg-iniciales">Iniciales del logo</label><input id="cfg-iniciales" name="iniciales" maxlength="3" value="${escapeHtml(p.branding?.iniciales || '')}" placeholder="CA"></div>
            <div class="field field--full">
                <label class="check-row"><input type="checkbox" name="contarJustificadas" ${p.contarJustificadas ? 'checked' : ''}><span>Las faltas justificadas cuentan para el porcentaje<small>Desactívalo si tu centro no las computa.</small></span></label>
                <label class="check-row"><input type="checkbox" name="contarRetrasos" ${p.contarRetrasos ? 'checked' : ''}><span>Los retrasos cuentan como tiempo faltado<small>Se suman los minutos convertidos en horas.</small></span></label>
            </div>
            <div class="field field--full">
                <div class="flex"><button type="button" class="btn btn--primary" data-save-general>${icon('save', 16)} Guardar cambios</button><span class="small text-muted">Al guardar se recargan los cálculos.</span></div>
            </div>
        </form>
    </section>`;
}

function subjectsSection() {
    const p = profile();
    const hours = weeklyHours(p);
    const rows = (p.asignaturas || []).map(a => `<div class="subject-row">
        <span class="subject-dot" style="background:${a.color}"></span>
        <div class="subject-row__main">
            <strong>${escapeHtml(a.nombre)}</strong>
            <span class="small text-muted">${escapeHtml(a.corto || '')}${a.profesor ? ` · ${escapeHtml(a.profesor)}` : ''}${a.limitePct ? ` · Límite ${a.limitePct}%` : ''}</span>
        </div>
        <span class="mono small text-soft">${formatHours(hours[a.id] || 0)} h/sem</span>
        <div class="flex">
            <button class="btn-icon" data-edit-subject="${a.id}" title="Editar">${icon('edit', 16)}</button>
            <button class="btn-icon btn-icon--danger" data-del-subject="${a.id}" title="Eliminar">${icon('trash', 16)}</button>
        </div>
    </div>`).join('');
    return `<section class="card settings-section" id="asignaturas">
        <div class="section-header"><div><h2>Asignaturas</h2><p>Las horas semanales se calculan automáticamente desde el horario.</p></div><button class="btn btn--primary btn--sm" data-add-subject>${icon('plus', 15)} Añadir asignatura</button></div>
        ${rows ? `<div class="list">${rows}</div>` : `<p class="small text-muted">Todavía no hay asignaturas. Añade la primera para empezar.</p>`}
    </section>`;
}

function scheduleSection() {
    const p = profile();
    const days = Array.from({ length: 7 }, (_, i) => i + 1);
    const dayBlocks = day => (p.horario || []).filter(b => Number(b.dia) === day).sort((a, b) => timeToMin(a.inicio) - timeToMin(b.inicio));
    return `<section class="card settings-section" id="horario">
        <div class="section-header"><div><h2>Horario semanal</h2><p>Usa horas reales. Los bloques no pueden solaparse. Los descansos y huecos no cuentan como horas lectivas.</p></div><span class="small text-muted" id="schedule-status"></span></div>
        <div class="schedule-editor">
            ${days.map(day => `<div class="schedule-editor__day">
                <div class="schedule-editor__head"><strong>${DAYS[day - 1]}</strong><button class="btn btn--ghost btn--sm" data-add-schedule="${day}">${icon('plus', 14)} Añadir bloque</button></div>
                <div class="cfg-list">
                    ${dayBlocks(day).map(b => `<div class="cfg-row sched-row" data-sched-row="${b.id}" data-day="${day}">
                        <select data-field="tipo" class="sched-row__type">
                            <option value="clase" ${b.tipo === 'clase' ? 'selected' : ''}>Clase</option>
                            <option value="descanso" ${b.tipo === 'descanso' ? 'selected' : ''}>Descanso</option>
                            <option value="libre" ${b.tipo === 'libre' ? 'selected' : ''}>Libre</option>
                        </select>
                        <select data-field="asignaturaId" ${b.tipo !== 'clase' ? 'disabled' : ''}>
                            <option value="">— Asignatura —</option>
                            ${(p.asignaturas || []).map(a => `<option value="${a.id}" ${b.asignaturaId === a.id ? 'selected' : ''}>${escapeHtml(a.corto || a.nombre)}</option>`).join('')}
                        </select>
                        <input type="time" data-field="inicio" value="${b.inicio}" step="300" aria-label="Hora de inicio">
                        <span class="cfg-row__sep">→</span>
                        <input type="time" data-field="fin" value="${b.fin}" step="300" aria-label="Hora de fin">
                        <input type="text" data-field="aula" value="${escapeHtml(b.aula || '')}" placeholder="Aula" class="sched-row__room" maxlength="40">
                        <button class="btn-icon btn-icon--danger" data-del-schedule="${b.id}" title="Quitar bloque">${icon('x', 15)}</button>
                    </div>`).join('') || '<p class="small text-muted">Sin bloques.</p>'}
                </div>
            </div>`).join('')}
        </div>
    </section>`;
}

function evalsSection() {
    const p = profile();
    return `<section class="card settings-section" id="evaluaciones">
        <div class="section-header"><div><h2>Evaluaciones</h2><p>Puedes tener tantas como necesite tu centro. Las horas se calculan entre el inicio y el fin de cada una.</p></div><button class="btn btn--primary btn--sm" data-add-eval>${icon('plus', 15)} Añadir evaluación</button></div>
        <div class="cfg-list">
            ${(p.evaluaciones || []).map(e => `<div class="cfg-row" data-eval-row="${e.id}">
                <input type="text" data-field="nombre" value="${escapeHtml(e.nombre)}" class="cfg-row__name" placeholder="Nombre" maxlength="60">
                <input type="date" data-field="inicio" value="${e.inicio}" aria-label="Inicio">
                <span class="cfg-row__sep">→</span>
                <input type="date" data-field="fin" value="${e.fin}" aria-label="Fin">
                <button class="btn-icon btn-icon--danger" data-del-eval="${e.id}" title="Eliminar evaluación">${icon('x', 15)}</button>
            </div>`).join('')}
        </div>
    </section>`;
}

function periodsSection() {
    const p = profile();
    return `<section class="card settings-section" id="periodos">
        <div class="section-header"><div><h2>Periodos</h2><p>Agrupa faltas por erronka, trimestre, proyecto o prácticas. Se muestran en el resumen.</p></div><button class="btn btn--primary btn--sm" data-add-period>${icon('plus', 15)} Añadir periodo</button></div>
        <div class="cfg-list">
            ${(p.periodos || []).map(per => `<div class="cfg-row" data-period-row="${per.id}">
                <input type="text" data-field="nombre" value="${escapeHtml(per.nombre)}" class="cfg-row__name" placeholder="Nombre" maxlength="60">
                <select data-field="tipo">
                    ${[['erronka', 'Erronka'], ['trimestre', 'Trimestre'], ['proyecto', 'Proyecto'], ['practicas', 'Prácticas'], ['examenes', 'Exámenes'], ['otro', 'Otro']].map(([v, l]) => `<option value="${v}" ${per.tipo === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
                <input type="date" data-field="inicio" value="${per.inicio}" aria-label="Inicio">
                <span class="cfg-row__sep">→</span>
                <input type="date" data-field="fin" value="${per.fin}" aria-label="Fin">
                <button class="btn-icon btn-icon--danger" data-del-period="${per.id}" title="Eliminar periodo">${icon('x', 15)}</button>
            </div>`).join('')}
        </div>
    </section>`;
}

function noLectivosSection() {
    const p = profile();
    return `<section class="card settings-section" id="nolectivos">
        <div class="section-header"><div><h2>Días no lectivos</h2><p>Festivos, vacaciones o prácticas en empresa. No cuentan horas y no se pueden registrar faltas.</p></div><button class="btn btn--primary btn--sm" data-add-nol>${icon('plus', 15)} Añadir rango</button></div>
        <p class="small text-muted">Las semanas de exámenes tienen prioridad: cuentan como lectivas aunque coincidan con un rango de esta lista.</p>
        <div class="cfg-list">
            ${(p.noLectivos || []).map(n => `<div class="cfg-row" data-nol-row="${n.id}">
                <input type="text" data-field="motivo" value="${escapeHtml(n.motivo)}" class="cfg-row__name" placeholder="Motivo" maxlength="60">
                <select data-field="tipo">
                    ${[['festivo', 'Festivo'], ['practicas', 'Prácticas'], ['vacaciones', 'Vacaciones'], ['otro', 'Otro']].map(([v, l]) => `<option value="${v}" ${n.tipo === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
                <input type="date" data-field="inicio" value="${n.inicio}" aria-label="Inicio">
                <span class="cfg-row__sep">→</span>
                <input type="date" data-field="fin" value="${n.fin}" aria-label="Fin">
                <button class="btn-icon btn-icon--danger" data-del-nol="${n.id}" title="Eliminar rango">${icon('x', 15)}</button>
            </div>`).join('')}
        </div>
    </section>`;
}

function dataSection() {
    const p = profile();
    const profiles = Store.getProfiles();
    return `<section class="card settings-section" id="datos">
        <div class="section-header"><div><h2>Cursos y copias de seguridad</h2><p>Puedes tener varios cursos guardados y cambiar entre ellos.</p></div><button class="btn btn--primary btn--sm" data-new-profile>${icon('plus', 15)} Nuevo curso</button></div>
        <div class="cfg-list">
            ${profiles.map(pr => `<div class="cfg-row">
                <div class="cfg-row__grow"><strong>${escapeHtml(pr.nombre)}</strong><div class="small text-muted">${escapeHtml(pr.centro || 'Sin centro')}${pr.grupo ? ` · ${escapeHtml(pr.grupo)}` : ''}</div></div>
                ${pr.id === p.id ? '<span class="badge badge--ok">Activo</span>' : `<button class="btn btn--ghost btn--sm" data-switch-profile="${pr.id}">Activar</button>`}
                <button class="btn btn--ghost btn--sm" data-duplicate-profile="${pr.id}">${icon('copy', 14)} Duplicar</button>
                ${profiles.length > 1 ? `<button class="btn-icon btn-icon--danger" data-del-profile="${pr.id}" title="Eliminar curso">${icon('trash', 16)}</button>` : ''}
            </div>`).join('')}
        </div>

        <div class="grid grid--2 mt-24">
            <div class="card card--soft">
                <h3>Backup completo</h3>
                <p class="small text-muted mt-8">Incluye todos los cursos, faltas, exámenes, apuntes y ajustes.</p>
                <div class="flex flex--wrap mt-12">
                    <button class="btn btn--primary btn--sm" data-backup>${icon('download', 15)} Descargar backup</button>
                    <button class="btn btn--ghost btn--sm" data-import-backup>${icon('upload', 15)} Restaurar backup</button>
                    <input type="file" id="import-backup" accept=".json,application/json" hidden>
                </div>
            </div>
            <div class="card card--soft">
                <h3>Exportar para el tutor</h3>
                <p class="small text-muted mt-8">Genera un CSV con todas las faltas del curso activo.</p>
                <div class="flex flex--wrap mt-12">
                    <button class="btn btn--ghost btn--sm" data-export-csv>${icon('download', 15)} Exportar CSV</button>
                </div>
            </div>
        </div>

        <div class="card danger-zone mt-24">
            <h3>Zona delicada</h3>
            <p class="small text-muted mt-8">Elimina todas las faltas y exámenes del curso activo sin borrar la configuración.</p>
            <button class="btn btn--danger btn--sm mt-12" data-clear-data>${icon('trash', 15)} Vaciar datos del curso</button>
        </div>
    </section>`;
}

function firebaseSection() {
    const c = getConfig();
    return `<section class="card settings-section" id="firebase">
        <div class="section-header"><div><h2>Sincronización con Firebase</h2><p>Opcional. La app funciona en local; si configuras Firestore, sincroniza faltas, exámenes y apuntes entre dispositivos.</p></div><span class="badge ${hasConfig() ? 'badge--ok' : 'badge--muted'}">${hasConfig() ? 'Configurado' : 'No configurado'}</span></div>
        <div class="form-grid">
            <div class="field"><label for="fb-api">API Key</label><input id="fb-api" value="${escapeHtml(c.apiKey)}" placeholder="AIzaSy…" autocomplete="off"></div>
            <div class="field"><label for="fb-project">Project ID</label><input id="fb-project" value="${escapeHtml(c.projectId)}" placeholder="mi-proyecto-xxxxx" autocomplete="off"></div>
            <div class="field field--full">
                <div class="flex flex--wrap">
                    <button class="btn btn--primary" data-save-firebase>${icon('cloud', 16)} Guardar y conectar</button>
                    ${hasConfig() ? `<button class="btn btn--ghost" data-clear-firebase>${icon('cloudOff', 16)} Desconectar</button>` : ''}
                </div>
            </div>
            <div class="field field--full">
                <details class="form-hint">
                    <summary>¿Cómo obtengo estos datos?</summary>
                    <ol style="margin:8px 0 0 18px;padding:0">
                        <li>Abre <a href="https://console.firebase.google.com" target="_blank" rel="noopener">console.firebase.google.com</a>.</li>
                        <li>Crea o abre tu proyecto.</li>
                        <li>Configuración del proyecto → Tus apps → App web.</li>
                        <li>Copia <code>apiKey</code> y <code>projectId</code>.</li>
                        <li>Activa Firestore Database.</li>
                    </ol>
                </details>
            </div>
        </div>
        <p class="small text-muted mt-16">El perfil del curso se guarda en este dispositivo. Usa el backup para moverlo a otro navegador.</p>
    </section>`;
}

function render() {
    const p = profile();
    const hash = location.hash.replace('#', '');
    content.innerHTML = `<div class="settings-layout">
        ${nav(hash || 'perfil')}
        <div class="settings-content">
            <div class="page-header" style="margin-bottom:0">
                <div><h2>Ajustes</h2><p>Configura el curso sin tocar código. Los cambios se guardan en este dispositivo.</p></div>
            </div>
            <div class="section">${generalSection()}</div>
            <div class="section">${subjectsSection()}</div>
            <div class="section">${scheduleSection()}</div>
            <div class="section">${evalsSection()}</div>
            <div class="section">${periodsSection()}</div>
            <div class="section">${noLectivosSection()}</div>
            <div class="section">${dataSection()}</div>
            <div class="section">${firebaseSection()}</div>
        </div>
    </div>`;
    bindSectionObserver();
    if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView(), 50);
}

function bindSectionObserver() {
    sectionObserver?.disconnect();
    const links = [...content.querySelectorAll('[data-section-link]')];
    const sections = links.map(a => document.getElementById(a.dataset.sectionLink)).filter(Boolean);
    const activate = id => links.forEach(a => a.classList.toggle('is-active', a.dataset.sectionLink === id));
    sectionObserver = new IntersectionObserver(entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) activate(visible.target.id);
    }, { rootMargin: '-90px 0px -65% 0px', threshold: [0.05, 0.3] });
    sections.forEach(s => sectionObserver.observe(s));
    links.forEach(a => a.addEventListener('click', () => activate(a.dataset.sectionLink)));
}

/* ============================================================
   Perfil general
   ============================================================ */
function saveGeneral() {
    const p = profile();
    const val = id => document.getElementById(id)?.value?.trim() || '';
    const nombre = val('cfg-nombre');
    const inicio = val('cfg-inicio');
    const fin = val('cfg-fin');
    const limite = Number(val('cfg-limite'));
    const tema = val('cfg-tema');
    if (!nombre) return toast('El curso necesita un nombre', 'error');
    if (!inicio || !fin) return toast('Indica el inicio y el fin del curso', 'error');
    if (inicio > fin) return toast('El inicio del curso no puede ser posterior al fin', 'error');
    if (!(limite > 0 && limite <= 100)) return toast('El límite debe estar entre 1 y 100', 'error');

    Store.updateProfile(p.id, {
        nombre,
        centro: val('cfg-centro'),
        grupo: val('cfg-grupo'),
        inicioCurso: inicio,
        finCurso: fin,
        limiteFaltasPct: limite,
        contarJustificadas: document.querySelector('[name="contarJustificadas"]')?.checked ?? true,
        contarRetrasos: document.querySelector('[name="contarRetrasos"]')?.checked ?? true,
        branding: { ...p.branding, iniciales: val('cfg-iniciales') || 'CA' },
        tema
    });
    Store.updateSettings({ theme: tema });
    applyTheme(tema);
    refreshShellProfile();
    toast('Ajustes guardados. Recargando…', 'success', 1400);
    setTimeout(() => location.reload(), 700);
}

/* ============================================================
   Asignaturas
   ============================================================ */
function openSubjectForm(initial = null) {
    const p = profile();
    const editing = Boolean(initial);
    const index = editing ? p.asignaturas.findIndex(a => a.id === initial.id) : p.asignaturas.length;
    const color = initial?.color || SUBJECT_PALETTE[index % SUBJECT_PALETTE.length];
    const modal = openModal({
        title: editing ? 'Editar asignatura' : 'Nueva asignatura',
        subtitle: 'El color se usa en el horario, las faltas y los exámenes',
        body: `<form id="subject-form" class="form-grid">
            <div class="field field--full"><label for="sub-name">Nombre</label><input id="sub-name" value="${escapeHtml(initial?.nombre || '')}" maxlength="100" required placeholder="Ej.: Matemáticas"></div>
            <div class="field"><label for="sub-short">Nombre corto</label><input id="sub-short" value="${escapeHtml(initial?.corto || '')}" maxlength="16" placeholder="Mat"></div>
            <div class="field"><label for="sub-teacher">Profesor</label><input id="sub-teacher" value="${escapeHtml(initial?.profesor || '')}" maxlength="80" placeholder="Nombre"></div>
            <div class="field"><label for="sub-color">Color</label><div class="color-field"><input type="color" id="sub-color" value="${color}"><input id="sub-color-text" value="${color}" maxlength="7" style="flex:1"></div></div>
            <div class="field"><label for="sub-limit">Límite propio (%)</label><input type="number" id="sub-limit" min="1" max="100" step="1" value="${initial?.limitePct ?? ''}" placeholder="Usar límite global"></div>
        </form>`,
        footer: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--primary" type="submit" form="subject-form">${editing ? 'Guardar' : 'Añadir'}</button>`,
        onMount: ({ card, close }) => {
            const colorInput = card.querySelector('#sub-color');
            const colorText = card.querySelector('#sub-color-text');
            colorInput.addEventListener('input', () => colorText.value = colorInput.value);
            colorText.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(colorText.value)) colorInput.value = colorText.value; });
            card.querySelector('#subject-form').addEventListener('submit', e => {
                e.preventDefault();
                const nombre = card.querySelector('#sub-name').value.trim();
                if (!nombre) return toast('Escribe un nombre', 'error');
                const asig = {
                    id: initial?.id || uid('asig'),
                    nombre,
                    corto: card.querySelector('#sub-short').value.trim() || nombre.slice(0, 6),
                    profesor: card.querySelector('#sub-teacher').value.trim(),
                    color: colorInput.value,
                    limitePct: card.querySelector('#sub-limit').value === '' ? null : Number(card.querySelector('#sub-limit').value)
                };
                const asignaturas = editing
                    ? p.asignaturas.map(a => a.id === initial.id ? asig : a)
                    : [...p.asignaturas, asig];
                Store.updateProfile(p.id, { asignaturas });
                close();
                render();
                toast(editing ? 'Asignatura actualizada' : 'Asignatura añadida', 'success');
            });
        }
    });
    return modal;
}

async function deleteSubject(id) {
    const p = profile();
    const subject = p.asignaturas.find(a => a.id === id);
    if (!subject) return;
    const related = (data().faltas || []).filter(f => f.asignaturaId === id).length + (data().examenes || []).filter(e => e.asignaturaId === id).length;
    const ok = await confirmDialog({
        title: 'Eliminar asignatura',
        message: `Se eliminarán "${subject.nombre}" y sus bloques de horario.${related ? ` También hay ${related} faltas/exámenes asociados que dejarán de mostrarse.` : ''}`,
        confirmText: 'Eliminar',
        danger: true
    });
    if (!ok) return;
    Store.updateProfile(p.id, {
        asignaturas: p.asignaturas.filter(a => a.id !== id),
        horario: (p.horario || []).filter(b => b.asignaturaId !== id)
    });
    render();
    toast('Asignatura eliminada', 'info');
}

/* ============================================================
   Horario
   ============================================================ */
function readSchedule() {
    return [...content.querySelectorAll('[data-sched-row]')].map(row => {
        const get = field => row.querySelector(`[data-field="${field}"]`);
        const tipo = get('tipo').value;
        return {
            id: row.dataset.schedRow,
            dia: Number(row.dataset.day),
            tipo,
            asignaturaId: tipo === 'clase' ? (get('asignaturaId').value || null) : null,
            inicio: get('inicio').value,
            fin: get('fin').value,
            aula: get('aula').value.trim()
        };
    });
}

function saveSchedule() {
    const p = profile();
    const rows = readSchedule();
    for (const b of rows) {
        if (!b.inicio || !b.fin) return scheduleError('Cada bloque necesita hora de inicio y fin');
        if (timeToMin(b.fin) <= timeToMin(b.inicio)) return scheduleError('La hora de fin debe ser posterior al inicio');
        if (b.tipo === 'clase' && !b.asignaturaId) return scheduleError('Selecciona una asignatura para cada bloque de clase');
    }
    for (const day of Array.from({ length: 7 }, (_, i) => i + 1)) {
        const list = rows.filter(b => b.dia === day).sort((a, b) => timeToMin(a.inicio) - timeToMin(b.inicio));
        for (let i = 1; i < list.length; i++) {
            if (timeToMin(list[i].inicio) < timeToMin(list[i - 1].fin)) {
                return scheduleError(`Hay bloques solapados el ${DAYS[day - 1].toLowerCase()}`);
            }
        }
    }
    Store.updateProfile(p.id, { horario: rows });
    const status = document.getElementById('schedule-status');
    if (status) {
        status.textContent = 'Guardado ✓';
        status.classList.add('text-ok');
        setTimeout(() => { status.textContent = ''; }, 1800);
    }
    return true;
}

function scheduleError(message) {
    toast(message, 'error');
    return false;
}

function addSchedule(day) {
    const p = profile();
    const blocks = (p.horario || []).filter(b => Number(b.dia) === Number(day));
    let start = 8 * 60;
    const sorted = blocks.sort((a, b) => timeToMin(a.inicio) - timeToMin(b.inicio));
    for (const b of sorted) {
        if (start < timeToMin(b.fin)) start = timeToMin(b.fin);
    }
    if (start >= 20 * 60) start = 8 * 60;
    const inicio = minToTime(start);
    const fin = minToTime(start + 60);
    const nuevo = { id: uid('blk'), dia: Number(day), tipo: 'clase', asignaturaId: p.asignaturas[0]?.id || null, inicio, fin, aula: '' };
    Store.updateProfile(p.id, { horario: [...(p.horario || []), nuevo] });
    render();
    document.getElementById('horario')?.scrollIntoView();
}

function deleteSchedule(id) {
    const p = profile();
    Store.updateProfile(p.id, { horario: (p.horario || []).filter(b => b.id !== id) });
    render();
    document.getElementById('horario')?.scrollIntoView();
}

/* ============================================================
   Evaluaciones / periodos / no lectivos
   ============================================================ */
function saveEvals() {
    const p = profile();
    const rows = [...content.querySelectorAll('[data-eval-row]')].map(row => ({
        id: row.dataset.evalRow,
        nombre: row.querySelector('[data-field="nombre"]').value.trim(),
        inicio: row.querySelector('[data-field="inicio"]').value,
        fin: row.querySelector('[data-field="fin"]').value
    }));
    for (const e of rows) {
        if (!e.nombre || !e.inicio || !e.fin) return toast('Completa todas las evaluaciones', 'error');
        if (e.inicio > e.fin) return toast(`La evaluación "${e.nombre}" termina antes de empezar`, 'error');
    }
    Store.updateProfile(p.id, { evaluaciones: rows });
}

function savePeriods() {
    const p = profile();
    const rows = [...content.querySelectorAll('[data-period-row]')].map(row => ({
        id: row.dataset.periodRow,
        nombre: row.querySelector('[data-field="nombre"]').value.trim(),
        tipo: row.querySelector('[data-field="tipo"]').value,
        inicio: row.querySelector('[data-field="inicio"]').value,
        fin: row.querySelector('[data-field="fin"]').value
    }));
    for (const per of rows) {
        if (!per.nombre || !per.inicio || !per.fin) return toast('Completa todos los periodos', 'error');
        if (per.inicio > per.fin) return toast(`El periodo "${per.nombre}" termina antes de empezar`, 'error');
    }
    Store.updateProfile(p.id, { periodos: rows });
}

function saveNoLectivos() {
    const p = profile();
    const rows = [...content.querySelectorAll('[data-nol-row]')].map(row => ({
        id: row.dataset.nolRow,
        motivo: row.querySelector('[data-field="motivo"]').value.trim(),
        tipo: row.querySelector('[data-field="tipo"]').value,
        inicio: row.querySelector('[data-field="inicio"]').value,
        fin: row.querySelector('[data-field="fin"]').value
    }));
    for (const n of rows) {
        if (!n.motivo || !n.inicio || !n.fin) return toast('Completa todos los días no lectivos', 'error');
        if (n.inicio > n.fin) return toast(`"${n.motivo}" termina antes de empezar`, 'error');
    }
    Store.updateProfile(p.id, { noLectivos: rows });
}

/* ============================================================
   Nuevo curso
   ============================================================ */
function openNewProfile() {
    const p = profile();
    const today = todayISO();
    const modal = openModal({
        title: 'Nuevo curso',
        subtitle: 'Puedes duplicar el curso actual y cambiar solo lo necesario',
        body: `<form id="new-profile-form" class="form-grid">
            <div class="field field--full"><label for="np-plantilla">Punto de partida</label>
                <select id="np-plantilla">
                    <option value="duplicate">Duplicar el curso actual sin datos</option>
                    <option value="starter">Plantilla básica (6 asignaturas y horario)</option>
                    <option value="empty">Curso vacío</option>
                </select>
            </div>
            <div class="field field--full"><label for="np-nombre">Nombre</label><input id="np-nombre" value="Curso ${new Date().getFullYear()}/${String(new Date().getFullYear() + 1).slice(-2)}" required maxlength="80"></div>
            <div class="field"><label for="np-centro">Centro</label><input id="np-centro" value="${escapeHtml(p.centro)}" maxlength="80"></div>
            <div class="field"><label for="np-grupo">Grupo</label><input id="np-grupo" value="" maxlength="80" placeholder="Ej.: 1º Bachillerato A"></div>
            <div class="field"><label for="np-inicio">Inicio</label><input type="date" id="np-inicio" value="${p.inicioCurso || today}"></div>
            <div class="field"><label for="np-fin">Fin</label><input type="date" id="np-fin" value="${p.finCurso || today}"></div>
        </form>`,
        footer: `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--primary" type="submit" form="new-profile-form">Crear curso</button>`,
        onMount: ({ card, close }) => {
            card.querySelector('#new-profile-form').addEventListener('submit', e => {
                e.preventDefault();
                const nombre = card.querySelector('#np-nombre').value.trim();
                const centro = card.querySelector('#np-centro').value.trim();
                const grupo = card.querySelector('#np-grupo').value.trim();
                const inicio = card.querySelector('#np-inicio').value;
                const fin = card.querySelector('#np-fin').value;
                const template = card.querySelector('#np-plantilla').value;
                if (!nombre) return toast('Escribe un nombre para el curso', 'error');
                if (inicio > fin) return toast('El inicio no puede ser posterior al fin', 'error');

                if (template === 'duplicate') {
                    const copy = Store.duplicateProfile(p.id, { nombre, copyData: false });
                    if (copy) Store.updateProfile(copy.id, { centro, grupo, inicioCurso: inicio, finCurso: fin });
                } else {
                    const creator = template === 'starter' ? starterProfile : emptyProfile;
                    Store.createProfile(creator({ nombre, centro, grupo, inicioCurso: inicio, finCurso: fin }));
                }
                close();
                toast('Curso creado', 'success');
                setTimeout(() => location.href = 'index.html', 500);
            });
        }
    });
    return modal;
}

/* ============================================================
   Datos
   ============================================================ */
function backup() {
    const p = profile();
    download(`backup-mi-curso-${todayISO()}.json`, JSON.stringify(Store.exportPayload(), null, 2));
    toast('Backup descargado', 'success');
}

function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const payload = JSON.parse(e.target.result);
            const ok = await confirmDialog({ title: 'Restaurar backup', message: 'Se sustituirán todos los cursos y datos actuales. ¿Continuar?', confirmText: 'Restaurar', danger: true });
            if (!ok) return;
            Store.importPayload(payload);
            toast('Backup restaurado', 'success');
            setTimeout(() => location.reload(), 700);
        } catch (err) {
            console.error(err);
            toast('El archivo no es un backup válido', 'error');
        }
    };
    reader.readAsText(file);
}

function exportCSV() {
    const p = profile();
    const d = data();
    const rows = [['Fecha', 'Asignatura', 'Evaluación', 'Tipo', 'Horas', 'Minutos retraso', 'Nota']];
    (d.faltas || []).slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).forEach(f => {
        const ev = (p.evaluaciones || []).find(e => e.id === f.evaluacionId);
        const asig = (p.asignaturas || []).find(a => a.id === f.asignaturaId);
        rows.push([f.fecha, asig?.nombre || f.asignaturaId, ev?.nombre || '', f.tipo, String(f.horas), String(f.minutosRetraso || ''), f.nota || '']);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    download(`asistencia-${todayISO()}.csv`, `\ufeff${csv}`, 'text/csv;charset=utf-8');
    toast('CSV exportado', 'success');
}

/* ============================================================
   Firebase
   ============================================================ */
function saveFirebase() {
    const key = document.getElementById('fb-api')?.value.trim();
    const project = document.getElementById('fb-project')?.value.trim();
    if (!key || !project) return toast('Completa la API Key y el Project ID', 'error');
    saveConfig(key, project);
    toast('Firebase configurado. Recargando…', 'success');
    setTimeout(() => location.reload(), 800);
}

async function clearFirebase() {
    const ok = await confirmDialog({ title: 'Desconectar Firebase', message: 'Los datos seguirán guardados en este dispositivo. Solo se dejará de sincronizar.', confirmText: 'Desconectar', danger: true });
    if (!ok) return;
    clearConfig();
    toast('Firebase desconectado', 'info');
    setTimeout(() => location.reload(), 600);
}

/* ============================================================
   Eventos
   ============================================================ */
content.addEventListener('click', async e => {
    if (e.target.closest('[data-save-general]')) { saveGeneral(); return; }
    if (e.target.closest('[data-add-subject]')) { openSubjectForm(); return; }
    const editSubject = e.target.closest('[data-edit-subject]');
    if (editSubject) {
        const a = profile().asignaturas.find(x => x.id === editSubject.dataset.editSubject);
        if (a) openSubjectForm(a);
        return;
    }
    const delSubject = e.target.closest('[data-del-subject]');
    if (delSubject) { deleteSubject(delSubject.dataset.delSubject); return; }

    const addSched = e.target.closest('[data-add-schedule]');
    if (addSched) { addSchedule(addSched.dataset.addSchedule); return; }
    const delSched = e.target.closest('[data-del-schedule]');
    if (delSched) { deleteSchedule(delSched.dataset.delSchedule); return; }

    if (e.target.closest('[data-add-eval]')) {
        const p = profile();
        const last = p.evaluaciones[p.evaluaciones.length - 1];
        Store.updateProfile(p.id, { evaluaciones: [...p.evaluaciones, { id: uid('eval'), nombre: `Evaluación ${p.evaluaciones.length + 1}`, inicio: last?.fin || todayISO(), fin: last?.fin || todayISO() }] });
        render();
        document.getElementById('evaluaciones')?.scrollIntoView();
        return;
    }
    const delEval = e.target.closest('[data-del-eval]');
    if (delEval) {
        const p = profile();
        if (p.evaluaciones.length <= 1) { toast('Debe existir al menos una evaluación', 'error'); return; }
        const id = delEval.dataset.delEval;
        const related = (data().faltas || []).filter(f => f.evaluacionId === id).length + (data().examenes || []).filter(ex => ex.evaluacionId === id).length;
        const ok = await confirmDialog({
            title: 'Eliminar evaluación',
            message: `Se eliminará la evaluación.${related ? ` Hay ${related} faltas/exámenes asociados que quedarán sin evaluación.` : ''}`,
            confirmText: 'Eliminar',
            danger: true
        });
        if (!ok) return;
        Store.updateProfile(p.id, { evaluaciones: p.evaluaciones.filter(ev => ev.id !== id) });
        render();
        document.getElementById('evaluaciones')?.scrollIntoView();
        return;
    }

    if (e.target.closest('[data-add-period]')) {
        const p = profile();
        Store.updateProfile(p.id, { periodos: [...(p.periodos || []), { id: uid('periodo'), nombre: `Periodo ${(p.periodos || []).length + 1}`, tipo: 'trimestre', inicio: p.inicioCurso, fin: p.finCurso }] });
        render();
        document.getElementById('periodos')?.scrollIntoView();
        return;
    }
    const delPeriod = e.target.closest('[data-del-period]');
    if (delPeriod) {
        const p = profile();
        Store.updateProfile(p.id, { periodos: (p.periodos || []).filter(x => x.id !== delPeriod.dataset.delPeriod) });
        render();
        document.getElementById('periodos')?.scrollIntoView();
        return;
    }

    if (e.target.closest('[data-add-nol]')) {
        const p = profile();
        Store.updateProfile(p.id, { noLectivos: [...(p.noLectivos || []), { id: uid('nol'), motivo: 'Festivo', tipo: 'festivo', inicio: todayISO(), fin: todayISO() }] });
        render();
        document.getElementById('nolectivos')?.scrollIntoView();
        return;
    }
    const delNol = e.target.closest('[data-del-nol]');
    if (delNol) {
        const p = profile();
        Store.updateProfile(p.id, { noLectivos: (p.noLectivos || []).filter(x => x.id !== delNol.dataset.delNol) });
        render();
        document.getElementById('nolectivos')?.scrollIntoView();
        return;
    }

    if (e.target.closest('[data-new-profile]')) { openNewProfile(); return; }
    const switchProfile = e.target.closest('[data-switch-profile]');
    if (switchProfile) { Store.setActiveProfile(switchProfile.dataset.switchProfile); location.reload(); return; }
    const dup = e.target.closest('[data-duplicate-profile]');
    if (dup) {
        const original = Store.getProfile(dup.dataset.duplicateProfile);
        const ok = await confirmDialog({ title: 'Duplicar curso', message: `Se creará una copia de "${original.nombre}" con todos sus datos.`, confirmText: 'Duplicar' });
        if (!ok) return;
        Store.duplicateProfile(dup.dataset.duplicateProfile, { copyData: true });
        toast('Curso duplicado', 'success');
        setTimeout(() => location.reload(), 500);
        return;
    }
    const delProfile = e.target.closest('[data-del-profile]');
    if (delProfile) {
        const pr = Store.getProfile(delProfile.dataset.delProfile);
        const ok = await confirmDialog({ title: 'Eliminar curso', message: `Se eliminarán "${pr.nombre}" y todos sus datos. Esta acción no se puede deshacer.`, confirmText: 'Eliminar', danger: true });
        if (!ok) return;
        Store.deleteProfile(delProfile.dataset.delProfile);
        toast('Curso eliminado', 'info');
        setTimeout(() => location.reload(), 500);
        return;
    }

    if (e.target.closest('[data-backup]')) { backup(); return; }
    if (e.target.closest('[data-import-backup]')) { document.getElementById('import-backup')?.click(); return; }
    if (e.target.closest('[data-export-csv]')) { exportCSV(); return; }
    if (e.target.closest('[data-clear-data]')) {
        const ok = await confirmDialog({ title: 'Vaciar datos del curso', message: 'Se eliminarán todas las faltas, exámenes y apuntes del curso activo. La configuración se mantiene.', confirmText: 'Vaciar', danger: true });
        if (!ok) return;
        Store.clearData();
        render();
        toast('Datos del curso vaciados', 'info');
        return;
    }

    if (e.target.closest('[data-save-firebase]')) { saveFirebase(); return; }
    if (e.target.closest('[data-clear-firebase]')) { clearFirebase(); return; }
});

content.addEventListener('change', e => {
    const schedRow = e.target.closest('[data-sched-row]');
    if (schedRow) {
        if (e.target.dataset.field === 'tipo') {
            const select = schedRow.querySelector('[data-field="asignaturaId"]');
            const isClase = e.target.value === 'clase';
            select.disabled = !isClase;
            if (!isClase) select.value = '';
            else if (!select.value) select.value = profile().asignaturas[0]?.id || '';
        }
        saveSchedule();
        return;
    }
    if (e.target.closest('[data-eval-row]')) { saveEvals(); return; }
    if (e.target.closest('[data-period-row]')) { savePeriods(); return; }
    if (e.target.closest('[data-nol-row]')) { saveNoLectivos(); return; }
    if (e.target.id === 'import-backup') {
        importBackup(e.target.files?.[0]);
        e.target.value = '';
    }
});

render();
