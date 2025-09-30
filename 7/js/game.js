// js/game.js
import { CONFIG } from './config.js';
import { canvas, ctx, ui, state, DPR } from './store.js';
import { randBetween, pointSegmentDistanceSq, gatherSegmentsNear, normAngle, rayCapsuleIntersect } from './utils.js';
import { clearAllLines } from './lines.js';
import {
  initPile, resizePile, resetPile, relax,
  getSegmentsNear as pileSegmentsNear,
  surfaceYAtX, depositAtX, drawPile, clipUnderSphere,
  blastErodeCircle
} from './pile.js';

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.floor(rect.width * DPR);
  canvas.height = Math.floor(rect.height * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  state.groundY = canvas.height / DPR - 20;
  resizePile(canvas.width / DPR, state.groundY);
}

function buildSoftNodes(r) {
  state.sphere.nodes = [];
  const N = CONFIG.sbNodeCount;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    state.sphere.nodes.push({ ang, off: 0, vel: 0 });
  }
}

function spawnNewSphere(first = false) {
  const r = CONFIG.baseRadius + (state.level - 1) * CONFIG.growPerStage;
  const sp = state.sphere;
  sp.radius = r;
  sp.x = canvas.width / DPR * 0.5;
  sp.vx = 0; sp.vy = 0;
  sp.frags = [];
  buildSoftNodes(r);

  if (first) {
    const surf = surfaceYAtX(sp.x);
    sp.y = surf - r - CONFIG.surfaceClampEps; // ★最初からわずかに浮かせる
    sp.state = 'idle';
  } else {
    sp.y = -r - 40;
    sp.state = 'falling';
  }
}

function explodeSphere() {
  const sp = state.sphere;
  sp.state = 'explode';
  sp.frags = [];
  const N = CONFIG.fragCount;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + (Math.random() * 0.25);
    const spd = randBetween(CONFIG.fragSpeedMin, CONFIG.fragSpeedMax);
    sp.frags.push({
      x: sp.x, y: sp.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: CONFIG.fragRadius, life: CONFIG.fragLife,
    });
  }
}

function resetGame() {
  state.level = 1;
  state.particles = [];
  clearAllLines();
  resetPile();
  spawnNewSphere(true);
}

// --- ぷるぷる更新 ---
function updateSoftBody(dt) {
  const sp = state.sphere;
  const N = sp.nodes.length;
  const kC = CONFIG.sbKCenter, kN = CONFIG.sbKNeighbor, d = CONFIG.sbDamping;
  for (let i = 0; i < N; i++) {
    const n = sp.nodes[i];
    const prev = sp.nodes[(i - 1 + N) % N].off;
    const next = sp.nodes[(i + 1) % N].off;
    const force = -kC * n.off + kN * (prev - 2 * n.off + next) - d * n.vel;
    n.vel += force * dt;
    n.off += n.vel * dt;
  }
}

function nearestNodeIndex(angle) {
  const sp = state.sphere;
  const N = sp.nodes.length;
  const step = (Math.PI * 2) / N;
  return Math.round(normAngle(angle) / step) % N;
}
function jellyImpulseAt(angle) {
  const sp = state.sphere;
  const N = sp.nodes.length;
  const idx = nearestNodeIndex(angle);
  const spread = CONFIG.sbImpulseSpread;
  const J = CONFIG.sbImpulsePerHit;
  for (let j = -spread; j <= spread; j++) {
    const k = (idx + j + N) % N;
    const falloff = 1 - Math.abs(j) / (spread + 1);
    sp.nodes[k].vel -= J * falloff;
  }
}

