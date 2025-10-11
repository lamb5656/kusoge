import { mulberry32, seedFromString } from './core/rng.js';
import { loadMeta, saveMeta, loadRun, saveRun, clearRun, defaultMeta } from './core/save.js';
import { choice } from './core/math.js';
import { CLASSES } from './world/classes.js';
import { RELICS_POOL } from './world/relics.js';
import { BOOSTS_POOL } from './world/boosts.js';
import { pickEvent } from './world/events.js';
import { enemyForFloor } from './world/enemies.js';
import { nextNodeOptions } from './world/map.js';
import { runBattle } from './battle/engine.js';
import { screenTitle, screenClassSelect, screenMap, screenBattle, screenReward, screenEvent, screenGameOver, screenMeta } from './ui/screens.js';

const screen = document.getElementById('screen');
const btnTitle = document.getElementById('btn-to-title');
const btnMetaTop = document.getElementById('btn-to-meta');

// === Difficulty tuning (敵の階層スケーリング) ===
const DIFF = {
  HP_PER_FLOOR: 5.5, ATK_PER_FLOOR: 1.25, DEF_PER_FLOOR: 0.6, SPD_PER_FLOOR: 0.12,
  EXP_HP: 1.012, EXP_ATK: 1.010, EXP_DEF: 1.008, EXP_SPD: 1.004,
  MILESTONES: [
    { at: 5,  hp: 1.08, atk: 1.06, def: 1.04 },
    { at: 10, hp: 1.12, atk: 1.08, def: 1.06, spd: 1.04 },
    { at: 15, hp: 1.15, atk: 1.10, def: 1.08, spd: 1.05 },
  ],
  CRIT_RATE_PER_FLOOR: 0.0025, // +0.25%/F
  CRIT_MULT_PER_3F:   0.005,   // +0.5%/3F
};

function scaleEnemyByFloor(enemy, floor){
  const f = Math.max(1, floor|0);
  const e = { ...enemy };
  // 線形
  e.maxHp = Math.floor(e.maxHp + DIFF.HP_PER_FLOOR  * f);
  e.atk   = Math.floor(e.atk   + DIFF.ATK_PER_FLOOR * f);
  e.def   = Math.floor(e.def   + DIFF.DEF_PER_FLOOR * f);
  e.spd   = Math.max(1, Math.floor(e.spd + DIFF.SPD_PER_FLOOR * f));
  // 指数
  e.maxHp = Math.floor(e.maxHp * Math.pow(DIFF.EXP_HP,  f-1));
  e.atk   = Math.floor(e.atk   * Math.pow(DIFF.EXP_ATK, f-1));
  e.def   = Math.floor(e.def   * Math.pow(DIFF.EXP_DEF, f-1));
  e.spd   = Math.max(1, Math.floor(e.spd * Math.pow(DIFF.EXP_SPD, f-1)));
  // 節目
  for (const m of DIFF.MILESTONES){
    if (f >= m.at){
      if (m.hp)  e.maxHp = Math.floor(e.maxHp * m.hp);
      if (m.atk) e.atk   = Math.floor(e.atk   * m.atk);
      if (m.def) e.def   = Math.floor(e.def   * m.def);
      if (m.spd) e.spd   = Math.max(1, Math.floor(e.spd * m.spd));
    }
  }
  // クリ
  e.critRate = Math.min(0.5, (e.critRate || 0) + DIFF.CRIT_RATE_PER_FLOOR * f);
  e.critMult = (e.critMult || 1.5) + Math.min(0.4, DIFF.CRIT_MULT_PER_3F * Math.floor(f/3));
  e.hp = e.maxHp;
  return e;
}

// === temp buffs: apply at battle start, revert after ===
const BATTLE_STAT_KEYS = ['atk','def','spd','critRate','critMult','critCap','bonusSpdPct','maxHp']; // ←HPは除外

