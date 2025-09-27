/* Persistence & normalization */

import {
  KEY, defaultCosts, workerDefs, makeDefaultState, perSecBase,
  PRESTIGE_RATE, upgradeDefs
} from "./defs.js";

/* Ensure defaults & numeric sanity (incl. prestige & autobuy) */
export function normalizeState(state) {
  const base = makeDefaultState();
  const S = { ...base, ...state };

  // costs
  S.costs = { ...defaultCosts, ...(state?.costs || {}) };

  // workers
  if (!S.workers) S.workers = {};
  for (const w of workerDefs) {
    const v = Number(S.workers[w.id]);
    S.workers[w.id] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  }

  // autoBuy flags
  const defaultAutoUp = Object.fromEntries(upgradeDefs.map(u => [u.id, false]));
  const defaultAutoWk = Object.fromEntries(workerDefs.map(w => [w.id, false]));
  S.autoBuy = {
    upgrades: { ...defaultAutoUp, ...(state?.autoBuy?.upgrades || {}) },
    workers:  { ...defaultAutoWk, ...(state?.autoBuy?.workers  || {}) }
  };
  // coerce to booleans
  for (const k of Object.keys(S.autoBuy.upgrades)) {
    S.autoBuy.upgrades[k] = !!S.autoBuy.upgrades[k];
  }
  for (const k of Object.keys(S.autoBuy.workers)) {
    S.autoBuy.workers[k] = !!S.autoBuy.workers[k];
  }

  // numerics
  S.points           = Math.max(0, Number(S.points) || 0);
  S.lifetimeEarned   = Math.max(0, Number(S.lifetimeEarned) || 0);
  S.perClickBase     = Math.max(1, Number(S.perClickBase) || 1);
  S.clickLevel       = Math.max(1, Number(S.clickLevel) || 1);
  S.critChance       = Math.max(0, Math.min(0.9, Number(S.critChance) || 0.01));
  S.critMultiplier   = Math.max(1, Math.min(50, Number(S.critMultiplier) || 10));
  S.goldenChance     = Math.max(0, Number(S.goldenChance) || 0.001);
  S.goldenMultiplier = Math.max(10, Math.min(1000, Number(S.goldenMultiplier) || 100));
  S.researchLvl      = Math.max(0, Number(S.researchLvl) || 0);
  S.offlineCapMins   = Math.max(0, Number(S.offlineCapMins) || 10);
  S.feverMultiplier  = Math.max(1, Number(S.feverMultiplier) || 2);
  S.prestigeShards   = Math.max(0, Number(S.prestigeShards) || 0);
  S.prestigeRate     = Number.isFinite(Number(S.prestigeRate)) ? Number(S.prestigeRate) : PRESTIGE_RATE;

  // costs numeric guard
  for (const k of Object.keys(defaultCosts)) {
    const v = Number(S.costs[k]);
    S.costs[k] = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : defaultCosts[k];
  }

  S.lastTick = Date.now();
  return S;
}

/* Older migrations (optional) */
export function migrateOlder(S) {
  try {
    for (const key of ["clicker_pages_v1", "clicker_pages_v2"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const old = JSON.parse(raw);
      S = normalizeState({ ...S, ...old });
      if (typeof old.autoCount === "number" && old.autoCount > 0) {
        S.workers.w1 += old.autoCount;
      }
      localStorage.removeItem(key);
    }
    return S;
  } catch {
    return S;
  }
}

/* Offline gains */
function applyOfflineGains(S, lastSaved) {
  const idleSec = Math.min(
    Math.max(0, Math.floor((Date.now() - (lastSaved || Date.now())) / 1000)),
    (S.offlineCapMins || 0) * 60
  );
  if (idleSec <= 0) return { S, gained: 0 };
  const base = perSecBase(S) * (1 + (S.researchLvl || 0) * 0.05);
  const gain = base * idleSec;
  S.points += gain;
  S.lifetimeEarned += gain;
  return { S, gained: Math.floor(gain) };
}

export function saveState(S, { manual = false, toast } = {}) {
  try {
    S.lastSaved = Date.now();
    localStorage.setItem(KEY, JSON.stringify(S));
    if (manual && toast) toast("+ 保存しました");
  } catch (e) {
    console.error(e);
    if (manual) alert("保存に失敗しました。容量やプライベートモードをご確認ください。");
  }
}

export function loadState({ manual = false, toast } = {}) {
  let S = makeDefaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      S = migrateOlder(S);
      if (manual) alert("保存データがありません。");
      return { S, offlineGained: 0 };
    }
    const obj = JSON.parse(raw);
    S = normalizeState({ ...S, ...obj });
    const { S: S2, gained } = applyOfflineGains(S, obj.lastSaved);
    S = S2;
    if (manual && toast) toast("+ 読み込みました");
    return { S, offlineGained: gained };
  } catch (e) {
    console.error(e);
    if (manual) alert("読み込みに失敗しました。");
    return { S, offlineGained: 0 };
  }
}

export function exportData(S, { toast } = {}) {
  try {
    const raw = JSON.stringify(S);
    const b64 = btoa(unescape(encodeURIComponent(raw)));
    navigator.clipboard.writeText(b64)
      .then(() => { if (toast) toast("+ クリップボードへエクスポートしました"); })
      .catch(() => { prompt("以下の文字列をコピーしてください：", b64); });
  } catch (e) {
    console.error(e);
    alert("エクスポートに失敗しました。");
  }
}

export function importDataPrompt({ toast } = {}) {
  const b64 = prompt("エクスポート文字列を貼り付けてください：");
  if (!b64) return null;
  try {
    const raw = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(raw);
    const S = normalizeState(obj);
    if (toast) toast("+ インポートしました");
    return S;
  } catch (e) {
    console.error(e);
    alert("インポートに失敗しました。文字列をご確認ください。");
    return null;
  }
}