// 玉 × 塩の山（CCD：上向き禁止＋下方向クランプ）
function moveSphereOnPile(dt) {
  const sp = state.sphere;

  // 横減衰＋上限
  sp.vx *= Math.exp(-CONFIG.sphereFriction * dt);
  sp.vx = Math.max(-CONFIG.sphereVxMax, Math.min(CONFIG.sphereVxMax, sp.vx));

  // 重力
  sp.vy += CONFIG.gravity * dt;

  let remaining = dt;
  let onSurface = false;

  const R = sp.radius + CONFIG.collisionThickness * 0.5;

  // ★ 保険①：処理前の下方向クランプ（床に入っていたら上へ戻す／上向き速度は付けない）
  {
    const surf = surfaceYAtX(sp.x);
    const yBottom = sp.y + sp.radius;
    if (yBottom >= surf - CONFIG.surfaceClampEps) {
      sp.y = surf - sp.radius - CONFIG.surfaceClampEps;
      if (sp.vy > 0) sp.vy = 0; // 下向き速度だけ消す
      onSurface = true;
    }
  }

  for (let iter = 0; iter < CONFIG.ccdMaxIterations && remaining > 1e-5; iter++) {
    const d = { x: sp.vx * remaining, y: sp.vy * remaining };
    const moveLen = Math.hypot(d.x, d.y);

    // 地形セグメントのみ相手
    const nearPile = pileSegmentsNear(sp.x, R + moveLen + 12);

    // 最初に当たる面
    let best = null;
    for (const s of nearPile) {
      const hit = rayCapsuleIntersect(
        { x: sp.x, y: sp.y }, d,
        { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 },
        R, 1.0
      );
      if (hit.hit && (!best || hit.t < best.t)) best = { ...hit, seg: s };
    }

    if (!best) {
      sp.x += d.x; sp.y += d.y;
      remaining = 0;
      break;
    }

    // 衝突点まで
    sp.x += d.x * best.t;
    sp.y += d.y * best.t;

    // 跳ねずに面に沿って滑る（ただし“上向き速度は許さない”）
    const nx = best.nx, ny = best.ny;
    const tx = -ny, ty = nx;
    const vt = sp.vx * tx + sp.vy * ty;
    const vt2 = vt * (1 - CONFIG.lineFriction);

    sp.vx = tx * vt2;
    sp.vy = ty * vt2;
    if (sp.vy < 0) sp.vy = 0; // ★上向き速度禁止

    // めり込み防止：下方向成分だけ押し戻す
    if (ny > 0) sp.y += ny * CONFIG.ccdEpsilon;
    sp.x += nx * CONFIG.ccdEpsilon;

    onSurface = true;

    const adv = best.t;
    remaining *= (1 - Math.max(0, Math.min(adv, 1)));
  }

  // ★ 保険②：処理後の下方向クランプ（数値誤差で入ったら戻す）
  {
    const surf = surfaceYAtX(sp.x);
    const yBottom = sp.y + sp.radius;
    if (yBottom >= surf - CONFIG.surfaceClampEps) {
      sp.y = surf - sp.radius - CONFIG.surfaceClampEps;
      if (sp.vy > 0) sp.vy = 0;
      onSurface = true;
    }
  }

  // 端
  const minX = sp.radius + 2;
  const maxX = canvas.width / DPR - sp.radius - 2;
  if (sp.x < minX) { sp.x = minX; sp.vx = -sp.vx * CONFIG.wallBounce; }
  else if (sp.x > maxX) { sp.x = maxX; sp.vx = -sp.vx * CONFIG.wallBounce; }

  sp.state = onSurface ? 'idle' : 'falling';
}

// --- 粒：サブステップ×CCD。床に当たってからだけ堆積する ---
function stepParticleCCD(p, stepDt) {
  const pr = CONFIG.particleRadius;
  const r  = pr + CONFIG.collisionThickness * 0.5;

  // 加速度
  p.vy += CONFIG.gravity * stepDt;
  p.vx *= Math.exp(-CONFIG.particleHDrag * stepDt);
  if (p.vy > CONFIG.particleVTerminal) p.vy = CONFIG.particleVTerminal;

  let remaining = stepDt;

  for (let iter = 0; iter < CONFIG.ccdMaxIterations && remaining > 1e-5 && p.alive; iter++) {
    const d = { x: p.vx * remaining, y: p.vy * remaining };
    const moveLen = Math.hypot(d.x, d.y);

    // 近傍候補：ユーザー線 + 地形
    const nearLines = gatherSegmentsNear(state, p.x, p.y, r + moveLen + 8);
    const nearPile  = pileSegmentsNear(p.x, r + moveLen + 8);
    const nearAll   = nearLines.concat(nearPile);

    // 最初に当たる面
    let best = null;
    for (const s of nearAll) {
      const hit = rayCapsuleIntersect(
        { x: p.x, y: p.y }, d,
        { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 },
        r, 1.0
      );
      if (hit.hit && (!best || hit.t < best.t)) best = { ...hit, seg: s };
    }

    if (!best) {
      p.x += d.x; p.y += d.y;
      remaining = 0;
      break;
    }

    // 衝突点まで
    p.x += d.x * best.t;
    p.y += d.y * best.t;

    // ★ 地形に当たったら“その瞬間だけ”堆積
    if (best.seg.isPile) {
      depositAtX(p.x, CONFIG.depositHeightPerGrain);
      p.alive = false;
      return;
    }

    // 線に当たった場合は“跳ねずに滑る”
    const nx = best.nx, ny = best.ny;
    const tx = -ny, ty = nx;
    const vt = p.vx * tx + p.vy * ty;
    const vt2 = vt * (1 - CONFIG.lineFriction);
    p.vx = tx * vt2;
    p.vy = ty * vt2;

    // めり込み防止
    p.x += nx * CONFIG.ccdEpsilon;
    p.y += ny * CONFIG.ccdEpsilon;

    // 残り時間
    const adv = best.t;
    remaining *= (1 - Math.max(0, Math.min(adv, 1)));
  }

  // ★ 最終保険：数値誤差で表面下に入ってしまったときだけ堆積
  if (p.alive) {
    const surfY = surfaceYAtX(p.x);
    if (p.y + pr >= surfY) {
      // 下向き短レイで“手前に線が無い”ときだけ許可
      const dShort = { x: 0, y: (surfY - (p.y + pr)) + CONFIG.ccdEpsilon + pr };
      let blocked = false;
      const nearLines2 = gatherSegmentsNear(state, p.x, p.y, r + 6);
      for (const s of nearLines2) {
        const hit2 = rayCapsuleIntersect(
          { x: p.x, y: p.y }, dShort,
          { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 },
          r, 1.0
        );
        if (hit2.hit) { blocked = true; break; }
      }
      if (!blocked) {
        depositAtX(p.x, CONFIG.depositHeightPerGrain);
        p.alive = false;
      }
    }
  }
}

