// scripts/input.js（ショップ文言=「アップグレード」／一覧常時更新／null安全）
import {
  canvas, btnPlace, btnSell, btnStartWave, btnSpeed, btnPause, btnReset,
  showToast, shopList, tooltip,
  inspectNone, inspectBox, insType, insLv, insDps, insRange,
  btnUpgrade, btnSellOne, insHint
} from "./dom.js";
import { W, H, COLS, ROWS } from "./consts.js";
import { worldToCell } from "./utils.js";
import {
  canPlaceAtCell, addTowerAtCell, findTowerAt,
  sellTower, getTowerInfo, upgradeType
} from "./towers.js";
import { updateHud } from "./hud.js";
import { TOWERS } from "./towers_def.js";
import { upgradeCost, getTowerStats } from "./upgrades.js";
import { towers } from "./state.js";

const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
const num = (v)=> (typeof v === "number" ? v : Number(v) || 0);

// ---- ユーティリティ（要素がある時だけ安全に動く） ----
function on(el, type, handler, opts){ if (el) el.addEventListener(type, handler, opts); }
function setText(idOrEl, val){
  const el = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
  if (el) el.textContent = String(val);
}
function setHidden(el, v){ if (el) el.hidden = !!v; }

/* ---------------- ショップ（設置／タイプ一括アップグレード） ---------------- */
export function buildShop(state){
  if (!shopList) return;
  shopList.innerHTML = "";

  for (const key of Object.keys(TOWERS)){
    const t = TOWERS[key];
    const wrap = document.createElement("div");
    wrap.className = "shop-item";

    const lv = state.tech?.[t.id] ?? 1;
    const costUp = upgradeCost(t.cost, lv);

    // 文言は「アップグレード」に統一
    wrap.innerHTML = `
      <div class="meta">
        <span class="badge">${t.name}</span><span class="muted">${t.desc}</span>
      </div>
      <div class="shop-actions">
        <button class="btn-mini" data-act="place" data-type="${t.id}">設置 (${t.cost}G)</button>
        <button class="btn-mini up" data-act="up" data-type="${t.id}">アップグレード (${costUp}G)</button>
      </div>
    `;

    // ヒント（PCのみ）
    if (!isCoarse){
      wrap.addEventListener("mouseenter", (e)=>{
        if (!tooltip) return;
        const r = e.currentTarget.getBoundingClientRect();
        tooltip.innerHTML = `${t.name}<br>${t.desc}<br><small>設置: ${t.cost}G / 次LvUP: ${costUp}G</small>`;
        tooltip.hidden = false;
        tooltip.style.left = `${r.left + window.scrollX}px`;
        tooltip.style.top  = `${r.top  + window.scrollY - 8}px`;
      });
      wrap.addEventListener("mouseleave", ()=>{ if (tooltip) tooltip.hidden = true; });
    }

    shopList.appendChild(wrap);
  }

  // クリック委譲（設置／アップグレード）
  on(shopList, "click", (e)=>{
    const btn = e.target.closest?.("button[data-act]"); if (!btn) return;
    const typeId = btn.getAttribute("data-type");
    const act = btn.getAttribute("data-act");
    const t = TOWERS[typeId]; if (!t) return;

    if (act === "place"){
      state.selectedTowerType = typeId;
      state.placeMode = true; state.sellMode = false;
      showToast(`${t.name} を配置モードに設定`);
      return;
    }
    if (act === "up"){
      const r = upgradeType(typeId, state);
      if (!r || !r.ok){
        showToast(r?.reason === "gold" ? "ゴールド不足" : "アップグレード不可");
      } else {
        showToast(`${t.name} Lv${r.newLevel} にアップグレード (-${r.cost}G)`);
        updateHud(state);
        refreshShopUpgradeButtons(state);
        refreshFleet(state);      // タイプ別（Lv/DPS/射程）即更新
        refreshTowerList(state);  // 個体一覧がある場合のみ更新
        refreshInspector(state);  // 選択中の表示も更新
      }
    }
  }, { passive:true });

  refreshShopUpgradeButtons(state);
}

function refreshShopUpgradeButtons(state){
  if (!shopList) return;
  const buttons = shopList.querySelectorAll('button[data-act="up"]');
  buttons.forEach(btn=>{
    const typeId = btn.getAttribute("data-type");
    const base = TOWERS[typeId];
    const lv = state.tech?.[typeId] ?? 1;
    const cost = upgradeCost(base.cost, lv);
    btn.textContent = `アップグレード (${cost}G)`;
    btn.disabled = num(state.gold) < num(cost);
  });
}

/* ---------------- 右パネル：全砲台ステータス（Lv/DPS/射程） ---------------- */
function refreshFleet(state){
  const types = ["cannon","bomb","ice","poison","sniper"];
  // HTMLがこの一覧を持っていない場合はスキップ
  if (!document.getElementById("fleet-cannon-lv")) return;

  for (const typeId of types){
    const lv  = state.tech?.[typeId] ?? 1;
    const S   = getTowerStats(typeId, lv);
    const dps = Math.round(S.dmg / S.cd);
    setText(`fleet-${typeId}-lv`,    lv);
    setText(`fleet-${typeId}-dps`,   dps);
    setText(`fleet-${typeId}-range`, S.range);
  }
}

