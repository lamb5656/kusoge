// src/world/enemies.js
// 既存は1種スケーリングのみ → floorに応じて6タイプを循環させ、毎階層で手触りが変わるようにする。
// 署名（enemyForFloor(floor)）はそのまま維持して互換に配慮。

function shadowStrider(floor){
  const base = 56 + floor * 5.5; // 機動型
  return {
    name: `影走り Lv.${floor}`,
    maxHp: Math.floor(base), hp: Math.floor(base),
    atk: 10 + Math.floor(floor * 1.1),
    def: 4 + Math.floor(floor * 0.5),
    spd: 12 + Math.floor(floor * 0.25),
    critRate: 0.08 + Math.min(0.30, floor * 0.002),
    critMult: 1.55
  };
}

function bruteOgre(floor){
  const base = 75 + floor * 7.5; // 肉弾型
  return {
    name: `大鬼 Lv.${floor}`,
    maxHp: Math.floor(base), hp: Math.floor(base),
    atk: 12 + Math.floor(floor * 1.5),
    def: 5 + Math.floor(floor * 0.7),
    spd: 8 + Math.floor(floor * 0.15),
    critRate: 0.05 + Math.min(0.20, floor * 0.0015),
    critMult: 1.6
  };
}

function ironSentinel(floor){
  const base = 70 + floor * 6.8; // 盾役
  return {
    name: `鋼の守衛 Lv.${floor}`,
    maxHp: Math.floor(base), hp: Math.floor(base),
    atk: 10 + Math.floor(floor * 1.0),
    def: 8 + Math.floor(floor * 1.0),
    spd: 8 + Math.floor(floor * 0.15),
    critRate: 0.04 + Math.min(0.15, floor * 0.001),
    critMult: 1.5
  };
}

function nightAssassin(floor){
  const base = 58 + floor * 5.8; // クリ特化
  return {
    name: `夜刃 Lv.${floor}`,
    maxHp: Math.floor(base), hp: Math.floor(base),
    atk: 11 + Math.floor(floor * 1.2),
    def: 4 + Math.floor(floor * 0.5),
    spd: 12 + Math.floor(floor * 0.3),
    critRate: 0.12 + Math.min(0.35, floor * 0.0025),
    critMult: 1.7
  };
}

function hexWarlock(floor){
  const base = 62 + floor * 6.2; // 倍率型
  return {
    name: `呪術師 Lv.${floor}`,
    maxHp: Math.floor(base), hp: Math.floor(base),
    atk: 10 + Math.floor(floor * 1.15),
    def: 5 + Math.floor(floor * 0.6),
    spd: 10 + Math.floor(floor * 0.2),
    critRate: 0.09 + Math.min(0.28, floor * 0.002),
    critMult: 1.8
  };
}

function stoneBeast(floor){
  const base = 80 + floor * 7.2; // 重装甲
  return {
    name: `石獣 Lv.${floor}`,
    maxHp: Math.floor(base), hp: Math.floor(base),
    atk: 10 + Math.floor(floor * 1.1),
    def: 9 + Math.floor(floor * 1.1),
    spd: 7 + Math.floor(floor * 0.12),
    critRate: 0.03 + Math.min(0.12, floor * 0.001),
    critMult: 1.55
  };
}

const ARCH = [shadowStrider, bruteOgre, ironSentinel, nightAssassin, hexWarlock, stoneBeast];

export function enemyForFloor(floor){
  const f = Math.max(1, floor|0);
  const pick = ARCH[(f - 1) % ARCH.length];
  return pick(f);
}
