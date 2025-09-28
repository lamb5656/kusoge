// Chain Reactor with Center Target
// - Particles hitting cores cause k new particles (chain reaction)
// - NEW: A large center target loses 1 per hit; shows Remaining and DPS
// - Upgrades for k, density, speed; Fever triples k temporarily
// - Visual particle cap keeps perf high; counts can explode independently

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: true });

const ui = {
  total: document.getElementById('total'),
  perSec: document.getElementById('perSec'),
  kVal: document.getElementById('kVal'),
  densityVal: document.getElementById('densityVal'),
  speedVal: document.getElementById('speedVal'),
  centerRemain: document.getElementById('centerRemain'),
  dps: document.getElementById('dps'),

  upK: document.getElementById('upK'),
  upKCost: document.getElementById('upKCost'),
  upDensity: document.getElementById('upDensity'),
  upDensityCost: document.getElementById('upDensityCost'),
  upSpeed: document.getElementById('upSpeed'),
  upSpeedCost: document.getElementById('upSpeedCost'),
  ignite: document.getElementById('ignite'),
  feverBtn: document.getElementById('fever'),
  feverInfo: document.getElementById('feverInfo'),

  resetTarget: document.getElementById('resetTarget'),
  segButtons: Array.from(document.querySelectorAll('.seg')),
};

const cfg = {
  MAX_VISUAL_PARTICLES: 1500,
  PARTICLE_RADIUS: 2,
  CORE_RADIUS: 4,
  BASE_SEED: 12,
  FEVER_TIME: 10,
  FEVER_MULT: 3,
  GRID_SIZE: 24,
  K_BASE_COST: 10,
  DENSITY_BASE_COST: 25,
  SPEED_BASE_COST: 25,
  COST_GROWTH: 1.22,
  CENTER_RADIUS: 70,          // visual center target radius
};

let W = 0, H = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  W = canvas.clientWidth; H = canvas.clientHeight;
  // keep center at canvas center
  center.x = W / 2;
  center.y = H / 2;
}
window.addEventListener('resize', resize);

const state = {
  totalReactions: 0,
  score: 0,               // used as currency
  perSecEMA: 0,
  hitsThisSecond: 0,

  particles: [],
  cores: [],
  grid: new Map(),

  k: 2,
  densityMult: 1.0,
  speedMult: 1.0,
  kLevel: 0,
  densityLevel: 0,
  speedLevel: 0,

  feverMeter: 0,
  feverUntil: 0,

  // center target tracking
  centerHitsThisSecond: 0,
  dpsEMA: 0,
  clearFlashUntil: 0,
};

// Center target value store
const center = {
  x: 0, y: 0,
  r: cfg.CENTER_RADIUS,
  value: 1e8,
  max: 1e8,
  initPreset: 1e8, // last chosen preset
};

function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return Math.floor(n).toString();
  const units = ['K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc','Ud','Dd','Td','Qad','Qid'];
  let u = -1;
  while (n >= 1000 && u < units.length-1) { n /= 1000; u++; }
  if (u === -1) return Math.floor(n).toString();
  return n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2) + units[u];
}

function rand(min, max) { return Math.random() * (max - min) + min; }

function spawnCoresToTarget() {
  const area = W * H;
  const baseDensity = 0.00008; // cores per pixel
  const target = Math.floor(area * baseDensity * state.densityMult);
  while (state.cores.length < target) {
    state.cores.push({ x: rand(10, W-10), y: rand(10, H-10), cd: 0 });
  }
  if (state.cores.length > target) state.cores.length = target;
}

function seedParticles(x, y, count) {
  const toAdd = Math.min(count, cfg.MAX_VISUAL_PARTICLES - state.particles.length);
  for (let i = 0; i < toAdd; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(1.2, 2.2) * state.speedMult;
    state.particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: rand(3,6) });
  }
  // overflow still contributes to stats
  const overflow = Math.max(0, count - toAdd);
  if (overflow > 0) {
    state.totalReactions += overflow;
    state.score += overflow;
    state.hitsThisSecond += overflow;
    state.feverMeter = Math.min(100, state.feverMeter + overflow * 0.001);
  }
}

function upgradeCosts() {
  const kCost = Math.floor(cfg.K_BASE_COST * Math.pow(cfg.COST_GROWTH, state.kLevel));
  const dCost = Math.floor(cfg.DENSITY_BASE_COST * Math.pow(cfg.COST_GROWTH, state.densityLevel));
  const sCost = Math.floor(cfg.SPEED_BASE_COST * Math.pow(cfg.COST_GROWTH, state.speedLevel));
  return { kCost, dCost, sCost };
}

