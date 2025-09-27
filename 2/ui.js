/* DOM building & rendering */

import {
  fmt, workerDefs, upgradeDefs, specialsDefs,
  perClick, perSec, workerCost, prestigeMultiplier,
  perSecBase, feverActive
} from "./defs.js";

const $ = (sel) => document.querySelector(sel);

const dom = {
  points: $("#points"),
  perSec: $("#perSec"),
  perClick: $("#perClick"),
  floatLayer: $("#floatLayer"),
  upgrades: $("#upgrades"),
  workers: $("#workers"),
  specials: $("#specials"),
  prestige: $("#prestige"),
  // owned summary
  lvlClickPower: $("#lvlClickPower"),
  critPercent: $("#critPercent"),
  critX: $("#critX"),
  goldenPercent: $("#goldenPercent"),
  researchBonus: $("#researchBonus"),
  offlineCap: $("#offlineCap"),
  workersCount: $("#workersCount"),
  feverStatus: $("#feverStatus"),
  prestigeShards: $("#prestigeShards"),
  prestigeMult: $("#prestigeMult"),
  // achievements
  achList: $("#achievements")
};

/* number formatter: integers are丸め、1未満は小数2桁 */
function fnum(v){
  if (!Number.isFinite(v)) return "-";
  const abs = Math.abs(v);
  if (abs >= 1) return fmt.format(Math.floor(v));
  return v.toFixed(2);
}

export function buildShops({
  onUpgradeBuy, onWorkerBuy, onFever, onPrestige,
  onToggleUpgradeAuto, onToggleWorkerAuto
}) {
  // Upgrades
  dom.upgrades.innerHTML = "";
  upgradeDefs.forEach(u => {
    const art = document.createElement("article");
    art.className = "card";
    art.innerHTML = `
      <h3>${u.name}</h3>
      <p>${u.desc}</p>
      <p class="price">価格: <span id="cost_${u.id}">-</span> pt</p>
      <p class="meta" id="metaU_${u.id}">—</p>
      <div class="row">
        <button id="buy_${u.id}">購入</button>
        <button id="autoU_${u.id}" class="auto-toggle">AUTO: OFF</button>
      </div>
    `;
    dom.upgrades.appendChild(art);
    $("#buy_" + u.id).addEventListener("click", () => onUpgradeBuy(u.id));
    $("#autoU_" + u.id).addEventListener("click", () => onToggleUpgradeAuto(u.id));
  });

  // Workers (x18)
  dom.workers.innerHTML = "";
  workerDefs.forEach(w => {
    const art = document.createElement("article");
    art.className = "card";
    art.innerHTML = `
      <h3>${w.name}</h3>
      <p>毎秒 +${fmt.format(w.perSec)} / 所持: <span id="own_${w.id}">0</span></p>
      <p class="price">価格: <span id="cost_${w.id}">-</span> pt</p>
      <p class="meta" id="metaW_${w.id}">—</p>
      <div class="row">
        <button id="buy_${w.id}">購入</button>
        <button id="autoW_${w.id}" class="auto-toggle">AUTO: OFF</button>
      </div>
    `;
    dom.workers.appendChild(art);
    $("#buy_" + w.id).addEventListener("click", () => onWorkerBuy(w.id));
    $("#autoW_" + w.id).addEventListener("click", () => onToggleWorkerAuto(w.id));
  });

  // Specials
  dom.specials.innerHTML = "";
  specialsDefs.forEach(su => {
    const art = document.createElement("article");
    art.className = "card";
    art.innerHTML = `
      <h3>${su.name}</h3>
      <p>${su.desc}</p>
      <p class="price">価格: <span id="cost_${su.id}">-</span> pt</p>
      <button id="buy_${su.id}">発動</button>
    `;
    dom.specials.appendChild(art);
    $("#buy_" + su.id).addEventListener("click", onFever);
  });

  // Prestige
  dom.prestige.innerHTML = "";
  const p = document.createElement("article");
  p.className = "card";
  p.innerHTML = `
    <h3>プレステージ（進化）</h3>
    <p>リセットして <strong>月光石</strong> を獲得。月光石は恒久倍率（全獲得×）を上げます。</p>
    <p class="ownedline">今リセットで獲得見込み: <strong id="prestigeGainNow">0</strong> 個</p>
    <p class="ownedline">恒久倍率: <strong id="prestigeMultCard">×1.00</strong>（+1%/個）</p>
    <button id="doPrestige">プレステージ実行</button>
  `;
  dom.prestige.appendChild(p);
  $("#doPrestige").addEventListener("click", onPrestige);
}

