/**
 * forms.js — Formularios compartidos de falta y examen.
 */
import * as Store from '../core/store.js';
import { evalForDate, nonTeachingForDate, classBlocksForDate, periodForDate } from '../core/stats.js';
import { todayISO, fmtDateLong } from '../core/dates.js';
import { openModal, toast, escapeHtml, icon, subjectName } from './ui.js';

export function openFaltaForm({ initial = null, date = null, onSaved = null } = {}) {
    const profile = Store.getActiveProfile();
    const data = Store.getData();
    const editing = Boolean(initial?.id);
    const evals = profile.evaluaciones || [];
    const subjects = profile.asignaturas || [];
    const fechaInicial = initial?.fecha || date || todayISO();
    const evalInicial = initial?.evaluacionId
        || evalForDate(profile, fechaInicial)?.id
        || evals[0]?.id
        || '';

    const subjectOptions = subjects.map(s => `<option value="${s.id}">${escapeHtml(s.nombre)}${s.corto && s.corto !== s.nombre ? ` (${escapeHtml(s.corto)})` : ''}</option>`).join('');
    const evalOptions = evals.map(e => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('');

    const modal = openModal({
        title: editing ? 'Editar falta' : 'Registrar falta',
        subtitle: editing ? 'Modifica los datos de la falta seleccionada' : 'Las horas se descuentan del margen de la asignatura',
        body: `
            <form id="falta-form" class="form-grid" novalidate>
                <div class="field">
                    <label for="falta-eval">Evaluación</label>
                    <select id="falta-eval" name="evaluacionId">${evalOptions}</select>
                </div>
                <div class="field">
                    <label for="falta-fecha">Fecha</label>
                    <input type="date" id="falta-fecha" name="fecha" value="${fechaInicial}" required>
                </div>
                <div class="field field--full">
                    <label for="falta-asignatura">Asignatura</label>
                    <select id="falta-asignatura" name="asignaturaId" required>
                        <option value="">— Seleccionar —</option>
                        ${subjectOptions}
                    </select>
                </div>
                <div class="field">
                    <label for="falta-tipo">Tipo</label>
                    <select id="falta-tipo" name="tipo">
                        <option value="injustificada">Injustificada</option>
                        <option value="justificada">Justificada</option>
                        <option value="retraso">Retraso</option>
                    </select>
                </div>
                <div class="field" id="falta-horas-field">
                    <label for="falta-horas">Horas</label>
                    <input type="number" id="falta-horas" name="horas" min="0.5" max="12" step="0.5" value="2" required>
                </div>
                <div class="field" id="falta-minutos-field" hidden>
                    <label for="falta-minutos">Minutos de retraso</label>
                    <input type="number" id="falta-minutos" name="minutosRetraso" min="1" max="600" step="1" value="15">
                </div>
                <div class="field field--full">
                    <label for="falta-nota">Nota (opcional)</label>
                    <input type="text" id="falta-nota" name="nota" maxlength="140" placeholder="Ej.: cita médica, examen, excursión…">
                </div>
                <div class="field field--full">
                    <div id="falta-hint" class="form-hint" aria-live="polite"></div>
                </div>
            </form>`,
        footer: `
            <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
            <button type="submit" form="falta-form" class="btn btn--primary">${editing ? 'Guardar cambios' : 'Registrar falta'}</button>`,
        onMount: ({ card, close }) => {
            const form = card.querySelector('#falta-form');
            const fFecha = card.querySelector('#falta-fecha');
            const fEval = card.querySelector('#falta-eval');
            const fAsig = card.querySelector('#falta-asignatura');
            const fTipo = card.querySelector('#falta-tipo');
            const fHoras = card.querySelector('#falta-horas');
            const fMinutos = card.querySelector('#falta-minutos');
            const horasField = card.querySelector('#falta-horas-field');
            const minutosField = card.querySelector('#falta-minutos-field');
            const hint = card.querySelector('#falta-hint');
            const fNota = card.querySelector('#falta-nota');

            if (initial) {
                fEval.value = evalInicial;
                fAsig.value = initial.asignaturaId || '';
                fTipo.value = initial.tipo || 'injustificada';
                fHoras.value = initial.horas || 2;
                fMinutos.value = initial.minutosRetraso || Math.round((initial.horas || 0.25) * 60) || 15;
                fNota.value = initial.nota || '';
            }

            const updateHint = () => {
                const fecha = fFecha.value;
                if (!fecha) { hint.innerHTML = ''; return; }
                const nt = nonTeachingForDate(profile, fecha);
                const blocks = classBlocksForDate(profile, fecha);
                const ev = evalForDate(profile, fecha);
                const period = periodForDate(profile, fecha);
                const parts = [];

                if (ev) fEval.value = ev.id;
                else if (evals.length) {
                    fEval.value = fecha < evals[0].inicio ? evals[0].id : evals[evals.length - 1].id;
                }

                parts.push(`<strong>${escapeHtml(fmtDateLong(fecha))}</strong>`);
                if (nt) {
                    parts.push(`<span class="text-warning">${icon('alert', 14)} ${escapeHtml(nt.motivo)} — día no lectivo</span>`);
                } else if (!blocks.length) {
                    parts.push(`<span class="text-muted">Sin clases programadas este día</span>`);
                } else {
                    parts.push(`<span>${icon('clock', 14)} ${blocks.map(b => escapeHtml(subjectName(profile, b.asignaturaId))).join(' · ')}</span>`);
                }
                if (period) parts.push(`<span class="text-muted">${escapeHtml(period.nombre)}</span>`);
                if (!ev) parts.push(`<span class="text-warning">La fecha queda fuera de las evaluaciones configuradas</span>`);
                hint.innerHTML = parts.join('<br>');

                if (!fAsig.value && blocks.length === 1) fAsig.value = blocks[0].asignaturaId;
            };

            const updateTipo = () => {
                const isRetraso = fTipo.value === 'retraso';
                horasField.hidden = isRetraso;
                minutosField.hidden = !isRetraso;
                fHoras.required = !isRetraso;
                fMinutos.required = isRetraso;
            };

            fFecha.addEventListener('change', updateHint);
            fTipo.addEventListener('change', updateTipo);
            updateHint();
            updateTipo();

            form.addEventListener('submit', e => {
                e.preventDefault();
                const asignaturaId = fAsig.value;
                const fecha = fFecha.value;
                const tipo = fTipo.value;
                const minutos = Number(fMinutos.value) || 0;
                const horas = tipo === 'retraso' ? minutos / 60 : Number(fHoras.value);
                if (!asignaturaId) return toast('Selecciona una asignatura', 'error');
                if (!fecha) return toast('Elige una fecha', 'error');
                if (!(horas > 0)) return toast(tipo === 'retraso' ? 'Indica los minutos de retraso' : 'Indica las horas', 'error');

                const payload = {
                    asignaturaId,
                    fecha,
                    evaluacionId: fEval.value,
                    tipo,
                    horas,
                    minutosRetraso: tipo === 'retraso' ? minutos : 0,
                    nota: fNota.value.trim()
                };
                try {
                    if (editing) Store.updateFalta(initial.id, payload);
                    else Store.addFalta(payload);
                    close();
                    toast(editing ? 'Falta actualizada' : 'Falta registrada', 'success');
                    onSaved?.();
                } catch (err) {
                    console.error(err);
                    toast('No se pudo guardar la falta', 'error');
                }
            });
        }
    });
    return modal;
}

export function openExamenForm({ initial = null, date = null, onSaved = null } = {}) {
    const profile = Store.getActiveProfile();
    const editing = Boolean(initial?.id);
    const evals = profile.evaluaciones || [];
    const subjects = profile.asignaturas || [];
    const fechaInicial = initial?.fecha || date || todayISO();
    const evalInicial = initial?.evaluacionId || evalForDate(profile, fechaInicial)?.id || evals[0]?.id || '';

    if (!subjects.length) {
        toast('Añade al menos una asignatura en Ajustes antes de crear exámenes', 'error', 4000);
        return null;
    }

    const modal = openModal({
        title: editing ? 'Editar examen' : 'Nuevo examen',
        subtitle: 'Planifica exámenes, entregas y presentaciones',
        size: 'lg',
        body: `
            <form id="examen-form" class="form-grid" novalidate>
                <div class="field field--full">
                    <label for="ex-titulo">Título</label>
                    <input type="text" id="ex-titulo" name="titulo" maxlength="120" placeholder="Ej.: Examen tema 3 · Funciones" required>
                </div>
                <div class="field">
                    <label for="ex-asignatura">Asignatura</label>
                    <select id="ex-asignatura" name="asignaturaId" required>
                        <option value="">— Seleccionar —</option>
                        ${subjects.map(s => `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('')}
                    </select>
                </div>
                <div class="field">
                    <label for="ex-eval">Evaluación</label>
                    <select id="ex-eval" name="evaluacionId">
                        ${evals.map(e => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('')}
                    </select>
                </div>
                <div class="field">
                    <label for="ex-fecha">Fecha</label>
                    <input type="date" id="ex-fecha" name="fecha" value="${fechaInicial}" required>
                </div>
                <div class="field">
                    <label for="ex-tipo">Tipo</label>
                    <select id="ex-tipo" name="tipo">
                        <option value="examen">Examen</option>
                        <option value="entrega">Entrega</option>
                        <option value="presentacion">Presentación</option>
                        <option value="practica">Práctica</option>
                        <option value="otro">Otro</option>
                    </select>
                </div>
                <div class="field">
                    <label for="ex-inicio">Hora de inicio</label>
                    <input type="time" id="ex-inicio" name="horaInicio" value="09:00" required>
                </div>
                <div class="field">
                    <label for="ex-fin">Hora de fin</label>
                    <input type="time" id="ex-fin" name="horaFin" value="10:00" required>
                </div>
                <div class="field">
                    <label for="ex-aula">Aula / lugar</label>
                    <input type="text" id="ex-aula" name="aula" maxlength="80" placeholder="Ej.: Aula 12, laboratorio…">
                </div>
                <div class="field">
                    <label for="ex-peso">Peso en la nota (%)</label>
                    <input type="number" id="ex-peso" name="peso" min="0" max="100" step="1" placeholder="Ej.: 30">
                </div>
                <div class="field">
                    <label for="ex-nota">Nota obtenida</label>
                    <input type="number" id="ex-nota" name="nota" min="0" max="10" step="0.1" placeholder="Sin corregir">
                </div>
                <div class="field field--full">
                    <label for="ex-temario">Temario / contenido</label>
                    <input type="text" id="ex-temario" name="temario" maxlength="220" placeholder="Temas, capítulos o material que entra">
                </div>
                <div class="field field--full">
                    <label for="ex-notas">Notas</label>
                    <textarea id="ex-notas" name="notas" rows="3" maxlength="600" placeholder="Material permitido, indicaciones del profesor…"></textarea>
                </div>
            </form>`,
        footer: `
            <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
            <button type="submit" form="examen-form" class="btn btn--primary">${editing ? 'Guardar cambios' : 'Añadir examen'}</button>`,
        onMount: ({ card, close }) => {
            const form = card.querySelector('#examen-form');
            const fTitulo = card.querySelector('#ex-titulo');
            const fAsig = card.querySelector('#ex-asignatura');
            const fFecha = card.querySelector('#ex-fecha');
            const fEval = card.querySelector('#ex-eval');
            const fInicio = card.querySelector('#ex-inicio');
            const fFin = card.querySelector('#ex-fin');
            const fPeso = card.querySelector('#ex-peso');
            const fNota = card.querySelector('#ex-nota');
            const fTipo = card.querySelector('#ex-tipo');
            const fAula = card.querySelector('#ex-aula');
            const fTemario = card.querySelector('#ex-temario');
            const fNotas = card.querySelector('#ex-notas');

            if (initial) {
                fTitulo.value = initial.titulo || '';
                fAsig.value = initial.asignaturaId || '';
                fFecha.value = initial.fecha || fechaInicial;
                fEval.value = evalInicial;
                fTipo.value = initial.tipo || 'examen';
                fInicio.value = initial.horaInicio || '09:00';
                fFin.value = initial.horaFin || '10:00';
                fAula.value = initial.aula || '';
                fPeso.value = initial.peso ?? '';
                fNota.value = initial.nota ?? '';
                fTemario.value = initial.temario || '';
                fNotas.value = initial.notas || '';
            }

            fFecha.addEventListener('change', () => {
                const ev = evalForDate(profile, fFecha.value);
                if (ev) fEval.value = ev.id;
            });

            form.addEventListener('submit', e => {
                e.preventDefault();
                if (!fTitulo.value.trim()) return toast('Escribe un título para el examen', 'error');
                if (!fAsig.value) return toast('Selecciona una asignatura', 'error');
                if (!fFecha.value) return toast('Elige una fecha', 'error');
                if (fFin.value <= fInicio.value) return toast('La hora de fin debe ser posterior al inicio', 'error');

                const payload = {
                    titulo: fTitulo.value.trim(),
                    asignaturaId: fAsig.value,
                    evaluacionId: fEval.value,
                    fecha: fFecha.value,
                    tipo: fTipo.value,
                    horaInicio: fInicio.value,
                    horaFin: fFin.value,
                    aula: fAula.value.trim(),
                    peso: fPeso.value === '' ? null : Number(fPeso.value),
                    nota: fNota.value === '' ? null : Number(fNota.value),
                    temario: fTemario.value.trim(),
                    notas: fNotas.value.trim()
                };
                try {
                    if (editing) Store.updateExamen(initial.id, payload);
                    else Store.addExamen(payload);
                    close();
                    toast(editing ? 'Examen actualizado' : 'Examen añadido', 'success');
                    onSaved?.();
                } catch (err) {
                    console.error(err);
                    toast('No se pudo guardar el examen', 'error');
                }
            });
        }
    });
    return modal;
}
