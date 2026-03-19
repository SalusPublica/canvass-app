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
app.use(express.static('.'));

// Where visits will be saved on the server
const VISITS_FILE = path.join(__dirname, 'visits.json');

// Create visits file if it doesn't exist
if (!fs.existsSync(VISITS_FILE)) {
  fs.writeFileSync(VISITS_FILE, JSON.stringify([]));
}

// Hash the team code once when the server starts
let hashedTeamCode;
bcrypt.hash(process.env.TEAM_CODE, 10).then(hash => {
  hashedTeamCode = hash;
  console.log('Team code hashed and ready');
});

// LOGIN — check if the submitted code matches the team code
app.post('/api/login', async (req, res) => {
  const { code } = req.body;
  const match = await bcrypt.compare(code, hashedTeamCode);
  if (match) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Incorrect team code' });
  }
});

// GET VISITS — return all saved visits
app.get('/api/visits', (req, res) => {
  const visits = JSON.parse(fs.readFileSync(VISITS_FILE));
  res.json(visits);
});

// SAVE VISIT — add a new visit to the list
app.post('/api/visits', (req, res) => {
  const visits = JSON.parse(fs.readFileSync(VISITS_FILE));
  const visit = req.body;
  visits.push(visit);
  fs.writeFileSync(VISITS_FILE, JSON.stringify(visits));
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});