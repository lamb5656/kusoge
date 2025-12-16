// app.js

const $ = (id) => document.getElementById(id);

// ===== Settings =====
// If true: any word found in WORDS_BY_LEN[len] is accepted as correct (dictionary-based).
// If false: only the currentWord is accepted.
const ANY_WORD_OK = false;

// Normalize strings before comparing (fixes cases like が vs が).
const NORMALIZE_FORM = "NFC";

// Prebuild dictionary sets for fast lookup when ANY_WORD_OK is true.
const dictCache = new Map(); // len -> Set(normalizedWord)

// ===== DOM =====
const levelText = $("levelText");
const streakText = $("streakText");
const bestText = $("bestText");
const hintText = $("hintText");
const answerSlots = $("answerSlots");
const tilePool = $("tilePool");
const btnShuffle = $("btnShuffle");
const btnClear = $("btnClear");
const btnHint = $("btnHint");
const btnNext = $("btnNext");
const btnResetProgress = $("btnResetProgress");
const toastEl = $("toast");

// ===== State =====
const STORAGE_KEY = "ws_progress_v1";
let state = loadState();

let currentWord = "";
let currentChars = [];
let pool = [];  // { ch, id, used }
let slots = []; // slot -> poolItemId or null
let hintUsed = false;

init();

function init() {
  renderHeader();
  startRound();

  btnShuffle.addEventListener("click", () => {
    shufflePool();
    renderPool();
    toast("シャッフルした");
  });

  btnClear.addEventListener("click", () => {
    clearSlots();
    renderAll();
  });

  btnHint.addEventListener("click", () => {
    useHint();
  });

  btnNext.addEventListener("click", () => {
    nextRound();
  });

  btnResetProgress.addEventListener("click", () => {
    if (!confirm("進行をリセットしますか？")) return;
    state = defaultState();
    saveState();
    renderHeader();
    nextRound();
    toast("リセットした");
  });
}

function defaultState() {
  return {
    progressionIndex: 0,
    clearsInThisTier: 0,
    streak: 0,
    best: 0,
    lastWord: null,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getTier() {
  return window.PROGRESSION[Math.min(state.progressionIndex, window.PROGRESSION.length - 1)];
}

function norm(s) {
  return (s ?? "").normalize(NORMALIZE_FORM);
}

function buildDictSet(len) {
  if (dictCache.has(len)) return dictCache.get(len);

  const list = window.WORDS_BY_LEN?.[len] || [];
  const set = new Set();
  for (const w of list) set.add(norm(w));
  dictCache.set(len, set);
  return set;
}

function pickWord() {
  const { len } = getTier();
  const list = window.WORDS_BY_LEN[len] || [];
  if (list.length === 0) return "ねこ"; // fallback

  // Avoid repeating the same word as last time
  let w = list[Math.floor(Math.random() * list.length)];
  if (list.length >= 2 && w === state.lastWord) {
    w = list[(list.indexOf(w) + 1) % list.length];
  }

  // Normalize for stable comparisons later
  w = norm(w);

  state.lastWord = w;
  saveState();
  return w;
}

function startRound() {
  currentWord = pickWord();           // already normalized
  currentChars = Array.from(currentWord);
  hintUsed = false;

  // Create pool items (even identical characters are distinguished by id)
  pool = currentChars.map((ch) => ({ ch, id: cryptoId(), used: false }));

  // Shuffle at start (avoid same arrangement)
  shufflePool(true);

  // Clear slots
  slots = new Array(currentChars.length).fill(null);

  renderAll();
}

function nextRound() {
  hintText.textContent = "";
  btnNext.disabled = true;
  startRound();
}

function renderAll() {
  renderHeader();
  renderSlots();
  renderPool();
  renderHint();
}

function renderHeader() {
  const lv = state.progressionIndex + 1;
  levelText.textContent = String(lv);
  streakText.textContent = String(state.streak);
  bestText.textContent = String(state.best);
}

function renderSlots() {
  answerSlots.innerHTML = "";
  slots.forEach((poolId, idx) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "slot" + (poolId ? " filled" : "");
    slot.setAttribute("aria-label", `スロット${idx + 1}`);

    if (poolId) {
      const item = pool.find((x) => x.id === poolId);
      slot.textContent = item?.ch ?? "";
    } else {
      slot.textContent = "";
    }

    // Tap to remove (return to pool)
    slot.addEventListener("click", () => {
      if (!slots[idx]) return;
      const id = slots[idx];
      slots[idx] = null;
      const item = pool.find((x) => x.id === id);
      if (item) item.used = false;
      btnNext.disabled = true;
      renderAll();
    });

    answerSlots.appendChild(slot);
  });
}

function renderPool() {
  tilePool.innerHTML = "";
  pool.forEach((item) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile" + (item.used ? " disabled" : "");
    tile.textContent = item.ch;
    tile.setAttribute("aria-label", `タイル ${item.ch}`);

    tile.addEventListener("click", () => {
      if (item.used) return;

      const emptyIndex = slots.findIndex((x) => x === null);
      if (emptyIndex === -1) {
        toast("上がいっぱい。どれかをタップして戻してね");
        return;
      }

      slots[emptyIndex] = item.id;
      item.used = true;

      renderAll();
      checkAnswerIfComplete();
    });

    tilePool.appendChild(tile);
  });
}

function renderHint() {
  if (!hintUsed) return;
  hintText.textContent = `ヒント：最初の文字は「${currentChars[0]}」`;
}

function clearSlots() {
  slots = slots.map(() => null);
  pool.forEach((x) => (x.used = false));
  btnNext.disabled = true;
  hintText.textContent = "";
  hintUsed = false;
}

function useHint() {
  if (hintUsed) {
    toast("ヒントはもう使った");
    return;
  }
  hintUsed = true;
  renderHint();
  toast("ヒントを表示した");
}

function checkAnswerIfComplete() {
  if (slots.some((x) => x === null)) return;

  const assembledRaw = slots.map((id) => pool.find((x) => x.id === id)?.ch ?? "").join("");
  const assembled = norm(assembledRaw);
  const target = norm(currentWord);

  // Exact match
  if (assembled === target) {
    onCorrect();
    return;
  }

  // Dictionary-based acceptance (optional)
  if (ANY_WORD_OK) {
    const len = currentChars.length;
    const set = buildDictSet(len);
    if (set.has(assembled)) {
      onCorrect();
      return;
    }
  }

  onWrong();
}

function onCorrect() {
  toast("正解！");
  btnNext.disabled = false;

  state.streak += 1;
  state.best = Math.max(state.best, state.streak);

  // Tier clears
  state.clearsInThisTier += 1;

  // Level up check
  const tier = getTier();
  if (state.clearsInThisTier >= tier.clearsToLevelUp) {
    if (state.progressionIndex < window.PROGRESSION.length - 1) {
      state.progressionIndex += 1;
      state.clearsInThisTier = 0;
      toast(`レベルアップ！ Lv${state.progressionIndex + 1}`);
    }
  }

  saveState();
  renderHeader();
}

function onWrong() {
  toast("ちがうよ。並べ替えてみよう");
  state.streak = 0;
  saveState();
  renderHeader();
}

function shufflePool(avoidSame = false) {
  const before = pool.map((x) => x.ch).join("");

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  if (avoidSame) {
    const after = pool.map((x) => x.ch).join("");
    if (after === before) {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
  }

  // Keep "used" state based on current slots
  const usedIds = new Set((slots || []).filter(Boolean));
  pool.forEach((x) => (x.used = usedIds.has(x.id)));
}

function cryptoId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1100);
}
