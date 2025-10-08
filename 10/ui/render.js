// Clean UI renderer: JP descriptions, targeted spell/equip, face lock with blockers, long-press preview
const E = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };

let attackerSel = null;
let attackEnabled = false;
let pendingSpell = null; // { handIdx, target: 'enemy'|'ally' }

document.addEventListener("keydown", (e) => { if (e.key === "Escape") clearTargeting(); });

export function renderAll(state, you) {
  const me  = state.players[you];
  const opp = state.players[you === "A" ? "B" : "A"];
  const board = document.getElementById("board");

  const isMatched = !!(state && state.players && state.players.A && state.players.B);
  document.body.classList.toggle("in-match", isMatched);

  attackEnabled = state.turn === you && !state.winner;

  // HP / Turn
  const youHpEl = document.getElementById("youHp");
  const oppHpEl = document.getElementById("oppHp");
  youHpEl.textContent = `${me.alias} HP: ${me.hp}`;
  oppHpEl.textContent = `${opp.alias} HP: ${opp.hp}`;
  document.getElementById("turnInfo").textContent = state.winner ? `Game Over` : `Turn: ${state.turn}`;
  document.getElementById("manaInfo").textContent = `Mana: ${me.mana}/${me.maxMana}`;

  // End overlay
  if (state.winner) {
    const type = state.winner === "draw" ? "draw" : (state.winner === you ? "win" : "lose");
    showEndOverlay(type, type === "draw" ? "引き分け" : (type === "win" ? "勝利！" : "敗北…"));
  } else {
    hideEndOverlay();
  }

  // Face target (only when no enemy units)
  const faceOK = opp.row.length === 0;
  oppHpEl.classList.toggle("face-target", attackEnabled && attackerSel !== null && !pendingSpell && faceOK);
  oppHpEl.onclick = null;
  if (attackEnabled) {
    oppHpEl.onclick = () => {
      if (pendingSpell) return;
      if (attackerSel === null) return;
      if (!faceOK) return;
      dispatchAttack(board, attackerSel, "face");
      clearSelection();
    };
  }

  // Rows
  const youRow = document.getElementById("youRow");
  const oppRow = document.getElementById("oppRow");
  youRow.innerHTML = ""; oppRow.innerHTML = "";

  // You row
  me.row.forEach((u, i) => {
    const el = renderUnit(u);

    if (attackEnabled && u.canAttack) el.classList.add("can-attack");

    // 自軍ユニット選択（攻撃役）
    el.addEventListener("click", () => {
      if (pendingSpell) return;
      if (!attackEnabled) return;

      if (attackerSel === i) {
        clearSelection();
      } else {
        attackerSel = i;
        refreshSelectionHighlight(youRow, i);
        const faceOK2 = opp.row.length === 0;
        if (faceOK2) document.getElementById("oppHp")?.classList.add("face-target");
        const showFace = faceOK2 && attackEnabled && (attackerSel !== null) && !pendingSpell;
        setupFaceOverlay({ board: document.getElementById("board"), show: showFace });
      }
    });

    // 味方対象（スペル/装備）
    if (pendingSpell?.target === "ally") {
      const handIdx = pendingSpell.handIdx;
      el.classList.add("targetable");
      el.addEventListener("click", (ev) => {
        ev.stopImmediatePropagation();
        dispatchSpellTarget(board, handIdx, i);
        clearTargeting();
      }, { once: true });
    }

    youRow.appendChild(el);
  });

  // Opp row
  opp.row.forEach((u, i) => {
    const el = renderUnit(u);

    if (attackEnabled) {
      // 敵ユニットを攻撃
      el.addEventListener("click", () => {
        if (pendingSpell) return;
        if (!attackEnabled) return;
        if (attackerSel === null) return;
        dispatchAttack(board, attackerSel, i);
        clearSelection();
      });
    }
    // 敵対象（スペル）
    if (pendingSpell?.target === "enemy") {
      const handIdx = pendingSpell.handIdx;
      el.classList.add("targetable");
      el.addEventListener("click", (ev) => {
        ev.stopImmediatePropagation();
        dispatchSpellTarget(board, handIdx, i);
        clearTargeting();
      }, { once: true });
    }

    oppRow.appendChild(el);
  });

  // Hands
  const youHand = document.getElementById("youHand");
  const oppHand = document.getElementById("oppHand");
  youHand.innerHTML = ""; oppHand.innerHTML = "";
  me.hand.forEach((c, i) => youHand.appendChild(renderCard(c, i)));
  opp.hand.forEach(() => oppHand.appendChild(renderHiddenCard()));

  // EndTurn
  document.getElementById("endTurn").disabled = state.turn !== you || !!state.winner;

  setupFaceOverlay({
    board,
    show: (opp.row.length === 0) && attackEnabled && (attackerSel !== null) && !pendingSpell
  });
}

