// --- 1. CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = 'https://qxmsttnbfwgrernnriei.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bXN0dG5iZndncmVybm5yaWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDc5NjUsImV4cCI6MjA3OTA4Mzk2NX0.kLII1ulgwzYtIuBslYtnoPmkgUFiu2lphf0CHXirqUE';

const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. CONFIGURACIÓN DEL MAPA ---
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
});
const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CartoDB'
});
const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri'
});

const limitesChiapas = L.latLngBounds([14.5000, -94.2000], [18.0000, -90.3000]);

const map = L.map('map', {
    center: [16.7537, -93.1160], 
    zoom: 13,
    minZoom: 10,
    layers: [osm], 
    zoomControl: false, 
    maxBounds: limitesChiapas,
    maxBoundsViscosity: 1.0
});

L.control.layers({ "Callejero (OSM)": osm, "Modo Oscuro": cartoDark, "Satélite": satelite }).addTo(map);

// --- 3. CONTROLES UI ---

// A) Geocodificador
const geocoder = L.Control.geocoder({
    geocoder: L.Control.Geocoder.photon({
        geocodingQueryParams: { countrycode: 'MX', lon: -93.1160, lat: 16.7537 }
    }),
    collapsed: false,
    placeholder: "🔍 Buscar en Tuxtla...",
    position: 'topleft',
    suggestMinLength: 3,
    suggestTimeout: 250
}).on('markgeocode', function(e) {
    const center = e.geocode.center;
    map.setView(center, 17);
    marcarPunto(center);
    document.querySelector('.leaflet-control-geocoder-alternatives').innerHTML = '';
}).addTo(map);

// B) Zoom
L.control.zoom({ position: 'topleft' }).addTo(map);

// C) Botón Home
L.Control.ResetView = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        L.DomEvent.disableClickPropagation(container);
        
        const button = L.DomUtil.create('a', 'leaflet-control-home', container);
        button.href = '#';
        button.title = 'Centrar en Tuxtla';
        button.innerHTML = '<i class="bi bi-house-fill"></i>';
        
        button.onclick = function(e) {
            L.DomEvent.stop(e);
            map.setView([16.7537, -93.1160], 13);
        }
        return container;
    }
});
new L.Control.ResetView({ position: 'topleft' }).addTo(map);

// D) Botón Limpiar Ruta
L.Control.ClearRoute = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create('div', 'leaflet-control'); 
        L.DomEvent.disableClickPropagation(container);
        
        const button = L.DomUtil.create('a', 'leaflet-control-clear', container);
        button.href = '#';
        button.title = 'Borrar ruta';
        button.innerHTML = '<i class="bi bi-trash3-fill"></i>';
        
        button.onclick = function(e) {
            L.DomEvent.stop(e);
            limpiarRutaActual(); 
        }
        return container;
    }
});
new L.Control.ClearRoute({ position: 'topleft' }).addTo(map);


// --- 4. LÓGICA DE MARCADORES Y RUTAS ---
const simbolos = { perdido: "#ff0000", avistamiento: "#ff8c00", maltrato: "#800080" };
let markerTemp;
let routingControl = null; 
let archivoFotoSeleccionado = null;

map.on('click', (e) => marcarPunto(e.latlng));

function marcarPunto(latlng) {
    if (markerTemp) map.removeLayer(markerTemp);
    markerTemp = L.marker(latlng, { draggable: true }).addTo(map)
        .bindPopup("<b>Ubicación del reporte</b><br>Arrástrame si es necesario.").openPopup();
    
    document.getElementById('lat').value = latlng.lat;
    document.getElementById('lng').value = latlng.lng;
}

// --- FUNCIÓN DE LIMPIEZA SEGURA ---
function limpiarRutaActual() {
    if (routingControl) {
        try {
            // Vaciamos puntos antes de remover para evitar errores de consola
            routingControl.setWaypoints([]); 
            map.removeControl(routingControl);
        } catch (error) {
            console.warn("Limpieza de ruta forzada:", error);
        }
        routingControl = null;
    }
}