function applyTempStartBuffs(run, logFn){
  const ctx = { state: run, log: logFn, metaUpgrades: run.metaUpgrades };
  // スナップショット（戦闘後に元へ戻す）
  const snap = {};
  for (const k of BATTLE_STAT_KEYS) snap[k] = run.player[k];
  run._battleStatSnapshot = snap;

  // 今戦闘限定の onBattleStart をここで明示的に発火
  for (const r of (run.activeTempRelics || [])){
    if (r.hooks?.onBattleStart) r.hooks.onBattleStart(ctx);
  }
}

function revertTempStartBuffs(run){
  const s = run._battleStatSnapshot;
  if (!s) return;
  // ダメージ等は維持したいので HP は触らない
  for (const k of Object.keys(s)) run.player[k] = s[k];
  delete run._battleStatSnapshot;
}

// === 互換: 旧バージョンの tempRelic を移行（_tempBattle が relics に混在していた場合） ===
function migrateTempRelicsInRun(run){
  if (!run) return;
  run.tempRelics = run.tempRelics || [];
  if (Array.isArray(run.relics)){
    const keep = [];
    for (const r of run.relics){
      if (r && typeof r._tempBattle === 'number'){
        run.tempRelics.push({
          id: r.id || `tmp_${Date.now()}`,
          name: r.name || '一時バフ',
          hooks: r.hooks || {},
          battlesLeft: Math.max(0, r._tempBattle|0)
        });
      } else {
        keep.push(r);
      }
    }
    run.relics = keep;
  }
}

let meta = loadMeta();
let run = loadRun();
migrateTempRelicsInRun(run);

renderTitle();

btnTitle.addEventListener('click', () => renderTitle());
btnMetaTop.addEventListener('click', () => renderMeta());

function renderTitle(){
  screen.innerHTML = screenTitle(meta, !!run);
  document.getElementById('btn-new-run').addEventListener('click', startNewRun);
  const c = document.getElementById('btn-continue');
  if (c) c.addEventListener('click', () => { if(run){ continueRun(); } });
  document.getElementById('btn-meta').addEventListener('click', renderMeta);
  document.getElementById('btn-wipe').addEventListener('click', () => { clearRun(); run=null; renderTitle(); });
}

function startNewRun(){
  const picks = shuffle([...CLASSES]).slice(0,3);
  screen.innerHTML = screenClassSelect(picks);
  for (const el of screen.querySelectorAll('.select-class')){
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      const cls = CLASSES.find(c=>c.id===id);
      beginRun(cls);
    });
  }
}

function continueRun(){
  if (!run) { renderTitle(); return; }
  if (run.mode === 'MAP') renderMap();
  else if (run.mode === 'BATTLE') renderBattle();
  else if (run.mode === 'REWARD') renderReward();
  else if (run.mode === 'EVENT') renderEvent();
  else renderMap();
}

function beginRun(playerClass){
  const timeSeed = Date.now().toString(16);
  const seed = seedFromString('run-'+timeSeed);
  const rng = mulberry32(seed);

  const p = JSON.parse(JSON.stringify(playerClass.base));
  applyMetaToBase(p, meta.upgrades);

  const player = {
    maxHp: Math.floor(p.hp),
    hp: Math.floor(p.hp),
    atk: Math.floor(p.atk),
    def: Math.floor(p.def),
    spd: Math.floor(p.spd),
    critRate: p.critRate,
    critMult: p.critMult,
    critCap: 0.5,
    bonusSpdPct: 0
  };

  run = {
    seed, rngTick: 0,
    mode: 'MAP',
    floor: 1,
    soulsThisRun: 0,
    relics: [],
    tempRelics: [],        // ★ 一時バフはここに保持
    activeTempRelics: [],  // ★ 「現在の戦闘で有効なもの」を分離
    playerClass: playerClass,
    player,
    enemy: null,
    nextNodes: nextNodeOptions(rng, 1),
    meta,
    metaUpgrades: meta.upgrades
  };
  saveRun(run);
  renderMap();
}

