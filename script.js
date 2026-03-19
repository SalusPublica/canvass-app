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

  const visit = { address, date, visitType, answered };
  visits.push(visit);
  localStorage.setItem('visits', JSON.stringify(visits));

  // Add to the list and place marker at exact clicked coordinates
  addVisitToList(visit);

  // Override the geocoded marker with one at the exact click location
  const color = visitType === 'leaflet' ? 'blue' :
                answered === 'yes' ? 'green' : 'grey';

  L.circleMarker(pendingLatLng, {
    radius: 8,
    fillColor: color,
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  })
  .bindPopup(`<b>${address}</b><br>${visitType === 'leaflet' ? '📬 Leaflet drop' : answered === 'yes' ? '🚪 Answered' : '🚪 No answer'}`)
  .addTo(map);

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

  // Add it to the visible list on the page
  addVisitToList(visit);

  // Clear the form fields ready for the next entry
  form.reset();
});

function addVisitToList(visit) {
  // Hide the "no visits yet" message
  emptyMessage.style.display = 'none';

  // Create a new list item
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

  // Add a marker on the map for this visit
  geocodeAddress(visit.address, visit.visitType, visit.answered);
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
    })
    .catch(error => console.log('Geocoding error:', error));
}

// Load any previously saved visits when the page opens
function loadSavedVisits() {
  if (visits.length === 0) return;
  visits.forEach(visit => addVisitToList(visit));
}

loadSavedVisits();