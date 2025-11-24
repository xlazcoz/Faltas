// Configuración de asignaturas (IGUAL QUE ANTES)
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

// Variables
let db = null;
let faltas = [];
let evaluacionActual = 1; // Puede ser 1, 2, 3 o 'total'

// DOM
const evalInput = document.getElementById('evaluacion-input');
const fechaInput = document.getElementById('fecha');
fechaInput.valueAsDate = new Date();

// --- LÓGICA DE VISTAS ---

window.cambiarEvaluacion = function(val) {
    evaluacionActual = val;
    
    // 1. Estilo botones
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${val}`).classList.add('active');
    
    // 2. Sincronizar formulario (Solo si no es 'total')
    // Si elegimos Global, no cambiamos el selector de registro (se queda en la última usada)
    if(val !== 'total') {
        evalInput.value = val;
    }

    // 3. Actualizar textos dinámicos
    const labelTexto = val === 'total' ? 'Global' : `Eval ${val}`;
    document.getElementById('stats-label').textContent = labelTexto;
    document.getElementById('stats-label-faltas').textContent = labelTexto;
    document.getElementById('history-label').textContent = labelTexto;

    actualizarUI();
}

// Selector manual
evalInput.addEventListener('change', (e) => {
    // Si el usuario cambia el selector para registrar, le llevamos a esa vista
    cambiarEvaluacion(parseInt(e.target.value));
});


// --- CÁLCULOS CENTRALES ---

function calcularStats(asignaturaKey) {
    let totalHorasAsignatura = 0;
    let faltasFiltradas = [];

    if (evaluacionActual === 'total') {
        // MODO GLOBAL: Sumamos las 3 evaluaciones
        const evals = config.asignaturas[asignaturaKey].evaluaciones;
        totalHorasAsignatura = evals[1] + evals[2] + evals[3];
        
        // Tomamos TODAS las faltas de esta asignatura
        faltasFiltradas = faltas.filter(f => f.asignatura === asignaturaKey);

    } else {
        // MODO EVALUACIÓN ESPECÍFICA
        totalHorasAsignatura = config.asignaturas[asignaturaKey].evaluaciones[evaluacionActual];
        
        // Filtramos por asignatura Y evaluación
        faltasFiltradas = faltas.filter(f => 
            f.asignatura === asignaturaKey && 
            parseInt(f.evaluacion || 1) === evaluacionActual
        );
    }

    const horasFaltadas = faltasFiltradas.reduce((sum, f) => sum + f.horas, 0);
    const porcentaje = (horasFaltadas / totalHorasAsignatura) * 100;
    
    // Límite 20% redondeado hacia abajo (Math.floor)
    const limiteHorasPermitidas = Math.floor(totalHorasAsignatura * (config.limitePorcentaje / 100));

    let estado = 'bueno';
    if (porcentaje > 20) estado = 'danger';
    else if (porcentaje > 15) estado = 'warning';

    return {
        horas: horasFaltadas,
        total: totalHorasAsignatura,
        limitePermitido: limiteHorasPermitidas,
        porcentaje: porcentaje,
        estado: estado
    };
}

function actualizarTablaResumen() {
    const tabla = document.getElementById('tabla-resumen');
    
    // Cabecera dinámica
    const sufijo = evaluacionActual === 'total' ? 'Global' : `Eval ${evaluacionActual}`;

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Asignatura</th>
                    <th>Horas ${sufijo}</th>
                    <th>% ${sufijo}</th>
                    <th>Estado</th>
                    <th>Máx. Faltas (20%)</th>
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
    
    let faltasAVisualizar = [];

    if (evaluacionActual === 'total') {
        faltasAVisualizar = [...faltas]; // Todas
    } else {
        faltasAVisualizar = faltas.filter(f => parseInt(f.evaluacion || 1) === evaluacionActual);
    }
    
    if (faltasAVisualizar.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:20px;">No hay faltas registradas.</p>`;
        return;
    }

    // Ordenar por fecha
    faltasAVisualizar.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    container.innerHTML = faltasAVisualizar.map(f => `
        <div class="lista-falta-item">
            <div class="lista-falta-info">
                <strong>${config.asignaturas[f.asignatura].nombreCompleto}</strong>
                <span style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-left:8px;">Eval ${f.evaluacion || 1}</span>
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
    
    const filtroActivo = document.querySelector('.btn-filter.active');
    if(filtroActivo) filtrarTabla(filtroActivo.dataset.filter);
}

// --- FIREBASE Y UTILIDADES (Igual que antes) ---

async function registrarFalta() {
    const asignatura = document.getElementById('asignatura').value;
    const fecha = document.getElementById('fecha').value;
    const horas = parseInt(document.getElementById('horas').value);
    const evaluacion = parseInt(evalInput.value); // Siempre toma el valor del selector

    if(!asignatura || !fecha) return alert('Rellena todos los campos');

    try {
        await db.collection('faltas').add({
            asignatura, fecha, horas, evaluacion,
            timestamp: new Date().toISOString()
        });
        mostrarNotificacion(`Falta guardada (Eval ${evaluacion})`, 'success');
        document.getElementById('asignatura').value = '';
        
        // Si estamos en vista Global, actualizamos para ver la nueva falta.
        // Si estábamos en otra vista distinta a la del registro, podríamos cambiar, 
        // pero mejor dejar al usuario donde está.
    } catch(e) {
        console.error(e);
        mostrarNotificacion('Error al guardar', 'error');
    }
}

let firebaseConfig = {
    apiKey: localStorage.getItem('firebase_apiKey'),
    projectId: localStorage.getItem('firebase_projectId')
};

function inicializarFirebase() {
    if(!firebaseConfig.apiKey) {
        const modal = document.getElementById('firebase-modal');
        if(modal) modal.style.display = 'block';
        return;
    }
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    db.collection('faltas').onSnapshot(snap => {
        faltas = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        updateStatus('Conectado', 'connected');
        actualizarUI();
    }, err => updateStatus('Error', 'error'));
}

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

function filtrarTabla(filtro) {
    const filas = document.querySelectorAll('#tabla-resumen tbody tr');
    filas.forEach(fila => {
        if(filtro === 'all') fila.style.display = '';
        else if(filtro === 'warning') fila.style.display = fila.classList.contains('tr-warning') ? '' : 'none';
        else if(filtro === 'danger') fila.style.display = fila.classList.contains('tr-danger') ? '' : 'none';
    });
}

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

document.addEventListener('DOMContentLoaded', inicializarFirebase);