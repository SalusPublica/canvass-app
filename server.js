const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Load and hash all team codes at startup
let teams = [];

function loadTeams() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'teams.json'), 'utf-8'));
    Promise.all(raw.map(async team => ({
      name: team.name,
      hashedCode: await bcrypt.hash(team.code, 10)
    }))).then(hashed => {
      teams = hashed;
      console.log(`Loaded ${teams.length} team(s)`);
    });
  } catch (err) {
    console.log('No teams.json found or error reading it:', err.message);
  }
}

loadTeams();

// Get visits file path for a team
function visitsFile(teamName) {
  const safe = teamName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(__dirname, `visits_${safe}.json`);
}

// Ensure visits file exists for a team
function ensureVisitsFile(teamName) {
  const file = visitsFile(teamName);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify([]));
  }
  return file;
}

// LOGIN
app.post('/api/login', async (req, res) => {
  const { teamName, code } = req.body;

  const team = teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
  if (!team) {
    return res.status(401).json({ success: false, message: 'Team not found' });
  }

  const match = await bcrypt.compare(code, team.hashedCode);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Incorrect team code' });
  }

  res.json({ success: true, teamName: team.name });
});

// GET VISITS for a team
app.get('/api/visits/:teamName', (req, res) => {
  const file = ensureVisitsFile(req.params.teamName);
  const visits = JSON.parse(fs.readFileSync(file));
  res.json(visits);
});

// SAVE VISIT for a team
app.post('/api/visits/:teamName', (req, res) => {
  const file = ensureVisitsFile(req.params.teamName);
  const visits = JSON.parse(fs.readFileSync(file));
  visits.push(req.body);
  fs.writeFileSync(file, JSON.stringify(visits));
  res.json({ success: true });
});

// EDIT A VISIT
app.put('/api/visits/:teamName/:id', (req, res) => {
  const file = ensureVisitsFile(req.params.teamName);
  const visits = JSON.parse(fs.readFileSync(file));
  const index = visits.findIndex(v => v.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false });
  visits[index] = { ...visits[index], ...req.body };
  fs.writeFileSync(file, JSON.stringify(visits));
  res.json({ success: true });
});

// DELETE A SINGLE VISIT
app.delete('/api/visits/:teamName/:id', (req, res) => {
  const file = ensureVisitsFile(req.params.teamName);
  let visits = JSON.parse(fs.readFileSync(file));
  visits = visits.filter(v => v.id !== req.params.id);
  fs.writeFileSync(file, JSON.stringify(visits));
  res.json({ success: true });
});

// SERVE DISTRICTS GEOJSON
app.get('/api/districts', (req, res) => {
  const data = fs.readFileSync(path.join(__dirname, 'districts.geojson'), 'utf-8');
  res.json(JSON.parse(data));
});

// Serve frontend files — must be last
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});