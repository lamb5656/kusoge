// minigame-stairs.js (v2.3.1) - Fix: "Ready..." persistent overlay removed
// - Use canvas text during warmup only; no DOM Ready element.
// - Everything else same as v2.3 (stairs + vertical follow + examiner climbs + thrown cans).
export function startMinigameStairs({ onWin, onLose }) {
  let active = true;

  // ---------- Config ----------
  const warmupTimeSec = 1.2;        // 開始猶予（無敵＋横スクロール停止）
  const startFlatDistance = 420;    // 最初の段まで距離
  const followPad = 0.60;           // 縦追従の基準位置（0=上,1=下）
  const followLerp = 6.0;           // 縦追従スムージング
  const projGravity = 1200 * 0.65;  // 投射物の重力（プレイヤーより少し軽め）
  const spawnMin = 0.9;             // スポーン間隔（序盤）秒
  const spawnMinFinal = 0.35;       // スポーン間隔（終盤）秒

  // ---------- Overlay / Canvas ----------
  const overlay = document.createElement('div');
  overlay.id = 'minigame-overlay';
  Object.assign(overlay.style, {
    position: 'absolute', inset: '0', zIndex: 10,
    background: 'linear-gradient(180deg,rgba(8,10,20,.92),rgba(5,6,12,.97))',
    overflow: 'hidden', touchAction: 'none'
  });
  ['click','pointerdown','pointermove','pointerup'].forEach(ev => overlay.addEventListener(ev, e => e.stopPropagation(), {passive:false}));

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  overlay.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const ui = document.createElement('div');
  Object.assign(ui.style, {
    position: 'absolute', left: '0', right: '0', bottom: '10px',
    display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '12px',
    padding: '0 16px', pointerEvents: 'none'
  });
  overlay.appendChild(ui);

  function mkBtn(label) {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      pointerEvents: 'auto',
      padding: '14px 10px', borderRadius: '16px', border: '1px solid rgba(255,255,255,.14)',
      background: 'linear-gradient(180deg,#24294f,#1a1e39)', color: '#e8ebff',
      fontWeight: 800, fontSize: '16px', boxShadow: '0 6px 20px rgba(0,0,0,.25)',
      touchAction: 'manipulation'
    });
    return b;
  }
  const btnL = mkBtn('←');
  const btnJ = mkBtn('JUMP');
  const btnR = mkBtn('→');
  ui.append(btnL, btnJ, btnR);

  const topBar = document.createElement('div');
  Object.assign(topBar.style, {
    position: 'absolute', left: '12px', right: '12px', top: '10px', display: 'flex', gap: '12px', alignItems: 'center'
  });
  const meter = document.createElement('div');
  Object.assign(meter.style, {
    flex: '1 1 auto', height: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,.18)',
    background: 'rgba(255,255,255,.04)', overflow: 'hidden'
  });
  const meterFill = document.createElement('div');
  Object.assign(meterFill.style, { height: '100%', width: '0%', background: '#6aa6ff' });
  meter.appendChild(meterFill);

  const tipEl = document.createElement('div');
  tipEl.textContent = '試験官を追い、階段をジャンプで登れ！ 缶ジュースも飛んでくるぞ（左端でゲームオーバー）';
  Object.assign(tipEl.style, { color: '#9aa3c7', fontSize: '12px' });
  topBar.append(meter, tipEl);
  overlay.appendChild(topBar);

  const app = document.getElementById('app') || document.body;
  app.appendChild(overlay);

  function resize() {
    const r = overlay.getBoundingClientRect();
    canvas.width = Math.floor(r.width);
    canvas.height = Math.floor(r.height);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- Game State ----------
  const state = {
    running: true,
    elapsed: 0,
    scrollX: 0,                   // camera left (world x)
    scrollY: 0,                   // camera top  (world y)
    scrollSpeed: 160,             // px/s
    goalDistance: 2600,
    floorY: Math.max(180, canvas.height - 110),
    player: { x: 80, y: 0, r: 16, vx: 0, vy: 0, speed: 220, jumpV: 420, gravity: 1200, grounded: false },
    leftKillMargin: 12,
    level: { steps: [] },
    input: { left:false, right:false },
    last: performance.now(),
    // projectiles
    projs: [],                    // {x,y,vx,vy,r,rot,omega,isBottle}
    spawnCool: 0
  };
  state.player.y = state.floorY - state.player.r;

  // ---------- Level Generation ----------
  function generateLevel() {
    const steps = [];
    const stepW = 150, gapX = 95, rise = 48;
    const topThickness = 12, riserW = 14;
    const total = 12;
    let x = startFlatDistance, yTop = state.floorY - rise;

    for (let i=0; i<total; i++) {
      steps.push({ x, y: yTop - topThickness, w: stepW, h: topThickness, kind:'top' });
      steps.push({ x: x - riserW, y: yTop - topThickness, w: riserW, h: (state.floorY - (yTop - topThickness)), kind:'riser' });
      x += stepW + gapX;
      yTop -= rise;
    }
    steps.push({ x, y: yTop - topThickness, w: 240, h: topThickness, kind:'top' });
    state.goalDistance = x + 300;
    state.level.steps = steps;
  }
  generateLevel();

  // 地形上の足場高さ
  function groundYAt(worldX) {
    let best = null;
    for (const s of state.level.steps) {
      if (s.kind !== 'top') continue;
      if (worldX >= s.x && worldX <= s.x + s.w) {
        if (!best || s.y < best.y) best = s;
      }
    }
    if (best) return best.y;
    let last = null;
    for (const s of state.level.steps) {
      if (s.kind !== 'top') continue;
      if (s.x < worldX) if (!last || s.x > last.x) last = s;
    }
    return last ? last.y : state.floorY;
  }

  // Examiner（先頭の人）
  function examinerWorldPos() {
    const exScreenX = Math.min(520, canvas.width * 0.65);
    const x = state.scrollX + exScreenX;
    const gy = groundYAt(x);
    const y = gy - 60;
    return { x, y };
  }

  // ---------- Input ----------
  function key(e, d) {
    if (!state.running) return;
    if (e.key === 'ArrowLeft') state.input.left = d;
    if (e.key === 'ArrowRight') state.input.right = d;
    if (e.code === 'Space' || e.key === ' ') {
      if (d) jump();
      e.preventDefault();
    }
  }
  window.addEventListener('keydown', (e)=>key(e,true));
  window.addEventListener('keyup', (e)=>key(e,false));
  btnL.addEventListener('pointerdown', ()=> state.input.left = true);
  btnL.addEventListener('pointerup',   ()=> state.input.left = false);
  btnL.addEventListener('pointercancel',()=> state.input.left = false);
  btnR.addEventListener('pointerdown', ()=> state.input.right = true);
  btnR.addEventListener('pointerup',   ()=> state.input.right = false);
  btnR.addEventListener('pointercancel',()=> state.input.right = false);
  btnJ.addEventListener('click', ()=> jump());

  function jump() {
    if (!state.running) return;
    const p = state.player;
    if (p.grounded) {
      p.vy = -p.jumpV;
      p.grounded = false;
    }
  }

  // ---------- Projectiles ----------
  function spawnProjectile() {
    const w = canvas.width, h = canvas.height;
    const camX = state.scrollX, camY = state.scrollY;

    const mode = Math.random() < 0.5 ? 'top' : 'right';
    let x,y,vx,vy;
    const targetX = state.player.x + (Math.random()*140 - 70);
    const targetY = state.player.y - 18 + (Math.random()*30 - 15);
    const t = 1.0 + Math.random()*0.5;

    if (mode === 'top') {
      x = camX + Math.random() * w;
      y = camY - 50;
      const dx = targetX - x, dy = targetY - y;
      vx = dx / t;
      vy = dy / t - 0.5 * projGravity * 0.6;
    } else {
      x = camX + w + 60;
      const gy = groundYAt(x);
      y = Math.min(gy - 120, state.player.y - 40);
      const dx = targetX - x, dy = targetY - y;
      vx = dx / t;
      vy = dy / t - 0.5 * projGravity * 0.55;
    }
    const isBottle = Math.random() < 0.5;
    const r = isBottle ? 12 : 10;
    const omega = (Math.random()*2-1) * 6;
    state.projs.push({ x, y, vx, vy, r, rot: 0, omega, isBottle });
  }

  // ---------- Physics / Camera / Update ----------
  function update(dt) {
    const p = state.player;
    state.elapsed += dt;

    const inWarmup = state.elapsed < warmupTimeSec;
    if (!inWarmup) {
      state.scrollX += state.scrollSpeed * dt;
      const prog = Math.min(1, state.scrollX / state.goalDistance);
      const interval = spawnMin * (1 - prog) + spawnMinFinal * prog;
      state.spawnCool -= dt;
      if (state.spawnCool <= 0) {
        spawnProjectile();
        state.spawnCool = interval * (0.75 + Math.random()*0.5);
      }
    }

    // Player control
    const ax = (state.input.right ? 1 : 0) - (state.input.left ? 1 : 0);
    p.vx = ax * p.speed;

    // Gravity
    p.vy += p.gravity * dt;
    let nextX = p.x + p.vx * dt;
    let nextY = p.y + p.vy * dt;

    // Horizontal collide with risers
    if (p.vx > 0) {
      for (const b of state.level.steps) {
        if (b.kind !== 'riser') continue;
        const plyTop = nextY - p.r, plyBot = nextY + p.r;
        const boxTop = b.y, boxBot = b.y + b.h;
        const yOverlap = plyBot > boxTop && plyTop < boxBot;
        if (!yOverlap) continue;
        const plyRight = nextX + p.r;
        const boxLeft = b.x;
        const prevRight = p.x + p.r;
        if (prevRight <= boxLeft && plyRight > boxLeft) {
          nextX = boxLeft - p.r;
          p.vx = 0;
        }
      }
    }
    // Vertical landing
    let grounded = false;
    if (p.vy >= 0) {
      for (const b of state.level.steps) {
        if (b.kind !== 'top') continue;
        const boxTop = b.y;
        const boxLeft = b.x, boxRight = b.x + b.w;
        const prevBot = p.y + p.r;
        const nextBot = nextY + p.r;
        const withinX = (p.x > boxLeft - p.r) && (p.x < boxRight + p.r);
        if (withinX && prevBot <= boxTop && nextBot > boxTop) {
          nextY = boxTop - p.r;
          p.vy = 0;
          grounded = true;
          break;
        }
      }
    }
    // Start ground pre-first riser
    const firstRiser = state.level.steps.find(s=>s.kind==='riser');
    const firstRiserX = firstRiser ? firstRiser.x : Infinity;
    if (!grounded && nextY + p.r > state.floorY && p.x + p.r < firstRiserX) {
      nextY = state.floorY - p.r;
      p.vy = 0;
      grounded = true;
    }
    p.grounded = grounded;
    p.x = nextX;
    p.y = nextY;

    // Projectiles move
    for (const e of state.projs) {
      e.vy += projGravity * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rot += e.omega * dt;
    }
    // Cull projectiles
    const w = canvas.width, h = canvas.height;
    state.projs = state.projs.filter(e => {
      const sx = e.x - state.scrollX, sy = e.y - state.scrollY;
      return sx > -140 && sx < w + 140 && sy < h + 180;
    });

    // Collisions: player vs projectiles
    for (const e of state.projs) {
      const dx = e.x - p.x, dy = e.y - p.y;
      const rr = (e.r + p.r);
      if (dx*dx + dy*dy <= rr*rr) { lose(); return; }
    }

    // Left kill (off during warmup)
    const screenX = p.x - state.scrollX;
    if (!inWarmup && screenX <= state.leftKillMargin) { lose(); return; }

    // Camera vertical follow
    const targetY = p.y - canvas.height * followPad;
    state.scrollY += (targetY - state.scrollY) * Math.min(1, followLerp * dt);
    state.scrollY = Math.max(0, state.scrollY);

    // Win
    const progress = Math.min(1, state.scrollX / state.goalDistance);
    meterFill.style.width = (progress*100).toFixed(1) + '%';
    if (progress >= 1) { win(); return; }
  }

  // ---------- Rendering ----------
  let decoPar = 0;
  function draw() {
    const w = canvas.width, h = canvas.height;
    // BG
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(16,18,42,1)');
    g.addColorStop(1, 'rgba(10,12,24,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Parallax
    decoPar += 0.5;
    ctx.globalAlpha = 0.25;
    for (let y = h; y > 0; y -= 42) {
      const x = Math.floor(((y*0.7 + decoPar) % 200) - 200);
      ctx.fillStyle = '#1f2346';
      ctx.fillRect(x, y, 200, 4);
    }
    ctx.globalAlpha = 1;

    // Steps
    for (const b of state.level.steps) {
      const sx = Math.floor(b.x - state.scrollX);
      const sy = Math.floor(b.y - state.scrollY);
      if (sx + b.w < -40 || sx > w + 40) continue;
      if (b.kind === 'top') {
        ctx.fillStyle = '#2c3366';
        ctx.fillRect(sx, sy, b.w, b.h);
        ctx.strokeStyle = 'rgba(255,255,255,.08)';
        ctx.strokeRect(sx, sy, b.w, b.h);
      } else {
        ctx.fillStyle = '#23284e';
        ctx.fillRect(sx, sy, b.w, b.h);
      }
    }

    // Floor up to first riser
    const firstRiser = state.level.steps.find(s=>s.kind==='riser');
    const firstRiserX = firstRiser ? firstRiser.x : Infinity;
    const floorLeft = -9999, floorRight = firstRiserX - state.scrollX;
    if (floorRight > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(floorLeft, (state.floorY - state.scrollY) + 14, floorRight, 2);
    }

    // Examiner
    const ex = examinerWorldPos();
    const exScreenX = Math.floor(ex.x - state.scrollX);
    const exScreenY = Math.floor(ex.y - state.scrollY);
    ctx.save();
    ctx.translate(exScreenX, exScreenY);
    ctx.fillStyle = '#ffd86a';
    ctx.fillRect(-10, -26, 20, 26);
    ctx.fillStyle = '#10122b';
    ctx.fillRect(-10, -30, 20, 6);
    ctx.beginPath(); ctx.arc(0, -34, 8, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Player
    const p = state.player;
    const px = Math.floor(p.x - state.scrollX);
    const py = Math.floor(p.y - state.scrollY);
    ctx.beginPath();
    ctx.arc(px, py, p.r, 0, Math.PI*2);
    ctx.fillStyle = '#6aa6ff';
    ctx.fill();

    // Projectiles
    for (const e of state.projs) {
      const sx = Math.floor(e.x - state.scrollX);
      const sy = Math.floor(e.y - state.scrollY);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(e.rot);
      if (e.isBottle) {
        ctx.fillStyle = '#ff6a8a';
        ctx.fillRect(-6, -12, 12, 24);
        ctx.fillStyle = '#ffd86a';
        ctx.fillRect(-5, -14, 10, 3);
      } else {
        ctx.fillStyle = '#ffd86a';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = '#10122b';
        ctx.fillRect(-10, -12, 20, 3);
        ctx.fillRect(-10, 9, 20, 3);
      }
      ctx.restore();
    }

    // Left kill wall or Ready text
    if (state.elapsed >= warmupTimeSec) {
      ctx.fillStyle = 'rgba(255,106,138,.35)';
      ctx.fillRect(0, 0, state.leftKillMargin, h);
    } else {
      ctx.font = '900 28px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#9ab4ff';
      ctx.textAlign = 'center';
      ctx.fillText('Ready...', Math.floor(w/2), Math.floor(h*0.42));
    }
  }

  // ---------- Loop ----------
  let raf = 0;
  function loop(now) {
    if (!active) return;
    const dt = Math.min(0.033, (now - state.last) / 1000);
    state.last = now;
    if (state.running) {
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }
  }
  state.last = performance.now();
  draw();
  raf = requestAnimationFrame(loop);

  function cleanup() {
    active = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    overlay.remove();
  }
  function win() {
    if (!active) return;
    state.running = false;
    cleanup();
    onWin && onWin();
  }
  function lose() {
    if (!active) return;
    state.running = false;
    cleanup();
    onLose && onLose();
  }

  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.running) { lose(); }
    }
  });
}