function updateUI() {
  ui.total.textContent = fmt(state.totalReactions);
  ui.perSec.textContent = fmt(state.perSecEMA);
  ui.kVal.textContent = state.k.toString();
  ui.densityVal.textContent = state.densityMult.toFixed(2) + '×';
  ui.speedVal.textContent = state.speedMult.toFixed(2) + '×';
  ui.centerRemain.textContent = fmt(Math.max(0, center.value));
  ui.dps.textContent = fmt(state.dpsEMA);

  const { kCost, dCost, sCost } = upgradeCosts();
  ui.upKCost.textContent = `コスト: ${fmt(kCost)}`;
  ui.upDensityCost.textContent = `コスト: ${fmt(dCost)}`;
  ui.upSpeedCost.textContent = `コスト: ${fmt(sCost)}`;

  ui.feverInfo.textContent = state.feverMeter >= 100 ? 'Ready!' : `${Math.floor(state.feverMeter)} / 100`;
  ui.feverBtn.disabled = !(state.feverMeter >= 100);

  // segments active state
  ui.segButtons.forEach(b => {
    const val = Number(b.dataset.init);
    b.classList.toggle('active', val === center.initPreset);
  });
}

function rebuildGrid() {
  state.grid.clear();
  const gs = cfg.GRID_SIZE;
  for (let i = 0; i < state.cores.length; i++) {
    const c = state.cores[i];
    const gx = (c.x / gs) | 0;
    const gy = (c.y / gs) | 0;
    const key = gx + ',' + gy;
    let arr = state.grid.get(key);
    if (!arr) { arr = []; state.grid.set(key, arr); }
    arr.push(i);
  }
}

function nearbyCoreIndices(x, y) {
  const gs = cfg.GRID_SIZE;
  const gx = (x / gs) | 0;
  const gy = (y / gs) | 0;
  const res = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = (gx+dx) + ',' + (gy+dy);
      const arr = state.grid.get(key);
      if (arr) res.push(...arr);
    }
  }
  return res;
}

function hitCenter(p) {
  // returns true if particle hits center target
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const r = cfg.PARTICLE_RADIUS + center.r;
  if (dx*dx + dy*dy <= r*r) {
    if (center.value > 0) {
      center.value -= 1; // 1 damage per hit (simple & readable)
      state.centerHitsThisSecond += 1;
      if (center.value <= 0) {
        center.value = 0;
        state.clearFlashUntil = performance.now()/1000 + 1.2; // show CLEAR
      }
    }
    return true;
  }
  return false;
}

function tick(dt) {
  spawnCoresToTarget();
  const now = performance.now() / 1000;
  const feverActive = now < state.feverUntil;

  rebuildGrid();

  // Move particles & collisions
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt;

    // walls
    if (p.x < cfg.PARTICLE_RADIUS || p.x > W - cfg.PARTICLE_RADIUS) p.vx *= -1;
    if (p.y < cfg.PARTICLE_RADIUS || p.y > H - cfg.PARTICLE_RADIUS) p.vy *= -1;

    let remove = false;

    // center hit check first (feels snappier)
    if (hitCenter(p)) {
      remove = true;
    } else {
      // core collisions → chain
      const idxs = nearbyCoreIndices(p.x, p.y);
      const pr = cfg.PARTICLE_RADIUS, cr = cfg.CORE_RADIUS;
      for (let j = 0; j < idxs.length; j++) {
        const c = state.cores[idxs[j]];
        if (c.cd > 0) continue;
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const r = pr + cr;
        if ((dx*dx + dy*dy) <= r*r) {
          c.cd = 0.2;

          const mult = feverActive ? cfg.FEVER_MULT : 1;
          const crit = Math.random() < 0.05 ? 5 : 1;
          const spawn = Math.floor(state.k * mult * crit);

          state.totalReactions += 1;
          state.score += 1;
          state.hitsThisSecond += 1;
          state.feverMeter = Math.min(100, state.feverMeter + 0.4);

          seedParticles(c.x, c.y, spawn);
          remove = true;
          break;
        }
      }
    }

    if (remove || p.life <= 0) {
      const last = state.particles.pop();
      if (i < state.particles.length) state.particles[i] = last;
    }
  }

  // core cooldowns
  for (let i = 0; i < state.cores.length; i++) {
    if (state.cores[i].cd > 0) state.cores[i].cd -= dt;
  }

  // smooth stats
  state.perSecEMA = state.perSecEMA * 0.92 + (state.hitsThisSecond / dt) * 0.08;
  state.hitsThisSecond = 0;

  state.dpsEMA = state.dpsEMA * 0.90 + (state.centerHitsThisSecond / dt) * 0.10;
  state.centerHitsThisSecond = 0;
}

