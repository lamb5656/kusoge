/* Shared definitions & utilities (no DOM) */

export const fmt = new Intl.NumberFormat("ja-JP");
export const KEY = "clicker_pages_v3"; // bump key to avoid old caches (still migrates)

/* Upgrade base costs (safe defaults) */
export const defaultCosts = {
  clickPower: 10,
  crit: 200,
  critMult: 400,
  gold: 800,
  research: 1500,
  offlineCap: 1000,
  fever: 500
};

/* Workers x18 (progression tuned for idle growth) */
export const workerDefs = [
  { id: "w1",  name: "子猫",       perSec: 1,           baseCost: 50,        growth: 1.15 },
  { id: "w2",  name: "黒猫",       perSec: 5,           baseCost: 250,       growth: 1.15 },
  { id: "w3",  name: "猫又",       perSec: 20,          baseCost: 1_200,     growth: 1.16 },
  { id: "w4",  name: "茶屋",       perSec: 75,          baseCost: 6_000,     growth: 1.17 },
  { id: "w5",  name: "神社",       perSec: 250,         baseCost: 25_000,    growth: 1.18 },
  { id: "w6",  name: "月の塔",     perSec: 1_000,       baseCost: 120_000,   growth: 1.20 },
  { id: "w7",  name: "霊猫隊",     perSec: 3_500,       baseCost: 550_000,   growth: 1.20 },
  { id: "w8",  name: "星見台",     perSec: 12_000,      baseCost: 2_200_000, growth: 1.20 },
  { id: "w9",  name: "影絵工房",   perSec: 40_000,      baseCost: 9_500_000, growth: 1.21 },
  { id: "w10", name: "妖怪市",     perSec: 120_000,     baseCost: 35_000_000, growth: 1.22 },
  { id: "w11", name: "花街座",     perSec: 400_000,     baseCost: 120_000_000, growth: 1.22 },
  { id: "w12", name: "竹林工房",   perSec: 1_200_000,   baseCost: 400_000_000, growth: 1.23 },
  { id: "w13", name: "仙猫庵",     perSec: 3_500_000,   baseCost: 1_400_000_000, growth: 1.23 },
  { id: "w14", name: "祈祷所",     perSec: 11_000_000,  baseCost: 5_000_000_000, growth: 1.24 },
  { id: "w15", name: "天球儀",     perSec: 35_000_000,  baseCost: 17_000_000_000, growth: 1.24 },
  { id: "w16", name: "月都工場",   perSec: 120_000_000, baseCost: 60_000_000_000, growth: 1.25 },
  { id: "w17", name: "銀河航路",   perSec: 400_000_000, baseCost: 210_000_000_000, growth: 1.25 },
  { id: "w18", name: "星海大聖堂", perSec: 1_500_000_000, baseCost: 800_000_000_000, growth: 1.26 }
];

/* Upgrades & Specials meta for shop build */
export const upgradeDefs = [
  { id: "clickPower", name: "パワーアップ",     desc: "1クリックの獲得量を+1します。",          key:"clickPower" },
  { id: "crit",       name: "クリティカル率",   desc: "クリティカル（×10）の発生確率を+1%。",  key:"crit" },
  { id: "critMult",   name: "クリティカル倍率", desc: "クリティカル倍率を+1（最大×50）。",     key:"critMult" },
  { id: "gold",       name: "ゴールデン率",     desc: "ゴールデン（×100）の発生確率を+0.05%。", key:"gold" },
  { id: "research",   name: "効率研究",         desc: "全ワーカーの毎秒効率を+5%。",            key:"research" },
  { id: "offlineCap", name: "オフライン上限",   desc: "オフライン回収の上限を+10分。",          key:"offlineCap" }
];
export const specialsDefs = [
  { id: "fever", name: "フィーバー（30秒×2）", desc: "30秒間の獲得が×2。購入で即時発動。", key:"fever" }
];

/* Prestige (permanent multiplier) */
export const PRESTIGE_NAME = "月光石";
export const PRESTIGE_RATE = 0.01; // +1% per shard
export const PRESTIGE_BASE = 250_000; // lifetime earned needed for 1 shard (sqrt curve)
export function totalShardsFromLifetime(lifetime) {
  // floor( sqrt(lifetime / PRESTIGE_BASE) )
  if (!Number.isFinite(lifetime) || lifetime <= 0) return 0;
  return Math.floor(Math.sqrt(lifetime / PRESTIGE_BASE));
}

/* Fresh default state */
export function makeDefaultState() {
  return {
    points: 0,
    lifetimeEarned: 0,     // cumulative points ever earned (for prestige)
    perClickBase: 1,
    clickLevel: 1,

    critChance: 0.01,
    critMultiplier: 10,
    goldenChance: 0.001,
    goldenMultiplier: 100,

    researchLvl: 0,
    offlineCapMins: 10,

    feverActiveUntil: 0,
    feverMultiplier: 2,

    prestigeShards: 0,
    prestigeRate: PRESTIGE_RATE,

    workers: Object.fromEntries(workerDefs.map(w => [w.id, 0])),

    costs: { ...defaultCosts },

    lastTick: Date.now(),
    lastSaved: Date.now(),
    totalClicks: 0,
    achievements: {}
  };
}

/* Math utils */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const clampInt = (v, min, max) => Math.floor(clamp(v, min, max));

/* Costs & production */
export function workerCost(def, count) {
  return Math.ceil(def.baseCost * Math.pow(def.growth, count));
}
export function feverActive(state) {
  return Date.now() < (state.feverActiveUntil || 0);
}
export function prestigeMultiplier(state) {
  const rate = Number(state.prestigeRate || PRESTIGE_RATE);
  const shards = Number(state.prestigeShards || 0);
  return 1 + rate * shards;
}
export function perClick(state) {
  let v = state.perClickBase * prestigeMultiplier(state);
  if (feverActive(state)) v *= state.feverMultiplier;
  return v;
}
export function perSecBase(state) {
  return workerDefs.reduce((sum, d) => sum + (state.workers[d.id] || 0) * d.perSec, 0);
}
export function perSec(state) {
  let v = perSecBase(state) * (1 + (state.researchLvl || 0) * 0.05);
  v *= prestigeMultiplier(state);
  if (feverActive(state)) v *= state.feverMultiplier;
  return v;
}