function applyMetaToBase(base, upg){
  base.hp = Math.floor(base.hp * (1 + 0.10 * (upg.vitality || 0)));
  base.atk = Math.floor(base.atk * (1 + 0.10 * (upg.sharpness || 0)));
  base.spd = Math.floor(base.spd * (1 + 0.10 * (upg.haste || 0)));
}

function renderMap(){
  if (!run) return renderTitle();
  screen.innerHTML = screenMap(run);
  for (const el of screen.querySelectorAll('.node')){
    el.addEventListener('click', () => {
      const i = Number(el.getAttribute('data-i'));
      const node = run.nextNodes[i];
      if (node.t === 'BATTLE'){
        startBattle();
      } else if (node.t === 'EVENT'){
        startEvent();
      } else {
        startBattle();
      }
    });
  }
}

function startBattle(){
  // ★ バトル開始時に tempRelics を起動・消費
  run.activeTempRelics = [];
  const keep = [];
  for (const t of (run.tempRelics || [])){
    if ((t.battlesLeft|0) > 0){
      run.activeTempRelics.push({ id: t.id, name: t.name, hooks: t.hooks || {} });
      t.battlesLeft -= 1; // 今の戦闘で消費
      if (t.battlesLeft > 0) keep.push(t); // 残りがあれば保持
    }
  }
  run.tempRelics = keep;

  run.enemy = scaleEnemyByFloor(enemyForFloor(run.floor), run.floor);
  run.mode = 'BATTLE';
  saveRun(run);
  renderBattle();
}

function renderBattle(){
  screen.innerHTML = screenBattle(run);
  document.getElementById('btn-battle-run').addEventListener('click', doBattle);
  document.getElementById('btn-battle-retreat').addEventListener('click', () => gameOver());
  const clearBtn = document.getElementById('btn-log-clear');
  if (clearBtn) clearBtn.addEventListener('click', ()=>{ const el = document.getElementById('battle-log'); if (el) el.textContent=''; });
}

function buildHooks(){
  const all = { 
    onBattleStart: (ctx)=>{},
    onAfterAttack: (ctx)=>{},
    onTurnEnd: (ctx)=>{},
    onBeforeDamageTaken: (ctx)=>{},
    onHeal: (ctx)=>{},
  };
  const merge = (src) => {
    for (const r of (src || [])){
      const h = r.hooks || {};
      for (const k of Object.keys(all)){
        if (h[k]){
          const prev = all[k];
          all[k] = (ctx) => { prev(ctx); h[k](ctx); };
        }
      }
    }
  };
  merge(run.relics);           // 恒久
  merge(run.activeTempRelics); // 今戦闘限定
  return all;
}

function doBattle(){
  const logEl = document.getElementById('battle-log');
  const pushLog = (s) => { logEl.textContent += s + "\n"; logEl.scrollTop = logEl.scrollHeight; };
  const hooks = buildHooks();
  const rng = mulberry32(run.seed + (++run.rngTick));

  // 一時バフ（activeTempRelics）の「戦闘開始時」効果を明示適用
  applyTempStartBuffs(run, pushLog);

  // Disable action buttons during resolution
  const runBtn = document.getElementById('btn-battle-run');
  const retreatBtn = document.getElementById('btn-battle-retreat');
  if (runBtn) runBtn.disabled = true;
  if (retreatBtn) runBtn.disabled = true;

  const result = runBattle(run, hooks, rng, pushLog);

  // 戦闘が終わったら一時バフの数値を元に戻す
  revertTempStartBuffs(run);

  // 今戦闘中フックの元データはクリア
  run.activeTempRelics = [];
  saveRun(run);

  const statusEl = document.getElementById('battle-status');
  const nextBtn = document.getElementById('btn-battle-next');
  if (nextBtn) nextBtn.classList.remove('hidden');

  if (result.win){
    if (statusEl) statusEl.textContent = '勝利！「結果へ」を押して報酬選択へ進む。';
    if (nextBtn) nextBtn.onclick = ()=>{
      run.soulsThisRun += 2 + Math.floor(run.floor * 0.6);
      run.floor += 1;
      run.mode = 'REWARD';
      saveRun(run);
      renderReward();
    };
  } else {
    if (statusEl) statusEl.textContent = '敗北…「結果へ」を押してリザルトへ。';
    if (nextBtn) nextBtn.onclick = ()=>{ gameOver(); };
  }
}

