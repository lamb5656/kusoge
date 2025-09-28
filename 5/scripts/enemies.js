// scripts/enemies.js
import { enemies } from "./state.js";
import { pathWaypoints } from "./path.js";
import { tickEffects } from "./effects.js";

export function spawnEnemy(hp, speedPx, state){
  enemies.push({
    x: pathWaypoints[0].x, y: pathWaypoints[0].y,
    hp, maxHp: hp,                // ★ 追加：最大HPを保存
    speed: speedPx, idx: 0,
    slowMul:1, slowT:0, poisonDPS:0, poisonT:0
  });
  state.enemiesAlive++;
}

export function updateEnemies(dt, state){
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];

    // ステータス効果更新
    tickEffects(e, dt);

    const target = pathWaypoints[e.idx + 1];
    if (!target){
      enemies.splice(i,1);
      state.enemiesAlive--;
      state.lives--;
      if (state.lives <= 0){ state.isGameOver = true; }
      continue;
    }

    const dx = target.x - e.x, dy = target.y - e.y;
    const d  = Math.hypot(dx,dy) || 1;
    const step = e.speed * (e.slowMul || 1) * dt * state.speed;
    if (d <= step){ e.x = target.x; e.y = target.y; e.idx++; }
    else { e.x += dx / d * step; e.y += dy / d * step; }

    // 死亡判定（毒含む）
    if (e.hp <= 0){
      enemies.splice(i,1);
      state.enemiesAlive--;
      state.gold += 10;
    }
  }
}
