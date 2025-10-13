// Configuración de asignaturas
const config = {
    asignaturas: {
        "Mar": { horasTotales: 114, horasTrimestre: 46, nombreCompleto: "Markatze Lengoaiak" },
        "Gar": { horasTotales: 85, horasTrimestre: 34, nombreCompleto: "Garapena" },
        "BBDD": { horasTotales: 170, horasTrimestre: 66, nombreCompleto: "Datu-baseak" },
        "Prog": { horasTotales: 228, horasTrimestre: 90, nombreCompleto: "Programazioa" },
        "Ingles": { horasTotales: 60, horasTrimestre: 24, nombreCompleto: "Ingeles Teknikoa" },
        "Digi": { horasTotales: 58, horasTrimestre: 24, nombreCompleto: "Digitalizazioa" },
        "Irau": { horasTotales: 29, horasTrimestre: 12, nombreCompleto: "Iraunkortasuna" }
    },
    limitePorcentaje: 20
};

// CONFIGURACIÓN FIREBASE FIJA - NO SE PIDE AL USUARIO
const firebaseConfig = {
    apiKey: "AIzaSyBfjIsR9WP5Sud02hgJT8ppoxYHiUAThRE",
    authDomain: "falta-szubieta.firebaseapp.com",
    projectId: "falta-szubieta",
    storageBucket: "falta-szubieta.firebasestorage.app",
    messagingSenderId: "1096789382482",
    appId: "1:1096789382482:web:2d4d7d6d8f6e6b7c9c0a9a"
};

// Variables globales
let db = null;
let faltas = [];

// Elementos DOM
const fechaInput = document.getElementById('fecha');
const asignaturaSelect = document.getElementById('asignatura');
const horasInput = document.getElementById('horas');
const btnRegistrar = document.getElementById('btn-registrar');
const btnLimpiar = document.getElementById('btn-limpiar');
const btnExportar = document.getElementById('btn-exportar');
const tablaResumen = document.getElementById('tabla-resumen');
const listaFaltasContainer = document.getElementById('lista-faltas-container');
const totalHorasElement = document.getElementById('total-horas');
const totalFaltasElement = document.getElementById('total-faltas');
const asignaturasRiesgoElement = document.getElementById('asignaturas-riesgo');
const totalRegistrosElement = document.getElementById('total-registros');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

// Establecer fecha actual por defecto
fechaInput.valueAsDate = new Date();

// FUNCIÓN DE NOTIFICACIONES MEJORADA
function mostrarNotificacion(mensaje, tipo) {
    console.log('Mostrando notificación:', mensaje, tipo);
    
    // Crear elemento de notificación
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.textContent = mensaje;
    
    // Añadir al body
    document.body.appendChild(notificacion);
    
    // Eliminar después de 3 segundos con animación
    setTimeout(() => {
        notificacion.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (document.body.contains(notificacion)) {
                document.body.removeChild(notificacion);
            }
        }, 300);
    }, 3000);
}

// Inicializar Firebase automáticamente
function inicializarFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        updateStatus('Conectado a Firebase', 'connected');
        cargarFaltasDesdeFirebase();
        return true;
    } catch (error) {
        console.error('Error inicializando Firebase:', error);
        updateStatus('Error conectando a Firebase', 'error');
        return false;
    }
}