function startEvent(){
  run.mode = 'EVENT';
  saveRun(run);
  renderEvent();
}

function renderEvent(){
  const rng = mulberry32(run.seed + (++run.rngTick));
  const ev = pickEvent(rng, run, meta);
  screen.innerHTML = screenEvent(run, ev.text);
  const acceptBtn = document.getElementById('btn-event-accept');
  const declineBtn = document.getElementById('btn-event-decline');
  if (acceptBtn) acceptBtn.addEventListener('click', () => {
    ev.accept();
    saveMeta(meta);
    saveRun(run);
    proceedAfterNode();
  });
  if (declineBtn) declineBtn.addEventListener('click', () => {
    ev.decline();
    saveRun(run);
    proceedAfterNode();
  });
}

function proceedAfterNode(){
  const rng = mulberry32(run.seed + (++run.rngTick));
  run.nextNodes = nextNodeOptions(rng, run.floor);
  run.mode = 'MAP';
  saveRun(run);
  renderMap();
}

function renderReward(){
  const rng = mulberry32(run.seed + (++run.rngTick));
  const rewards = [];
  const pool = shuffle([...RELICS_POOL]);

  // Relic ×2
  rewards.push({ kind: 'relic', obj: pool[0] });
  rewards.push({ kind: 'relic', obj: pool[1] });

  // Boost ×1
  const bi = Math.max(0, Math.floor(rng() * BOOSTS_POOL.length)) % BOOSTS_POOL.length;
  rewards.push({ kind: 'boost', obj: BOOSTS_POOL[bi] });

  screen.innerHTML = screenReward(rewards);
  for (const el of screen.querySelectorAll('.pick-reward')){
    el.addEventListener('click', ()=>{
      const idx = Number(el.getAttribute('data-i'));
      const pick = rewards[idx];
      if (pick.kind === 'relic'){
        run.relics.push(pick.obj);
        if (pick.obj.hooks?.onGain){
          pick.obj.hooks.onGain({ state: run, log: ()=>{}, metaUpgrades: run.metaUpgrades });
        }
      } else {
        const b = pick.obj;
        if (b.type === 'consumable'){
          b.apply(run); // その場で消費
        } else if (b.type === 'tempRelic'){
          // ★ 一時バフは tempRelics へ（次の戦闘で自動消費）
          run.tempRelics.push({
            id: `tmp_${b.id}_${Date.now()}`,
            name: b.name,
            hooks: b.relicHooks || {},
            battlesLeft: Math.max(1, b.durationBattles || 1)
          });
        } else {
          if (typeof b.apply === 'function') b.apply(run);
        }
      }
      proceedAfterNode();
    });
  }
}

function gameOver(){
  const earned = 5 + Math.floor((run?.floor || 1) * 1.5) + (run?.soulsThisRun || 0);
  meta.soul += earned;
  saveMeta(meta);
  const summary = { floor: run?.floor || 1, soulsEarned: earned };
  run = null;
  clearRun();
  screen.innerHTML = screenGameOver(summary);
  document.getElementById('btn-go-title').addEventListener('click', renderTitle);
  document.getElementById('btn-go-meta').addEventListener('click', renderMeta);
}

function renderMeta(){
  screen.innerHTML = screenMeta(meta);
  for (const el of screen.querySelectorAll('.buy-upg')){
    el.addEventListener('click', ()=>{
      const id = el.getAttribute('data-id');
      const cost = 50;
      if (meta.soul >= cost){
        meta.soul -= cost;
        meta.upgrades[id] = (meta.upgrades[id] || 0) + 1;
        saveMeta(meta);
        renderMeta();
      }
    });
  }
}

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
