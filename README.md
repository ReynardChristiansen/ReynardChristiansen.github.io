# 🐍 Hyper Snake

A modern, neon-themed remake of the classic Snake game — built with **vanilla
HTML, CSS, and JavaScript** (zero dependencies). Smooth, responsive,
touch-friendly, and crisp on retina displays.

<p align="center">
  <img src="assets/hyper-snake.gif" alt="Hyper Snake gameplay" width="440">
</p>

<p align="center">
  <a href="assets/hyper-snake.mp4">▶ Watch the MP4</a> ·
  <a href="https://reynardchristiansen.github.io/">🎮 Play it live</a>
</p>

## ✨ Features

- **Buttery-smooth motion** — the snake glides between cells via
  `requestAnimationFrame` interpolation, while game logic stays on a fixed grid.
- **Retro D-pad on mobile** — a raised, engraved cross-pad; plus swipe controls
  on the board.
- **Synthesized sound** — eat, turn, game-over, and win effects generated with
  the Web Audio API (no audio files). Toggle mute any time — your choice is saved.
- **High score** — your best run is stored locally and persists between sessions;
  beating it is highlighted on the game-over screen.
- **Steady pace** — a constant, predictable speed (150 ms per step) — no
  ramp-up, so the challenge comes from your length, not from panic.
- **Modern UI** — glassmorphism, subtle neon accents, and an animated background.
- **Crisp rendering** — device-pixel-ratio aware canvas for sharp visuals.
- **Fully responsive** — one layout that adapts from desktop to phone.

## 🎮 Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Move   | `↑ ↓ ← →` or `W A S D` | Retro D-pad or swipe |
| Pause / Resume | `Space` | — |
| Start / Restart | **Play / Play Again** button | tap **Play / Play Again** |

## 🎯 Objective

Eat the glowing food to grow longer. Avoid the walls and your own body.
Fill the entire **15 × 15** board (225 cells) to win!

## ▶️ How to Play

Play online: **https://reynardchristiansen.github.io/**

Or run locally — just open `index.html` in any modern browser.

## 🛠️ Built With

- Vanilla JavaScript (canvas rendering + fixed-timestep game loop)
- CSS (glassmorphism, responsive layout, retro D-pad)
- Web Audio API for sound
- `localStorage` for the high score

## 💬 Feedback

Reach out at reynard.satria@gmail.com

---

© 2026 Reynard Christiansen · Hyper Snake