/* ---------------- 右パネル：個体一覧（存在時のみ） ---------------- */
function towerItemHtml(i, info){
  const name = TOWERS[info.typeId]?.name || info.typeId;
  return `
    <div class="tower-item ${i===window.__selectedIdx ? "selected":""}" data-idx="${i}">
      <div class="ti-name"><strong>${name}</strong> <span class="muted">#${i}</span></div>
      <div class="ti-meta muted">Lv${info.lvl} / DPS ${info.dps} / 射程 ${info.range}</div>
    </div>
  `;
}
function refreshTowerList(state){
  const wrap = document.getElementById("towerList");
  if (!wrap) return;
  if (!towers.length){ wrap.innerHTML = `<div class="tower-item muted">まだ砲台がありませんにゃ。</div>`; return; }
  const parts = [];
  for (let i=0;i<towers.length;i++){ parts.push(towerItemHtml(i, getTowerInfo(i, state))); }
  wrap.innerHTML = parts.join("");
  wrap.onclick = (e)=>{
    const item = e.target.closest?.(".tower-item"); if (!item) return;
    const idx = Number(item.dataset.idx);
    window.__selectedIdx = idx;
    state.selectedTowerIndex = idx;
    refreshInspector(state);
    refreshTowerList(state);
  };
}

/* ---------------- 旧インスペクタ（存在時のみ） ---------------- */
function refreshInspector(state){
  if (!inspectNone || !inspectBox) return;
  const idx = state.selectedTowerIndex;
  if (idx < 0){ setHidden(inspectNone, false); setHidden(inspectBox, true); return; }
  const info = getTowerInfo(idx, state);
  if (!info){ setHidden(inspectNone, false); setHidden(inspectBox, true); return; }

  setHidden(inspectNone, true); setHidden(inspectBox, false);
  setText(insType,  info.typeId);
  setText(insLv,   `Lv${info.lvl}`);
  setText(insDps,  `${info.dps}`);
  setText(insRange,`${info.range}`);

  if (btnUpgrade){ btnUpgrade.textContent = "タイプ一括はショップから"; btnUpgrade.disabled = true; }
  if (insHint) insHint.textContent = "個別UPは廃止にゃ。ショップの各タイプ「アップグレード」で全台が上がるにゃ。";
}

/* ---------------- 入力（pointer対応） ---------------- */
export function setupInput(state, api){
  buildShop(state);
  refreshFleet(state);
  refreshTowerList(state);

  const actAt = (cx, cy)=>{
    const rect = canvas?.getBoundingClientRect?.(); if (!rect) return;
    const x = (cx - rect.left) * (W / rect.width);
    const y = (cy - rect.top)  * (H / rect.height);

    if (state.placeMode){
      const { cx, cy } = worldToCell(x, y);
      if (!canPlaceAtCell(cx, cy, COLS, ROWS)){ showToast("ここには設置できません"); return; }
      if (!addTowerAtCell(cx, cy, state.selectedTowerType, state)){ showToast("ゴールドが足りません"); return; }
      updateHud(state);
      refreshShopUpgradeButtons(state);
      refreshFleet(state);
      refreshTowerList(state);
      return;
    }
    if (state.sellMode){
      const idx = findTowerAt(x, y);
      if (idx !== -1){
        const refund = sellTower(idx, state);
        if (refund > 0){
          showToast(`売却: +${refund}G`);
          updateHud(state);
          refreshShopUpgradeButtons(state);
          refreshFleet(state);
          refreshTowerList(state);
          refreshInspector(state);
        }
      }
      return;
    }
    // 選択のみ
    const idx = findTowerAt(x, y);
    state.selectedTowerIndex = idx;
    window.__selectedIdx = idx;
    refreshInspector(state);
    refreshTowerList(state);
  };

  on(canvas, "pointerdown", (e)=>{ if (e.button===2) return; actAt(e.clientX, e.clientY); }, { passive:true });
  on(canvas, "contextmenu", (e)=> e.preventDefault());

  on(btnPlace,     "click", ()=>{ state.placeMode=!state.placeMode; if(state.placeMode) state.sellMode=false; showToast(state.placeMode?"配置モード":"配置解除"); }, { passive:true });
  on(btnSell,      "click", ()=>{ state.sellMode =!state.sellMode; if(state.sellMode)  state.placeMode=false; showToast(state.sellMode ?"売却モード":"売却解除"); }, { passive:true });
  on(btnSpeed,     "click", ()=>{ state.speed=(state.speed===1)?2:(state.speed===2?4:1); if (btnSpeed) btnSpeed.textContent=`速度: ${state.speed}x`; showToast(`速度 ${state.speed}x`); }, { passive:true });
  on(btnPause,     "click", ()=>{ state.isPaused=!state.isPaused; btnPause?.classList.toggle("primary", state.isPaused); if (btnPause) btnPause.textContent=state.isPaused?"再開":"一時停止"; showToast(state.isPaused?"一時停止":"再開"); }, { passive:true });
  on(btnStartWave, "click", ()=>{ if (api.spawner.running) return; state.wave++; updateHud(state); api.spawner.beginWave(state.wave); }, { passive:true });
  on(btnReset,     "click", ()=>{ localStorage.removeItem("tdx-save"); localStorage.removeItem("tdx-save-v2"); location.reload(); });

  on(btnUpgrade, "click", ()=> showToast("タイプ一括はショップの『アップグレード』でにゃ"));
  on(btnSellOne, "click", ()=>{
    const idx = state.selectedTowerIndex; if (idx<0) return;
    const refund = sellTower(idx, state);
    if (refund>0){
      showToast(`売却: +${refund}G`);
      updateHud(state);
      refreshShopUpgradeButtons(state);
      refreshFleet(state);
      refreshTowerList(state);
      refreshInspector(state);
    }
  });
}
