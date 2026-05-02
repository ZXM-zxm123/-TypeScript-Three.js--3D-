# 3D Breakout Game

A 3D breakout game built with Three.js, WebAssembly physics, and Node.js.

## Project Structure

```
breakout-game/
├── cpp/
│   ├── physics.cpp          # C++ physics engine
│   └── build.bat            # Emscripten build script
├── public/
│   ├── index.html           # Main HTML file
│   └── game.js              # Compiled JavaScript
├── server/
│   ├── index.js             # Node.js server
│   ├── routes/
│   │   └── levels.js        # REST API routes
│   └── data/
│       ├── levels.json      # Built-in levels
│       └── user_levels.json # User-created levels
├── src/
│   ├── game.ts              # TypeScript source
│   ├── index.html           # HTML template
│   └── tsconfig.json        # TypeScript config
└── package.json             # Dependencies
```

## Quick Start

### 1. Install Dependencies

```bash
cd breakout-game
npm install
```

### 2. Build WebAssembly (Optional - falls back to JS if not available)

Install Emscripten SDK from https://emscripten.org/docs/getting_started/downloads.html

```bash
cd cpp
build.bat
```

### 3. Start Server

```bash
cd server
node index.js
```

### 4. Open Game

Navigate to http://localhost:3000

## Controls

- **Arrow Keys / A,D**: Move paddle
- **Space**: Launch ball
- **ESC**: Pause
- **Mouse**: Move paddle

## Features

- 3D rendering with Three.js
- Physics via WebAssembly (C++) or JavaScript fallback
- 5 built-in levels with different themes
- Level editor for custom levels
- Power-ups: extend paddle, multi-ball, slow motion
- High score tracking (localStorage)
- Theme switching (Default, Neon, Cyberpunk, Retro, Space)

## REST API

### Get All Levels
```
GET /api/levels
```

### Get Single Level
```
GET /api/levels/:id
```

### Save Custom Level
```
POST /api/levels/user
Body: { "name": "Level Name", "bricks": [...] }
```

### Delete Custom Level
```
DELETE /api/levels/user/:id
```

## Themes

- **Default**: Classic blue/purple
- **Neon**: Cyan/Magenta/Green glow
- **Cyberpunk**: Purple/Cyan/Yellow
- **Retro**: Orange/Purple
- **Space**: Dark blue/Red accents

## Building TypeScript (Optional)

```bash
cd src
npx tsc
```

This compiles `game.ts` to `game.js` in the public folder.