export function renderBlank() {
  document.getElementById("youHp").textContent = "";
  document.getElementById("oppHp").textContent = "";
  document.getElementById("turnInfo").textContent = "";
  document.getElementById("manaInfo").textContent = "";
  document.getElementById("youRow").innerHTML = "";
  document.getElementById("oppRow").innerHTML = "";
  document.getElementById("youHand").innerHTML = "";
  document.getElementById("oppHand").innerHTML = "";
  document.getElementById("endTurn").disabled = true;
  clearSelection(); clearTargeting(); hideEndOverlay();
  document.body.classList.remove("in-match");
}

/* ---------- Render helpers ---------- */
function renderUnit(u) {
  const el = E("div", "card unit");
  el.appendChild(typeBadge("ユニット", "badge-unit"));
  el.appendChild(unitArtElement(u.name));

  const h = E("h4"); h.textContent = u.name; el.appendChild(h);
  const stats = E("div", "stats"); stats.textContent = `攻撃 ${u.atk} / 体力 ${u.hp}`; el.appendChild(stats);

  // キーワードバッジ（聖盾は消費で非表示）
  const kwRow = kwRowFor(u.kw, u._shieldUsed);
  if (kwRow) el.appendChild(kwRow);

  // 長押しプレビュー（盤面ユニット）
  attachLongPress(el, () => openCardPreview({
    type:"unit", name: u.name, cost: u.cost ?? 0, atk: u.atk, hp: u.hp,
    kw: u.kw, _shieldUsed: u._shieldUsed
  }));

  return el;
}

/* ---------- Keyword labels & tooltip ---------- */
const KW_TIP = {
  taunt:  "挑発：このユニットが場にいる限り、相手は先にこのユニットを攻撃しなければならない。",
  charge: "突撃：召喚したターンでも攻撃できる。",
  shield: "聖盾：このユニットが最初に受けるダメージを1回だけ無効化する。",
  // deathrattle は個別に動的説明
};

function kwBadge(label, tip) {
  const b = E("span", "kw");
  b.textContent = label;
  b.setAttribute("data-tip", tip);
  b.title = tip;
  return b;
}

// 死亡時の効果テキストを生成（手札/盤面どちらでも利用）
function effectToText(e){
  if (!e) return "効果";
  switch (e.kind) {
    case "draw":        return `${e.n ?? 1}枚ドロー`;
    case "damage":
      if (e.target === "face")          return `敵ヒーローに${e.n}ダメージ`;
      if (typeof e.target === "number") return `敵ユニット#${e.target+1}に${e.n}ダメージ`;
      if (e.target === "chooseEnemy")   return `選んだ敵ユニットに${e.n}ダメージ`;
      return `${e.n}ダメージ`;
    case "heal":
      if (e.target === "face")          return `自ヒーローを${e.n}回復`;
      if (typeof e.target === "number") return `味方ユニット#${e.target+1}を${e.n}回復`;
      return `${e.n}回復`;
    case "buffAttack":
      if (e.target === "chooseAlly")    return `選んだ味方ユニットの攻撃+${e.n}`;
      return `味方ユニットの攻撃+${e.n}`;
    case "buffHealth":
      if (e.target === "chooseAlly")    return `選んだ味方ユニットの体力+${e.n}`;
      return `味方ユニットの体力+${e.n}`;
    default:            return "効果";
  }
}
function deathrattleText(effs){
  if (!Array.isArray(effs) || effs.length === 0)
    return "死亡時：倒されたとき、効果を発動。";
  const parts = effs.map(effectToText);
  return `死亡時：${parts.join("、")}`;
}

