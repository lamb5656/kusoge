import { towers, enemies, state as globalState } from "./state.js";
import { TOWERS } from "./towers_def.js";
import { getTowerStats, upgradeCost } from "./upgrades.js";
import { SELL_REFUND_RATE, TILE } from "./consts.js";
import { worldToCell, cellToWorld, inPath } from "./utils.js";
import { fireBullet } from "./bullets.js";

export function canPlaceAtCell(cx, cy, cols, rows){
  if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return false;
  const wy = cy * TILE + TILE/2;
  if (inPath(wy)) return false;
  return !towers.some(t => { const tc = worldToCell(t.x, t.y); return tc.cx === cx && tc.cy === cy; });
}

export function addTowerAtCell(cx, cy, typeId, st){
  const def = TOWERS[typeId]; if (!def) return false;
  if (st.gold < def.cost) return false;
  const { x, y } = cellToWorld(cx, cy);
  const lv = (st.tech?.[typeId] ?? 1);
  towers.push({ x, y, typeId, level: lv, last: 0, costSpent: def.cost });
  st.gold -= def.cost;
  return true;
}

export function sellTower(idx, st){
  const t = towers[idx]; if (!t) return 0;
  const refund = Math.round((t.costSpent || TOWERS[t.typeId].cost) * SELL_REFUND_RATE);
  st.gold += refund; towers.splice(idx,1); st.selectedTowerIndex = -1;
  return refund;
}

// ★ タイプ一括アップグレード（ショップから呼ぶ）
export function upgradeType(typeId, st){
  const def = TOWERS[typeId]; if (!def) return { ok:false, reason:"type" };
  const curLv = (st.tech?.[typeId] ?? 1);
  const cost  = upgradeCost(def.cost, curLv);
  if ((st.gold|0) < cost) return { ok:false, reason:"gold", cost };

  st.gold -= cost;
  const newLv = curLv + 1;
  st.tech[typeId] = newLv;

  // 既存タワーへ反映 & 返金計算に反映（按分）
  const list = towers.filter(t => t.typeId === typeId);
  if (list.length){
    const add = Math.round(cost / list.length);
    for (const t of list){ t.level = newLv; t.costSpent = (t.costSpent || def.cost) + add; }
  }
  return { ok:true, cost, newLevel: newLv, count: list.length };
}

export function updateTowers(dt, st){
  for (const t of towers){
    t.last -= dt * st.speed; if (t.last > 0) continue;
    const lv = st.tech?.[t.typeId] ?? t.level ?? 1;
    const S = getTowerStats(t.typeId, lv);
    let target = null, best = 1e9;
    for (const e of enemies){
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (d <= S.range && d < best){ best = d; target = e; }
    }
    if (target){ fireBullet(t, target, { dmg:S.dmg, proj:S.proj }); t.last = S.cd; }
  }
}

export function getTowerInfo(idx, st = globalState){
  const t = towers[idx]; if (!t) return null;
  const lv = st.tech?.[t.typeId] ?? t.level ?? 1;
  const S = getTowerStats(t.typeId, lv);
  const dps = Math.round(S.dmg / S.cd);
  return { typeId: t.typeId, lvl: lv, range: S.range, dps };
}

export function findTowerAt(x, y){
  let idx = -1, best = 9999;
  for (let i=0;i<towers.length;i++){
    const d = Math.hypot(x - towers[i].x, y - towers[i].y);
    if (d < best){ best = d; idx = i; }
  }
  return (idx !== -1 && best <= TILE*0.8) ? idx : -1;
}
