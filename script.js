// --- 1. CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = 'https://qxmsttnbfwgrernnriei.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bXN0dG5iZndncmVybm5yaWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDc5NjUsImV4cCI6MjA3OTA4Mzk2NX0.kLII1ulgwzYtIuBslYtnoPmkgUFiu2lphf0CHXirqUE';
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. MAPA ---
// Definimos capas
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' });
const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CartoDB' });
const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri' });

const limitesChiapas = L.latLngBounds([14.5000, -94.2000], [18.0000, -90.3000]);

const map = L.map('map', {
    center: [16.7537, -93.1160], 
    zoom: 13,
    minZoom: 10,
    layers: [osm], 
    zoomControl: false, 
    maxBounds: limitesChiapas,
    maxBoundsViscosity: 1.0,
    tap: false
});

// Control de Capas (Top Right - Por defecto)
L.control.layers({ "Callejero": osm, "Oscuro": cartoDark, "Satélite": satelite }, null, { position: 'topright' }).addTo(map);

// --- 3. CONTROLES IZQUIERDOS (Ordenados) ---

// A) Buscador (Top Left)
L.Control.geocoder({
    geocoder: L.Control.Geocoder.nominatim({
        geocodingQueryParams: { countrycodes: 'mx', viewbox: '-93.35,16.70,-93.00,16.85', bounded: 1 }
    }),
    collapsed: false,
    placeholder: "🔍 Buscar...",
    position: 'topleft', // Fijo a la izquierda
    defaultMarkGeocode: false 
})
.on('markgeocode', function(e) {
    map.setView(e.geocode.center, 18);
})
.addTo(map);

// B) Zoom (Debajo del buscador)
L.control.zoom({ position: 'topleft' }).addTo(map);

// C) Botón Home
L.Control.ResetView = L.Control.extend({
    onAdd: function(map) {
        const btn = L.DomUtil.create('div', 'custom-map-control btn-home');
        btn.innerHTML = '<i class="bi bi-house-fill"></i>';
        L.DomEvent.disableClickPropagation(btn);
        btn.onclick = (e) => { e.preventDefault(); map.setView([16.7537, -93.1160], 13); };
        return btn;
    }
});
new L.Control.ResetView({ position: 'topleft' }).addTo(map);

// D) Botón Borrar
L.Control.ClearRoute = L.Control.extend({
    onAdd: function(map) {
        const btn = L.DomUtil.create('div', 'custom-map-control btn-clear'); 
        btn.innerHTML = '<i class="bi bi-trash3-fill"></i>';
        L.DomEvent.disableClickPropagation(btn);
        btn.onclick = (e) => { e.preventDefault(); limpiarRutaActual(); };
        return btn;
    }
});
new L.Control.ClearRoute({ position: 'topleft' }).addTo(map);

// --- 4. LÓGICA ---
const simbolos = { perdido: "#dc3545", avistamiento: "#ffc107", maltrato: "#6f42c1" };
let routingControl = null; 
let markerTemp;
let archivoFotoSeleccionado = null;

map.on('click', (e) => {
    if (e.originalEvent.target.closest('.leaflet-control') || e.originalEvent.target.closest('.custom-map-control')) return;
    if (markerTemp) map.removeLayer(markerTemp);
    markerTemp = L.marker(e.latlng, { draggable: true }).addTo(map)
        .bindPopup("<b>Ubicación seleccionada</b>").openPopup();
    
    document.getElementById('lat').value = e.latlng.lat;
    document.getElementById('lng').value = e.latlng.lng;
});

function limpiarRutaActual() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
}

function calcularRuta(latDest, lngDest) {
    limpiarRutaActual();
    map.locate({setView: false, enableHighAccuracy: true});
    document.getElementById('loader').style.display = 'flex';

    map.once('locationfound', (e) => {
        document.getElementById('loader').style.display = 'none';
        const esMovil = window.innerWidth < 768;

        const routerOSRM = L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving',
            language: 'es'
        });

        routingControl = L.Routing.control({
            waypoints: [L.latLng(e.latlng), L.latLng(latDest, lngDest)],
            router: routerOSRM,
            language: 'es',
            createMarker: () => null, 
            lineOptions: { styles: [{color: '#198754', opacity: 0.8, weight: 6}] },
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            // TRUCO: Posición 'bottomleft' para que no empuje los controles de arriba
            position: 'bottomleft', 
            show: !esMovil // Oculta texto en móvil
        }).addTo(map);
    });
    
    map.once('locationerror', () => {
        document.getElementById('loader').style.display = 'none';
        alert("Activa tu GPS.");
    });
}

