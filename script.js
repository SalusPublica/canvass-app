const SERVER = 'http://localhost:3000';

// Check if already logged in
if (localStorage.getItem('loggedIn') === 'true') {
  showApp();
}

document.getElementById('login-button').addEventListener('click', async function() {
  const code = document.getElementById('team-code-input').value;

  const response = await fetch(`${SERVER}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });

  const data = await response.json();

  if (data.success) {
    localStorage.setItem('loggedIn', 'true');
    showApp();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
});

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  loadVisitsFromServer();
}

async function loadVisitsFromServer() {
  const response = await fetch(`${SERVER}/api/visits`);
  const serverVisits = await response.json();
  serverVisits.forEach(visit => addVisitToList(visit));
}

// Initialise the map, centred on Helsinki
const map = L.map('map').setView([60.1699, 24.9384], 12);

// Load and display the map tiles from OpenStreetMap
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Track the coordinates from a map click
let pendingLatLng = null;

// Get references to the popup elements
const mapPopup = document.getElementById('map-popup');
const mapPopupAddress = document.getElementById('map-popup-address');
const mapVisitType = document.getElementById('map-visit-type');
const mapAnswered = document.getElementById('map-answered');
const mapAnsweredContainer = document.getElementById('map-answered-container');

// Show/hide the answered field in the popup based on visit type
mapVisitType.addEventListener('change', function() {
  mapAnsweredContainer.style.display =
    mapVisitType.value === 'leaflet' ? 'none' : 'block';
});

// Listen for clicks on the map
map.on('click', function(e) {
  pendingLatLng = e.latlng;
  mapPopupAddress.textContent = 'Fetching address...';
  mapPopup.style.display = 'flex';

  // Reverse geocode the clicked coordinates
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      const house = data.address.house_number || '';
      const road = data.address.road || 'Unknown street';
      const unit = data.address.unit ? ` ${data.address.unit}` : '';
      mapPopupAddress.textContent = `${road} ${house}${unit}`.trim();
    })
    .catch(() => {
      mapPopupAddress.textContent = 'Could not fetch address';
    });
});

// Handle the confirm button
document.getElementById('map-popup-confirm').addEventListener('click', function() {
  if (!pendingLatLng) return;

  const address = mapPopupAddress.textContent;
  const visitType = mapVisitType.value;
  const answered = visitType === 'knock' ? mapAnswered.value : 'n/a';
  const date = new Date().toISOString().split('T')[0];

  const visit = { address, date, visitType, answered, lat: pendingLatLng.lat, lon: pendingLatLng.lng };
  visits.push(visit);
  localStorage.setItem('visits', JSON.stringify(visits));
  saveVisitToServer(visit);

  // Add to the visit list
  emptyMessage.style.display = 'none';
  const li = document.createElement('li');
  const formattedDate = new Date(visit.date).toLocaleDateString('fi-FI');
  if (visit.visitType === 'leaflet') {
    li.classList.add('answered-no');
    li.textContent = `${formattedDate} — ${visit.address} — 📬 Leaflet drop`;
  } else {
    li.classList.add(visit.answered === 'yes' ? 'answered-yes' : 'answered-no');
    li.textContent = `${formattedDate} — ${visit.address} — ${visit.answered === 'yes' ? '🚪 Answered ✓' : '🚪 No answer'}`;
  }
  visitList.appendChild(li);

  // Place marker directly using the click coordinates — no geocoding needed
  addMarkerToMap(pendingLatLng.lat, pendingLatLng.lng, visitType, answered, address);

  // Close the popup
  mapPopup.style.display = 'none';
  pendingLatLng = null;
});

// Handle the cancel button
document.getElementById('map-popup-cancel').addEventListener('click', function() {
  mapPopup.style.display = 'none';
  pendingLatLng = null;
});

// Load saved visits from localStorage, or start with an empty array
const visits = JSON.parse(localStorage.getItem('visits')) || [];

// Get references to the HTML elements we need
const form = document.getElementById('visit-form');
const visitList = document.getElementById('visit-list');
const emptyMessage = document.getElementById('empty-message');

// Show/hide the "answered" field based on visit type
const visitTypeSelect = document.getElementById('visit-type');
const answeredLabel = document.getElementById('answered-label');
const answeredSelect = document.getElementById('answered');

visitTypeSelect.addEventListener('change', function() {
  const isLeaflet = visitTypeSelect.value === 'leaflet';
  answeredLabel.style.display = isLeaflet ? 'none' : 'block';
  answeredSelect.style.display = isLeaflet ? 'none' : 'block';
});

// Listen for the form being submitted
form.addEventListener('submit', function(event) {
  // Prevent the page from reloading (default form behaviour)
  event.preventDefault();

  // Read the values from the form fields
  const address = document.getElementById('address').value;
  const date = document.getElementById('date').value;
  const visitType = document.getElementById('visit-type').value;
  const answered = visitType === 'knock'
    ? document.getElementById('answered').value
    : 'n/a';

  // Create a visit object and add it to our array
  const visit = { address, date, visitType, answered };
  visits.push(visit);

  // Save the updated visits array to localStorage
  localStorage.setItem('visits', JSON.stringify(visits));
saveVisitToServer(visit);

  // Add it to the visible list on the page
  addVisitToList(visit);

  // Clear the form fields ready for the next entry
  form.reset();
});

function addVisitToList(visit) {
  emptyMessage.style.display = 'none';

  const li = document.createElement('li');
  const formattedDate = new Date(visit.date).toLocaleDateString('fi-FI');

  if (visit.visitType === 'leaflet') {
    li.classList.add('answered-no');
    li.textContent = `${formattedDate} — ${visit.address} — 📬 Leaflet drop`;
  } else {
    li.classList.add(visit.answered === 'yes' ? 'answered-yes' : 'answered-no');
    li.textContent = `${formattedDate} — ${visit.address} — ${visit.answered === 'yes' ? '🚪 Answered ✓' : '🚪 No answer'}`;
  }

  visitList.appendChild(li);

  // If coordinates are already saved, place marker directly — no geocoding needed
  if (visit.lat && visit.lon) {
    addMarkerToMap(visit.lat, visit.lon, visit.visitType, visit.answered, visit.address);
  } else {
    geocodeAddress(visit.address, visit.visitType, visit.answered);
  }
}

function geocodeAddress(address, visitType, answered) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Finland')}`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.length === 0) {
        console.log('Address not found:', address);
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);

      // Save coordinates to the visit in localStorage and server
      const visitIndex = visits.findIndex(v => v.address === address && !v.lat);
      if (visitIndex !== -1) {
        visits[visitIndex].lat = lat;
        visits[visitIndex].lon = lon;
        localStorage.setItem('visits', JSON.stringify(visits));
        saveVisitToServer(visits[visitIndex]);
      }

      addMarkerToMap(lat, lon, visitType, answered, address);
    })
    .catch(error => console.log('Geocoding error:', error));
}

