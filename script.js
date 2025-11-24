// Configuración de asignaturas (ESTRUCTURA MANTENIDA)
const config = {
    asignaturas: {
        "Mar": { 
            nombreCompleto: "Markatze Lengoaiak (Mar)",
            evaluaciones: { 1: 46, 2: 42, 3: 38 }
        },
        "Gar": { 
            nombreCompleto: "Garapena (Gar)",
            evaluaciones: { 1: 34, 2: 32, 3: 28 }
        },
        "BBDD": { 
            nombreCompleto: "Datu-baseak (BBDD)",
            evaluaciones: { 1: 66, 2: 62, 3: 60 }
        },
        "Prog": { 
            nombreCompleto: "Programazioa (Prog)",
            evaluaciones: { 1: 90, 2: 86, 3: 76 }
        },
        "Ingles": { 
            nombreCompleto: "Ingeles Teknikoa (Ingles)",
            evaluaciones: { 1: 24, 2: 24, 3: 18 }
        },
        "Digi": { 
            nombreCompleto: "Digitalizazioa (Digi)",
            evaluaciones: { 1: 24, 2: 24, 3: 16 }
        },
        "Irau": { 
            nombreCompleto: "Iraunkortasuna (Irau)",
            evaluaciones: { 1: 12, 2: 12, 3: 8 }
        }
    },
    limitePorcentaje: 20
};

// Variables globales
let db = null;
let faltas = [];
let evaluacionActual = 1;

// Elementos DOM
const evalInput = document.getElementById('evaluacion-input');
const fechaInput = document.getElementById('fecha');
fechaInput.valueAsDate = new Date(); // Fecha actual por defecto

// --- FUNCIONALIDAD DE EVALUACIONES ---

// Cambiar evaluación desde las pestañas
window.cambiarEvaluacion = function(num) {
    evaluacionActual = num;
    
    // Actualizar estilo pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${num}`).classList.add('active');
    
    // Sincronizar selector del formulario
    evalInput.value = num;

    actualizarUI();
}

// Cambiar evaluación desde el selector del formulario
evalInput.addEventListener('change', (e) => {
    cambiarEvaluacion(parseInt(e.target.value));
});

// --- LÓGICA PRINCIPAL ---

function calcularStats(asignaturaKey) {
    // 1. Total horas de la evaluación actual
    const totalHorasAsignatura = config.asignaturas[asignaturaKey].evaluaciones[evaluacionActual];
    
    // 2. Faltas filtradas por asignatura Y evaluación actual
    const faltasFiltradas = faltas.filter(f => 
        f.asignatura === asignaturaKey && 
        parseInt(f.evaluacion || 1) === evaluacionActual
    );

    const horasFaltadas = faltasFiltradas.reduce((sum, f) => sum + f.horas, 0);
    const porcentaje = (horasFaltadas / totalHorasAsignatura) * 100;
    
    // CORRECCIÓN SOLICITADA:
    // Calculamos el 20% y redondeamos SIEMPRE hacia abajo (Math.floor)
    // Ejemplo: 46 * 0.20 = 9.2 -> Se convierte en 9.
    const limiteHorasPermitidas = Math.floor(totalHorasAsignatura * (config.limitePorcentaje / 100));

    let estado = 'bueno';
    if (porcentaje > 20) estado = 'danger';
    else if (porcentaje > 15) estado = 'warning';

    return {
        horas: horasFaltadas,
        total: totalHorasAsignatura,
        limitePermitido: limiteHorasPermitidas, // Ahora es un número entero seguro
        porcentaje: porcentaje,
        estado: estado
    };
}

