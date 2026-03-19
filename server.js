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

// Hash the team code once when the server starts
let hashedTeamCode;
bcrypt.hash(process.env.TEAM_CODE, 10).then(hash => {
  hashedTeamCode = hash;
  console.log('Team code hashed and ready');
});

// Where visits will be saved on the server
const VISITS_FILE = path.join(__dirname, 'visits.json');

// Create visits file if it doesn't exist
if (!fs.existsSync(VISITS_FILE)) {
  fs.writeFileSync(VISITS_FILE, JSON.stringify([]));
}

// LOGIN
app.post('/api/login', async (req, res) => {
  const { code } = req.body;
  const match = await bcrypt.compare(code, hashedTeamCode);
  if (match) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Incorrect team code' });
  }
});

// GET VISITS
app.get('/api/visits', (req, res) => {
  const visits = JSON.parse(fs.readFileSync(VISITS_FILE));
  res.json(visits);
});

// SAVE VISIT
app.post('/api/visits', (req, res) => {
  const visits = JSON.parse(fs.readFileSync(VISITS_FILE));
  const visit = req.body;
  visits.push(visit);
  fs.writeFileSync(VISITS_FILE, JSON.stringify(visits));
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