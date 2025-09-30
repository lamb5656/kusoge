// なめ消し塩（試作・改）
// 変更点：
// - 初期の玉を小さく（baseRadius）
// - 縮みをゆっくり（shrinkPerHitを大幅減）
// - 塩の粒を小さく＆サラサラ（particleRadius↓、spawnPerSecond↑）
// - ヒット側と反対方向に玉が横移動（kickPerHit、sphere.vxを追加）

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const $level = document.getElementById('stat-level');
const $lines = document.getElementById('stat-lines');
const $salt  = document.getElementById('stat-salt');
const $fps   = document.getElementById('stat-fps');

const BTN_CLEAR = document.getElementById('btn-clear');
const BTN_RESET = document.getElementById('btn-reset');

const DPR = Math.max(1, window.devicePixelRatio || 1);

// ====== 調整しやすい設定 ======
const CONFIG = {
  gravity: 1800,               // px/s^2
  particleRadius: 1.0,         // 塩の粒半径（細かく）
  spawnPerSecond: 520,         // たくさん降らせてサラサラ感
  spawnJitterX: 24,
  maxParticles: 2400,          // パフォーマンス保護
  lineThickness: 4,
  lineBounce: 0.35,
  lineFriction: 0.12,

  shrinkPerHit: 0.06,          // ← ゆっくり縮む
  minRadiusToExplode: 14,      // 最小サイズで爆発（小さめに）
  baseRadius: 34,              // ← 初期玉を小さく
  growPerStage: 1.0,           // 次の玉は“ちょっとだけ”大きく

  groundYMargin: 96,

  // 爆発破片
  fragCount: 28,
  fragSpeedMin: 600,
  fragSpeedMax: 1200,
  fragRadius: 7,
  fragLife: 1.2,
  fragDrag: 0.98,

  // 線当たり高速化グリッド
  gridSize: 40,

  spawnTopMargin: 12,

  // 玉の横移動パラメータ
  kickPerHit: 42,              // 粒ヒット1回の横方向加速量
  sphereFriction: 1.8,         // 横速度の減衰（/s）
  wallBounce: 0.28             // 端に当たったときの反発
};

// ====== キャンバス寸法 ======
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * DPR);
  canvas.height = Math.floor(rect.height * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // 論理座標=CSSピクセル
  groundY = canvas.height / DPR - 20;
}
window.addEventListener('resize', resizeCanvas, { passive: true });

// ====== ゲーム状態 ======
let particles = [];       // {x,y,vx,vy,alive}
let level = 1;

let groundY = 0;

const sphere = {
  x: 0,
  y: 0,
  vx: 0,                 // ← 横移動速度を追加
  vy: 0,
  radius: CONFIG.baseRadius,
  targetY: 0,
  state: 'idle',         // 'falling' | 'idle' | 'explode'
  frags: [],
};

function resetGame() {
  level = 1;
  particles = [];
  clearAllLines();
  spawnNewSphere(true);
}

function spawnNewSphere(first = false) {
  const r = CONFIG.baseRadius + (level - 1) * CONFIG.growPerStage;
  sphere.radius = r;
  sphere.x = canvas.width / DPR * 0.5;
  sphere.targetY = (groundY - r);
  sphere.frags = [];
  sphere.vy = 0;
  sphere.vx = 0;

  // 上から落とす
  sphere.y = first ? sphere.targetY : -r - 40;
  sphere.state = first ? 'idle' : 'falling';
}

function explodeSphere() {
  sphere.state = 'explode';
  sphere.frags = [];
  const N = CONFIG.fragCount;

  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + (Math.random() * 0.25);
    const spd = randBetween(CONFIG.fragSpeedMin, CONFIG.fragSpeedMax);
    sphere.frags.push({
      x: sphere.x,
      y: sphere.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: CONFIG.fragRadius,
      life: CONFIG.fragLife,
    });
  }
}

