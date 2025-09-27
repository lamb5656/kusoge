/* Clicker Extended for GitHub Pages (no build, no deps)
   - UI text: Japanese
   - Comments: English only
*/

(() => {
  "use strict";

  // ---------- Utilities ----------
  const $ = (sel) => document.querySelector(sel);
  const fmt = new Intl.NumberFormat("ja-JP");

  // ---------- DOM refs (top) ----------
  const elPoints = $("#points");
  const elPerSec = $("#perSec");
  const elPerClick = $("#perClick");
  const elClickBtn = $("#clickBtn");
  const elFloatLayer = $("#floatLayer");

  // Shop containers
  const elUpgrades = $("#upgrades");
  const elWorkers = $("#workers");
  theContainerGuard(elUpgrades, "upgrades");
  theContainerGuard(elWorkers, "workers");
  const elSpecials = $("#specials");

  // Owned summary
  const elLvlClickPower = $("#lvlClickPower");
  const elCritPercent = $("#critPercent");
  const elCritX = $("#critX");
  const elGoldenPercent = $("#goldenPercent");
  const elResearchBonus = $("#researchBonus");
  const elOfflineCap = $("#offlineCap");
  const elWorkersCount = $("#workersCount");
  const elFeverStatus = $("#feverStatus");

  // Data section
  const elSave = $("#saveBtn");
  const elLoad = $("#loadBtn");
  const elExport = $("#exportBtn");
  const elImport = $("#importBtn");
  const elReset = $("#resetBtn");

  // Achievements
  const elAch = $("#achievements");

  function theContainerGuard(el, name) {
    if (!el) throw new Error(`Missing container: ${name}`);
  }

  // ---------- Definitions ----------
  const workerDefs = [
    { id: "w1", name: "子猫", perSec: 1,   baseCost: 50,     growth: 1.15 },
    { id: "w2", name: "黒猫", perSec: 5,   baseCost: 250,    growth: 1.15 },
    { id: "w3", name: "猫又", perSec: 20,  baseCost: 1200,   growth: 1.16 },
    { id: "w4", name: "茶屋", perSec: 75,  baseCost: 6000,   growth: 1.17 },
    { id: "w5", name: "神社", perSec: 250, baseCost: 25000,  growth: 1.18 },
    { id: "w6", name: "月の塔", perSec: 1000, baseCost: 120000, growth: 1.20 },
  ];

  const defaultState = {
    points: 0,
    perClickBase: 1,
    clickLevel: 1,

    // Crit & golden
    critChance: 0.01,        // 1%
    critMultiplier: 10,      // x10
    goldenChance: 0.001,     // 0.1%
    goldenMultiplier: 100,   // x100

    // Global multipliers
    researchLvl: 0,          // each +5% to worker perSec
    offlineCapMins: 10,      // offline cap minutes
    feverActiveUntil: 0,     // timestamp ms
    feverMultiplier: 2,      // x2 during fever

    // Workers (id -> count)
    workers: {
      w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0
    },

    // Costs (dynamic)
    costs: {
      clickPower: 10,
      crit: 200,
      critMult: 400,
      gold: 800,
      research: 1500,
      offlineCap: 1000,
      fever: 500
    },

    // Legacy / misc
    lastTick: Date.now(),
    lastSaved: Date.now(),
    totalClicks: 0,
    achievements: {}
  };

  let S = { ...defaultState };

  // ---------- Persistence ----------
  const KEY = "clicker_pages_v2";
  function save(manual = false) {
    try {
      S.lastSaved = Date.now();
      localStorage.setItem(KEY, JSON.stringify(S));
      if (manual) toast("+ 保存しました");
    } catch (e) {
      console.error(e);
      if (manual) alert("保存に失敗しました。容量やプライベートモードをご確認ください。");
    }
  }

  function migrateFromV1() {
    try {
      const raw1 = localStorage.getItem("clicker_pages_v1");
      if (!raw1) return false;
      const v1 = JSON.parse(raw1);
      // Shallow merge
      S = { ...S, ...v1 };
      S.lastSaved = Date.now();
      // Map old auto to workers (optional boost)
      if (typeof v1.autoCount === "number" && v1.autoCount > 0) {
        S.workers.w1 += v1.autoCount;
      }
      localStorage.removeItem("clicker_pages_v1");
      return true;
    } catch {
      return false;
    }
  }

  function load(manual = false) {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        // Attempt migration
        if (migrateFromV1()) {
          if (manual) toast("+ 旧データを引き継ぎました");
          return true;
        }
        if (manual) alert("保存データがありません。");
        return false;
      }
      const obj = JSON.parse(raw);
      S = { ...defaultState, ...obj };

      // sanitize
      S.points = Math.max(0, Number(S.points) || 0);
      S.perClickBase = Math.max(1, Number(S.perClickBase) || 1);
      S.critChance = clamp(Number(S.critChance) || 0.01, 0, 0.9);
      S.critMultiplier = clampInt(Number(S.critMultiplier) || 10, 1, 50);
      S.goldenChance = clamp(Number(S.goldenChance) || 0.001, 0, 0.05);
      S.goldenMultiplier = clampInt(Number(S.goldenMultiplier) || 100, 10, 1000);
      S.researchLvl = clampInt(Number(S.researchLvl) || 0, 0, 1000);
      S.offlineCapMins = clampInt(Number(S.offlineCapMins) || 10, 0, 24 * 60);
      if (!S.workers) S.workers = { w1:0,w2:0,w3:0,w4:0,w5:0,w6:0 };
      S.lastTick = Date.now();

      // Offline gains (approx using current perSec)
      const idleSec = Math.min(
        Math.max(0, Math.floor((Date.now() - (obj.lastSaved || Date.now())) / 1000)),
        S.offlineCapMins * 60
      );
      if (idleSec > 0) {
        const gain = getPerSecEstimate(S) * idleSec;
        if (gain > 0) {
          S.points += gain;
          toast(`+ オフライン回収 ${fmt.format(Math.floor(gain))} pt`);
        }
      }

      if (manual) toast("+ 読み込みました");
      return true;
    } catch (e) {
      console.error(e);
      if (manual) alert("読み込みに失敗しました。");
      return false;
    }
  }

  function exportData() {
    try {
      const raw = JSON.stringify(S);
      const b64 = btoa(unescape(encodeURIComponent(raw)));
      navigator.clipboard.writeText(b64).then(() => {
        toast("+ クリップボードへエクスポートしました");
      }).catch(() => {
        prompt("以下の文字列をコピーしてください：", b64);
      });
    } catch (e) {
      console.error(e);
      alert("エクスポートに失敗しました。");
    }
  }

  function importData() {
    const b64 = prompt("エクスポート文字列を貼り付けてください：");
    if (!b64) return;
    try {
      const raw = decodeURIComponent(escape(atob(b64)));
      const obj = JSON.parse(raw);
      S = { ...defaultState, ...obj };
      S.lastTick = Date.now();
      toast("+ インポートしました");
      buildShopsOnce(); // ensure DOM entries
      renderAll();
      save();
    } catch (e) {
      console.error(e);
      alert("インポートに失敗しました。文字列をご確認ください。");
    }
  }

  // ---------- Maths ----------
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function clampInt(v, min, max){ return Math.floor(clamp(v, min, max)); }
  function workerCost(def, count){
    return Math.ceil(def.baseCost * Math.pow(def.growth, count));
  }

  function feverActiveNow(){
    return Date.now() < (S.feverActiveUntil || 0);
  }

  function getPerClick() {
    let v = S.perClickBase;
    if (feverActiveNow()) v *= S.feverMultiplier;
    return v;
  }

  function getPerSec() {
    const base = workerDefs.reduce((sum, d) => sum + (S.workers[d.id] || 0) * d.perSec, 0);
    let v = base * (1 + S.researchLvl * 0.05);
    if (feverActiveNow()) v *= S.feverMultiplier;
    return v;
  }
  function getPerSecEstimate(state){
    const base = workerDefs.reduce((sum, d) => sum + (state.workers[d.id] || 0) * d.perSec, 0);
    return base * (1 + (state.researchLvl || 0) * 0.05);
  }

  // ---------- Core actions ----------
  function clickOnce() {
    const base = getPerClick();
    let gain = base;
    let tag = "";

    // Golden first, then crit
    if (Math.random() < S.goldenChance) {
      gain = base * S.goldenMultiplier;
      tag = "GOLD";
    } else if (Math.random() < S.critChance) {
      gain = base * S.critMultiplier;
      tag = "CRIT";
    }

    S.points += gain;
    S.totalClicks += 1;
    floatChip(
      `${tag ? tag + " " : ""}+${fmt.format(Math.floor(gain))}`,
      tag === "CRIT" ? "crit" : (tag === "GOLD" ? "gold" : "")
    );
    checkAchievements();
    renderTop();
  }

  function buyUpgrade(id) {
    switch(id){
      case "clickPower": {
        const c = S.costs.clickPower;
        if (S.points >= c) {
          S.points -= c;
          S.perClickBase += 1;
          S.clickLevel += 1;
          S.costs.clickPower = Math.ceil(c * 1.25 + 1);
          toast("+ パワーアップ！");
        }
        break;
      }
      case "crit": {
        const c = S.costs.crit;
        if (S.points >= c) {
          S.points -= c;
          S.critChance = clamp(S.critChance + 0.01, 0, 0.9);
          S.costs.crit = Math.ceil(c * 1.35 + 1);
          toast("+ クリ率アップ！");
        }
        break;
      }
      case "critMult": {
        const c = S.costs.critMult;
        if (S.points >= c) {
          S.points -= c;
          S.critMultiplier = clampInt(S.critMultiplier + 1, 1, 50);
          S.costs.critMult = Math.ceil(c * 1.33 + 1);
          toast("+ クリ倍率アップ！");
        }
        break;
      }
      case "gold": {
        const c = S.costs.gold;
        if (S.points >= c) {
          S.points -= c;
          S.goldenChance = clamp(S.goldenChance + 0.0005, 0, 0.05); // +0.05% each
          S.costs.gold = Math.ceil(c * 1.4 + 2);
          toast("+ ゴールデン率アップ！");
        }
        break;
      }
      case "research": {
        const c = S.costs.research;
        if (S.points >= c) {
          S.points -= c;
          S.researchLvl += 1; // +5% per level
          S.costs.research = Math.ceil(c * 1.45 + 5);
          toast("+ 研究レベルアップ！");
        }
        break;
      }
      case "offlineCap": {
        const c = S.costs.offlineCap;
        if (S.points >= c) {
          S.points -= c;
          S.offlineCapMins = clampInt(S.offlineCapMins + 10, 0, 24*60);
          S.costs.offlineCap = Math.ceil(c * 1.5 + 10);
          toast("+ オフライン上限+10分！");
        }
        break;
      }
      default: break;
    }
    renderAll();
  }

  function buyWorker(workerId) {
    const def = workerDefs.find(d => d.id === workerId);
    if (!def) return;
    const owned = S.workers[workerId] || 0;
    const cost = workerCost(def, owned);
    if (S.points >= cost) {
      S.points -= cost;
      S.workers[workerId] = owned + 1;
      floatChip(`+ ${def.name} を雇用`, "");
      renderAll();
      save();
      checkAchievements();
    }
  }

  function activateFever() {
    const c = S.costs.fever;
    if (S.points >= c) {
      S.points -= c;
      S.feverActiveUntil = Date.now() + 30_000; // 30s
      S.costs.fever = Math.ceil(c * 1.5 + 10);
      floatChip("FEVER ×2 (30秒)", "gold");
      renderAll();
      save();
    }
  }

  // ---------- Achievements ----------
  const ACH = [
    { id: "firstClick",  test: s => s.totalClicks >= 1,           label: "初クリック！" },
    { id: "hundred",     test: s => s.points >= 100,              label: "100pt 突破" },
    { id: "thousand",    test: s => s.points >= 1_000,            label: "1,000pt 突破" },
    { id: "tenK",        test: s => s.points >= 10_000,           label: "10,000pt 突破" },
    { id: "hundK",       test: s => s.points >= 100_000,          label: "100,000pt 突破" },

    { id: "w1x10",       test: s => (s.workers.w1||0) >= 10,      label: "子猫×10" },
    { id: "w3x10",       test: s => (s.workers.w3||0) >= 10,      label: "猫又×10" },
    { id: "w6x1",        test: s => (s.workers.w6||0) >= 1,       label: "月の塔×1" },

    { id: "crit10",      test: s => s.critChance >= 0.10,         label: "クリ率10%" },
    { id: "critX20",     test: s => s.critMultiplier >= 20,       label: "クリ倍率×20" },
    { id: "goldTouched", test: s => s.goldenChance >= 0.002,      label: "ゴールデンの気配" },

    { id: "research3",   test: s => s.researchLvl >= 3,           label: "研究Lv3" },
    { id: "offline60",   test: s => s.offlineCapMins >= 60,       label: "オフライン上限60分" },
    { id: "feverOnce",   test: s => s.feverActiveUntil > 0,       label: "初フィーバー！" },
  ];

  function checkAchievements() {
    let changed = false;
    for (const a of ACH) {
      if (!S.achievements[a.id] && a.test(S)) {
        S.achievements[a.id] = true;
        addAchItem(a.label);
        changed = true;
      }
    }
    if (changed) save();
  }

  function addAchItem(text) {
    const li = document.createElement("li");
    li.textContent = `✔ ${text}`;
    elAch.prepend(li);
  }

  function renderAchievements() {
    elAch.innerHTML = "";
    ACH.filter(a => S.achievements[a.id]).forEach(a => addAchItem(a.label));
  }

  // ---------- UI build & render ----------
  const upgradeDefs = [
    { id: "clickPower", name: "パワーアップ", desc: "1クリックの獲得量を+1します。", key:"clickPower" },
    { id: "crit",       name: "クリティカル率", desc: "クリティカル（×10）の発生確率を+1%。", key:"crit" },
    { id: "critMult",   name: "クリティカル倍率", desc: "クリティカル倍率を+1（最大×50）。", key:"critMult" },
    { id: "gold",       name: "ゴールデン率", desc: "ゴールデン（×100）の発生確率を+0.05%。", key:"gold" },
    { id: "research",   name: "効率研究", desc: "全ワーカーの毎秒効率を+5%。", key:"research" },
    { id: "offlineCap", name: "オフライン上限", desc: "オフライン回収の上限を+10分。", key:"offlineCap" },
  ];

  const specialsDefs = [
    { id: "fever", name: "フィーバー（30秒×2）", desc: "30秒間の獲得が×2。購入で即時発動。", key:"fever" }
  ];

  let shopsBuilt = false;
  function buildShopsOnce() {
    if (shopsBuilt) return;

    // Upgrades
    elUpgrades.innerHTML = "";
    upgradeDefs.forEach(u => {
      const art = document.createElement("article");
      art.className = "card";
      art.innerHTML = `
        <h3>${u.name}</h3>
        <p>${u.desc}</p>
        <p class="price">価格: <span id="cost_${u.id}">-</span> pt</p>
        <button id="buy_${u.id}">購入</button>
      `;
      elUpgrades.appendChild(art);
      $("#buy_" + u.id).addEventListener("click", () => buyUpgrade(u.id));
    });

    // Workers
    elWorkers.innerHTML = "";
    workerDefs.forEach(w => {
      const art = document.createElement("article");
      art.className = "card";
      art.innerHTML = `
        <h3>${w.name}</h3>
        <p>毎秒 +${fmt.format(w.perSec)} / 所持: <span id="own_${w.id}">0</span></p>
        <p class="price">価格: <span id="cost_${w.id}">-</span> pt</p>
        <button id="buy_${w.id}">購入</button>
      `;
      elWorkers.appendChild(art);
      $("#buy_" + w.id).addEventListener("click", () => buyWorker(w.id));
    });

    // Specials
    elSpecials.innerHTML = "";
    specialsDefs.forEach(su => {
      const art = document.createElement("article");
      art.className = "card";
      art.innerHTML = `
        <h3>${su.name}</h3>
        <p>${su.desc}</p>
        <p class="price">価格: <span id="cost_${su.id}">-</span> pt</p>
        <button id="buy_${su.id}">発動</button>
      `;
      elSpecials.appendChild(art);
      $("#buy_" + su.id).addEventListener("click", () => activateFever());
    });

    shopsBuilt = true;
  }

  function renderTop() {
    elPoints.textContent = fmt.format(Math.floor(S.points));
    elPerSec.textContent = fmt.format(Math.floor(getPerSec()));
    elPerClick.textContent = fmt.format(Math.floor(getPerClick()));
  }

  function renderShop() {
    // Upgrades costs & buttons
    upgradeDefs.forEach(u => {
      const cost = S.costs[u.key];
      const costEl = $("#cost_" + u.id);
      const btnEl = $("#buy_" + u.id);
      if (costEl) costEl.textContent = fmt.format(cost);
      if (btnEl) btnEl.disabled = S.points < cost;
    });

    // Workers costs & owned
    workerDefs.forEach(w => {
      const own = S.workers[w.id] || 0;
      const cost = workerCost(w, own);
      const ownEl = $("#own_" + w.id);
      const costEl = $("#cost_" + w.id);
      const btnEl = $("#buy_" + w.id);
      if (ownEl) ownEl.textContent = fmt.format(own);
      if (costEl) costEl.textContent = fmt.format(cost);
      if (btnEl) btnEl.disabled = S.points < cost;
    });

    // Specials
    const cFever = S.costs.fever;
    const costElF = $("#cost_fever");
    const btnElF = $("#buy_fever");
    if (costElF) costElF.textContent = fmt.format(cFever);
    if (btnElF) btnElF.disabled = S.points < cFever;

    // Owned summary
    elLvlClickPower.textContent = fmt.format(S.clickLevel);
    elCritPercent.textContent = `${Math.round(S.critChance * 100)}%`;
    elCritX.textContent = `×${fmt.format(S.critMultiplier)}`;
    elGoldenPercent.textContent = `${(S.goldenChance * 100).toFixed(2)}%`;
    elResearchBonus.textContent = `+${Math.round(S.researchLvl * 5)}%`;
    elOfflineCap.textContent = `${fmt.format(S.offlineCapMins)}分`;
    const totalWorkers = workerDefs.reduce((sum, d) => sum + (S.workers[d.id] || 0), 0);
    elWorkersCount.textContent = fmt.format(totalWorkers);
    elFeverStatus.textContent = feverActiveNow() ? "ON" : "OFF";
  }

  function renderAll() {
    renderTop();
    renderShop();
    renderAchievements();
  }

  function floatChip(text, kind = "") {
    const chip = document.createElement("div");
    chip.className = "float-chip";
    if (kind === "crit") {
      chip.style.borderColor = "#ffd166"; chip.style.color = "#ffd166";
      chip.style.textShadow = "0 0 10px rgba(255,209,102,.6)";
    } else if (kind === "gold") {
      chip.style.borderColor = "#f9f871"; chip.style.color = "#f9f871";
      chip.style.textShadow = "0 0 12px rgba(249,248,113,.8)";
    }
    chip.textContent = text;
    elFloatLayer.appendChild(chip);
    setTimeout(() => chip.remove(), 950);
  }

  function toast(text) { floatChip(text, ""); }

  // ---------- Loop ----------
  let saveTimer = 0;
  function loop() {
    const now = Date.now();
    const dt = (now - S.lastTick) / 1000;
    S.lastTick = now;

    // Idle earnings while active
    const ps = getPerSec();
    if (ps > 0) S.points += ps * dt;

    renderTop();
    renderShop();

    // auto-save every ~5 seconds
    saveTimer += dt;
    if (saveTimer >= 5) {
      saveTimer = 0;
      save(false);
    }

    requestAnimationFrame(loop);
  }

  // ---------- Events ----------
  function onClick(e) {
    clickOnce();
  }
  function onKey(e) {
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      clickOnce();
    }
  }

  elClickBtn.addEventListener("click", onClick);
  window.addEventListener("keydown", onKey);

  elSave.addEventListener("click", () => save(true));
  elLoad.addEventListener("click", () => { load(true); buildShopsOnce(); renderAll(); });
  elExport.addEventListener("click", exportData);
  elImport.addEventListener("click", importData);
  elReset.addEventListener("click", () => {
    if (confirm("本当にリセットしますか？この操作は元に戻せません。")) {
      S = { ...defaultState, lastTick: Date.now(), lastSaved: Date.now() };
      save(true);
      buildShopsOnce();
      renderAll();
    }
  });

  // ---------- Bootstrap ----------
  load(false);
  buildShopsOnce();
  renderAll();
  requestAnimationFrame(loop);
})();
