// Core game state and constants

export const WORLD = { w: 420, h: 740 };

export const state = {
  running: false,

  // Stats
  power: 10,
  rapidLevel: 0,
  score: 0,
  best: 0,

  // Scroll / pacing
  speed: 240,
  difficulty: 1,
  distance: 0,
  spawnEvery: 1300,
  fireCooldown: 0,

  // Hold-to-fire gating
  fireHoldTimer: 0,      // seconds held since last press
  fireFirstDelay: 0.20,  // delay for the very first shot (sec)
  aimTolerance: 24,      // px distance (targetX - x) allowed to shoot

  // Player
  player: { x: WORLD.w * 0.5, y: WORLD.h * 0.86, r: 14, targetX: WORLD.w * 0.5 },

  // Entities
  walls: [],
  bullets: [],

  // Input
  controls: { dragging: false, hold: false, keys: new Set() }
};

export function initBest() {
  state.best = Number(localStorage.getItem("gate-best") || 0);
}
export function saveBest() {
  localStorage.setItem("gate-best", String(state.best));
}
export function resetState() {
  state.running = true;
  state.power = 10;
  state.rapidLevel = 0;
  state.score = 0;
  state.speed = 240;
  state.difficulty = 1;
  state.distance = 0;
  state.spawnEvery = 1300;

  state.fireCooldown = 0;
  state.fireHoldTimer = 0;

  state.player.x = WORLD.w * 0.5;
  state.player.targetX = state.player.x;

  state.walls.length = 0;
  state.bullets.length = 0;
}