// --- FUNCIÓN DE CÁLCULO DE RUTA (ESPAÑOL FORZADO) ---
function calcularRuta(latDest, lngDest) {
    // 1. Limpieza
    limpiarRutaActual();

    // 2. Ubicación
    map.locate({setView: false, enableHighAccuracy: true});

    // 3. Ubicación Encontrada
    map.once('locationfound', (e) => {
        limpiarRutaActual();

        // CAMBIO AQUÍ: Agregamos language: 'es' al router interno
        const routerOSRM = L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving',
            language: 'es' // Forzamos español en la petición al servidor
        });

        routingControl = L.Routing.control({
            waypoints: [L.latLng(e.latlng), L.latLng(latDest, lngDest)],
            router: routerOSRM,
            language: 'es', // Forzamos español en el control visual
            createMarker: () => null, 
            lineOptions: { styles: [{color: '#198754', opacity: 1, weight: 5}] },
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            show: true
        }).addTo(map);

        // Manejo de errores traducido
        routingControl.on('routingerror', function(err) {
            console.error("Error OSRM:", err);
            
            let mensaje = "No se pudo calcular la ruta.";
            if(err.error && (err.error.status === -1 || err.error.status === undefined)) {
                mensaje += " El servidor de mapas está saturado. Intenta de nuevo en unos segundos.";
            } else {
                mensaje += " Verifica tu conexión a internet.";
            }
            
            alert(mensaje);
            limpiarRutaActual();
        });
    });
    
    // 4. Error GPS
    map.once('locationerror', (e) => {
        alert("No pudimos acceder a tu ubicación GPS. Por favor, activa la ubicación.");
    });
}

// --- 5. GESTIÓN DE FOTO ---
document.getElementById('foto').addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
        archivoFotoSeleccionado = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            document.getElementById('img-preview').src = reader.result;
            document.getElementById('preview-container').classList.remove('d-none');
        };
        reader.readAsDataURL(archivoFotoSeleccionado);
    }
});

// --- 6. GUARDAR EN SUPABASE ---
document.getElementById('formMascota').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;

    if (!lat || !lng) return alert("Por favor, marca la ubicación en el mapa.");
    if (!archivoFotoSeleccionado) return alert("Es necesaria una foto de evidencia.");

    document.getElementById('loader').style.display = 'flex';

    try {
        const nombreArchivo = `${Date.now()}_${archivoFotoSeleccionado.name}`;
        
        // 1. Subir Foto
        const { data: dataFoto, error: errorFoto } = await clienteSupabase.storage
            .from('fotos_mascotas')
            .upload(nombreArchivo, archivoFotoSeleccionado);

        if (errorFoto) throw errorFoto;

        // 2. Obtener URL
        const { data: dataUrl } = clienteSupabase.storage
            .from('fotos_mascotas')
            .getPublicUrl(nombreArchivo);

        // 3. Guardar Datos
        const { error: errorInsert } = await clienteSupabase
            .from('reportes_mascotas')
            .insert([{
                tipo: document.getElementById('tipo').value,
                especie: document.getElementById('especie').value,
                raza: document.getElementById('raza').value,
                senas: document.getElementById('senas').value,
                contacto: document.getElementById('contacto').value,
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                foto_url: dataUrl.publicUrl
            }]);

        if (errorInsert) throw errorInsert;

        alert("¡Reporte guardado exitosamente!");
        document.getElementById('loader').style.display = 'none';
        bootstrap.Modal.getInstance(document.getElementById('modalReporte')).hide();
        
        document.getElementById('formMascota').reset();
        document.getElementById('preview-container').classList.add('d-none');
        archivoFotoSeleccionado = null;
        if (markerTemp) map.removeLayer(markerTemp);

        cargarReportes();

    } catch (error) {
        console.error(error);
        document.getElementById('loader').style.display = 'none';
        alert("Error al guardar: " + error.message);
    }
});

// --- 7. CARGAR REPORTES ---
async function cargarReportes() {
    const { data, error } = await clienteSupabase
        .from('reportes_mascotas')
        .select('*');

    if (error) {
        console.error("Error cargando puntos:", error);
        return;
    }

    data.forEach(d => {
        crearMarcadorFinal(d);
    });
}

function crearMarcadorFinal(d) {
    const color = simbolos[d.tipo];
    const icon = L.divIcon({
        className: 'custom-icon',
        html: `<div style="background:${color}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [16, 16]
    });

    const content = `
        <div style="text-align:center; width:200px;">
            <span class="badge" style="background:${color}">${d.tipo.toUpperCase()}</span><br>
            <strong style="font-size:1.1em">${d.especie}</strong><br>
            <img src="${d.foto_url}" class="popup-img" alt="Foto" style="max-height:120px; object-fit:cover;">
            <div class="mt-2 text-start small">
                <b>Raza:</b> ${d.raza || 'N/A'}<br>
                <b>Señas:</b> ${d.senas || 'Sin descripción'}<br>
                <b>Contacto:</b> ${d.contacto}
            </div>
            <button class="btn btn-dark btn-sm w-100 mt-2" onclick="calcularRuta(${d.lat}, ${d.lng})">
                <i class="bi bi-cursor-fill"></i> ¿CÓMO LLEGAR?
            </button>
        </div>
    `;

    L.marker([d.lat, d.lng], { icon: icon }).addTo(map).bindPopup(content);
}

cargarReportes();