function drawCenter() {
  // outer glow
  ctx.beginPath();
  ctx.arc(center.x, center.y, center.r+10, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255, 220, 120, 0.06)';
  ctx.fill();

  // base
  ctx.beginPath();
  ctx.arc(center.x, center.y, center.r, 0, Math.PI*2);
  ctx.fillStyle = '#1a2230';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3b5171';
  ctx.stroke();

  // progress ring
  const remainRatio = center.max > 0 ? Math.max(0, center.value / center.max) : 0;
  const ringR = center.r + 6;
  ctx.beginPath();
  ctx.strokeStyle = '#243245';
  ctx.lineWidth = 6;
  ctx.arc(center.x, center.y, ringR, 0, Math.PI*2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = '#ffd45e';
  ctx.lineWidth = 6;
  ctx.arc(center.x, center.y, ringR, -Math.PI/2, -Math.PI/2 + Math.PI*2*remainRatio);
  ctx.stroke();

  // number
  ctx.font = '700 20px ui-sans-serif, system-ui';
  ctx.fillStyle = '#eaf2ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmt(center.value), center.x, center.y);
}

function draw() {
  // background with faint trail
  ctx.fillStyle = 'rgba(9,13,18,0.45)';
  ctx.fillRect(0, 0, W, H);

  // center first (so particles draw on top)
  drawCenter();

  // cores
  for (let i = 0; i < state.cores.length; i++) {
    const c = state.cores[i];
    ctx.beginPath();
    ctx.arc(c.x, c.y, cfg.CORE_RADIUS, 0, Math.PI*2);
    const glow = c.cd > 0 ? '#7ce3ff' : '#2f97ff';
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // particles
  ctx.fillStyle = '#ffd45e';
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, cfg.PARTICLE_RADIUS, 0, Math.PI*2);
    ctx.fill();
  }

  // fever overlay
  const now = performance.now() / 1000;
  if (now < state.feverUntil) {
    ctx.fillStyle = 'rgba(255,80,120,0.08)';
    ctx.fillRect(0,0,W,H);
  }

  // clear flash
  if (now < state.clearFlashUntil) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(255, 200, 60, 0.18)';
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }
}

let lastTime = performance.now() / 1000;
function loop() {
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - lastTime);
  lastTime = now;
  tick(dt);
  draw();
  updateUI();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Input: click/drag to seed
let dragging = false;
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left);
  const y = (e.clientY - rect.top);
  return { x, y };
}
canvas.addEventListener('pointerdown', e => {
  dragging = true;
  const { x, y } = canvasPos(e);
  seedParticles(x, y, cfg.BASE_SEED);
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const { x, y } = canvasPos(e);
  seedParticles(x, y, 4);
});
window.addEventListener('pointerup', () => dragging = false);

// Buttons
ui.ignite.addEventListener('click', () => {
  for (let i = 0; i < 4; i++) {
    seedParticles(rand(20, W-20), rand(20, H-20), cfg.BASE_SEED);
  }
});

ui.upK.addEventListener('click', () => {
  const { kCost } = upgradeCosts();
  if (state.score >= kCost) {
    state.score -= kCost;
    state.kLevel++;
    state.k += 1;
  }
});

ui.upDensity.addEventListener('click', () => {
  const { dCost } = upgradeCosts();
  if (state.score >= dCost) {
    state.score -= dCost;
    state.densityLevel++;
    state.densityMult *= 1.10;
  }
});

ui.upSpeed.addEventListener('click', () => {
  const { sCost } = upgradeCosts();
  if (state.score >= sCost) {
    state.score -= sCost;
    state.speedLevel++;
    state.speedMult *= 1.10;
  }
});

ui.feverBtn.addEventListener('click', () => {
  if (state.feverMeter >= 100) {
    state.feverMeter = 0;
    state.feverUntil = performance.now()/1000 + cfg.FEVER_TIME;
  }
});

// Target controls
function setTargetInit(val) {
  center.initPreset = val;
  center.max = val;
  center.value = val;
  state.dpsEMA = 0;
}
ui.segButtons.forEach(b => {
  b.addEventListener('click', () => {
    const v = Number(b.dataset.init);
    setTargetInit(v);
  });
});
ui.resetTarget.addEventListener('click', () => setTargetInit(center.initPreset));

// Initial boot
resize();
spawnCoresToTarget();
for (let i = 0; i < 8; i++) seedParticles(rand(20, W-20), rand(20, H-20), 8);
