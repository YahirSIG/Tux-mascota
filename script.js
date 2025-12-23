const SCRIPT_URL = "TU_URL_DE_APPS_SCRIPT_AQUI";

// 1. MAPAS BASE
const callejero = L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: 'CartoDB' });
const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' });

const map = L.map('map', {
    center: [16.7537, -93.1160], // Tuxtla Gutiérrez
    zoom: 13,
    layers: [callejero]
});

L.control.layers({ "Mapa Claro": callejero, "Satélite": satelite }).addTo(map);

// 2. GEOCODIFICADOR PREDICTIVO (MOTOR PHOTON)
const geocoder = L.Control.geocoder({
    geocoder: L.Control.Geocoder.photon({
        geocodingQueryParams: {
            countrycode: 'MX', // LIMITAR A MÉXICO
            lon: -93.1160,     // PRIORIZAR TUXTLA
            lat: 16.7537
        }
    }),
    collapsed: false,          // SIEMPRE ABIERTO
    placeholder: "🔍 Buscar en Tuxtla...",
    position: 'topleft',
    suggestMinLength: 3,       // EMPIEZA A PREDECIR A LAS 3 LETRAS
    suggestTimeout: 250
}).on('markgeocode', function(e) {
    const center = e.geocode.center;
    map.setView(center, 17);
    marcarPunto(center);
    // Limpiar sugerencias tras seleccionar
    document.querySelector('.leaflet-control-geocoder-alternatives').innerHTML = '';
}).addTo(map);

// 3. SIMBOLOGÍA
const simbolos = { perdido: "#ff0000", avistamiento: "#ff8c00", maltrato: "#800080" };

// 4. LÓGICA DE MARCADORES
let markerTemp;
let routingControl;

map.on('click', (e) => marcarPunto(e.latlng));

function marcarPunto(latlng) {
    if (markerTemp) map.removeLayer(markerTemp);
    markerTemp = L.marker(latlng, { draggable: true }).addTo(map)
        .bindPopup("<b>Ubicación del reporte</b><br>Puedes arrastrarme si es necesario.").openPopup();
    
    document.getElementById('lat').value = latlng.lat;
    document.getElementById('lng').value = latlng.lng;
}

function calcularRuta(latDest, lngDest) {
    if (routingControl) map.removeControl(routingControl);
    map.locate({setView: false});
    map.on('locationfound', (e) => {
        routingControl = L.Routing.control({
            waypoints: [L.latLng(e.latlng), L.latLng(latDest, lngDest)],
            language: 'es',
            createMarker: () => null
        }).addTo(map);
    });
}

// 5. CÁMARA
document.getElementById('foto').addEventListener('change', function(e) {
    const reader = new FileReader();
    reader.onload = () => {
        document.getElementById('img-preview').src = reader.result;
        document.getElementById('preview-container').classList.remove('d-none');
    };
    if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
});

// 6. ENVÍO
document.getElementById('formMascota').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!document.getElementById('lat').value) return alert("Por favor, marca la ubicación en el mapa.");

    document.getElementById('loader').style.display = 'flex';

    const datos = {
        tipo: document.getElementById('tipo').value,
        especie: document.getElementById('especie').value,
        raza: document.getElementById('raza').value,
        senas: document.getElementById('senas').value,
        contacto: document.getElementById('contacto').value,
        lat: document.getElementById('lat').value,
        lng: document.getElementById('lng').value,
        foto: document.getElementById('img-preview').src
    };

    // Simulación de guardado
    setTimeout(() => {
        crearMarcadorFinal(datos);
        document.getElementById('loader').style.display = 'none';
        bootstrap.Modal.getInstance(document.getElementById('modalReporte')).hide();
        this.reset();
        document.getElementById('preview-container').classList.add('d-none');
        if (markerTemp) map.removeLayer(markerTemp);
        alert("¡Reporte publicado!");
    }, 1500);
});

function crearMarcadorFinal(d) {
    const color = simbolos[d.tipo];
    const icon = L.divIcon({
        className: 'custom-icon',
        html: `<div style="background:${color}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [16, 16]
    });

    const content = `
        <div style="text-align:center; width:180px;">
            <span class="badge" style="background:${color}">${d.tipo.toUpperCase()}</span><br>
            <strong>${d.especie}</strong><br>
            <img src="${d.foto}" class="popup-img">
            <div class="mt-2 small"><b>Contacto:</b> ${d.contacto}</div>
            <button class="btn btn-dark btn-sm w-100 mt-2" onclick="calcularRuta(${d.lat}, ${d.lng})">
                <i class="bi bi-cursor-fill"></i> ¿CÓMO LLEGAR?
            </button>
        </div>
    `;

    L.marker([d.lat, d.lng], { icon: icon }).addTo(map).bindPopup(content);
}