export function renderTop(S) {
  dom.points.textContent = fmt.format(Math.floor(S.points));
  dom.perSec.textContent = fmt.format(Math.floor(perSec(S)));
  dom.perClick.textContent = fmt.format(Math.floor(perClick(S)));
}

export function renderShop(S) {
  // global multipliers (for preview)
  const pMult = prestigeMultiplier(S);
  const feverMult = feverActive(S) ? S.feverMultiplier : 1;
  const clickMult = pMult * feverMult;
  const secMult = pMult * feverMult;
  const basePS = perSecBase(S); // workers合計(研究前)

  // Upgrades
  for (const id of ["clickPower","crit","critMult","gold","research","offlineCap"]) {
    const cost = Number(S.costs?.[id]) || 0;
    const elC = document.querySelector(`#cost_${id}`);
    const elB = document.querySelector(`#buy_${id}`);
    const tgl = document.querySelector(`#autoU_${id}`);
    if (elC) elC.textContent = fmt.format(cost);
    if (elB) elB.disabled = !(S.points >= cost && cost > 0);
    if (tgl) {
      const on = !!(S.autoBuy?.upgrades?.[id]);
      tgl.textContent = on ? "AUTO: ON" : "AUTO: OFF";
      tgl.classList.toggle("on", on);
    }

    // meta line (effect preview)
    const meta = document.querySelector(`#metaU_${id}`);
    if (!meta) continue;

    if (id === "clickPower") {
      // current contribution from purchased clickPower (without crit/gold EV)
      const current = Math.max(0, (S.perClickBase - 1)) * clickMult;
      const delta = 1 * clickMult;
      meta.textContent = `1クリック: 現在 +${fnum(current)} / 次Lv +${fnum(delta)}`;
    } else if (id === "research") {
      // research boosts workers' perSec (+5% each Lv)
      const current = basePS * (S.researchLvl || 0) * 0.05 * secMult;
      const delta = basePS * 0.05 * secMult;
      meta.textContent = `毎秒: 現在 +${fnum(current)} / 次Lv +${fnum(delta)}`;
    } else if (id === "crit") {
      const baseClick = S.perClickBase * clickMult;
      const current = baseClick * (S.critChance || 0) * ((S.critMultiplier || 1) - 1);
      const delta = baseClick * 0.01 * ((S.critMultiplier || 1) - 1); // +1% 期待値
      meta.textContent = `期待値/クリック: 現在 +${fnum(current)} / 次Lv +${fnum(delta)}`;
    } else if (id === "critMult") {
      const baseClick = S.perClickBase * clickMult;
      const current = baseClick * (S.critChance || 0) * ((S.critMultiplier || 1) - 1);
      const delta = baseClick * (S.critChance || 0) * 1; // +1倍率ぶんの期待値
      meta.textContent = `期待値/クリック: 現在 +${fnum(current)} / 次Lv +${fnum(delta)}`;
    } else if (id === "gold") {
      const baseClick = S.perClickBase * clickMult;
      const current = baseClick * (S.goldenChance || 0) * ((S.goldenMultiplier || 1) - 1);
      const delta = baseClick * 0.0005 * ((S.goldenMultiplier || 1) - 1); // +0.05%
      meta.textContent = `期待値/クリック: 現在 +${fnum(current)} / 次Lv +${fnum(delta)}`;
    } else if (id === "offlineCap") {
      meta.textContent = `即時/秒: +0 / 次Lv: 放置上限 +10分`;
    }
  }

  // Workers
  for (const w of workerDefs) {
    const own = S.workers[w.id] || 0;
    const cost = workerCost(w, own);
    const ownEl = document.querySelector(`#own_${w.id}`);
    const costEl = document.querySelector(`#cost_${w.id}`);
    const btnEl = document.querySelector(`#buy_${w.id}`);
    const tgl = document.querySelector(`#autoW_${w.id}`);
    if (ownEl) ownEl.textContent = fmt.format(own);
    if (costEl) costEl.textContent = fmt.format(cost);
    if (btnEl) btnEl.disabled = S.points < cost;
    if (tgl) {
      const on = !!(S.autoBuy?.workers?.[w.id]);
      tgl.textContent = on ? "AUTO: ON" : "AUTO: OFF";
      tgl.classList.toggle("on", on);
    }

    // meta: current contribution and next delta (effective DPS)
    const meta = document.querySelector(`#metaW_${w.id}`);
    if (meta) {
      const unit = w.perSec * (1 + (S.researchLvl || 0) * 0.05) * secMult; // effective per-unit DPS
      const current = own * unit;
      const delta = unit; // next hire adds this
      meta.textContent = `現在貢献: +${fnum(current)}/秒 ・ 次購入: +${fnum(delta)}/秒`;
    }
  }

  // Specials
  const cF = Number(S.costs?.fever) || 0;
  const costElF = document.querySelector("#cost_fever");
  const btnElF = document.querySelector("#buy_fever");
  if (costElF) costElF.textContent = fmt.format(cF);
  if (btnElF) btnElF.disabled = !(S.points >= cF && cF > 0);

  // Owned summary
  dom.lvlClickPower.textContent = fmt.format(S.clickLevel);
  dom.critPercent.textContent = `${Math.round((S.critChance || 0) * 100)}%`;
  dom.critX.textContent = `×${fmt.format(S.critMultiplier || 1)}`;
  dom.goldenPercent.textContent = `${((S.goldenChance || 0) * 100).toFixed(2)}%`;
  dom.researchBonus.textContent = `+${Math.round((S.researchLvl || 0) * 5)}%`;
  dom.offlineCap.textContent = `${fmt.format(S.offlineCapMins || 0)}分`;
  const totalWorkers = workerDefs.reduce((sum, d) => sum + (S.workers[d.id] || 0), 0);
  dom.workersCount.textContent = fmt.format(totalWorkers);
  dom.feverStatus.textContent = (Date.now() < (S.feverActiveUntil || 0)) ? "ON" : "OFF";
  dom.prestigeShards.textContent = fmt.format(S.prestigeShards || 0);
  dom.prestigeMult.textContent = `×${(prestigeMultiplier(S)).toFixed(2)}`;
}

