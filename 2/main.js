/* Game entry (workers x18 + prestige + autobuy)
   - UI text: Japanese
   - Comments: English only
*/

import {
  fmt, upgradeDefs, workerDefs,
  clamp, clampInt, perClick, perSec, workerCost,
  totalShardsFromLifetime, prestigeMultiplier
} from "./defs.js";
import {
  normalizeState, saveState, loadState,
  exportData, importDataPrompt
} from "./storage.js";
import {
  buildShops, renderAll, renderTop, renderShop,
  floatChip, toast, renderPrestige
} from "./ui.js";

const $ = (sel) => document.querySelector(sel);

// ----- Global state -----
let S = normalizeState({});

// ----- Achievements -----
const ACH = [
  { id: "初クリック！",     test: s => s.totalClicks >= 1 },
  { id: "100pt 突破",      test: s => s.points >= 100 },
  { id: "1,000pt 突破",    test: s => s.points >= 1_000 },
  { id: "10,000pt 突破",   test: s => s.points >= 10_000 },
  { id: "100,000pt 突破",  test: s => s.points >= 100_000 },
  { id: "子猫×10",         test: s => (s.workers.w1||0) >= 10 },
  { id: "猫又×10",         test: s => (s.workers.w3||0) >= 10 },
  { id: "妖怪市×1",        test: s => (s.workers.w10||0) >= 1 },
  { id: "星海大聖堂×1",    test: s => (s.workers.w18||0) >= 1 },
  { id: "クリ率10%",       test: s => s.critChance >= 0.10 },
  { id: "クリ倍率×20",     test: s => s.critMultiplier >= 20 },
  { id: "ゴールデンの気配", test: s => s.goldenChance >= 0.002 },
  { id: "研究Lv3",         test: s => s.researchLvl >= 3 },
  { id: "オフライン上限60分", test: s => s.offlineCapMins >= 60 },
  { id: "初フィーバー！",  test: s => s.feverActiveUntil > 0 },
  { id: "初プレステージ！", test: s => (s.prestigeShards || 0) >= 1 }
];

function addAchievement(label) {
  if (!S.achievements[label]) {
    S.achievements[label] = true;
  }
}
function checkAchievements() {
  let changed = false;
  for (const a of ACH) {
    if (!S.achievements[a.id] && a.test(S)) {
      addAchievement(a.id);
      floatChip(`✔ ${a.id}`, "");
      changed = true;
    }
  }
  if (changed) saveState(S, { manual:false, toast });
}

// ----- Helpers -----
function addPoints(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  S.points += amount;
  S.lifetimeEarned += amount;
}

// ----- Core mechanics (buy functions now support {silent}) -----
function buyUpgrade(id, opts = {}) {
  let purchased = false;
  switch(id){
    case "clickPower": {
      const c = S.costs.clickPower;
      if (S.points >= c && c > 0) {
        S.points -= c;
        S.perClickBase += 1;
        S.clickLevel += 1;
        S.costs.clickPower = Math.ceil(c * 1.25 + 1);
        if (!opts.silent) toast("+ パワーアップ！");
        purchased = true;
      }
      break;
    }
    case "crit": {
      const c = S.costs.crit;
      if (S.points >= c && c > 0) {
        S.points -= c;
        S.critChance = clamp((S.critChance || 0) + 0.01, 0, 0.9);
        S.costs.crit = Math.ceil(c * 1.35 + 1);
        if (!opts.silent) toast("+ クリ率アップ！");
        purchased = true;
      }
      break;
    }
    case "critMult": {
      const c = S.costs.critMult;
      if (S.points >= c && c > 0) {
        S.points -= c;
        S.critMultiplier = clampInt((S.critMultiplier || 10) + 1, 1, 50);
        S.costs.critMult = Math.ceil(c * 1.33 + 1);
        if (!opts.silent) toast("+ クリ倍率アップ！");
        purchased = true;
      }
      break;
    }
    case "gold": {
      const c = S.costs.gold;
      if (S.points >= c && c > 0) {
        S.points -= c;
        S.goldenChance = Math.min(0.05, (S.goldenChance || 0) + 0.0005);
        S.costs.gold = Math.ceil(c * 1.4 + 2);
        if (!opts.silent) toast("+ ゴールデン率アップ！");
        purchased = true;
      }
      break;
    }
    case "research": {
      const c = S.costs.research;
      if (S.points >= c && c > 0) {
        S.points -= c;
        S.researchLvl = (S.researchLvl || 0) + 1;
        S.costs.research = Math.ceil(c * 1.45 + 5);
        if (!opts.silent) toast("+ 研究レベルアップ！");
        purchased = true;
      }
      break;
    }
    case "offlineCap": {
      const c = S.costs.offlineCap;
      if (S.points >= c && c > 0) {
        S.points -= c;
        S.offlineCapMins = (S.offlineCapMins || 0) + 10;
        S.costs.offlineCap = Math.ceil(c * 1.5 + 10);
        if (!opts.silent) toast("+ オフライン上限+10分！");
        purchased = true;
      }
      break;
    }
  }
  if (purchased && !opts.silent) {
    renderAll(S, currentPrestigeGain());
    saveState(S, { manual:false, toast });
    checkAchievements();
  }
  return purchased;
}

