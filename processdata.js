const fs = require('fs');

// Read the GeoJSON file
const geojson = JSON.parse(fs.readFileSync('districts.geojson', 'utf-8'));

// Read the party results CSV
const csv = fs.readFileSync('ekv-2023_tpat_maa.csv', 'latin1');
const lines = csv.split('\n').filter(line => line.trim());

// Read the area/turnout CSV
const areaCsv = fs.readFileSync('ekv-2023_taat_maa.csv', 'latin1');
const areaLines = areaCsv.split('\n').filter(line => line.trim());

// Parse turnout data per district
const turnoutData = {};
areaLines.forEach(line => {
  const cols = line.split(';');
  const municipalityCode = cols[2].trim();
  const districtCode = cols[4].trim();
  const eligibleVoters = parseInt(cols[13].trim(), 10);
  const totalVoted = parseInt(cols[40].trim(), 10);

  if (isNaN(eligibleVoters) || isNaN(totalVoted) || eligibleVoters === 0) return;

  const key = `${municipalityCode}-${districtCode.replace(/^0+/, '')}`;
  const turnoutPct = Math.round((totalVoted / eligibleVoters) * 1000) / 10;
  turnoutData[key] = { eligibleVoters, totalVoted, turnoutPct };
});

console.log('Turnout keys sample:', Object.keys(turnoutData).slice(0, 5));
console.log('Turnout sample value:', Object.values(turnoutData).slice(0, 1));

// Parse the CSV into party vote data per district
const districtVotes = {};
lines.forEach(line => {
  const cols = line.split(';');
  const municipalityCode = cols[2].trim();
  const districtCode = cols[4].trim();
  const partyName = cols[10].trim();
  const totalVotes = parseInt(cols[39].trim(), 10);

  if (isNaN(totalVotes)) return;

  const key = `${municipalityCode}-${districtCode.replace(/^0+/, '')}`;

  if (!districtVotes[key]) {
    districtVotes[key] = {};
  }

  districtVotes[key][partyName] = (districtVotes[key][partyName] || 0) + totalVotes;
});

// Calculate totals, winner and percentages for each district
const districtResults = {};
Object.entries(districtVotes).forEach(([key, parties]) => {
  const totalVotes = Object.values(parties).reduce((sum, v) => sum + v, 0);
  const winner = Object.entries(parties).sort((a, b) => b[1] - a[1])[0];

  const percentages = {};
  Object.entries(parties).forEach(([party, votes]) => {
    percentages[party] = Math.round((votes / totalVotes) * 1000) / 10;
  });

  districtResults[key] = {
    winner: winner[0],
    winnerVotes: winner[1],
    totalVotes,
    percentages
  };
});

// Merge results into GeoJSON
geojson.features.forEach(feature => {
  const municipalityCode = feature.properties.kuntanro;
  const districtCode = feature.properties.tunnus;
  const key = `${municipalityCode}-${districtCode}`;

  if (districtResults[key]) {
    const result = districtResults[key];
    feature.properties.winningParty = result.winner;
    feature.properties.winningVotes = result.winnerVotes;
    feature.properties.totalVotes = result.totalVotes;
    feature.properties.partyPercentages = result.percentages;
    feature.properties.sdpPercentage = result.percentages['SDP'] || 0;
  }

  if (turnoutData[key]) {
    feature.properties.turnoutPct = turnoutData[key].turnoutPct;
    feature.properties.eligibleVoters = turnoutData[key].eligibleVoters;
    feature.properties.totalVoted = turnoutData[key].totalVoted;
  }
});

// Save the enriched GeoJSON
fs.writeFileSync('districts.geojson', JSON.stringify(geojson));
console.log('Data processing complete!');
console.log('Sample SDP%:', geojson.features[0].properties.sdpPercentage);
console.log('Sample turnout%:', geojson.features[0].properties.turnoutPct);