function update(dt) {
  // スポーン
  const spawn = CONFIG.spawnPerSecond * dt + state.runtime.spawnCarry;
  let toSpawn = Math.floor(spawn);
  state.runtime.spawnCarry = spawn - toSpawn;
  while (toSpawn-- > 0 && state.particles.length < CONFIG.maxParticles) {
    state.particles.push({
      x: canvas.width / DPR * 0.5 + (Math.random() * 2 - 1) * CONFIG.spawnJitterX,
      y: CONFIG.spawnTopMargin,
      vx: (Math.random() * 2 - 1) * CONFIG.spawnVxJitter,
      vy: 0,
      alive: true,
    });
  }

  // 粒の更新（サブステップ×CCD。床に当たってからだけ堆積）
  const maxY = canvas.height / DPR + 50;
  for (const p of state.particles) {
    if (!p.alive) continue;

    const speed = Math.hypot(p.vx, p.vy) + CONFIG.gravity * dt;
    const safe = Math.max(CONFIG.particleRadius, 0.5) + CONFIG.collisionThickness * 0.5;
    let steps = Math.ceil((speed * dt) / (safe * 0.9));
    steps = Math.max(1, Math.min(CONFIG.particleSubstepsMax, steps));
    const stepDt = dt / steps;

    for (let s = 0; s < steps && p.alive; s++) {
      stepParticleCCD(p, stepDt);
      if (p.y > maxY || p.x < -50 || p.x > canvas.width / DPR + 50) p.alive = false;
    }

    // 球体ヒット：塩が玉に当たったら縮む＆ぷるぷる
    const sp = state.sphere;
    if (p.alive && sp.state !== 'explode') {
      const dx = p.x - sp.x, dy = p.y - sp.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= sp.radius + CONFIG.particleRadius) {
        p.alive = false;
        sp.radius -= CONFIG.shrinkPerHit;
        if (sp.radius <= CONFIG.minRadiusToExplode) {
          explodeSphere();
        } else {
          const kick = (dx < 0 ? +1 : -1) * CONFIG.kickPerHit;
          const heightFactor = 0.7 + 0.6 * Math.max(0, 1 - Math.abs(dy) / Math.max(1, sp.radius));
          sp.vx += kick * heightFactor;
          const ang = Math.atan2(dy, dx);
          jellyImpulseAt(ang);
        }
      }
    }
  }

  // 掃除
  if ((state.runtime.frameCount % 30) === 0) {
    state.particles = state.particles.filter(p => p.alive);
  }

  // 地形の緩和（雪崩）
  relax(CONFIG.pileRelaxIterations);

  // ★ 侵食ダメージ計測用の合算バッファ
  let erodedPx = 0;

  // 事前クリップ：玉の下面に食い込んだ塩を削る（削れ量を加算）
  if (state.sphere.state !== 'explode') {
    const sp = state.sphere;
    erodedPx += clipUnderSphere(sp.x, sp.y, sp.radius, 1.5);
  }

  // 玉の移動（上向き禁止＋下方向クランプ版の moveSphereOnPile を使用）
  if (state.sphere.state !== 'explode') {
    moveSphereOnPile(dt);
  }

  // 事後クリップ：移動後に再チェック（側面で触れた分も削る）
  if (state.sphere.state !== 'explode') {
    const sp = state.sphere;
    erodedPx += clipUnderSphere(sp.x, sp.y, sp.radius, 1.5);
  }

  // ★ 削れ量→玉のダメージ（上から降ってなくても“触れて削れた分”だけ確実に萎む）
  if (state.sphere.state !== 'explode' && erodedPx > CONFIG.erosionShrinkMinTriggerPx) {
    const sp = state.sphere;
    sp.radius -= erodedPx * CONFIG.erosionShrinkPerPx;

    if (sp.radius <= CONFIG.minRadiusToExplode) {
      explodeSphere();
    } else {
      // ちょいぷる反応（任意・弱め）
      const kick = 0; // 侵食では横キックなし
      sp.vx += kick;
      // 小さく波紋だけ与えるなら：jellyImpulseAt(Math.PI/2) なども可にゃ
    }
  }

  // ぷるぷる更新
  updateSoftBody(dt);

  // 爆発破片（塩＆線を消す）
  const sp = state.sphere;
  if (sp.state === 'explode') {
    let allDead = true;
    for (const f of sp.frags) {
      if (f.life <= 0) continue;
      allDead = false;

      f.vx *= CONFIG.fragDrag;
      f.vy = (f.vy + CONFIG.gravity * dt) * CONFIG.fragDrag;
      f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;

      // 破片ループ内（f.x/f.y を更新した直後あたり）
      blastErodeCircle(f.x, f.y, f.r * 1.2, 0.6); // 半径少し広め＋わずかな余裕でガッツリ削る

      // 破片で塩粒を消す
      for (const p of state.particles) {
        if (!p.alive) continue;
        const dx = p.x - f.x, dy = p.y - f.y;
        if (dx * dx + dy * dy <= (f.r + CONFIG.particleRadius) ** 2) p.alive = false;
      }
      // 破片で線を消す
      const nearSegs = gatherSegmentsNear(state, f.x, f.y, f.r + 4);
      for (const s of nearSegs) {
        if (!s.alive) continue;
        const d2 = pointSegmentDistanceSq(f.x, f.y, s.x1, s.y1, s.x2, s.y2);
        if (d2 <= (CONFIG.collisionThickness * 0.5) ** 2) s.alive = false;
      }

    }
    if (allDead || sp.frags.every(fr => fr.life <= 0)) {
      state.level++;
      state.particles = state.particles.filter(p => p.alive);
      spawnNewSphere();
    }
  }

  // UI
  ui.level.textContent = state.level.toString();
  ui.salt.textContent  = state.particles.length.toString();
}