// Cargar faltas desde Firebase
function cargarFaltasDesdeFirebase() {
    if (!db) return;

    updateStatus('Sincronizando con Firebase...', 'connecting');

    db.collection('faltas')
        .orderBy('fecha', 'desc')
        .onSnapshot((snapshot) => {
            faltas = [];
            snapshot.forEach((doc) => {
                faltas.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`Sincronizadas ${faltas.length} faltas desde Firebase`);
            updateStatus('Sincronizado con Firebase', 'connected');
            actualizarUI();
        }, (error) => {
            console.error('Error en sincronización:', error);
            updateStatus('Error de sincronización', 'error');
        });
}

// Guardar falta en Firebase
async function guardarFaltaEnFirebase(falta) {
    if (!db) throw new Error('Firebase no inicializado');

    try {
        const docRef = await db.collection('faltas').add(falta);
        console.log('Falta guardada en Firebase con ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error guardando en Firebase:', error);
        throw error;
    }
}

// Eliminar falta de Firebase
async function eliminarFaltaDeFirebase(id) {
    if (!db) throw new Error('Firebase no inicializado');

    try {
        await db.collection('faltas').doc(id).delete();
        console.log('Falta eliminada de Firebase:', id);
    } catch (error) {
        console.error('Error eliminando de Firebase:', error);
        throw error;
    }
}

// Limpiar toda la base de datos Firebase
async function limpiarBaseDeDatosFirebase() {
    if (!db) throw new Error('Firebase no inicializado');

    try {
        const snapshot = await db.collection('faltas').get();
        const batch = db.batch();
        
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log('Base de datos Firebase limpiada');
    } catch (error) {
        console.error('Error limpiando Firebase:', error);
        throw error;
    }
}

// Event Listeners
btnRegistrar.addEventListener('click', registrarFalta);
btnLimpiar.addEventListener('click', limpiarBaseDeDatosCompleta);
btnExportar.addEventListener('click', exportarDatos);

document.querySelectorAll('.btn-filter').forEach(btn => {
    btn.addEventListener('click', (e) => filtrarTabla(e.target.dataset.filter));
});

// Funciones principales
async function registrarFalta() {
    const fecha = fechaInput.value;
    const asignatura = asignaturaSelect.value;
    const horas = parseInt(horasInput.value);

    if (!fecha || !asignatura) {
        mostrarNotificacion('Por favor, completa todos los campos', 'error');
        return;
    }

    const nuevaFalta = {
        fecha,
        asignatura,
        horas,
        timestamp: new Date().toISOString(),
        dispositivo: navigator.userAgent
    };

    try {
        await guardarFaltaEnFirebase(nuevaFalta);
        
        // Resetear formulario
        asignaturaSelect.value = '';
        horasInput.value = '2';
        
        // NOTIFICACIÓN DE ÉXITO
        mostrarNotificacion('✅ Falta registrada y sincronizada', 'success');
    } catch (error) {
        console.error('Error al registrar falta:', error);
        mostrarNotificacion('❌ Error al registrar falta', 'error');
    }
}

async function eliminarFalta(id) {
    if (confirm('¿Estás seguro de que quieres eliminar esta falta?')) {
        try {
            await eliminarFaltaDeFirebase(id);
            mostrarNotificacion('✅ Falta eliminada', 'success');
        } catch (error) {
            console.error('Error al eliminar falta:', error);
            mostrarNotificacion('❌ Error al eliminar falta', 'error');
        }
    }
}

async function limpiarBaseDeDatosCompleta() {
    if (confirm('¿Estás seguro de que quieres eliminar TODOS los registros? Esta acción no se puede deshacer.')) {
        try {
            await limpiarBaseDeDatosFirebase();
            mostrarNotificacion('✅ Base de datos limpiada', 'success');
        } catch (error) {
            console.error('Error al limpiar base de datos:', error);
            mostrarNotificacion('❌ Error al limpiar base de datos', 'error');
        }
    }
}

function exportarDatos() {
    const datos = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        faltas: faltas,
        config: config
    };

    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    mostrarNotificacion('✅ Datos exportados correctamente', 'success');
}

// Resto de funciones se mantienen igual
function calcularEstadisticasAsignatura(asignaturaKey) {
    const configAsignatura = config.asignaturas[asignaturaKey];
    const faltasAsignatura = faltas.filter(f => f.asignatura === asignaturaKey);
    
    const horasFaltadas = faltasAsignatura.reduce((total, falta) => total + falta.horas, 0);
    
    const porcentajeFaltasTrimestral = (horasFaltadas / configAsignatura.horasTrimestre) * 100;
    const limiteFaltasTrimestre = configAsignatura.horasTrimestre * (config.limitePorcentaje / 100);
    const faltasRestantesTrimestre = Math.floor(limiteFaltasTrimestre - horasFaltadas);
    
    const porcentajeFaltasAnual = (horasFaltadas / configAsignatura.horasTotales) * 100;
    const limiteFaltasAnual = configAsignatura.horasTotales * (config.limitePorcentaje / 100);
    const faltasRestantesAnual = Math.floor(limiteFaltasAnual - horasFaltadas);
    
    let estado = 'normal';
    if (porcentajeFaltasTrimestral > 20 || porcentajeFaltasAnual > 20) {
        estado = 'danger';
    } else if (porcentajeFaltasTrimestral > 15 || porcentajeFaltasAnual > 15) {
        estado = 'warning';
    }
    
    return {
        horasFaltadas,
        porcentajeFaltasTrimestral: Math.min(100, porcentajeFaltasTrimestral),
        porcentajeFaltasAnual: Math.min(100, porcentajeFaltasAnual),
        faltasRestantesTrimestre,
        faltasRestantesAnual,
        estado
    };
}

function actualizarUI() {
    actualizarTablaResumen();
    actualizarListaFaltas();
    actualizarEstadisticas();
}