// Load any previously saved visits when the page opens
function loadSavedVisits() {
  if (visits.length === 0) return;
  visits.forEach(visit => addVisitToList(visit));
}

loadSavedVisits();
async function saveVisitToServer(visit) {
  await fetch(`${SERVER}/api/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visit)
  });
}

function addMarkerToMap(lat, lon, visitType, answered, address) {
  const color = visitType === 'leaflet' ? 'blue' :
                answered === 'yes' ? 'green' : 'grey';

  L.circleMarker([lat, lon], {
    radius: 8,
    fillColor: color,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  })
  .bindPopup(`<b>${address}</b><br>${visitType === 'leaflet' ? '📬 Leaflet drop' : answered === 'yes' ? '🚪 Answered' : '🚪 No answer'}`)
  .addTo(map);
}
// Party colours
const partyColors = {
  'KOK': '#0047AB',   // Blue - Kokoomus
  'PS': '#FFD700',    // Yellow - Perussuomalaiset
  'SDP': '#CC0000',   // Red - SDP
  'KESK': '#006400',  // Green - Keskusta
  'VIHR': '#00A550',  // Light green - Vihreät
  'VAS': '#CC0000',   // Dark red - Vasemmistoliitto
  'RKP': '#FFFF00',   // Yellow - RKP
  'KD': '#FF6B00',    // Orange - KD
};

let votingLayer = null;
let votingLayerVisible = false;

async function loadVotingLayer() {
  if (votingLayer) {
    if (votingLayerVisible) {
      map.removeLayer(votingLayer);
      votingLayerVisible = false;
    } else {
      votingLayer.addTo(map);
      votingLayerVisible = true;
    }
    return;
  }

  const response = await fetch(`${SERVER}/api/districts`);
  const geojson = await response.json();

  votingLayer = L.geoJSON(geojson, {
    style: function(feature) {
      const party = feature.properties.winningParty;
      return {
        fillColor: partyColors[party] || '#888888',
        fillOpacity: 0.5,
        color: '#fff',
        weight: 1
      };
    },
    onEachFeature: function(feature, layer) {
      const party = feature.properties.winningParty || 'Unknown';
      const votes = feature.properties.winningVotes || 0;
      const name = feature.properties.nimi || '';
      layer.bindPopup(`<b>${name}</b><br>Winner: ${party}<br>Votes: ${votes}`);
    }
  }).addTo(map);

  votingLayerVisible = true;
}
document.getElementById('toggle-voting-layer').addEventListener('click', loadVotingLayer);
