// ウェーブ設定：HP緩和 & 5の倍数でボス
export function waveConfig(n){
const w = Math.max(1, n);
const base = {
count: 8 + Math.floor(w * 1.5),
hp: 18 + w * 10,
speed: 60 + w * 4,
spawnInterval: Math.max(0.30, 1.0 - w * 0.1)
};
const boss = (w % 5 === 0) ? { hp: Math.round(base.hp * 8), speed: Math.max(70, base.speed - 10) } : null;
return { base, boss };
}