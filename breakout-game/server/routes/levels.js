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
  const { name, bricks, theme, userId, userName, overwrite } = req.body;
  
  const levelName = name || `Custom Level ${userLevels.levels.length + 1}`;
  
  // 查找同名关卡
  const existingLevel = userLevels.levels.find(level => level.name === levelName);
  
  if (existingLevel) {
    if (existingLevel.userId !== userId) {
      // 他人的同名关卡，拒绝覆盖
      return res.status(403).json({
        error: 'A level with this name already exists and belongs to another user. Please choose a different name.',
        existingAuthor: existingLevel.userName
      });
    }
    
    if (!overwrite) {
      // 自己的同名关卡，需确认覆盖
      return res.status(409).json({
        error: 'You already have a level with this name. Confirm overwrite?',
        existingLevel
      });
    }
    
    // 覆盖自己的关卡
    const index = userLevels.levels.findIndex(l => l.id === existingLevel.id);
    userLevels.levels[index] = {
      ...existingLevel,
      bricks,
      theme: theme || 'default',
      updatedAt: new Date().toISOString()
    };
    saveUserLevels(userLevels);
    return res.json(userLevels.levels[index]);
  }
  
  // 创建新关卡
  const newLevel = {
    id: Date.now(),
    name: levelName,
    bricks,
    theme: theme || 'default',
    userId,
    userName,
    createdAt: new Date().toISOString()
  };
  
  userLevels.levels.push(newLevel);
  saveUserLevels(userLevels);
  res.status(201).json(newLevel);
});

router.delete('/user/:id', (req, res) => {
  const { userId } = req.query;
  const userLevels = loadUserLevels();
  const initialLength = userLevels.levels.length;
  
  // 检查是否是自己的关卡
  const levelIndex = userLevels.levels.findIndex(l => l.id === parseInt(req.params.id));
  if (levelIndex === -1) {
    return res.status(404).json({ error: 'Level not found' });
  }
  
  if (userLevels.levels[levelIndex].userId !== userId) {
    return res.status(403).json({ error: 'You can only delete your own levels' });
  }
  
  userLevels.levels.splice(levelIndex, 1);
  saveUserLevels(userLevels);
  res.json({ message: 'Level deleted successfully' });
});

module.exports = router;