function drawSoftBodyFill() {
  const sp = state.sphere;
  const N = sp.nodes.length;

  // ソフトボディ輪郭
  const pts = [];
  let maxOff = 0;
  for (let i = 0; i < N; i++) {
    const n = sp.nodes[i];
    const off = sp.radius + n.off;
    maxOff = Math.max(maxOff, Math.abs(n.off));
    pts.push({ x: sp.x + Math.cos(n.ang) * off, y: sp.y + Math.sin(n.ang) * off });
  }

  // スムーズに閉じたパス
  ctx.beginPath();
  const mid = (a, b) => ({ x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 });
  const p0 = pts[0], pLast = pts[N - 1];
  let m = mid(pLast, p0);
  ctx.moveTo(m.x, m.y);
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    const pNext = pts[(i + 1) % N];
    const mNext = mid(p, pNext);
    ctx.quadraticCurveTo(p.x, p.y, mNext.x, mNext.y);
  }
  ctx.closePath();

  // ===== 茶〜黄土の“なめくじ”ボディ =====
  const rVis = sp.radius + maxOff * 1.0;

  // 本体（中心やや上を明るく）
  const body = ctx.createRadialGradient(
    sp.x - rVis * 0.20, sp.y - rVis * 0.32, rVis * 0.12,   // 内側
    sp.x,               sp.y + rVis * 0.10, rVis * 1.05    // 外側
  );
  // 内→外：淡いベージュ → 黄土 → 焦げ茶
  body.addColorStop(0.00, '#f1debf');  // クリーム寄りハイライト
  body.addColorStop(0.30, '#d6b089');  // ライトオーカー
  body.addColorStop(0.60, '#b47a51');  // ミドルブラウン
  body.addColorStop(0.85, '#8a5a3b');  // 深めの茶
  body.addColorStop(1.00, '#4a3427');  // 外縁の焦げ茶

  ctx.save();
  ctx.globalAlpha = 0.92;        // 半透明で“湿り気”
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();

  // ぬめりのハイライト（楕円の光沢）
  ctx.save();
  ctx.globalAlpha = 0.28;
  const hl = ctx.createRadialGradient(
    sp.x - rVis * 0.18, sp.y - rVis * 0.42, rVis * 0.05,
    sp.x - rVis * 0.18, sp.y - rVis * 0.42, rVis * 0.55
  );
  hl.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  hl.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.ellipse(sp.x - rVis * 0.14, sp.y - rVis * 0.38, rVis * 0.54, rVis * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // うっすら縞（実物っぽい背の筋）— 強すぎないようにソフトに
  ctx.save();
  ctx.clip();                         // 球体の中だけ描く
  ctx.globalAlpha = 0.20;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(40,25,20,0.35)';
  ctx.shadowBlur = rVis * 0.12;

  // 斜めに2本入れる（幅は球サイズに追従）
  const stripe = (offset) => {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60,40,30,0.45)'; // 暗茶
    ctx.lineWidth = Math.max(1, rVis * 0.12);
    ctx.moveTo(sp.x - rVis * 0.9, sp.y - rVis * (0.10 + offset));
    ctx.quadraticCurveTo(sp.x, sp.y - rVis * (0.25 + offset), sp.x + rVis * 0.9, sp.y + rVis * (0.05 + offset));
    ctx.stroke();
  };
  stripe(-0.10);
  stripe(+0.06);
  ctx.restore();

  // 外周のごく薄い縁取り（湿った影）
  ctx.save();
  ctx.lineWidth = Math.max(1, rVis * 0.05);
  ctx.strokeStyle = 'rgba(30,22,18,0.35)';
  ctx.stroke();
  ctx.restore();
}


