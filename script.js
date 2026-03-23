const SERVER = window.location.origin;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Login ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  if (localStorage.getItem('loggedIn') === 'true' && localStorage.getItem('teamName')) {
    showApp();
  }

  document.getElementById('team-code-input').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') document.getElementById('login-button').click();
  });

  document.getElementById('login-button').addEventListener('click', async function() {
    const teamName = document.getElementById('team-name-input').value.trim();
    const code = document.getElementById('team-code-input').value;

    if (!teamName) {
      document.getElementById('login-error').textContent = 'Please enter a team name.';
      document.getElementById('login-error').style.display = 'block';
      return;
    }

    const response = await fetch(`${SERVER}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamName, code })
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('teamName', data.teamName);
      showApp();
    } else {
      document.getElementById('login-error').textContent = data.message || 'Incorrect team name or code.';
      document.getElementById('login-error').style.display = 'block';
    }
  });

  document.getElementById('show-password').addEventListener('click', function() {
    const input = document.getElementById('team-code-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('logout-button').addEventListener('click', function() {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('teamName');
    localStorage.removeItem('visits');
    location.reload();
  });
});

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  document.getElementById('team-label').textContent = localStorage.getItem('teamName');
  loadVisitsFromServer();
  setTimeout(function() { map.invalidateSize(); }, 100);
}

// ── Map ────────────────────────────────────────────────
const map = L.map('map').setView([60.1699, 24.9384], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ── Visits data ────────────────────────────────────────
let visits = [];

// ── DOM references ─────────────────────────────────────
const form = document.getElementById('visit-form');
const visitList = document.getElementById('visit-list');
const emptyMessage = document.getElementById('empty-message');
const visitTypeSelect = document.getElementById('visit-type');
const answeredLabel = document.getElementById('answered-label');
const answeredSelect = document.getElementById('answered');

// ── Form visit type toggle ─────────────────────────────
visitTypeSelect.addEventListener('change', function() {
  const isLeaflet = visitTypeSelect.value === 'leaflet';
  answeredLabel.style.display = isLeaflet ? 'none' : 'block';
  answeredSelect.style.display = isLeaflet ? 'none' : 'block';
});

// ── Form submit ────────────────────────────────────────
form.addEventListener('submit', function(event) {
  event.preventDefault();

  const address = document.getElementById('address').value;
  const date = document.getElementById('date').value;
  const visitType = document.getElementById('visit-type').value;
  const answered = visitType === 'knock' ? document.getElementById('answered').value : 'n/a';

  const visit = { id: generateId(), address, date, visitType, answered };
  visits.push(visit);
  saveVisitToServer(visit);
  addVisitToList(visit);
  form.reset();
});

// ── Map click popup ────────────────────────────────────
let pendingLatLng = null;

const mapPopup = document.getElementById('map-popup');
const mapPopupAddress = document.getElementById('map-popup-address');
const mapVisitType = document.getElementById('map-visit-type');
const mapAnswered = document.getElementById('map-answered');
const mapAnsweredContainer = document.getElementById('map-answered-container');

mapVisitType.addEventListener('change', function() {
  mapAnsweredContainer.style.display = mapVisitType.value === 'leaflet' ? 'none' : 'block';
});

map.on('click', function(e) {
  pendingLatLng = e.latlng;
  mapPopupAddress.textContent = 'Fetching address...';
  mapPopup.style.display = 'flex';

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`;
  fetch(url)
    .then(r => r.json())
    .then(data => {
      const house = data.address.house_number || '';
      const road = data.address.road || 'Unknown street';
      mapPopupAddress.textContent = `${road} ${house}`.trim();
    })
    .catch(() => { mapPopupAddress.textContent = 'Could not fetch address'; });
});

document.getElementById('map-popup-confirm').addEventListener('click', function() {
  if (!pendingLatLng) return;

  const address = mapPopupAddress.textContent;
  const visitType = mapVisitType.value;
  const answered = visitType === 'knock' ? mapAnswered.value : 'n/a';
  const date = new Date().toISOString().split('T')[0];

  const visit = { id: generateId(), address, date, visitType, answered, lat: pendingLatLng.lat, lon: pendingLatLng.lng };
  visits.push(visit);
  saveVisitToServer(visit);
  addVisitToList(visit);

  mapPopup.style.display = 'none';
  pendingLatLng = null;
});

document.getElementById('map-popup-cancel').addEventListener('click', function() {
  mapPopup.style.display = 'none';
  pendingLatLng = null;
});

// ── Visit list ─────────────────────────────────────────
function addVisitToList(visit) {
  if (!visit.id) visit.id = generateId();

  if (emptyMessage) emptyMessage.style.display = 'none';

  const li = document.createElement('li');
  li.classList.add('list-group-item');
  li.dataset.id = visit.id;

  const formattedDate = new Date(visit.date).toLocaleDateString('fi-FI');

  let icon, label, colorClass;
  if (visit.visitType === 'leaflet') {
    icon = '📬'; label = 'Leaflet drop'; colorClass = 'leaflet-drop';
  } else if (visit.answered === 'yes') {
    icon = '🚪'; label = 'Answered ✓'; colorClass = 'answered-yes';
  } else {
    icon = '🚪'; label = 'No answer'; colorClass = 'answered-no';
  }

  li.classList.add(colorClass);
  li.innerHTML = `
    <div class="d-flex justify-content-between align-items-start">
      <div>
        <div class="fw-500">${visit.address}</div>
        <div class="text-muted" style="font-size:12px;">${formattedDate} — ${icon} ${label}</div>
      </div>
      <div class="d-flex gap-1 ms-2">
        <button class="btn btn-outline-secondary btn-xs edit-btn" data-id="${visit.id}">✏️</button>
        <button class="btn btn-outline-danger btn-xs delete-btn" data-id="${visit.id}">🗑</button>
      </div>
    </div>
  `;

  visitList.appendChild(li);

  if (visit.lat && visit.lon) {
    addMarkerToMap(visit.lat, visit.lon, visit.visitType, visit.answered, visit.address, visit.id);
  } else {
    geocodeAddress(visit.address, visit.visitType, visit.answered, visit.id);
  }
}

// ── Delete & Edit handlers ─────────────────────────────
document.getElementById('visit-list').addEventListener('click', function(e) {
  const deleteBtn = e.target.closest('.delete-btn');
  const editBtn = e.target.closest('.edit-btn');

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    if (!confirm('Are you sure you want to remove this visit?')) return;
    deleteVisit(id);
  }

  if (editBtn) {
    const id = editBtn.dataset.id;
    const visit = visits.find(v => v.id === id);
    if (visit) openEditPopup(visit);
  }
});

