import { TOWERS } from "./towers_def.js";

// 与ダメ倍率: Lv1=1.00, 以降 +18%/Lv
const dmgMult = (lv)=> 1 + 0.18 * (Math.max(1, lv)-1);
// 射程: +10%/Lv
const rangeFor = (base, lv)=> Math.round(base * (1 + 0.10 * (Math.max(1, lv)-1)));

// コスト: Lv1→2 = +60%、以降逓増（0.6 + 0.25*(Lv-1)）倍
export function upgradeCost(baseCost, level){
  const lv = Math.max(1, level);
  const mult = 0.6 + 0.25 * (lv - 1);
  return Math.round(baseCost * mult);
}

// lv は “タイプレベル” を渡す
export function getTowerStats(typeId, level){
  const t = TOWERS[typeId];
  const lv = Math.max(1, level);
  return { range: rangeFor(t.baseRange, lv), dmg: Math.round(t.dmg * dmgMult(lv)), cd: t.cd, proj: t.proj };
}

// いつでもアップグレード可（タイプ単位）
export function canUpgrade(){ return true; }