function draw() {
  // 背景
  ctx.fillStyle = '#0f1020';
  ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);

  // 地面ガイド
  ctx.strokeStyle = '#26294e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, state.groundY + 0.5);
  ctx.lineTo(canvas.width / DPR, state.groundY + 0.5);
  ctx.stroke();

  // 塩の山
  drawPile(ctx);

  // 球体 or 破片
  const sp = state.sphere;
  if (sp.state === 'falling' || sp.state === 'idle') {
    drawSoftBodyFill();
  } else if (sp.state === 'explode') {
    ctx.fillStyle = '#8fd3ff';
    for (const f of sp.frags) {
      if (f.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, f.life / CONFIG.fragLife);
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // 線
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#f2f2f7';
  ctx.lineWidth = CONFIG.lineThickness;
  ctx.beginPath();
  for (const s of state.segments) {
    if (!s.alive) continue;
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();

  // 動的な塩粒
  ctx.fillStyle = '#ffffff';
  for (const p of state.particles) {
    if (!p.alive) continue;
    ctx.beginPath(); ctx.arc(p.x, p.y, CONFIG.particleRadius, 0, Math.PI * 2); ctx.fill();
  }

  // スポーン口（狭い口）
  ctx.fillStyle = '#c0c6ff';
  const spx = canvas.width / DPR * 0.5;
  const mouthW = Math.max(4, CONFIG.spawnJitterX * 2);
  ctx.fillRect(spx - mouthW * 0.5, 0, mouthW, 6);
}

function loop(now) {
  const dt = Math.min(0.035, Math.max(0.001, (now - state.runtime.lastTime) / 1000));
  state.runtime.lastTime = now;

  const instFps = 1 / dt;
  state.runtime.fpsSmoother = state.runtime.fpsSmoother * 0.92 + instFps * 0.08;
  if ((state.runtime.frameCount & 15) === 0) ui.fps.textContent = Math.round(state.runtime.fpsSmoother).toString();

  update(dt);
  draw();

  state.runtime.frameCount++;
  requestAnimationFrame(loop);
}

export function initGame() {
  const rect = canvas.getBoundingClientRect();
  state.groundY = (rect.height * DPR) / DPR - 20;
  initPile(rect.width, state.groundY);

  resizeCanvas();
  spawnNewSphere(true);
  state.runtime.lastTime = performance.now();
  requestAnimationFrame(loop);

  window.addEventListener('resize', resizeCanvas, { passive: true });
  ui.btnReset.addEventListener('click', resetGame);
}