// ====== 線の管理（ポリライン→短い線分配列）＋グリッド ======
let segments = []; // {x1,y1,x2,y2,alive}
let drawing = false;
let lastDrawPt = null;
let pointerId = null;

const grid = new Map(); // "gx|gy" -> array of segment refs
function gridKey(gx, gy) { return gx + '|' + gy; }

function addSegment(x1, y1, x2, y2) {
  const seg = { x1, y1, x2, y2, alive: true };
  segments.push(seg);
  insertSegmentToGrid(seg);
  updateLinesStat();
}

function insertSegmentToGrid(seg) {
  const GS = CONFIG.gridSize;
  const xMin = Math.min(seg.x1, seg.x2), xMax = Math.max(seg.x1, seg.x2);
  const yMin = Math.min(seg.y1, seg.y2), yMax = Math.max(seg.y1, seg.y2);
  const gx0 = Math.floor(xMin / GS), gx1 = Math.floor(xMax / GS);
  const gy0 = Math.floor(yMin / GS), gy1 = Math.floor(yMax / GS);
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gy = gy0; gy <= gy1; gy++) {
      const key = gridKey(gx, gy);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(seg);
    }
  }
}

function clearAllLines() {
  segments.length = 0;
  grid.clear();
  updateLinesStat();
}

function updateLinesStat() {
  let count = 0;
  for (const s of segments) if (s.alive) count++;
  $lines.textContent = count.toString();
}

// ====== 入力 ======
canvas.addEventListener('pointerdown', (e) => {
  if (drawing) return;
  pointerId = e.pointerId;
  drawing = true;
  lastDrawPt = getLocalXY(e);
  e.preventDefault();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing || e.pointerId !== pointerId) return;
  const pt = getLocalXY(e);
  const dx = pt.x - lastDrawPt.x;
  const dy = pt.y - lastDrawPt.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= 4) {
    addSegment(lastDrawPt.x, lastDrawPt.y, pt.x, pt.y);
    lastDrawPt = pt;
  }
  e.preventDefault();
}, { passive: false });

function endDrawing(e) {
  if (!drawing || (e && e.pointerId !== pointerId)) return;
  drawing = false;
  lastDrawPt = null;
  pointerId = null;
}
canvas.addEventListener('pointerup', endDrawing);
canvas.addEventListener('pointercancel', endDrawing);
canvas.addEventListener('pointerleave', endDrawing);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ====== ボタン ======
BTN_CLEAR.addEventListener('click', () => clearAllLines());
BTN_RESET.addEventListener('click', () => resetGame());

// ====== 補助 ======
function getLocalXY(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left),
    y: (e.clientY - rect.top),
  };
}
function randBetween(a, b) { return a + Math.random() * (b - a); }

function pointSegmentDistanceSq(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = px - x1, wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return (px - x1) ** 2 + (py - y1) ** 2;
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return (px - x2) ** 2 + (py - y2) ** 2;
  const t = c1 / c2;
  const projx = x1 + t * vx;
  const projy = y1 + t * vy;
  return (px - projx) ** 2 + (py - projy) ** 2;
}

function gatherSegmentsNear(x, y, radius = 20) {
  const GS = CONFIG.gridSize;
  const gx = Math.floor(x / GS);
  const gy = Math.floor(y / GS);
  const reach = Math.ceil(radius / GS) + 1;
  const out = [];
  for (let ix = -reach; ix <= reach; ix++) {
    for (let iy = -reach; iy <= reach; iy++) {
      const key = gridKey(gx + ix, gy + iy);
      const arr = grid.get(key);
      if (!arr) continue;
      for (const s of arr) if (s.alive) out.push(s);
    }
  }
  return out;
}

// ====== 物理・描画 ======
let spawnCarry = 0;
let lastTime = performance.now();
let fpsSmoother = 60;