function kwRowFor(kw, shieldUsed) {
  if (!kw) return null;
  const row = E("div", "kw-row"); let added = false;

  if (kw.taunt)       { row.appendChild(kwBadge("挑発",   KW_TIP.taunt));  added = true; }
  if (kw.charge)      { row.appendChild(kwBadge("突撃",   KW_TIP.charge)); added = true; }
  if (kw.shield && !shieldUsed) {
                      row.appendChild(kwBadge("聖盾",     KW_TIP.shield)); added = true;
  }
  if (kw.deathrattle) {
    row.appendChild(kwBadge("死亡時", deathrattleText(kw.deathrattle)));
    added = true;
  }
  return added ? row : null;
}

function renderCard(c, idx) {
  const el = E("div", `card ${c.type} selectable`);

  if (c.type === "unit")       el.appendChild(typeBadge("ユニット", "badge-unit"));
  else if (c.type === "spell") el.appendChild(typeBadge("スペル", "badge-spell"));
  else if (c.type === "equip") el.appendChild(typeBadge("装備", "badge-equip"));

  if (c.type === "unit")       el.appendChild(unitArtElement(c.name));
  else if (c.type === "spell") el.appendChild(spellArtElement(c.name));
  else if (c.type === "equip") el.appendChild(equipArtElement(c.name));

  const h = E("h4"); h.textContent = c.name; el.appendChild(h);

  const cost = E("div", `cost-bubble ${c.type}`);
  cost.textContent = c.cost ?? 0;
  el.appendChild(cost);

  const meta = E("div", "meta");
  const stats = E("span", "stats");
  if (c.type === "unit")       stats.textContent = `攻撃 ${c.atk} / 体力 ${c.hp}`;
  else if (c.type === "spell") stats.textContent = `スペル`;
  else if (c.type === "equip") stats.textContent = `装備`;
  meta.appendChild(stats);
  el.appendChild(meta);

  // 手札のユニットにもキーワードバッジ
  if (c.type === "unit") {
    const kwRow = kwRowFor(c.kw, false);
    if (kwRow) el.appendChild(kwRow);
  }

  const desc = E("div", "desc"); desc.textContent = cardDescription(c); el.appendChild(desc);
  el.dataset.handIdx = idx;

  el.addEventListener("click", () => {
    const t = cardTargetType(c);
    if (t) {
      if (pendingSpell && pendingSpell.handIdx === idx) { clearTargeting(); renderAll(window.__STATE__, window.__YOU__); return; }
      clearSelection();
      pendingSpell = { handIdx: idx, target: t };
      renderAll(window.__STATE__, window.__YOU__);
    } else {
      clearTargeting();
      el.dispatchEvent(new CustomEvent("playcard", { bubbles: true, detail: { idx } }));
    }
  });

  // 長押しプレビュー（手札カード）
  attachLongPress(el, () => openCardPreview({
    type: c.type, name: c.name, cost: c.cost ?? 0,
    atk: c.atk, hp: c.hp, kw: c.kw, _shieldUsed: false, effect: c.effect
  }));

  return el;
}

function typeBadge(text, cls) {
  const b = E("div", `type-badge ${cls}`);
  b.textContent = text;
  return b;
}

function renderHiddenCard() {
  // 相手手札：カード裏面を表示
  const el = E("div", "card back");

  const wrap = E("div", "art");
  const img = document.createElement("img");
  img.className = "art-img";
  img.loading = "lazy";
  img.alt = "カードの裏面";

  const exts = [".webp", ".png", ".jpg", ".jpeg"];
  const candidates = [];
  for (const ext of exts) {
    candidates.push(`/img/card-back${ext}`);
    candidates.push( `img/card-back${ext}`);
  }

  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      img.remove();
      const ph = document.createElement("div");
      ph.className = "art-ph";
      ph.textContent = "🂠";
      wrap.appendChild(ph);
      return;
    }
    img.src = candidates[i++];
  };
  img.onerror = tryNext;
  tryNext();

  wrap.appendChild(img);
  el.appendChild(wrap);
  return el;
}