// --- 5. REPORTES ---
async function cargarReportes() {
    const { data } = await clienteSupabase.from('reportes_mascotas').select('*');
    if (data) data.forEach(d => crearMarcadorFinal(d));
}

function crearMarcadorFinal(d) {
    const color = simbolos[d.tipo] || "#333";
    const icon = L.divIcon({
        className: 'custom-icon',
        html: `<div style="background:${color}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [16, 16],
        popupAnchor: [0, -10]
    });

    const content = `
        <div class="popup-header" style="background:${color}">
            ${d.tipo.toUpperCase()}
        </div>
        <div class="popup-body text-center">
            <div style="font-weight:bold; font-size:14px; margin-bottom:5px;">${d.especie}</div>
            <img src="${d.foto_url}" class="popup-img" onclick="verFotoGrande('${d.foto_url}')">
            
            <div class="text-start small bg-light p-2 rounded border mt-2">
                ${d.raza ? `<b>Raza:</b> ${d.raza}<br>` : ''}
                <b>Detalle:</b> ${d.senas || '---'}<br>
                <b>Tel:</b> ${d.contacto}
            </div>
            
            <button class="btn btn-success btn-sm w-100 mt-2 fw-bold" onclick="calcularRuta(${d.lat}, ${d.lng})">
                <i class="bi bi-geo-alt-fill"></i> IR AQUÍ
            </button>
        </div>`;
    
    L.marker([d.lat, d.lng], { icon }).addTo(map).bindPopup(content);
}

// --- 6. FORMULARIOS ---
window.verFotoGrande = (url) => {
    document.getElementById('img-gran-vista').src = url;
    document.getElementById('btn-descargar').href = url;
    new bootstrap.Modal(document.getElementById('modalFoto')).show();
};

document.getElementById('foto').addEventListener('change', function(e) {
    if (e.target.files[0]) {
        archivoFotoSeleccionado = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            document.getElementById('img-preview').src = reader.result;
            document.getElementById('preview-container').classList.remove('d-none');
        };
        reader.readAsDataURL(archivoFotoSeleccionado);
    }
});

document.getElementById('formMascota').addEventListener('submit', async function(e) {
    e.preventDefault();
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;
    if (!lat || !lng) return alert("Falta ubicación.");
    if (!archivoFotoSeleccionado) return alert("Falta foto.");

    document.getElementById('loader').style.display = 'flex';
    try {
        const nombreArchivo = `${Date.now()}_${archivoFotoSeleccionado.name}`;
        const { data: dataUrl } = await subirFoto(nombreArchivo, archivoFotoSeleccionado);
        
        await clienteSupabase.from('reportes_mascotas').insert([{
            tipo: document.getElementById('tipo').value,
            especie: document.getElementById('especie').value,
            raza: document.getElementById('raza').value,
            senas: document.getElementById('senas').value,
            contacto: document.getElementById('contacto').value,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            foto_url: dataUrl.publicUrl
        }]);

        alert("Guardado");
        window.location.reload(); 
    } catch (error) {
        console.error(error);
        alert("Error");
        document.getElementById('loader').style.display = 'none';
    }
});

async function subirFoto(nombre, archivo) {
    await clienteSupabase.storage.from('fotos_mascotas').upload(nombre, archivo);
    return clienteSupabase.storage.from('fotos_mascotas').getPublicUrl(nombre);
}

// --- 7. LEYENDA (Carga inmediata) ---
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = '<h6>Simbología</h6>';
    for (const key in simbolos) {
        div.innerHTML += `
            <div class="legend-item">
                <i style="background:${simbolos[key]}"></i>
                ${key.charAt(0).toUpperCase() + key.slice(1)}
            </div>`;
    }
    return div;
};
legend.addTo(map);

// Inicializar
cargarReportes();