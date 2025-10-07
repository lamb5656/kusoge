// Clean UI renderer: subtle accents, JP descriptions, targeted spell/equip, face lock with blockers
const E = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };

let attackerSel = null;
let attackEnabled = false;
let pendingSpell = null; // { handIdx, target: 'enemy'|'ally' }

document.addEventListener("keydown", (e) => { if (e.key === "Escape") clearTargeting(); });

export function renderAll(state, you) {
  const me  = state.players[you];
  const opp = state.players[you === "A" ? "B" : "A"];
  const board = document.getElementById("board");

  attackEnabled = state.turn === you && !state.winner;

  // HP / Turn
  const youHpEl = document.getElementById("youHp");
  const oppHpEl = document.getElementById("oppHp");
  youHpEl.textContent = `${me.alias} HP: ${me.hp}`;
  oppHpEl.textContent = `${opp.alias} HP: ${opp.hp}`;
  document.getElementById("turnInfo").textContent = state.winner ? `Game Over` : `Turn: ${state.turn}`;
  document.getElementById("manaInfo").textContent = `Mana: ${me.mana}/${me.maxMana}`;

  // End overlay（日本語）
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

    // 視覚ヒント（元の挙動は維持）
    if (attackEnabled && u.canAttack) el.classList.add("can-attack");

    // ★ 常時バインドして、内側で判定
    el.addEventListener("click", () => {
      if (pendingSpell) return;        // 対象選択中は攻撃選択に入らない
      if (!attackEnabled) return;      // 自分のターン以外は無効

      if (attackerSel === i) {
        clearSelection();
      } else {
        attackerSel = i;
        refreshSelectionHighlight(youRow, i);
        const faceOK = opp.row.length === 0;
        if (faceOK) document.getElementById("oppHp")?.classList.add("face-target");
      }
    });

    // Ally target (spell/equip) は元のまま
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
      // 敵ユニットへの攻撃クリック（★ 常時バインド & 内側で判定）
      el.addEventListener("click", () => {
        if (pendingSpell) return;        // 対象選択中は攻撃しない
        if (!attackEnabled) return;      // 自分のターン以外は無効
        if (attackerSel === null) return;

        // ユニット→ユニット攻撃
        dispatchAttack(board, attackerSel, i);
        clearSelection();
      });
    }
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
}

/* ---------- Render helpers ---------- */
function renderUnit(u) {
  const el = E("div", "card unit");
  el.appendChild(typeBadge("ユニット", "badge-unit"));
  el.appendChild(unitArtElement(u.name));
  const h = E("h4"); h.textContent = u.name; el.appendChild(h);
  const stats = E("div", "stats"); stats.textContent = `攻撃 ${u.atk} / 体力 ${u.hp}`; el.appendChild(stats);
  return el;
}

function renderCard(c, idx) {
  const el = E("div", `card ${c.type} selectable`);

  // タイプ別バッジ
  if (c.type === "unit")      el.appendChild(typeBadge("ユニット", "badge-unit"));
  else if (c.type === "spell") el.appendChild(typeBadge("スペル", "badge-spell"));
  else if (c.type === "equip") el.appendChild(typeBadge("装備", "badge-equip"));

  // ★ カード種別ごとに画像を表示
  if (c.type === "unit")       el.appendChild(unitArtElement(c.name));
  else if (c.type === "spell") el.appendChild(spellArtElement(c.name));
  else if (c.type === "equip") el.appendChild(equipArtElement(c.name));

  const h = E("h4"); h.textContent = c.name; el.appendChild(h);

  // 右上コストバッジ
  const cost = E("div", `cost-bubble ${c.type}`);
  cost.textContent = c.cost ?? 0;
  el.appendChild(cost);

  // メタ行
  const meta = E("div", "meta");
  const stats = E("span", "stats");
  if (c.type === "unit") stats.textContent = `攻撃 ${c.atk} / 体力 ${c.hp}`;
  else if (c.type === "spell") stats.textContent = `スペル`;
  else if (c.type === "equip") stats.textContent = `装備`;
  meta.appendChild(stats);
  el.appendChild(meta);

  const desc = E("div", "desc"); desc.textContent = cardDescription(c); el.appendChild(desc);
  el.dataset.handIdx = idx;

  // クリック処理（既存のまま）
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

  return el;
}


function typeBadge(text, cls) {
  const b = E("div", `type-badge ${cls}`);
  b.textContent = text;
  return b;
}

function renderHiddenCard() { const el = E("div", "card"); const h = E("h4"); h.textContent = "?"; el.appendChild(h); return el; }

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
function clearSelection() { attackerSel = null; document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected")); document.getElementById("oppHp")?.classList.remove("face-target"); }
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
}
function showEndOverlay(type, text) {
  const ov = document.getElementById("overlay"); const msg = document.getElementById("overlayMsg");
  if (!ov || !msg) return;
  msg.textContent = text;
  ov.classList.remove("hidden"); ov.classList.remove("win","lose","draw"); ov.classList.add(type);
  const conf = document.getElementById("confetti"); if (!conf) return;
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

function slugifyJP(name){
  // 記号除去 → 空白/全角空白→ハイフン → 小文字
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

  // ファイル名は基本「そのまま」（日本語OK）。必要なら slugifyJP(name) に入れ替え可。
  const filename = name.trim();
  const exts = [".webp", ".png", ".jpg", ".jpeg"];

  // 絶対・相対どちらでも成功するよう両方試す
  const candidates = [];
  for (const ext of exts) {
    candidates.push(`/img/units/${filename}${ext}`); // ルート起点（CF Workers/通常ホスティング向け）
    candidates.push( `img/units/${filename}${ext}`); // 相対パス（GH Pages のサブパス対策）
  }

  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      // どれも失敗ならプレースホルダー
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
