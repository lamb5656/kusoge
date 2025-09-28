export function applySlow(e, mul, dur){
if (!mul || !dur) return;
e.slowMul = Math.min(e.slowMul ?? 1, mul); // より強いスローを優先
e.slowT = Math.max(e.slowT ?? 0, dur);
}
export function applyPoison(e, dps, dur){
if (!dps || !dur) return;
e.poisonDPS = Math.max(e.poisonDPS ?? 0, dps);
e.poisonT = Math.max(e.poisonT ?? 0, dur);
}
export function tickEffects(e, dt){
if (e.slowT && e.slowT > 0){ e.slowT -= dt; if (e.slowT <= 0){ e.slowMul = 1; e.slowT = 0; } }
if (e.poisonT && e.poisonT > 0){ e.hp -= (e.poisonDPS||0) * dt; e.poisonT -= dt; if (e.poisonT <= 0){ e.poisonDPS = 0; e.poisonT = 0; } }
}