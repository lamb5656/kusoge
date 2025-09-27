// Bootstrap, loop, HUD, resize, overlay
import { state, WORLD, initBest, saveBest, resetState } from "./state.js";
import { attachInput } from "./input.js";
import { spawnInitial } from "./spawn.js";
import { update } from "./systems.js";
import { draw } from "./render.js";

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hudPower = document.getElementById("power");
const hudRapid = document.getElementById("rapid");
const hudScore = document.getElementById("score");
const hudBest = document.getElementById("best");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");

let lastTime = 0;
let accTime = 0;

initBest();
hudBest.textContent = `Best: ${state.best}`;
attachInput(canvas);
resize();
window.addEventListener("resize", resize, { passive: true });

startBtn.addEventListener("click", startGame);

function startGame() {
  resetState();
  spawnInitial();
  overlay.classList.remove("show");
  hudBest.textContent = `Best: ${state.best}`;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  accTime += dt;

  const alive = update(dt);
  draw(ctx, canvas, accTime);
  updateHUD();

  if (!alive) {
    state.running = false;
    state.best = Math.max(state.best, Math.floor(state.score));
    saveBest();
    showGameOver();
    return;
  }
  requestAnimationFrame(loop);
}

function updateHUD() {
  hudPower.textContent = `Power: ${Math.max(0, Math.floor(state.power))}`;
  hudRapid.textContent = `Rapid Lv: ${state.rapidLevel}`;
  hudScore.textContent = `Score: ${Math.floor(state.score)}`;
  hudBest.textContent = `Best: ${state.best}`;
}

function showGameOver() {
  overlay.classList.add("show");
  overlay.querySelector("h1").textContent = "Game Over";
  overlay.querySelector("p").innerHTML =
    `Score: <b>${Math.floor(state.score)}</b> &nbsp; • &nbsp; Best: <b>${state.best}</b><br>
     Hold to shoot. Avoid the wrong lane!`;
  startBtn.textContent = "Restart";
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