function buyWorker(workerId, opts = {}) {
  const def = workerDefs.find(d => d.id === workerId);
  if (!def) return false;
  const owned = S.workers[workerId] || 0;
  const cost = workerCost(def, owned);
  if (S.points >= cost) {
    S.points -= cost;
    S.workers[workerId] = owned + 1;
    if (!opts.silent) {
      floatChip(`+ ${def.name} を雇用`, "");
      renderAll(S, currentPrestigeGain());
      saveState(S, { manual:false, toast });
      checkAchievements();
    }
    return true;
  }
  return false;
}

function clickOnce() {
  const base = perClick(S);
  let gain = base;
  let kind = "";
  if (Math.random() < (S.goldenChance || 0)) {
    gain = base * (S.goldenMultiplier || 100);
    kind = "gold";
  } else if (Math.random() < (S.critChance || 0)) {
    gain = base * (S.critMultiplier || 10);
    kind = "crit";
  }
  addPoints(gain);
  S.totalClicks += 1;
  floatChip(`${kind ? (kind === "gold" ? "GOLD " : "CRIT ") : ""}+${fmt.format(Math.floor(gain))}`, kind);
  checkAchievements();
  renderTop(S);
  renderPrestige(S, currentPrestigeGain());
}

// ----- Prestige -----
function currentPrestigeGain() {
  const total = totalShardsFromLifetime(S.lifetimeEarned);
  return Math.max(0, total - (S.prestigeShards || 0));
}
function doPrestige() {
  const gain = currentPrestigeGain();
  if (gain <= 0) return;
  const ok = confirm(
    `プレステージを実行しますか？\n` +
    `獲得予定: 月光石 ${gain} 個\n` +
    `（全てのポイント・ワーカー・一部アップグレードがリセットされます。` +
    `月光石による恒久倍率は維持・加算されます）`
  );
  if (!ok) return;
  S.prestigeShards = (S.prestigeShards || 0) + gain;
  const keepLifetime = S.lifetimeEarned;
  const keepShards = S.prestigeShards;
  const keepRate = S.prestigeRate;
  S = normalizeState({});
  S.lifetimeEarned = keepLifetime;
  S.prestigeShards = keepShards;
  S.prestigeRate = keepRate;
  floatChip(`+ 月光石 ${gain} 獲得 / 恒久倍率 ×${prestigeMultiplier(S).toFixed(2)}`, "gold");
  renderAll(S, currentPrestigeGain());
  saveState(S, { manual:true, toast });
  checkAchievements();
}

// ----- AUTO BUY -----
function toggleUpgradeAuto(id) {
  S.autoBuy.upgrades[id] = !S.autoBuy.upgrades[id];
  saveState(S);
  renderShop(S);
}
function toggleWorkerAuto(id) {
  S.autoBuy.workers[id] = !S.autoBuy.workers[id];
  saveState(S);
  renderShop(S);
}

