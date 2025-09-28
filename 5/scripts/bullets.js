import { bullets, enemies } from "./state.js";
import { W, H, BULLET_RADIUS_HIT } from "./consts.js";
import { dist } from "./utils.js";
import { applySlow, applyPoison } from "./effects.js";

export function fireBullet(from, target, payload){
  const dx = target.x - from.x, dy = target.y - from.y;
  const d  = Math.hypot(dx, dy) || 1;
  const sp = payload.proj?.speed || 380;
  const vx = dx / d * sp;
  const vy = dy / d * sp;

  bullets.push({
    x: from.x, y: from.y, vx, vy,
    kind:    payload.proj?.kind || "bullet", // "bullet" | "aoe"
    damage:  payload.dmg || 8,
    aoeR:    payload.proj?.aoeR || 0,
    slowMul: payload.proj?.slowMul,
    slowT:   payload.proj?.slowT,
    poisonDPS: payload.proj?.poisonDPS,
    poisonT:   payload.proj?.poisonT,
  });
}

export function updateBullets(dt, state){
  for (let i = bullets.length - 1; i >= 0; i--){
    const b = bullets[i];

    // 移動
    b.x += b.vx * dt * state.speed;
    b.y += b.vy * dt * state.speed;

    // 画面外
    if (b.x < -50 || b.x > W + 50 || b.y < -50 || b.y > H + 50){
      bullets.splice(i,1);
      continue;
    }

    // 衝突判定（最初に当たった1体）
    let hit = -1;
    for (let j = enemies.length - 1; j >= 0; j--){
      if (dist(b.x, b.y, enemies[j].x, enemies[j].y) <= BULLET_RADIUS_HIT){
        hit = j; break;
      }
    }
    if (hit !== -1){
      if (b.kind === "aoe" && b.aoeR){
        // 範囲ダメージ：半径 aoeR 以内の敵すべてに適用
        for (let k = enemies.length - 1; k >= 0; k--){
          const ek = enemies[k];
          if (dist(b.x, b.y, ek.x, ek.y) <= b.aoeR){
            ek.hp -= b.damage;
            if (b.slowMul && b.slowT)   applySlow(ek, b.slowMul, b.slowT);
            if (b.poisonDPS && b.poisonT) applyPoison(ek, b.poisonDPS, b.poisonT);
          }
        }
      } else {
        // 単体ダメージ
        const e = enemies[hit];
        e.hp -= b.damage;
        if (b.slowMul && b.slowT)     applySlow(e, b.slowMul, b.slowT);
        if (b.poisonDPS && b.poisonT) applyPoison(e, b.poisonDPS, b.poisonT);
      }

      // 弾を消す
      bullets.splice(i,1);
    }
  }
}