function actualizarTablaResumen() {
    const tabla = document.getElementById('tabla-resumen');
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Asignatura</th>
                    <th>Horas Eval ${evaluacionActual}</th>
                    <th>% Eval ${evaluacionActual}</th>
                    <th>Estado</th>
                    <th>Límite Faltas (20%)</th>
                </tr>
            </thead>
            <tbody>
    `;

    Object.keys(config.asignaturas).forEach(key => {
        const asig = config.asignaturas[key];
        const stats = calcularStats(key);

        const rowClass = stats.estado === 'danger' ? 'tr-danger' : (stats.estado === 'warning' ? 'tr-warning' : '');
        const badgeClass = stats.estado === 'danger' ? 'porcentaje-peligro' : (stats.estado === 'warning' ? 'porcentaje-advertencia' : 'porcentaje-bueno');
        
        const estadoTexto = stats.estado === 'danger' ? 'Peligro' : (stats.estado === 'warning' ? 'Riesgo' : 'Correcto');

        // CORRECCIÓN VISUAL:
        // Quitamos <strong> y quitamos .toFixed() porque Math.floor ya devuelve entero
        html += `
            <tr class="${rowClass}">
                <td><strong>${asig.nombreCompleto}</strong></td>
                <td>${stats.horas}</td>
                <td><span class="porcentaje ${badgeClass}">${stats.porcentaje.toFixed(1)}%</span></td>
                <td><span style="font-size:0.9em; opacity:0.8">${estadoTexto}</span></td>
                <td>${stats.limitePermitido}h</td> 
            </tr>
        `;
    });

    html += '</tbody></table>';
    tabla.innerHTML = html;
}

function actualizarListaFaltas() {
    const container = document.getElementById('lista-faltas-container');
    
    const faltasDeEstaEval = faltas.filter(f => parseInt(f.evaluacion || 1) === evaluacionActual);
    
    if (faltasDeEstaEval.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:20px;">No hay faltas en la ${evaluacionActual}ª Evaluación.</p>`;
        return;
    }

    // Ordenar por fecha descendente
    faltasDeEstaEval.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    container.innerHTML = faltasDeEstaEval.map(f => `
        <div class="lista-falta-item">
            <div class="lista-falta-info">
                <strong>${config.asignaturas[f.asignatura].nombreCompleto}</strong>
                <br>
                <small>${new Date(f.fecha).toLocaleDateString()} | ${f.horas} horas</small>
            </div>
            <div class="lista-falta-acciones">
                <button class="btn-eliminar" onclick="eliminarFalta('${f.id}')">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function actualizarEstadisticas() {
    let totalHoras = 0;
    let totalFaltas = 0;
    let enRiesgo = 0;

    Object.keys(config.asignaturas).forEach(key => {
        const stats = calcularStats(key);
        totalHoras += stats.total;
        totalFaltas += stats.horas;
        if(stats.estado !== 'bueno') enRiesgo++;
    });

    document.getElementById('total-horas').textContent = totalHoras;
    document.getElementById('total-faltas').textContent = totalFaltas;
    document.getElementById('asignaturas-riesgo').textContent = enRiesgo;
}

function actualizarUI() {
    actualizarTablaResumen();
    actualizarListaFaltas();
    actualizarEstadisticas();
    // Reaplicar filtro activo si existe
    const filtroActivo = document.querySelector('.btn-filter.active');
    if(filtroActivo) filtrarTabla(filtroActivo.dataset.filter);
}

// --- FUNCIONES FIREBASE Y AUXILIARES ---

async function registrarFalta() {
    const asignatura = document.getElementById('asignatura').value;
    const fecha = document.getElementById('fecha').value;
    const horas = parseInt(document.getElementById('horas').value);
    const evaluacion = parseInt(evalInput.value);

    if(!asignatura || !fecha) return alert('Rellena todos los campos');

    try {
        await db.collection('faltas').add({
            asignatura, fecha, horas, evaluacion,
            timestamp: new Date().toISOString()
        });
        mostrarNotificacion('Falta guardada', 'success');
        // Solo reseteamos asignatura, mantenemos fecha
        document.getElementById('asignatura').value = '';
    } catch(e) {
        console.error(e);
        mostrarNotificacion('Error al guardar', 'error');
    }
}

// Configuración Firebase (Recuperamos localStorage)
let firebaseConfig = {
    apiKey: localStorage.getItem('firebase_apiKey'),
    projectId: localStorage.getItem('firebase_projectId')
};

function inicializarFirebase() {
    if(!firebaseConfig.apiKey) {
        // Si no hay config, mostrar modal
        const modal = document.getElementById('firebase-modal');
        if(modal) modal.style.display = 'block';
        return;
    }
    
    // Inicializar app
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    
    // Listener en tiempo real
    db.collection('faltas').onSnapshot(snap => {
        faltas = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        updateStatus('Conectado', 'connected');
        actualizarUI();
    }, err => updateStatus('Error', 'error'));
}

// Helpers visuales
function updateStatus(msg, type) {
    const el = document.getElementById('status-indicator');
    const txt = document.getElementById('status-text');
    if(el && txt) {
        txt.textContent = msg;
        el.className = `status-indicator status-${type}`;
    }
}

function mostrarNotificacion(msg, type) {
    const n = document.createElement('div');
    n.textContent = msg;
    n.style.cssText = `position:fixed;top:20px;right:20px;padding:15px;background:${type==='success'?'#16a34a':'#dc2626'};color:white;border-radius:8px;z-index:9999;box-shadow:0 4px 6px rgba(0,0,0,0.1)`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

async function eliminarFalta(id) {
    if(confirm('¿Borrar falta?')) await db.collection('faltas').doc(id).delete();
}

// Filtros de tabla
function filtrarTabla(filtro) {
    const filas = document.querySelectorAll('#tabla-resumen tbody tr');
    filas.forEach(fila => {
        if(filtro === 'all') fila.style.display = '';
        else if(filtro === 'warning') fila.style.display = fila.classList.contains('tr-warning') ? '' : 'none';
        else if(filtro === 'danger') fila.style.display = fila.classList.contains('tr-danger') ? '' : 'none';
    });
}

// Listeners
const btnRegistrar = document.getElementById('btn-registrar');
if(btnRegistrar) btnRegistrar.addEventListener('click', registrarFalta);

document.querySelectorAll('.btn-filter').forEach(btn => {
    btn.addEventListener('click', e => {
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        filtrarTabla(e.target.dataset.filter);
    });
});

const btnGuardar = document.getElementById('btn-guardar-config');
if(btnGuardar) {
    btnGuardar.addEventListener('click', () => {
        const key = document.getElementById('api-key').value;
        const id = document.getElementById('project-id').value;
        if(key && id) {
            localStorage.setItem('firebase_apiKey', key);
            localStorage.setItem('firebase_projectId', id);
            location.reload();
        }
    });
}

// Botones extra (limpiar/exportar) si existen en el HTML
const btnLimpiar = document.getElementById('btn-limpiar');
if(btnLimpiar) btnLimpiar.addEventListener('click', async () => {
    if(confirm('¿ELIMINAR TODO? Se borrarán todas las evaluaciones.')) {
        const snap = await db.collection('faltas').get();
        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        mostrarNotificacion('Base de datos limpiada', 'success');
    }
});

const btnExportar = document.getElementById('btn-exportar');
if(btnExportar) btnExportar.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({faltas, config}, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'asistencia-backup.json';
    a.click();
});

// Arrancar
document.addEventListener('DOMContentLoaded', inicializarFirebase);