async function deleteVisit(id) {
  const teamName = localStorage.getItem('teamName');
  await fetch(`${SERVER}/api/visits/${encodeURIComponent(teamName)}/${id}`, {
    method: 'DELETE'
  });

  visits = visits.filter(v => v.id !== id);

  const li = document.querySelector(`li[data-id="${id}"]`);
  if (li) li.remove();

  map.eachLayer(layer => {
    if (layer.visitId === id) map.removeLayer(layer);
  });

  if (visits.length === 0 && emptyMessage) {
    emptyMessage.style.display = 'block';
  }
}

// ── Edit popup ─────────────────────────────────────────
let currentEditId = null;

function openEditPopup(visit) {
  currentEditId = visit.id;

  document.getElementById('edit-popup-address').textContent = visit.address;
  document.getElementById('edit-date').value = visit.date;
  document.getElementById('edit-visit-type').value = visit.visitType;
  document.getElementById('edit-answered').value = visit.answered === 'n/a' ? 'yes' : visit.answered;
  document.getElementById('edit-answered-container').style.display =
    visit.visitType === 'leaflet' ? 'none' : 'block';

  document.getElementById('edit-popup').style.display = 'flex';
}

document.getElementById('edit-visit-type').addEventListener('change', function() {
  document.getElementById('edit-answered-container').style.display =
    this.value === 'leaflet' ? 'none' : 'block';
});