function autoBuyTick() {
  let purchases = 0;
  const MAX = 50;

  // Upgrades first (array order)
  for (const u of upgradeDefs) {
    if (!S.autoBuy.upgrades[u.id]) continue;
    while (purchases < MAX && buyUpgrade(u.id, {silent:true})) {
      purchases++;
    }
    if (purchases >= MAX) break;
  }

  // Workers next (array order)
  if (purchases < MAX) {
    for (const w of workerDefs) {
      if (!S.autoBuy.workers[w.id]) continue;
      // attempt multiple hires while affordable
      while (purchases < MAX && buyWorker(w.id, {silent:true})) {
        purchases++;
      }
      if (purchases >= MAX) break;
    }
  }

  if (purchases > 0) {
    renderAll(S, currentPrestigeGain());
    saveState(S);
    checkAchievements();
  }
}

// ----- Loop -----
let saveTimer = 0;
function loop() {
  const now = Date.now();
  const dt = (now - (S.lastTick || now)) / 1000;
  S.lastTick = now;

  const ps = perSec(S);
  if (ps > 0) addPoints(ps * dt);

  autoBuyTick();          // <- run after income
  renderTop(S);
  renderShop(S);
  renderPrestige(S, currentPrestigeGain());

  saveTimer += dt;
  if (saveTimer >= 5) {
    saveTimer = 0;
    saveState(S, { manual:false, toast });
  }
  requestAnimationFrame(loop);
}

// ----- Wire DOM events -----
function wireCommonButtons() {
  $("#clickBtn").addEventListener("click", () => clickOnce());
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      clickOnce();
    }
  });

  $("#saveBtn").addEventListener("click", () => saveState(S, { manual:true, toast }));
  $("#loadBtn").addEventListener("click", () => {
    const { S: loaded } = loadState({ manual:true, toast });
    S = normalizeState(loaded);
    renderAll(S, currentPrestigeGain());
  });
  $("#exportBtn").addEventListener("click", () => exportData(S, { toast }));
  $("#importBtn").addEventListener("click", () => {
    const ns = importDataPrompt({ toast });
    if (ns) { S = normalizeState(ns); renderAll(S, currentPrestigeGain()); saveState(S); }
  });
  $("#resetBtn").addEventListener("click", () => {
    if (confirm("本当にリセットしますか？この操作は元に戻せません。")) {
      const keepLife = S.lifetimeEarned;
      const keepShards = S.prestigeShards;
      const keepRate = S.prestigeRate;
      S = normalizeState({});
      S.lifetimeEarned = keepLife;
      S.prestigeShards = keepShards;
      S.prestigeRate = keepRate;
      saveState(S, { manual:true, toast });
      renderAll(S, currentPrestigeGain());
    }
  });
}

function boot() {
  buildShops({
    onUpgradeBuy: (id) => buyUpgrade(id),
    onWorkerBuy: (id) => buyWorker(id),
    onFever: () => {
      const c = S.costs.fever;
      if (S.points >= c) {
        S.points -= c;
        S.feverActiveUntil = Date.now() + 30_000;
        S.costs.fever = Math.ceil(c * 1.5 + 10);
        floatChip("FEVER ×2 (30秒)", "gold");
        renderAll(S, currentPrestigeGain());
        saveState(S, { manual:false, toast });
      }
    },
    onPrestige: () => doPrestige(),
    onToggleUpgradeAuto: (id) => toggleUpgradeAuto(id),
    onToggleWorkerAuto:  (id) => toggleWorkerAuto(id)
  });

  const { S: loaded, offlineGained } = loadState({ manual:false, toast });
  S = normalizeState(loaded);
  if (offlineGained > 0) floatChip(`+ オフライン回収 ${fmt.format(offlineGained)} pt`, "");

  renderAll(S, currentPrestigeGain());
  wireCommonButtons();
  requestAnimationFrame(loop);
}

boot();