function update(dt) {
  // スポーン
  const spawn = CONFIG.spawnPerSecond * dt + spawnCarry;
  let toSpawn = Math.floor(spawn);
  spawnCarry = spawn - toSpawn;

  const pr = CONFIG.particleRadius;
  const maxY = canvas.height / DPR + 50;

  while (toSpawn-- > 0 && particles.length < CONFIG.maxParticles) {
    particles.push({
      x: canvas.width / DPR * 0.5 + (Math.random() * 2 - 1) * CONFIG.spawnJitterX,
      y: CONFIG.spawnTopMargin,
      vx: (Math.random() * 2 - 1) * 40,
      vy: 0,
      alive: true,
    });
  }

  // 球体の落下（垂直）
  if (sphere.state === 'falling') {
    sphere.vy += CONFIG.gravity * dt;
    sphere.y += sphere.vy * dt;
    if (sphere.y >= sphere.targetY) {
      sphere.y = sphere.targetY;
      sphere.vy = 0;
      sphere.state = 'idle';
    }
  }

  // 球体の横移動（idle/fallingどちらでも有効）
  if (sphere.state !== 'explode') {
    // 摩擦で減衰
    const f = Math.max(0, 1 - CONFIG.sphereFriction * dt);
    sphere.vx *= f;

    // 位置更新＆端でバウンス
    sphere.x += sphere.vx * dt;
    const r = Math.max(0, sphere.radius);
    const minX = r + 2, maxX = canvas.width / DPR - r - 2;
    if (sphere.x < minX) {
      sphere.x = minX;
      sphere.vx = -sphere.vx * CONFIG.wallBounce;
    } else if (sphere.x > maxX) {
      sphere.x = maxX;
      sphere.vx = -sphere.vx * CONFIG.wallBounce;
    }
  }

  // 粒運動
  for (const p of particles) {
    if (!p.alive) continue;
    p.vy += CONFIG.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y > maxY || p.x < -50 || p.x > canvas.width / DPR + 50) {
      p.alive = false;
      continue;
    }

    // 線との衝突
    const nearby = gatherSegmentsNear(p.x, p.y, 24);
    for (const s of nearby) {
      const rad = pr + CONFIG.lineThickness * 0.5 + 0.1;
      const d2 = pointSegmentDistanceSq(p.x, p.y, s.x1, s.y1, s.x2, s.y2);
      if (d2 <= rad * rad) {
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        const len = Math.hypot(dx, dy) || 1;
        const tx = dx / len, ty = dy / len;       // 接線
        const nx = -ty, ny = tx;                  // 法線
        const vn = p.vx * nx + p.vy * ny;
        const vt = p.vx * tx + p.vy * ty;
        if (vn < 0) {
          const bounce = CONFIG.lineBounce;
          const fric = CONFIG.lineFriction;
          const vn2 = -vn * (1 + bounce);
          const vt2 = vt * (1 - fric);
          p.vx = p.vx + vn2 * nx + (vt2 - vt) * tx;
          p.vy = p.vy + vn2 * ny + (vt2 - vt) * ty;

          const d = Math.sqrt(d2);
          const push = (rad - d) * 0.6;
          p.x += nx * push;
          p.y += ny * push;
        }
      }
    }

    // 球体ヒット：縮みはゆっくり＋横移動キック
    if (sphere.state === 'falling' || sphere.state === 'idle') {
      const dx = p.x - sphere.x;
      const dy = p.y - sphere.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= sphere.radius + pr) {
        p.alive = false;

        // 縮み（ゆっくり）
        sphere.radius -= CONFIG.shrinkPerHit;
        if (sphere.radius <= CONFIG.minRadiusToExplode) {
          explodeSphere();
        } else {
          // 横キック：左に当たったら右へ、右に当たったら左へ
          // dx<0 => 粒は左側 → +kick（右へ）, dx>0 => -kick（左へ）
          const kick = (dx < 0 ? +1 : -1) * CONFIG.kickPerHit;
          // ヒットの高さによって少しだけ強弱（上の方に当たると軽め）
          const heightFactor = 0.7 + 0.6 * Math.max(0, 1 - Math.abs(dy) / Math.max(1, sphere.radius));
          sphere.vx += kick * heightFactor;
        }
      }
    }
  }

  // 爆発破片（塩＆線を消す）
  if (sphere.state === 'explode') {
    let allDead = true;
    for (const f of sphere.frags) {
      if (f.life <= 0) continue;
      allDead = false;

      f.vx *= CONFIG.fragDrag;
      f.vy = (f.vy + CONFIG.gravity * dt) * CONFIG.fragDrag;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;

      // 塩を消す
      for (const p of particles) {
        if (!p.alive) continue;
        const dx = p.x - f.x;
        const dy = p.y - f.y;
        if (dx * dx + dy * dy <= (f.r + CONFIG.particleRadius) ** 2) {
          p.alive = false;
        }
      }

      // 線を消す
      const nearby = gatherSegmentsNear(f.x, f.y, f.r + 4);
      for (const s of nearby) {
        if (!s.alive) continue;
        const d2 = pointSegmentDistanceSq(f.x, f.y, s.x1, s.y1, s.x2, s.y2);
        if (d2 <= (f.r + CONFIG.lineThickness * 0.5) ** 2) {
          s.alive = false;
        }
      }
    }
    if (allDead || sphere.frags.every(fr => fr.life <= 0)) {
      level++;
      particles = particles.filter(p => p.alive);
      spawnNewSphere();
    }
  }

  // 軽い掃除
  if (frameCount % 30 === 0) {
    particles = particles.filter(p => p.alive);
    updateLinesStat();
  }

  // UI
  $level.textContent = level.toString();
  $salt.textContent = particles.length.toString();
}

