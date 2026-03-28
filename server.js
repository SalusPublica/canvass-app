const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');

dotenv.config();

const app = express();

// Sets secure HTTP headers
app.use(helmet({
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
     imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://tile.openstreetmap.org"],
      connectSrc: ["'self'", "https://nominatim.openstreetmap.org"],
    }
  }
}));

const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 15 minutes
  max: 10,                   // maximum 10 attempts per 15 minutes per IP
  message: { success: false, message: 'Too many login attempts. Please try again in 30 minutes.' },
  standardHeaders: true,     // sends rate limit info in response headers
  legacyHeaders: false,      // disables older X-RateLimit headers
});

// Only allow requests from our own frontend
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow if origin matches our allowed origin
    if (origin === process.env.ALLOWED_ORIGIN) {
      return callback(null, true);
    }
    // Block everything else
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

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

// Check validation results and return error if any rules failed
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Invalid input', errors: errors.array() });
  }
  return null;
}

// Get visits file path for a team
function visitsFile(teamName) {
  // Remove any character that isn't a letter, number, hyphen or underscore
  const safe = teamName.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Build the full file path
  const filePath = path.join(__dirname, `visits_${safe}.json`);

  // Verify the path stays inside the app directory
  // If someone tried ../../etc/passwd it would resolve outside __dirname
  if (!filePath.startsWith(__dirname)) {
    throw new Error('Invalid team name');
  }

  return filePath;
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
app.post('/api/login', loginLimiter, [
  // teamName must be a string between 1 and 100 characters
  body('teamName').isString().trim().isLength({ min: 1, max: 100 }),
  // code must be a string between 1 and 200 characters
  body('code').isString().isLength({ min: 1, max: 200 })
], async (req, res) => {
  const error = validate(req, res);
  if (error) return;

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
app.get('/api/visits/:teamName', [
  param('teamName').isString().trim().isLength({ min: 1, max: 100 })
], (req, res) => {
  const error = validate(req, res);
  if (error) return;

  const file = ensureVisitsFile(req.params.teamName);
  const visits = JSON.parse(fs.readFileSync(file));
  res.json(visits);
});

// SAVE VISIT for a team
app.post('/api/visits/:teamName', [
  param('teamName').isString().trim().isLength({ min: 1, max: 100 }),
  body('address').isString().trim().isLength({ min: 1, max: 500 }),
  body('date').isISO8601(),  // must be a valid date like 2024-03-28
  body('visitType').isIn(['knock', 'leaflet']),  // must be one of these two values
  body('answered').isIn(['yes', 'no', 'n/a']),  // must be one of these three values
  body('lat').optional().isFloat({ min: -90, max: 90 }),   // valid latitude
  body('lon').optional().isFloat({ min: -180, max: 180 })  // valid longitude
], (req, res) => {
  const error = validate(req, res);
  if (error) return;

  const file = ensureVisitsFile(req.params.teamName);
  const visits = JSON.parse(fs.readFileSync(file));
  visits.push(req.body);
  fs.writeFileSync(file, JSON.stringify(visits));
  res.json({ success: true });
});

// EDIT A VISIT
app.put('/api/visits/:teamName/:id', [
  param('teamName').isString().trim().isLength({ min: 1, max: 100 }),
  param('id').isString().trim().isLength({ min: 1, max: 50 }),
  body('date').isISO8601(),
  body('visitType').isIn(['knock', 'leaflet']),
  body('answered').isIn(['yes', 'no', 'n/a'])
], (req, res) => {
  const error = validate(req, res);
  if (error) return;

  const file = ensureVisitsFile(req.params.teamName);
  const visits = JSON.parse(fs.readFileSync(file));
  const index = visits.findIndex(v => v.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false });
  visits[index] = { ...visits[index], ...req.body };
  fs.writeFileSync(file, JSON.stringify(visits));
  res.json({ success: true });
});

// DELETE A SINGLE VISIT
app.delete('/api/visits/:teamName/:id', [
  param('teamName').isString().trim().isLength({ min: 1, max: 100 }),
  param('id').isString().trim().isLength({ min: 1, max: 50 })
], (req, res) => {
  const error = validate(req, res);
  if (error) return;

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