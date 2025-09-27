
import { mulberry32, seedFromString } from './core/rng.js';
import { loadMeta, saveMeta, loadRun, saveRun, clearRun, defaultMeta } from './core/save.js';
import { choice } from './core/math.js';
import { CLASSES } from './world/classes.js';
import { RELICS_POOL } from './world/relics.js';
import { enemyForFloor } from './world/enemies.js';
import { nextNodeOptions } from './world/map.js';
import { runBattle } from './battle/engine.js';
import { screenTitle, screenClassSelect, screenMap, screenBattle, screenReward, screenEvent, screenGameOver, screenMeta } from './ui/screens.js';

const screen = document.getElementById('screen');
const btnTitle = document.getElementById('btn-to-title');
const btnMetaTop = document.getElementById('btn-to-meta');

let meta = loadMeta();
let run = loadRun();

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
  const rng = mulberry32(run.seed + (++run.rngTick));
  run.enemy = enemyForFloor(run.floor);
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
  for (const r of run.relics){
    const h = r.hooks || {};
    for (const k of Object.keys(all)){
      if (h[k]){
        const prev = all[k];
        all[k] = (ctx) => { prev(ctx); h[k](ctx); };
      }
    }
  }
  return all;
}

function doBattle(){
  const logEl = document.getElementById('battle-log');
  const pushLog = (s) => {
    logEl.textContent += s + "\n";  // ← 改行を必ず付ける
    logEl.scrollTop = logEl.scrollHeight;
  };
  const hooks = buildHooks();
  const rng = mulberry32(run.seed + (++run.rngTick));

  for (const r of run.relics){
    if (r.hooks?.onGain){
      r.hooks.onGain({ state: run, log: pushLog, metaUpgrades: run.metaUpgrades });
    }
  }

  // Disable action buttons during resolution
  const runBtn = document.getElementById('btn-battle-run');
  const retreatBtn = document.getElementById('btn-battle-retreat');
  if (runBtn) runBtn.disabled = true;
  if (retreatBtn) retreatBtn.disabled = true;

  const result = runBattle(run, hooks, rng, pushLog);

  // Show status and Next button instead of jumping away
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
    if (nextBtn) nextBtn.onclick = ()=>{
      gameOver();
    };
  }
}

function startEvent(){
  run.mode = 'EVENT';
  saveRun(run);
  renderEvent();
}

function renderEvent(){
  const rng = mulberry32(run.seed + (++run.rngTick));
  const roll = rng();
  let text = '';
  let effect = null;
  if (roll < 0.5){
    text = '静かな祠が温かな光を放っている。癒やしを受ける？（HP +30%／オーバーヒールは月光の蜜でシールド化）';
    effect = () => {
      const heal = Math.floor(run.player.maxHp * 0.3);
      run.player.hp += heal;
      for (const r of run.relics){
        if (r.hooks?.onHeal){
          r.hooks.onHeal({ state: run, log: ()=>{}, metaUpgrades: run.metaUpgrades });
        }
      }
    };
  } else {
    text = '呪われた偶像が囁く。力を受け入れる？（ATK +3, HP -10）';
    effect = () => {
      run.player.atk += 3;
      run.player.maxHp = Math.max(1, run.player.maxHp - 10);
      run.player.hp = Math.min(run.player.hp, run.player.maxHp);
    };
  }

  screen.innerHTML = screenEvent(run, text);
  document.getElementById('btn-event-accept').addEventListener('click', () => {
    effect();
    proceedAfterNode();
  });
  document.getElementById('btn-event-decline').addEventListener('click', () => {
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
  rewards.push({ kind: 'relic', obj: pool[0] });
  rewards.push({ kind: 'relic', obj: pool[1] });
  rewards.push({ kind: 'boost', obj: { name: '鉄の躯', desc: '最大HP +12、DEF +2', apply: (s)=>{ s.player.maxHp+=12; s.player.hp+=12; s.player.def+=2; } }});

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
        pick.obj.apply(run);
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