function draw() {
  // 背景
  ctx.fillStyle = '#0f1020';
  ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);

  // 地面
  ctx.strokeStyle = '#26294e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 0.5);
  ctx.lineTo(canvas.width / DPR, groundY + 0.5);
  ctx.stroke();

  // 球体 or 破片
  if (sphere.state === 'falling' || sphere.state === 'idle') {
    const g = ctx.createRadialGradient(
      sphere.x - sphere.radius * 0.3, sphere.y - sphere.radius * 0.3, sphere.radius * 0.2,
      sphere.x, sphere.y, sphere.radius
    );
    g.addColorStop(0, '#7fe7ff');
    g.addColorStop(1, '#2257ff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sphere.x, sphere.y, Math.max(0, sphere.radius), 0, Math.PI * 2);
    ctx.fill();
  } else if (sphere.state === 'explode') {
    ctx.fillStyle = '#8fd3ff';
    for (const f of sphere.frags) {
      if (f.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, f.life / CONFIG.fragLife);
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // 線
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#f2f2f7';
  ctx.lineWidth = CONFIG.lineThickness;
  ctx.beginPath();
  for (const s of segments) {
    if (!s.alive) continue;
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();

  // 塩
  ctx.fillStyle = '#ffffff';
  for (const p of particles) {
    if (!p.alive) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, CONFIG.particleRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // スポーン口
  ctx.fillStyle = '#c0c6ff';
  const spx = canvas.width / DPR * 0.5;
  ctx.fillRect(spx - 10, 0, 20, 6);
}

// ====== ループ ======
let frameCount = 0;
function loop(now) {
  const dt = Math.min(0.035, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  const instFps = 1 / dt;
  fpsSmoother = fpsSmoother * 0.92 + instFps * 0.08;
  if ((frameCount & 15) === 0) $fps.textContent = Math.round(fpsSmoother).toString();

  update(dt);
  draw();

  frameCount++;
  requestAnimationFrame(loop);
}

// ====== 初期化 ======
function init() {
  resizeCanvas();
  groundY = canvas.height / DPR - 20;
  spawnNewSphere(true);
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// Utils
init();
