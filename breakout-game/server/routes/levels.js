const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const LEVELS_FILE = path.join(__dirname, '../data/levels.json');
const USER_LEVELS_FILE = path.join(__dirname, '../data/user_levels.json');

function loadLevels() {
  try {
    const data = fs.readFileSync(LEVELS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { levels: [] };
  }
}

function loadUserLevels() {
  try {
    const data = fs.readFileSync(USER_LEVELS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { levels: [] };
  }
}

function saveUserLevels(data) {
  fs.writeFileSync(USER_LEVELS_FILE, JSON.stringify(data, null, 2));
}

router.get('/', (req, res) => {
  const levels = loadLevels();
  const userLevels = loadUserLevels();
  res.json({
    preset: levels.levels,
    userCreated: userLevels.levels
  });
});

router.get('/:id', (req, res) => {
  const levels = loadLevels();
  const userLevels = loadUserLevels();
  const allLevels = [...levels.levels, ...userLevels.levels];
  const level = allLevels.find(l => l.id === parseInt(req.params.id));
  
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }
  res.json(level);
});

router.post('/user', (req, res) => {
  const userLevels = loadUserLevels();
  const newLevel = {
    id: Date.now(),
    name: req.body.name || `Custom Level ${userLevels.levels.length + 1}`,
    bricks: req.body.bricks,
    theme: req.body.theme || 'default',
    createdAt: new Date().toISOString()
  };
  
  userLevels.levels.push(newLevel);
  saveUserLevels(userLevels);
  res.status(201).json(newLevel);
});

router.delete('/user/:id', (req, res) => {
  const userLevels = loadUserLevels();
  const initialLength = userLevels.levels.length;
  userLevels.levels = userLevels.levels.filter(l => l.id !== parseInt(req.params.id));
  
  if (userLevels.levels.length === initialLength) {
    return res.status(404).json({ error: 'Level not found' });
  }
  
  saveUserLevels(userLevels);
  res.json({ message: 'Level deleted successfully' });
});

module.exports = router;