document.getElementById('edit-popup-cancel').addEventListener('click', function() {
  document.getElementById('edit-popup').style.display = 'none';
  currentEditId = null;
});

document.getElementById('edit-popup-save').addEventListener('click', async function() {
  if (!currentEditId) return;

  const teamName = localStorage.getItem('teamName');
  const visitType = document.getElementById('edit-visit-type').value;
  const answered = visitType === 'knock' ? document.getElementById('edit-answered').value : 'n/a';
  const date = document.getElementById('edit-date').value;

  const updates = { visitType, answered, date };

  await fetch(`${SERVER}/api/visits/${encodeURIComponent(teamName)}/${currentEditId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  const index = visits.findIndex(v => v.id === currentEditId);
  if (index !== -1) visits[index] = { ...visits[index], ...updates };

  document.getElementById('edit-popup').style.display = 'none';
  currentEditId = null;

  location.reload();
});

// ── Server sync ────────────────────────────────────────
async function loadVisitsFromServer() {
  const teamName = localStorage.getItem('teamName');
  const response = await fetch(`${SERVER}/api/visits/${encodeURIComponent(teamName)}`);
  const serverVisits = await response.json();
  visits = serverVisits;
  for (const visit of serverVisits) {
    addVisitToList(visit);
    if (!visit.lat || !visit.lon) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function saveVisitToServer(visit) {
  const teamName = localStorage.getItem('teamName');
  await fetch(`${SERVER}/api/visits/${encodeURIComponent(teamName)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visit)
  });
}

// ── Markers ────────────────────────────────────────────
function addMarkerToMap(lat, lon, visitType, answered, address, id) {
  const color = visitType === 'leaflet' ? 'blue' : answered === 'yes' ? 'green' : 'grey';

  const marker = L.circleMarker([lat, lon], {
    radius: 8,
    fillColor: color,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  })
  .bindPopup(`<b>${address}</b><br>${visitType === 'leaflet' ? '📬 Leaflet drop' : answered === 'yes' ? '🚪 Answered' : '🚪 No answer'}`)
  .addTo(map);

  marker.visitId = id;

  marker.on('contextmenu', function() {
    const visit = visits.find(v => v.id === id);
    if (visit) openEditPopup(visit);
  });
}

function geocodeAddress(address, visitType, answered, id) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Finland')}`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      if (data.length === 0) return;

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);

      const visitIndex = visits.findIndex(v => v.id === id);
      if (visitIndex !== -1) {
        visits[visitIndex].lat = lat;
        visits[visitIndex].lon = lon;
        saveVisitToServer(visits[visitIndex]);
      }

      addMarkerToMap(lat, lon, visitType, answered, address, id);
    })
    .catch(error => console.log('Geocoding error:', error));
}

// ── Election data layers ───────────────────────────────
const partyColors = {
  'KOK': '#0047AB',
  'PS': '#FFD700',
  'SDP': '#CC0000',
  'KESK': '#006400',
  'VIHR': '#00A550',
  'VAS': '#8B0000',
  'RKP': '#FFDD00',
  'KD': '#FF6B00',
};

function buildPartyPopup(name, feature) {
  const percentages = feature.properties.partyPercentages || {};
  const sdp = feature.properties.sdpPercentage || 0;
  const winner = feature.properties.winningParty || 'Unknown';
  const totalVotes = feature.properties.totalVotes || 0;

  const sortedParties = Object.entries(percentages)
    .filter(([, pct]) => pct >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([party, pct]) => {
      const bold = party === 'SDP' ? '<b>' : '';
      const boldEnd = party === 'SDP' ? '</b>' : '';
      return `${bold}${party}: ${pct}%${boldEnd}`;
    })
    .join('<br>');

  return `<b>${name}</b><br>Winner: ${winner}<br>Total votes: ${totalVotes}<br><b style="color:#CC0000">SDP: ${sdp}%</b><hr>${sortedParties}`;
}