function actualizarTablaResumen() {
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Asignatura</th>
                    <th>Horas Faltadas</th>
                    <th>% Faltas Trim</th>
                    <th>% Faltas Anual</th>
                    <th>Faltas Restantes (Trim)</th>
                    <th>Faltas Restantes (Anual)</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
    `;

    Object.keys(config.asignaturas).forEach(asignaturaKey => {
        const stats = calcularEstadisticasAsignatura(asignaturaKey);
        const configAsignatura = config.asignaturas[asignaturaKey];
        
        const claseFila = stats.estado === 'danger' ? 'tr-danger' : 
                         stats.estado === 'warning' ? 'tr-warning' : '';
        
        const claseFaltasTrimestral = stats.porcentajeFaltasTrimestral > 20 ? 'porcentaje-peligro' :
                                     stats.porcentajeFaltasTrimestral > 15 ? 'porcentaje-advertencia' : 'porcentaje-bueno';
        
        const claseFaltasAnual = stats.porcentajeFaltasAnual > 20 ? 'porcentaje-peligro' :
                                stats.porcentajeFaltasAnual > 15 ? 'porcentaje-advertencia' : 'porcentaje-bueno';

        html += `
            <tr class="${claseFila}">
                <td><strong>${configAsignatura.nombreCompleto}</strong></td>
                <td>${stats.horasFaltadas}h</td>
                <td><span class="porcentaje ${claseFaltasTrimestral}">${stats.porcentajeFaltasTrimestral.toFixed(1)}%</span></td>
                <td><span class="porcentaje ${claseFaltasAnual}">${stats.porcentajeFaltasAnual.toFixed(1)}%</span></td>
                <td>${stats.faltasRestantesTrimestre > 0 ? stats.faltasRestantesTrimestre + 'h' : '<span style="color: #dc2626;">0h</span>'}</td>
                <td>${stats.faltasRestantesAnual > 0 ? stats.faltasRestantesAnual + 'h' : '<span style="color: #dc2626;">0h</span>'}</td>
                <td>${generarEstadoHTML(stats)}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    tablaResumen.innerHTML = html;
}

function generarEstadoHTML(stats) {
    if (stats.porcentajeFaltasTrimestral > 20 || stats.porcentajeFaltasAnual > 20) {
        return '<span style="color: #dc2626; font-weight: bold;">⚠️ Pérdida eval. continua</span>';
    } else if (stats.porcentajeFaltasTrimestral > 15 || stats.porcentajeFaltasAnual > 15) {
        return '<span style="color: #d97706; font-weight: bold;">⚠️ En riesgo</span>';
    } else {
        return '<span style="color: #16a34a;">✅ Correcto</span>';
    }
}

function actualizarListaFaltas() {
    if (faltas.length === 0) {
        listaFaltasContainer.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay faltas registradas</p>';
        return;
    }

    const faltasOrdenadas = [...faltas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    listaFaltasContainer.innerHTML = faltasOrdenadas.map(falta => `
        <div class="lista-falta-item">
            <div class="lista-falta-info">
                <strong>${config.asignaturas[falta.asignatura].nombreCompleto}</strong>
                <br>
                <small>Fecha: ${formatearFecha(falta.fecha)} | Horas: ${falta.horas}h</small>
                ${falta.timestamp ? `<br><small style="color: #64748b;">Sincronizado: ${formatearFechaHora(falta.timestamp)}</small>` : ''}
            </div>
            <div class="lista-falta-acciones">
                <button class="btn-eliminar" onclick="eliminarFalta('${falta.id}')">
                    Eliminar
                </button>
            </div>
        </div>
    `).join('');
}

function actualizarEstadisticas() {
    const totalHoras = Object.values(config.asignaturas).reduce((sum, asig) => sum + asig.horasTotales, 0);
    const totalFaltas = faltas.reduce((sum, falta) => sum + falta.horas, 0);
    
    const asignaturasEnRiesgo = Object.keys(config.asignaturas).filter(asignaturaKey => {
        const stats = calcularEstadisticasAsignatura(asignaturaKey);
        return stats.estado === 'warning' || stats.estado === 'danger';
    }).length;

    totalHorasElement.textContent = totalHoras;
    totalFaltasElement.textContent = totalFaltas;
    asignaturasRiesgoElement.textContent = asignaturasEnRiesgo;
    totalRegistrosElement.textContent = faltas.length;
}

function formatearFecha(fechaString) {
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatearFechaHora(fechaString) {
    const fecha = new Date(fechaString);
    return fecha.toLocaleString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function filtrarTabla(filtro) {
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    const filas = tablaResumen.querySelectorAll('tbody tr');
    
    filas.forEach(fila => {
        switch (filtro) {
            case 'warning':
                fila.style.display = fila.classList.contains('tr-warning') ? '' : 'none';
                break;
            case 'danger':
                fila.style.display = fila.classList.contains('tr-danger') ? '' : 'none';
                break;
            default:
                fila.style.display = '';
        }
    });
}

function updateStatus(message, type) {
    statusText.textContent = message;
    statusIndicator.className = 'status-indicator';
    
    switch(type) {
        case 'connected':
            statusIndicator.classList.add('status-connected');
            break;
        case 'connecting':
            statusIndicator.classList.add('status-connecting');
            break;
        case 'error':
            statusIndicator.classList.add('status-error');
            break;
    }
}

// Inicializar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    inicializarFirebase();
});