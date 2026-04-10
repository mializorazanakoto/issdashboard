// ISS Mission Operations Dashboard
// Live telemetry and manifest

// Configuration
const ISS_API = 'https://api.wheretheiss.at/v1/satellites/25544';
const CREW_API = 'https://corquaid.github.io/international-space-station-api/api/external/iss-passengers.json';
// Fallback if the above doesn't work: 'http://api.open-notify.org/astros.json'
const UPDATE_INTERVAL = 3000; // 3 seconds

// Nationality Mapping (Fallback)
const nationalities = {
    'Oleg Kononenko': { nat: 'Russia', flag: '🇷🇺' },
    'Nikolai Chub': { nat: 'Russia', flag: '🇷🇺' },
    'Tracy Caldwell Dyson': { nat: 'USA', flag: '🇺🇸' },
    'Matthew Dominick': { nat: 'USA', flag: '🇺🇸' },
    'Michael Barratt': { nat: 'USA', flag: '🇺🇸' },
    'Jeanette Epps': { nat: 'USA', flag: '🇺🇸' },
    'Alexander Grebenkin': { nat: 'Russia', flag: '🇷🇺' },
    'Butch Wilmore': { nat: 'USA', flag: '🇺🇸' },
    'Suni Williams': { nat: 'USA', flag: '🇺🇸' },
    'Oleg Novitskiy': { nat: 'Russia', flag: '🇷🇺' },
    'Marina Vasilevskaya': { nat: 'Belarus', flag: '🇧🇾' },
    'Loral O\'Hara': { nat: 'USA', flag: '🇺🇸' }
};

// State
let map, issMarker, pathLine;
let history = [];

// Initialize Dashboard
function init() {
    initMap();
    updateDashboard();
    updateCrew();
    startTimeUpdate();
    
    // Start fetch loops
    setInterval(updateDashboard, UPDATE_INTERVAL);
}

function initMap() {
    map = L.map('map', {
        center: [0, 0],
        zoom: 3,
        minZoom: 2,
        maxBounds: [[-90, -180], [90, 180]]
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Custom ISS Icon
    const issIcon = L.divIcon({
        className: 'iss-icon-container',
        html: `<div class="iss-marker-pulse"></div><div class="iss-marker-icon">🚀</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    issMarker = L.marker([0, 0], { icon: issIcon }).addTo(map);
    pathLine = L.polyline([], { color: '#00f2ff', weight: 2, dashArray: '5, 10', opacity: 0.6 }).addTo(map);
}

async function updateDashboard() {
    try {
        const response = await fetch(ISS_API);
        if (!response.ok) throw new Error('Telemetry offline');
        const data = await response.json();

        const { latitude, longitude, altitude, velocity, visibility, timestamp } = data;

        // Update UI
        document.getElementById('lat-val').textContent = `${latitude.toFixed(4)}°`;
        document.getElementById('lon-val').textContent = `${longitude.toFixed(4)}°`;
        document.getElementById('alt-val').textContent = Math.round(altitude);
        document.getElementById('vel-val').textContent = Math.round(velocity).toLocaleString();
        document.getElementById('vis-val').textContent = visibility.toUpperCase();

        // Calculate Orbit Period (approx)
        // T = 2 * pi * sqrt(a^3 / mu)
        const R = 6371; // Earth radius
        const mu = 398600.4418; // G * M
        const a = R + altitude;
        const T = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
        document.getElementById('period-val').textContent = Math.round(T / 60);

        // Update Map
        const pos = [latitude, longitude];
        issMarker.setLatLng(pos);
        
        // Update Path (Tail)
        history.push(pos);
        if (history.length > 100) history.shift();
        pathLine.setLatLngs(history);

        // Smooth center if needed (first update)
        if (history.length === 1) map.setView(pos, 3);

        updateStatus(true);
    } catch (error) {
        console.error('Error fetching ISS position:', error);
        updateStatus(false);
    }
}

async function updateCrew() {
    const list = document.getElementById('crew-list');
    try {
        // Try fetching open-notify which is reliable
        const response = await fetch('https://open-notify.org/astros.json');
        // If the above has CORS issues (common for open-notify), we use a fallback or proxy
        // Since we are in a browser, we might need a CORS proxy or use a different API
        
        // Second try: Corquaid API which is more browser friendly
        let crewResponse = await fetch('https://corquaid.github.io/international-space-station-api/api/external/iss-passengers.json');
        let data;
        
        if (crewResponse.ok) {
            data = await crewResponse.json();
            // This API format: { passengers: [{ name: '', biography: '', nationality: '', ... }] }
            renderCrew(data.passengers || data.people);
        } else {
            // Last resort: basic list or open-notify proxy
            const backupResponse = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('http://api.open-notify.org/astros.json'));
            const backupData = await backupResponse.json();
            const parsed = JSON.parse(backupData.contents);
            renderCrew(parsed.people);
        }
    } catch (error) {
        console.error('Error fetching crew:', error);
        list.innerHTML = `<div class="error">Unable to sync crew data. Retrying...</div>`;
        setTimeout(updateCrew, 10000);
    }
}

function renderCrew(people) {
    const list = document.getElementById('crew-list');
    list.innerHTML = '';

    if (!people || people.length === 0) {
        list.innerHTML = '<li>No crew data available</li>';
        return;
    }

    // Modern ISS crew actually on station (filter to ISS only)
    const issCrew = people.filter(p => !p.craft || p.craft === 'ISS');

    issCrew.forEach(p => {
        const info = nationalities[p.name] || { nat: p.nationality || 'Earth', flag: '🌍' };
        
        const item = document.createElement('div');
        item.className = 'crew-item';
        item.innerHTML = `
            <div class="crew-avatar">${p.name.charAt(0)}</div>
            <div class="crew-info">
                <span class="crew-name">${p.name}</span>
                <span class="crew-nat">${info.nat}</span>
            </div>
            <span class="flag">${info.flag}</span>
        `;
        list.appendChild(item);
    });
}

function updateStatus(nominal) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (nominal) {
        dot.className = 'dot green';
        text.textContent = 'SYSTEMS NOMINAL';
    } else {
        dot.className = 'dot red';
        text.textContent = 'LINK DEGRADED';
    }
}

function startTimeUpdate() {
    const timeEl = document.getElementById('live-time');
    setInterval(() => {
        const now = new Date();
        timeEl.textContent = now.toISOString().split('T')[1].split('.')[0] + ' UTC';
    }, 1000);
}

// Marker styles injection
const style = document.createElement('style');
style.innerHTML = `
    .iss-marker-pulse {
        width: 100%;
        height: 100%;
        border: 2px solid var(--accent-color);
        border-radius: 50%;
        animation: markerPulse 2s infinite linear;
        position: absolute;
    }
    .iss-marker-icon {
        font-size: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        filter: drop-shadow(0 0 5px var(--accent-color));
    }
    @keyframes markerPulse {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(3); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Run init
init();
