// minigame-stairs.js
// 「階段を上がる」風の回避ミニゲーム（ジャンプ必須）
// - 20秒間、上から飛んでくる下剤入りジュース（缶/ボトル）を避けきれば勝利
// - 操作: ← / → で左右、Space/画面ボタンでジャンプ（2段ジャンプなし）
// - モバイル向けに画面内に [←][JUMP][→] のタッチボタンを表示
// - 既存 main.js の resolveOutcome('MINIGAME') から呼び出すことを想定

export function startMinigameStairs({ onWin, onLose }) {
  let active = true;

  const overlay = document.createElement('div');
  overlay.id = 'minigame-overlay';
  Object.assign(overlay.style, {
    position: 'absolute', inset: '0', zIndex: 10,
    background: 'linear-gradient(180deg,rgba(8,10,20,.9),rgba(5,6,12,.96))',
    overflow: 'hidden', touchAction: 'none'
  });
  // 背面クリックをブロック
  ['click','pointerdown','pointermove','pointerup'].forEach(ev => overlay.addEventListener(ev, e => e.stopPropagation(), {passive:false}));

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  overlay.appendChild(canvas);

  const ui = document.createElement('div');
  Object.assign(ui.style, {
    position: 'absolute', left: '0', right: '0', bottom: '10px',
    display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '12px',
    padding: '0 16px', pointerEvents: 'none' // 各ボタン側で復活
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
  const timerEl = document.createElement('div');
  Object.assign(timerEl.style, {
    flex: '0 0 auto',
    padding: '8px 12px', borderRadius: '12px', background: '#10122b', color: '#e8ebff', fontWeight: 700, border: '1px solid rgba(255,255,255,.08)'
  });
  const tipEl = document.createElement('div');
  tipEl.textContent = '階段を上がりながら、下剤ジュースを避けろ！ Space / JUMP でジャンプ';
  Object.assign(tipEl.style, { color: '#9aa3c7', fontSize: '12px' });
  topBar.append(timerEl, tipEl);
  overlay.appendChild(topBar);

  const app = document.getElementById('app') || document.body;
  app.appendChild(overlay);

  const ctx = canvas.getContext('2d');

  function resize() {
    const r = overlay.getBoundingClientRect();
    canvas.width = Math.floor(r.width);
    canvas.height = Math.floor(r.height);
  }
  resize();
  window.addEventListener('resize', resize);

  // -------- ゲームステート --------
  const state = {
    t0: performance.now(),
    last: performance.now(),
    elapsed: 0,
    duration: 20,                  // 20秒耐久でクリア
    climbSpeed: 60,                // 背景「上り」速度（見た目）px/s
    player: {
      x: canvas.width * 0.5,
      y: Math.max(140, canvas.height - 120),
      r: 16,
      vx: 0, vy: 0,
      speed: 220,                  // 左右移動 px/s
      jumpV: 420,                  // 初速
      gravity: 1200,               // 重力
      grounded: false
    },
    floorY: Math.max(140, canvas.height - 80),
    enemies: [],                   // {x,y,vx,vy,r,rot,omega,isBottle}
    spawnCool: 0,
    spawnMin: 0.6,                 // 最初のスポーン間隔
    spawnMinFinal: 0.28,           // 最終難易度（線形に詰める）
    leftHeld: false, rightHeld: false, jumpHeld: false,
    onWin, onLose,
    running: true
  };

  // -------- 入力 --------
  function onKey(e, d) {
    if (!state.running) return;
    if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') state.leftHeld = d;
    if (e.code === 'ArrowRight' || e.key === 'ArrowRight') state.rightHeld = d;
    if (e.code === 'Space' || e.key === ' ') {
      if (d) tryJump();
      e.preventDefault();
    }
  }
  window.addEventListener('keydown', (e)=>onKey(e,true));
  window.addEventListener('keyup', (e)=>onKey(e,false));

  let holdL=false, holdR=false;
  btnL.addEventListener('pointerdown', ()=>{ holdL=true; state.leftHeld=true; });
  btnL.addEventListener('pointerup',   ()=>{ holdL=false; state.leftHeld=false; });
  btnL.addEventListener('pointercancel',()=>{ holdL=false; state.leftHeld=false; });
  btnR.addEventListener('pointerdown', ()=>{ holdR=true; state.rightHeld=true; });
  btnR.addEventListener('pointerup',   ()=>{ holdR=false; state.rightHeld=false; });
  btnR.addEventListener('pointercancel',()=>{ holdR=false; state.rightHeld=false; });
  btnJ.addEventListener('click', ()=> tryJump());

  function tryJump() {
    if (!state.running) return;
    if (state.player.grounded) {
      state.player.vy = -state.player.jumpV;
      state.player.grounded = false;
    }
  }

  // -------- 敵（ジュース）スポーン --------
  function spawnEnemy() {
    const w = canvas.width, h = canvas.height;
    // 上端または上左右から放物線で投げてくる
    const edge = Math.random() < 0.5 ? 'top' : (Math.random() < 0.5 ? 'lt' : 'rt');
    let x, y, vx, vy;
    if (edge === 'top') {
      x = Math.random() * w; y = -20;
      const tx = state.player.x + (Math.random()*120-60);
      const ty = state.player.y - 20;
      const dx = tx - x, dy = ty - y;
      const t = 1.0 + Math.random()*0.6; // 到達想定時間
      vx = dx / t;
      vy = dy / t - 0.5 * state.player.gravity * 0.6; // 放物線になるよう控えめに補正
    } else {
      y = -30;
      x = edge === 'lt' ? -40 : w + 40;
      const tx = state.player.x + (edge==='lt'? 120: -120) + (Math.random()*80-40);
      const ty = state.player.y - 20;
      const t = 1.2 + Math.random()*0.6;
      vx = (tx - x) / t;
      vy = (ty - y) / t - 0.5 * state.player.gravity * 0.5;
    }
    const isBottle = Math.random() < 0.55;
    const r = isBottle ? 12 : 10;
    const omega = (Math.random()*2-1) * 6; // 回転
    state.enemies.push({ x, y, vx, vy, r, rot: 0, omega, isBottle });
  }

  // -------- 更新 --------
  function update(dt) {
    // 時間
    state.elapsed += dt;
    const tLeft = Math.max(0, state.duration - state.elapsed);
    timerEl.textContent = `残り ${tLeft.toFixed(1)} 秒`;

    if (state.elapsed >= state.duration) {
      state.running = false;
      win();
      return;
    }

    // 難易度：時間経過でスポーン間隔を詰める
    const p = Math.min(1, state.elapsed / state.duration);
    const spawnTarget = state.spawnMin * (1 - p) + state.spawnMinFinal * p;
    state.spawnCool -= dt;
    if (state.spawnCool <= 0) {
      spawnEnemy();
      state.spawnCool = spawnTarget * (0.75 + Math.random()*0.5);
    }

    // プレイヤー左右
    const pl = state.player;
    pl.vx = (state.rightHeld - state.leftHeld) * pl.speed;
    pl.x += pl.vx * dt;
    pl.x = Math.max(pl.r, Math.min(canvas.width - pl.r, pl.x));

    // 重力・着地
    pl.vy += pl.gravity * dt;
    pl.y += pl.vy * dt;
    if (pl.y > state.floorY - pl.r) {
      pl.y = state.floorY - pl.r;
      pl.vy = 0;
      pl.grounded = true;
    } else {
      pl.grounded = false;
    }

    // 敵の移動（重力で落下）
    for (const e of state.enemies) {
      e.vy += pl.gravity * 0.65 * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rot += e.omega * dt;
    }
    // 画面外の敵を破棄
    const w = canvas.width, h = canvas.height;
    state.enemies = state.enemies.filter(e => e.x > -80 && e.x < w + 80 && e.y < h + 120);

    // 当たり判定（円同士）
    for (const e of state.enemies) {
      const dx = e.x - pl.x, dy = e.y - pl.y;
      const rr = (e.r + pl.r);
      if (dx*dx + dy*dy <= rr*rr) {
        state.running = false;
        lose();
        break;
      }
    }
  }

  // -------- 描画 --------
  let stairScroll = 0;
  function draw() {
    const w = canvas.width, h = canvas.height;
    // 背景グラデ
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(16,18,42,1)');
    g.addColorStop(1, 'rgba(10,12,24,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 階段（擬似）: 斜めに流れる段差をタイル状に
    stairScroll += state.climbSpeed / 60;
    const gapY = 34, stepW = 120, stepH = 8, period = 160, slope = 0.7;
    ctx.fillStyle = '#23284e';
    for (let y = h + 40; y > -40; y -= gapY) {
      let x = ((y * slope + stairScroll) % period) - stepW;
      for (let k = -1; k <= 2; k++) {
        const xx = x + k * period;
        ctx.fillRect(xx, y, stepW, stepH);
      }
    }

    // 地面（見た目の基準線）
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(0, state.floorY + 18, w, 2);

    // プレイヤー（トンパのシルエット丸）
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI*2);
    ctx.fillStyle = '#6aa6ff';
    ctx.fill();

    // 敵：缶/ボトル
    for (const e of state.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot);
      if (e.isBottle) {
        // ボトル
        ctx.fillStyle = '#ff6a8a';
        ctx.fillRect(-6, -12, 12, 24);
        ctx.fillStyle = '#ffd86a';
        ctx.fillRect(-5, -14, 10, 3); // キャップ
      } else {
        // 缶
        ctx.fillStyle = '#ffd86a';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = '#10122b';
        ctx.fillRect(-10, -12, 20, 3);
        ctx.fillRect(-10, 9, 20, 3);
      }
      ctx.restore();
    }

    // 残り時間バー
    const p = Math.max(0, 1 - state.elapsed/state.duration);
    const barW = Math.max(0, (w - 24) * p);
    ctx.fillStyle = '#6aa6ff';
    ctx.fillRect(12, 12, barW, 6);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.strokeRect(12, 12, w - 24, 6);
  }

  // -------- ループ --------
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

  // 終了処理
  function cleanup() {
    active = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    overlay.remove();
  }
  function win() {
    if (!active) return;
    cleanup();
    onWin && onWin();
  }
  function lose() {
    if (!active) return;
    cleanup();
    onLose && onLose();
  }

  // ESC で中断→失敗扱い
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.running) { state.running = false; lose(); }
    }
  }, { once:false });
}
