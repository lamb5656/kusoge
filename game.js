(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl  = document.getElementById('best');
  const stateEl = document.getElementById('state');
  const msgEl   = document.getElementById('message');
  const startBtn  = document.getElementById('startBtn');
  const resetBtn  = document.getElementById('resetBtn');
  const difficultySel = document.getElementById('difficulty');

  // -------- Retina対応 --------
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, devicePixelRatio || 1));
    canvas.width  = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas();
  addEventListener('resize', () => { fitCanvas(); });

  // -------- 定数など --------
  const STATE = { READY:'待機中', PLAY:'プレイ中', OVER:'ゲームオーバー' };
  const BEST_KEY = (lv) => `ito-toshi-slit-best-${lv}`;

  let game;
  const player = { x: 0, y: 0, r: 7, vy: 0 }; // 小さめの●

  const input = { press:false };

  function levelParams(lv) {
    // 画面高さにあわせてスケール
    const H = canvas.clientHeight || 540;
    const scale = H / 540;

    // スポーン間隔とギャップを難易度ごとに設定（間隔は広め）
    if (lv === 'easy') {
      return {
        speed: 180, gravity: 900, thrust: 1400,
        gapH: 180 * scale,         // スリット高さ（広め）
        barH: 18 * scale,          // 横棒の太さ
        gateW: 120 * scale,        // ゲートのX幅（当たり判定領域）
        spawnEvery: 3.2,           // 次ゲートまでの時間（広い）
        initGapX: 360,             // 初期整列間隔（px相当）
        playerR: 7 * scale,
        maxStepY: 120 * scale,     // 前ゲートからの中心Y変化上限
        yMargin: 60 * scale        // 画面端の安全マージン
      };
    }
    if (lv === 'hard') {
      return {
        speed: 230, gravity: 1150, thrust: 1700,
        gapH: 120 * scale,
        barH: 16 * scale,
        gateW: 100 * scale,
        spawnEvery: 2.3,           // 以前より広げた（でも歯ごたえ維持）
        initGapX: 320,
        playerR: 7 * scale,
        maxStepY: 140 * scale,
        yMargin: 60 * scale
      };
    }
    // normal
    return {
      speed: 200, gravity: 1000, thrust: 1550,
      gapH: 150 * scale,
      barH: 16 * scale,
      gateW: 110 * scale,
      spawnEvery: 2.8,             // ← 間隔拡大
      initGapX: 340,
      playerR: 7 * scale,
      maxStepY: 130 * scale,
      yMargin: 60 * scale
    };
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function rand(a, b){ return a + Math.random() * (b - a); }

  // -------- リセット --------
  function reset(level = 'normal') {
    const L = levelParams(level);
    game = {
      level,
      gates: [], // {x, y, gapH, barH, w, xPrev, scored, passed}
      speed: L.speed,
      gravity: L.gravity,
      thrust: L.thrust,
      spawnEvery: L.spawnEvery,
      spawnTimer: 0,
      score: 0,
      state: STATE.READY,
      lastTs: 0,
      gateW: L.gateW,
      gapH: L.gapH,
      barH: L.barH,
      yMin: L.yMargin,
      yMax: (canvas.clientHeight || 540) - L.yMargin,
      maxStepY: L.maxStepY
    };
    player.r = L.playerR;
    player.x = Math.round((canvas.clientWidth || 960) * 0.25);
    player.y = Math.round((canvas.clientHeight || 540) * 0.5);
    player.vy = 0;

    // 初期ゲートを広めの間隔で配置
    for (let i = 0; i < 4; i++) spawnGate(true, i === 0 ? null : game.gates[i-1], L.initGapX);

    updateHud();
    draw(true);
  }

  function spawnGate(initial = false, prev = null, initGapX = 300) {
    const L = levelParams(game.level);
    const baseX = (canvas.clientWidth || 960) + 80;
    const last = prev || game.gates[game.gates.length - 1];

    const x = initial
      ? (last ? last.x + initGapX : baseX + 160)
      : baseX;

    // 前ゲートからの変化量を制限して理不尽なジャンプを防止
    let y;
    if (last) {
      const target = last.y + rand(-game.maxStepY, game.maxStepY);
      y = clamp(target, game.yMin + game.gapH * 0.6, game.yMax - game.gapH * 0.6);
    } else {
      y = rand(game.yMin + game.gapH * 0.6, game.yMax - game.gapH * 0.6);
    }

    game.gates.push({
      x, y,
      gapH: game.gapH,
      barH: game.barH,
      w: game.gateW,
      xPrev: x,
      scored: false,
      passed: false
    });
  }

  // -------- ループ --------
  let rafId = 0;

  function start() {
    if (game.state === STATE.PLAY) return;
    game.state = STATE.PLAY;
    msgEl.textContent = '';
    resetBtn.disabled = false;
    stateEl.textContent = STATE.PLAY;
    game.lastTs = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function gameOver(reason='失敗') {
    game.state = STATE.OVER;
    stateEl.textContent = STATE.OVER;
    msgEl.textContent = `${reason}：スコア ${game.score}`;
    const key = BEST_KEY(game.level);
    const prev = Number(localStorage.getItem(key) || '0');
    if (game.score > prev) {
      localStorage.setItem(key, String(game.score));
      bestEl.textContent = String(game.score);
      msgEl.textContent += '（ベスト更新）';
    }
    cancelAnimationFrame(rafId);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - game.lastTs) / 1000);
    game.lastTs = now;
    step(dt);
    draw();
    if (game.state === STATE.PLAY) rafId = requestAnimationFrame(loop);
  }

  // -------- 物理・判定 --------
  function step(dt) {
    // 押す=上昇、離す=下降
    const acc = input.press ? -game.thrust : game.gravity;
    player.vy += acc * dt;
    player.y += player.vy * dt;

    // 画面上下
    if (player.y - player.r < 0) return gameOver('上にぶつかった');
    if (player.y + player.r > canvas.clientHeight) return gameOver('下に落ちた');

    // ゲート移動＆生成
    const v = game.speed * dt;
    game.spawnTimer += dt;
    if (game.spawnTimer >= game.spawnEvery) {
      game.spawnTimer -= game.spawnEvery;
      spawnGate(false);
    }

    for (const g of game.gates) {
      g.xPrev = g.x;
      g.x -= v;

      const halfW = g.w / 2;
      const gapTop = g.y - g.gapH / 2;
      const gapBot = g.y + g.gapH / 2;

      // 中央線通過時にスコア or 失敗
      if (!g.scored) {
        const wasLeft = (g.xPrev - player.x) >= 0;
        const nowLeft = (g.x - player.x) >= 0;
        if (wasLeft && !nowLeft) {
          const within = (player.y - player.r) >= gapTop && (player.y + player.r) <= gapBot;
          if (within) {
            g.scored = true;
            g.passed = true;
            game.score += 1;
            updateHud();
          } else {
            return gameOver('スリットを外した');
          }
        }
      }

      // 幅領域内でスリット外なら接触
      if (!g.passed) {
        const dx = Math.abs(player.x - g.x);
        const insideX = dx <= (halfW + player.r * 0.8);
        const outsideGap = (player.y - player.r) < gapTop || (player.y + player.r) > gapBot;
        if (insideX && outsideGap) {
          return gameOver('横棒に接触');
        }
      }
    }

    // 画面外を掃除
    while (game.gates.length && game.gates[0].x < - (game.gates[0].w + 120)) {
      game.gates.shift();
    }
  }

  // -------- 描画 --------
  function draw(initial=false) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    drawGrid(w, h);

    // ゲート（横棒2本のスリット）
    for (const g of game.gates) {
      drawSlitGate(g, w, h);
    }

    // プレイヤー（●）
    ctx.beginPath();
    ctx.fillStyle = '#38bdf8';
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();

    // ガイド
    ctx.strokeStyle = 'rgba(148,163,184,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(h * 0.5) + 0.5);
    ctx.lineTo(w, Math.round(h * 0.5) + 0.5);
    ctx.stroke();

    if (initial && game.state === STATE.READY) {
      msgEl.textContent = '「開始」でスタート。押して上昇・離して下降。横棒2本の隙間（スリット）をくぐるにゃ。';
    }
  }

  function drawSlitGate(g, w, h) {
    const halfW = g.w / 2;
    const x0 = Math.round(g.x - halfW);
    const x1 = Math.round(g.x + halfW);
    const gapTop = Math.round(g.y - g.gapH / 2);
    const gapBot = Math.round(g.y + g.gapH / 2);
    const barH  = Math.max(2, Math.round(g.barH));

    // 上の横棒
    ctx.fillStyle = g.scored ? '#16a34a' : '#eab308';
    ctx.fillRect(x0, gapTop - Math.round(barH / 2), x1 - x0, barH);

    // 下の横棒
    ctx.fillRect(x0, gapBot - Math.round(barH / 2), x1 - x0, barH);

    // スリット中心の薄い目印
    ctx.fillStyle = 'rgba(203,213,225,.22)';
    ctx.fillRect(x0, g.y - 2, x1 - x0, 4);
  }

  function drawGrid(w, h) {
    const step = 40;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1f2937';
    for (let x = (performance.now()/20)%step; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x)+0.5, 0);
      ctx.lineTo(Math.round(x)+0.5, h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateHud() {
    scoreEl.textContent = String(game.score);
    const best = localStorage.getItem(BEST_KEY(game.level));
    bestEl.textContent = best ? best : '–';
    stateEl.textContent = game.state;
  }

  // -------- 入力 --------
  function pressOn(){ input.press = true; }
  function pressOff(){ input.press = false; }

  canvas.addEventListener('pointerdown', (e) => {
    if (game.state === STATE.READY) start();
    pressOn();
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', () => pressOff());
  canvas.addEventListener('pointercancel', () => pressOff());
  addEventListener('blur', () => pressOff());

  // キーボード（スペース）
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (game.state === STATE.READY) start(); pressOn(); }
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'Space') { e.preventDefault(); pressOff(); }
  });

  // -------- ボタン --------
  startBtn.addEventListener('click', () => start());
  resetBtn.addEventListener('click', () => reset(game.level));
  difficultySel.addEventListener('change', (e) => {
    reset(e.target.value);
    const best = localStorage.getItem(BEST_KEY(e.target.value));
    bestEl.textContent = best ? best : '–';
  });

  // ページ非表示時は終了扱い（チート防止）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game?.state === STATE.PLAY) {
      gameOver('一時停止');
    }
  });

  // 初期化
  reset(difficultySel.value);
})();