export function renderPrestige(S, gainNow) {
  const g = document.querySelector("#prestigeGainNow");
  const m = document.querySelector("#prestigeMultCard");
  if (g) g.textContent = fmt.format(gainNow || 0);
  if (m) m.textContent = `×${(prestigeMultiplier(S)).toFixed(2)}`;
  const btn = document.querySelector("#doPrestige");
  if (btn) btn.disabled = !((gainNow || 0) > 0);
}

export function renderAchievements(S) {
  dom.achList.innerHTML = "";
  for (const [id, ok] of Object.entries(S.achievements || {})) {
    if (!ok) continue;
    const li = document.createElement("li");
    li.textContent = `✔ ${id}`;
    dom.achList.prepend(li);
  }
}

export function renderAll(S, prestigeGainNow = 0) {
  renderTop(S);
  renderShop(S);
  renderPrestige(S, prestigeGainNow);
  renderAchievements(S);
}

export function floatChip(text, kind = "") {
  const layer = dom.floatLayer;
  const chip = document.createElement("div");
  chip.className = "float-chip";
  if (kind === "crit") {
    chip.style.borderColor = "#ffd166";
    chip.style.color = "#ffd166";
    chip.style.textShadow = "0 0 10px rgba(255,209,102,.6)";
  } else if (kind === "gold") {
    chip.style.borderColor = "#f9f871";
    chip.style.color = "#f9f871";
    chip.style.textShadow = "0 0 12px rgba(249,248,113,.8)";
  }
  chip.textContent = text;
  layer.appendChild(chip);
  setTimeout(() => chip.remove(), 950);
}

export function toast(text) {
  floatChip(text, "");
}