function setupFaceOverlay({ board, show }) {
  const oppRow = document.getElementById("oppRow");
  const oppHpEl = document.getElementById("oppHp");
  if (!oppRow) return;

  let zone = document.getElementById("faceZone");
  if (!zone) {
    zone = document.createElement("button");
    zone.id = "faceZone";
    zone.type = "button";
    zone.className = "face-zone hidden";
    zone.innerHTML = `<span class="face-zone-label">直接攻撃！！</span>`;
    oppRow.appendChild(zone);
  }

  oppHpEl?.classList.toggle("face-ready", !!show);

  if (show) {
    zone.classList.remove("hidden");
    zone.onclick = () => {
      if (typeof attackerSel === "number") {
        board.dispatchEvent(new CustomEvent("attack", {
          bubbles: true,
          detail: { attackerIdx: attackerSel, targetIdx: "face" }
        }));
        clearSelection();
      }
    };
  } else {
    zone.classList.add("hidden");
    zone.onclick = null;
  }
}

/* ---------- Descriptions (JP) ---------- */
function effectDesc(e) {
  if (e.kind === "damage") {
    if (e.target === "face") return `敵ヒーローに${e.n}ダメージ`;
    if (e.target === "chooseEnemy") return `選んだ敵ユニットに${e.n}ダメージ`;
    return `敵ユニット#${(e.target|0)+1}に${e.n}ダメージ`;
  }
  if (e.kind === "heal") return `自分のヒーローを${e.n}回復`;
  if (e.kind === "draw") return `カードを${e.n}枚引く`;
  if (e.kind === "buffAttack") {
    if (e.target === "chooseAlly") return `選んだ味方ユニットの攻撃+${e.n}`;
    return `${e.self ? "自分" : "敵"}ユニット#${(e.target|0)+1}の攻撃+${e.n}`;
  }
  if (e.kind === "buffHealth") {
    if (e.target === "chooseAlly") return `選んだ味方ユニットの体力+${e.n}`;
    return `${e.self ? "自分" : "敵"}ユニット#${(e.target|0)+1}の体力+${e.n}`;
  }
  return "";
}

function cardDescription(c) {
  if (c.type === "unit") return `ユニット`;
  if (c.type === "spell") return (c.effect||[]).map(effectDesc).join("・");
  if (c.type === "equip") {
    const a = c.bonus?.atk ?? 0, h = c.bonus?.hp ?? 0;
    const pieces = [];
    if (a) pieces.push(`攻撃+${a}`);
    if (h) pieces.push(`体力+${h}`);
    return `味方ユニット1体を選んで装備：${pieces.length ? pieces.join(" / ") : "効果なし"}`;
  }
  return "";
}

function cardTargetType(card){
  if (card.type === "equip") return "ally";
  if (card.type === "spell") {
    const effs = card.effect || [];
    if (effs.some(e => e.target === "chooseEnemy")) return "enemy";
    if (effs.some(e => e.target === "chooseAlly"))  return "ally";
  }
  return null;
}

/* ---------- Utils ---------- */
function refreshSelectionHighlight(youRow, idx) { [...youRow.children].forEach((c, i) => c.classList.toggle("selected", i === idx)); }
function clearSelection() {
  attackerSel = null;
  document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
  document.getElementById("oppHp")?.classList.remove("face-target");
  setupFaceOverlay({ board: document.getElementById("board"), show: false });
}
function clearTargeting(){ pendingSpell = null; document.querySelectorAll(".targetable").forEach((el)=>el.classList.remove("targetable")); }
function dispatchAttack(board, attackerIdx, targetIdx) { board.dispatchEvent(new CustomEvent("attack", { bubbles: true, detail: { attackerIdx, targetIdx } })); }
function dispatchSpellTarget(board, handIdx, targetIdx) { board.dispatchEvent(new CustomEvent("spelltarget", { bubbles: true, detail: { handIdx, targetIdx } })); }

export function bindUI({ onPlayCard, onAttack, onEndTurn }) {
  const board = document.getElementById("board");
  document.getElementById("youHand").addEventListener("playcard", (e) => onPlayCard(e.detail.idx));
  board.addEventListener("spelltarget", (e) => onPlayCard(e.detail.handIdx, e.detail.targetIdx));
  board.addEventListener("attack", (e) => onAttack(e.detail.attackerIdx, e.detail.targetIdx));
  document.getElementById("endTurn").addEventListener("click", () => { clearSelection(); clearTargeting(); onEndTurn(); });
}