let votingLayer = null, votingLayerVisible = false;
let sdpLayer = null, sdpLayerVisible = false;
let turnoutLayer = null, turnoutLayerVisible = false;

async function loadVotingLayer() {
  if (votingLayer) {
    votingLayerVisible ? map.removeLayer(votingLayer) : votingLayer.addTo(map);
    votingLayerVisible = !votingLayerVisible;
    return;
  }
  const geojson = await fetch(`${SERVER}/api/districts`).then(r => r.json());
  votingLayer = L.geoJSON(geojson, {
    style: feature => ({
      fillColor: partyColors[feature.properties.winningParty] || '#888888',
      fillOpacity: 0.5, color: '#fff', weight: 1
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buildPartyPopup(feature.properties.nimi || '', feature));
    }
  }).addTo(map);
  votingLayerVisible = true;
}

async function loadSdpLayer() {
  if (sdpLayer) {
    sdpLayerVisible ? map.removeLayer(sdpLayer) : sdpLayer.addTo(map);
    sdpLayerVisible = !sdpLayerVisible;
    return;
  }
  const geojson = await fetch(`${SERVER}/api/districts`).then(r => r.json());
  sdpLayer = L.geoJSON(geojson, {
    style: feature => {
      const pct = feature.properties.sdpPercentage || 0;
      const intensity = Math.min(pct / 50, 1);
      return {
        fillColor: `rgb(204,${Math.round(204 * (1 - intensity))},${Math.round(204 * (1 - intensity))})`,
        fillOpacity: 0.7, color: '#fff', weight: 1
      };
    },
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buildPartyPopup(feature.properties.nimi || '', feature));
    }
  }).addTo(map);
  sdpLayerVisible = true;
}

async function loadTurnoutLayer() {
  if (turnoutLayer) {
    turnoutLayerVisible ? map.removeLayer(turnoutLayer) : turnoutLayer.addTo(map);
    turnoutLayerVisible = !turnoutLayerVisible;
    return;
  }
  const geojson = await fetch(`${SERVER}/api/districts`).then(r => r.json());
  turnoutLayer = L.geoJSON(geojson, {
    style: feature => {
      const pct = feature.properties.turnoutPct || 0;
      const stops = [[0,220,0,0],[50,230,120,0],[75,255,210,0],[100,0,180,0]];
      let lower = stops[0], upper = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (pct >= stops[i][0] && pct <= stops[i+1][0]) { lower = stops[i]; upper = stops[i+1]; break; }
      }
      const t = (upper[0] - lower[0]) === 0 ? 0 : (pct - lower[0]) / (upper[0] - lower[0]);
      return {
        fillColor: `rgb(${Math.round(lower[1]+t*(upper[1]-lower[1]))},${Math.round(lower[2]+t*(upper[2]-lower[2]))},${Math.round(lower[3]+t*(upper[3]-lower[3]))})`,
        fillOpacity: 0.7, color: '#fff', weight: 1
      };
    },
    onEachFeature: (feature, layer) => {
      layer.bindPopup(`<b>${feature.properties.nimi||''}</b><br><b>Turnout: ${feature.properties.turnoutPct||0}%</b><br>Voted: ${feature.properties.totalVoted||0} / ${feature.properties.eligibleVoters||0}`);
    }
  }).addTo(map);
  turnoutLayerVisible = true;
}

document.getElementById('toggle-voting-layer').addEventListener('click', loadVotingLayer);
document.getElementById('toggle-sdp-layer').addEventListener('click', loadSdpLayer);
document.getElementById('toggle-turnout-layer').addEventListener('click', loadTurnoutLayer);