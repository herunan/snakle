# Snakle 🐍

A daily snake game with procedurally generated mazes. Everyone plays the same level each day!

## 🎮 Play Now

[**Play Snakle →**](https://snakle.surge.sh)

## ✨ Features

- **Daily Levels**: Unique maze layout every day, generated deterministically so everyone gets the same puzzle
- **Classic Mechanics**: Traditional snake gameplay with fruit collection and growth
- **Wall Wrapping**: Hit the boundary and appear on the opposite side
- **Smart Generation**: Levels are guaranteed to be solvable with connectivity checks
- **Mobile Friendly**: Swipe controls for touch devices, arrow keys for desktop
- **Share Results**: Copy your score and stats to share with friends

## 🎯 How to Play

1. Click **PLAY** to start
2. Wait for the 3-second countdown
3. Control the snake:
   - **Desktop**: Arrow keys
   - **Mobile**: Swipe in any direction
4. Collect all fruits without hitting yourself or internal walls
5. Share your results!

## 🏗️ Tech Stack

- **React** + **TypeScript**
- **Vite** - Fast build tooling
- **Tailwind CSS** v4 - Styling
- **Seeded RNG** - Deterministic daily levels

## 🚀 Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Deploy to Surge
npx surge ./dist --domain snakle.surge.sh
```

## 🎲 Level Generation

Levels are generated using a seeded random number generator based on the current date. Four pattern types:

- **Scattered Blocks**: Random obstacles
- **Lines**: Vertical/horizontal corridors
- **Box/Donut**: Enclosed areas with gaps
- **Spiral**: Winding maze patterns

Each level passes a connectivity check to ensure all areas are reachable.

## 📊 Scoring

Your daily score is based on:
- 🍎 **Fruits collected**
- 💀 **Lives used** (deaths)

## 📝 License

MIT

---

Made with 💚 by [Your Name]