/* ---------- Overlay ---------- */
function hideEndOverlay() {
  const ov = document.getElementById("overlay"); if (!ov) return;
  ov.classList.add("hidden"); ov.classList.remove("win","lose","draw");
  const conf = document.getElementById("confetti"); if (conf) conf.innerHTML = "";
  const a = document.getElementById("overlayActions");
  if (a) a.replaceChildren();
}

function showEndOverlay(type, text) {
  const ov = document.getElementById("overlay"); const msg = document.getElementById("overlayMsg");
  if (!ov || !msg) return;

  msg.textContent = text;
  ov.classList.remove("hidden"); ov.classList.remove("win","lose","draw"); ov.classList.add(type);

  // confetti（勝利のみ）
  const conf = document.getElementById("confetti");
  if (conf) {
    conf.innerHTML = "";
    if (type === "win") {
      for (let i=0;i<80;i++) {
        const s = document.createElement("span");
        s.style.left = (Math.random()*100) + "vw";
        s.style.animationDuration = (2.5 + Math.random()*1.5) + "s";
        s.style.animationDelay = (Math.random()*0.6) + "s";
        s.style.background = `hsl(${Math.floor(Math.random()*360)}, 90%, 60%)`;
        conf.appendChild(s);
      }
    }
  }

  let actions = document.getElementById("overlayActions");
  if (!actions) {
    actions = document.createElement("div");
    actions.id = "overlayActions";
    actions.className = "overlay-actions";
    ov.appendChild(actions);
  }
  actions.innerHTML = `<button id="btnLobby" class="btn-ghost">ロビーに戻る</button>`;

  document.getElementById("btnLobby").onclick = () => {
    hideEndOverlay();
    document.body.classList.remove("in-match");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
}

function slugifyJP(name){
  return name
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .trim()
    .replace(/[\s\u3000]+/g, "-")
    .toLowerCase();
}

function unitArtElement(name){
  const wrap = document.createElement("div");
  wrap.className = "art";

  const img = document.createElement("img");
  img.className = "art-img";
  img.loading = "lazy";
  img.alt = name;

  const filename = name.trim();
  const exts = [".webp", ".png", ".jpg", ".jpeg"];
  const candidates = [];
  for (const ext of exts) {
    candidates.push(`/img/units/${filename}${ext}`);
    candidates.push( `img/units/${filename}${ext}`);
  }

  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      img.remove();
      const ph = document.createElement("div");
      ph.className = "art-ph";
      ph.textContent = name.slice(0, 6);
      wrap.appendChild(ph);
      return;
    }
    img.src = candidates[i++];
  };

  img.onerror = tryNext;
  tryNext();

  wrap.appendChild(img);
  return wrap;
}

function spellArtElement(name){
  const wrap = document.createElement("div");
  wrap.className = "art";
  const img = document.createElement("img");
  img.className = "art-img";
  img.loading = "lazy";
  img.alt = name;

  const filename = name.trim();
  const exts = [".webp", ".png", ".jpg", ".jpeg"];
  const candidates = [];
  for (const ext of exts) {
    candidates.push(`/img/spells/${filename}${ext}`);
    candidates.push( `img/spells/${filename}${ext}`);
  }
  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      img.remove();
      const ph = document.createElement("div");
      ph.className = "art-ph";
      ph.textContent = name.slice(0, 6);
      wrap.appendChild(ph);
      return;
    }
    img.src = candidates[i++];
  };
  img.onerror = tryNext; tryNext();
  wrap.appendChild(img);
  return wrap;
}

function equipArtElement(name){
  const wrap = document.createElement("div");
  wrap.className = "art";
  const img = document.createElement("img");
  img.className = "art-img";
  img.loading = "lazy";
  img.alt = name;

  const filename = name.trim();
  const exts = [".webp", ".png", ".jpg", ".jpeg"];
  const candidates = [];
  for (const ext of exts) {
    candidates.push(`/img/equips/${filename}${ext}`);
    candidates.push( `img/equips/${filename}${ext}`);
  }
  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      img.remove();
      const ph = document.createElement("div");
      ph.className = "art-ph";
      ph.textContent = name.slice(0, 6);
      wrap.appendChild(ph);
      return;
    }
    img.src = candidates[i++];
  };
  img.onerror = tryNext; tryNext();
  wrap.appendChild(img);
  return wrap;
}

