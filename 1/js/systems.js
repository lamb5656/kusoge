// Update: movement, firing gates, bullet-wall interactions, scoring
import { WORLD, state } from "./state.js";
import { clamp } from "./math.js";
import { maybeSpawnRow } from "./spawn.js";

export function update(dt) {
  // Forward scroll and difficulty
  state.distance += state.speed * dt;
  if (state.distance > 1500) state.difficulty = 1.5;
  if (state.distance > 3500) state.difficulty = 2.2;
  if (state.distance > 6000) state.difficulty = 3.0;
  state.speed = 240 + state.difficulty * 40;

  // Spawning and scrolling
  maybeSpawnRow();
  const dy = state.speed * dt;
  for (const w of state.walls) w.y += dy;

  // Lateral control
  const p = state.player;
  if (state.controls.keys.has("left")) p.targetX -= 220 * dt;
  if (state.controls.keys.has("right")) p.targetX += 220 * dt;
  p.targetX = clamp(p.targetX, 20, WORLD.w - 20);
  p.x += (p.targetX - p.x) * Math.min(1, 9 * dt);

  // Hold-to-fire gating: first delay + aim settle
  state.fireCooldown -= dt;
  if (state.controls.hold) state.fireHoldTimer += dt; else state.fireHoldTimer = 0;

  const aimSettled = Math.abs(p.targetX - p.x) <= state.aimTolerance;
  const fireRate = effectiveFireRate(); // shots/sec
  const canShootNow =
    state.controls.hold &&
    state.fireHoldTimer >= state.fireFirstDelay &&
    aimSettled &&
    state.power > 0 &&
    state.fireCooldown <= 0;

  if (canShootNow) {
    shoot();
    state.fireCooldown = 1 / fireRate;
  }

  // Move bullets
  for (const b of state.bullets) b.y -= b.vy * dt;

  // Bullet vs wall (lane check)
  for (const w of state.walls) {
    if (w.broken) continue;
    const bandTop = w.y - 18;
    const bandBot = w.y + 18;
    const isLeft = w.side === "L";
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      const bLeft = b.x < WORLD.w * 0.5;
      if (bLeft !== isLeft) continue;
      if (b.y > bandTop && b.y < bandBot) {
        w.hp -= b.dmg;
        state.bullets.splice(i, 1);
        if (w.hp <= 0) {
          onWallDestroyed(w);
          break;
        }
      }
    }
  }

  // Player collision in current lane
  for (const w of state.walls) {
    if (w.broken) continue;
    const playerLeft = state.player.x < WORLD.w * 0.5;
    if ((w.side === "L") !== playerLeft) continue;
    const bandTop = w.y - 18;
    const bandBot = w.y + 18;
    if (state.player.y > bandTop && state.player.y < bandBot) {
      return false; // game over
    }
  }

  // Cleanup
  while (state.walls.length && state.walls[0].y > WORLD.h + 60) state.walls.shift();
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    if (state.bullets[i].y < -40) state.bullets.splice(i, 1);
  }
  return true;
}

function effectiveFireRate() {
  const base = 2; // base shots/sec
  const mult = clamp(1 + 0.25 * state.rapidLevel, 0.25, 4);
  return base * mult;
}

function shoot() {
  const dmg = Math.max(0, Math.floor(state.power));
  if (dmg <= 0) return;
  state.bullets.push({ x: state.player.x, y: state.player.y - 16, vy: 600, dmg });
}

function onWallDestroyed(w) {
  w.broken = true;
  state.score += 10 + w.max;
  if (w.type === "plus") state.power = clamp(state.power + (w.amount || 0), 0, 999999);
  else if (w.type === "minus") state.power = clamp(state.power - (w.amount || 0), 0, 999999);
  else if (w.type === "rapidPlus") state.rapidLevel = clamp(state.rapidLevel + (w.amount || 1), -10, 20);
  else if (w.type === "rapidMinus") state.rapidLevel = clamp(state.rapidLevel - (w.amount || 1), -10, 20);
}