// ========== Long-press preview ==========
function attachLongPress(el, onTrigger, holdMs = 380) {
  let t = null, moved = false, lpFired = false, sx = 0, sy = 0;

  const clear = () => { if (t) clearTimeout(t); t = null; moved = false; };

  const start = (x, y) => {
    sx = x; sy = y; lpFired = false; clear();
    t = setTimeout(() => { lpFired = true; el.__lp_suppressClick = true; onTrigger(); }, holdMs);
  };
  const move = (x, y) => {
    if (!t) return;
    if (Math.abs(x - sx) > 10 || Math.abs(y - sy) > 10) { moved = true; clear(); }
  };
  const end = () => { clear(); setTimeout(() => (el.__lp_suppressClick = false), 50); };

  el.addEventListener("touchstart", (e) => {
    const t0 = e.touches[0]; start(t0.clientX, t0.clientY);
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    const t0 = e.touches[0]; move(t0.clientX, t0.clientY);
  }, { passive: true });
  el.addEventListener("touchend", end, { passive: true });
  el.addEventListener("touchcancel", end, { passive: true });

  el.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") start(e.clientX, e.clientY); });
  el.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") move(e.clientX, e.clientY); });
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);

  // 長押し後の誤クリック抑止
  el.addEventListener("click", (e) => { if (el.__lp_suppressClick) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

function openCardPreview(data){
  // data: {type,name,cost,atk,hp,kw,_shieldUsed,effect?}
  let backdrop = document.getElementById("previewBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "previewBackdrop";
    backdrop.className = "preview-backdrop";
    backdrop.innerHTML = `
      <div id="previewCard" class="preview-card">
        <button id="previewClose" class="preview-close" aria-label="閉じる">×</button>
        <div class="type-row"><span class="type-badge"></span><span class="cost"></span></div>
        <div class="art"></div>
        <h3 class="title"></h3>
        <div class="stats"></div>
        <div class="kw-row"></div>
        <div class="desc"></div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (e)=>{ if(e.target===backdrop) closeCardPreview(); });
    backdrop.querySelector("#previewClose").addEventListener("click", closeCardPreview);
    document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeCardPreview(); });
  }

  const card = backdrop.querySelector("#previewCard");
  const typeBadge = card.querySelector(".type-badge");
  const costEl = card.querySelector(".cost");
  const art = card.querySelector(".art");
  const title = card.querySelector(".title");
  const stats = card.querySelector(".stats");
  const kwRow = card.querySelector(".kw-row");
  const desc = card.querySelector(".desc");

  // 種別
  typeBadge.textContent = (data.type==="unit"?"ユニット":data.type==="spell"?"スペル":"装備");
  typeBadge.className = "type-badge " + (data.type==="unit"?"badge-unit":data.type==="spell"?"badge-spell":"badge-equip");
  costEl.textContent = `コスト ${data.cost ?? 0}`;

  // アート
  art.innerHTML = "";
  if (data.type==="unit") art.appendChild(unitArtElement(data.name));
  else if (data.type==="spell") art.appendChild(spellArtElement(data.name));
  else art.appendChild(equipArtElement(data.name));
  art.querySelectorAll(".art-img").forEach(img => img.classList.add("art-img-large"));

  // テキスト
  title.textContent = data.name;
  stats.textContent = (data.type==="unit") ? `攻撃 ${data.atk} / 体力 ${data.hp}` : "";
  kwRow.innerHTML = "";
  const krow = kwRowFor(data.kw, data._shieldUsed);
  if (krow) kwRow.append(...krow.childNodes);
  desc.textContent = cardDescription(data);

  document.body.classList.add("preview-open");
  backdrop.classList.add("show");
  setTimeout(()=>backdrop.classList.add("visible"), 0);
}
function closeCardPreview(){
  const backdrop = document.getElementById("previewBackdrop");
  if (!backdrop) return;
  backdrop.classList.remove("visible");
  setTimeout(()=>{
    backdrop.classList.remove("show");
    document.body.classList.remove("preview-open");
  }, 120);
}
