import { GameState, Phases } from "./game/state.js";
import { STAGES } from "./game/stages.js";
import { computePowderFlowDeg, updateToppings } from "./game/physics.js";
import { scorePowder, scoreToppings, scoreTiming, finalScore } from "./game/scoring.js";
import { initSidebar, updateRecipeUI, showPhasePanel, drawScene, qs } from "./ui/ui.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let stageIndex = 0;
let state = new GameState(STAGES[stageIndex]);

initSidebar(STAGES, switchStage);
updateRecipeUI(STAGES[stageIndex]);
setupControls();
setupKeyboard();
startPhasePowder();

function switchStage(idx) {
  stageIndex = idx;
  state.resetForStage(STAGES[stageIndex]);
  updateRecipeUI(STAGES[stageIndex]);
  startPhasePowder();
}

function setupControls() {
  // Powder
  const tiltA = qs("#tiltA"), tiltB = qs("#tiltB");
  tiltA.addEventListener("input", () => { state.tilt.A = Number(tiltA.value); qs("#tiltAVal").textContent = tiltA.value + "°"; });
  tiltB.addEventListener("input", () => { state.tilt.B = Number(tiltB.value); qs("#tiltBVal").textContent = tiltB.value + "°"; });
  qs("#powderDone").addEventListener("click", () => startPhaseToppings());

  // Toppings (2-axis)
  const tx = qs("#boardTiltX"), ty = qs("#boardTiltY");
  const setTiltLabels = () => {
    qs("#boardTiltXVal").textContent = Math.round(state.boardTilt.roll) + "°";
    qs("#boardTiltYVal").textContent = Math.round(state.boardTilt.pitch) + "°";
  };
  tx.addEventListener("input", () => { state.boardTilt.roll = Number(tx.value); setTiltLabels(); });
  ty.addEventListener("input", () => { state.boardTilt.pitch = Number(ty.value); setTiltLabels(); });
  setTiltLabels();
  qs("#toppingsDone").addEventListener("click", () => startPhasePour());

  // Pour
  const pourBtn = qs("#pourBtn");
  let pouring = false;
  pourBtn.addEventListener("mousedown", () => pouring = true);
  pourBtn.addEventListener("touchstart", () => pouring = true, { passive: true });
  const stopPour = () => pouring = false;
  ["mouseup","mouseleave","touchend","touchcancel"].forEach(ev => pourBtn.addEventListener(ev, stopPour));
  function updatePour(dt) {
    if (!pouring) return;
    state.waterFill = Math.min(1, state.waterFill + dt * 0.35);
    if (state.waterFill >= state.stage.target.fillLine * 1.1) state.spill += 0.2 * dt * 60;
    if (state.waterFill >= state.stage.target.fillLine) qs("#lidBtn").disabled = false;
  }
  state._updatePour = updatePour;

  qs("#lidBtn").addEventListener("click", () => { state.lidClosedAt = performance.now(); startPhaseWait(); });
  qs("#openBtn").addEventListener("click", () => { state.openPressedAt = performance.now(); startPhaseResult(); });

  qs("#retryBtn").addEventListener("click", () => switchStage(stageIndex));
  qs("#nextStageBtn").addEventListener("click", () => {
    const next = (stageIndex + 1) % STAGES.length; switchStage(next);
    document.querySelector("#stageSelect").value = String(next);
  });

  // Gyro (experimental → roll=gamma, pitch=beta近似)
  const gyroToggle = qs("#gyroToggle");
  gyroToggle.addEventListener("change", async () => {
    if (gyroToggle.checked && typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
      try { await DeviceOrientationEvent.requestPermission(); } catch {}
    }
  });
  window.addEventListener("deviceorientation", (e) => {
    if (!gyroToggle.checked) return;
    const gamma = e.gamma ?? 0; // 左右
    const beta  = e.beta ?? 0;  // 奥行き
    state.boardTilt.roll  = clampRange(gamma, -30, 30);
    state.boardTilt.pitch = clampRange(beta - 60, -30, 30); // 端末角度を軽く補正
    tx.value = String(Math.round(state.boardTilt.roll));
    ty.value = String(Math.round(state.boardTilt.pitch));
    qs("#boardTiltXVal").textContent = Math.round(state.boardTilt.roll) + "°";
    qs("#boardTiltYVal").textContent = Math.round(state.boardTilt.pitch) + "°";
  });
}

function setupKeyboard() {
  window.addEventListener("keydown", (e) => {
    const step = 3;
    if (state.phase === Phases.POWDER) {
      if (e.key.toLowerCase() === "q") state.tilt.A = clampRange(state.tilt.A + step, 0, 120);
      if (e.key.toLowerCase() === "e") state.tilt.A = clampRange(state.tilt.A - step, 0, 120);
      if (e.key.toLowerCase() === "a") state.tilt.B = clampRange(state.tilt.B + step, 0, 120);
      if (e.key.toLowerCase() === "d") state.tilt.B = clampRange(state.tilt.B - step, 0, 120);
      qs("#tiltA").value = String(Math.round(state.tilt.A));
      qs("#tiltB").value = String(Math.round(state.tilt.B));
      qs("#tiltAVal").textContent = Math.round(state.tilt.A) + "°";
      qs("#tiltBVal").textContent = Math.round(state.tilt.B) + "°";
    }
    if (state.phase === Phases.TOPPINGS) {
      if (e.key.toLowerCase() === "a") state.boardTilt.roll  = clampRange(state.boardTilt.roll - step, -30, 30);
      if (e.key.toLowerCase() === "d") state.boardTilt.roll  = clampRange(state.boardTilt.roll + step, -30, 30);
      if (e.key.toLowerCase() === "w") state.boardTilt.pitch = clampRange(state.boardTilt.pitch - step, -30, 30);
      if (e.key.toLowerCase() === "s") state.boardTilt.pitch = clampRange(state.boardTilt.pitch + step, -30, 30);
      qs("#boardTiltX").value = String(Math.round(state.boardTilt.roll));
      qs("#boardTiltY").value = String(Math.round(state.boardTilt.pitch));
      qs("#boardTiltXVal").textContent = Math.round(state.boardTilt.roll) + "°";
      qs("#boardTiltYVal").textContent = Math.round(state.boardTilt.pitch) + "°";
    }
  });
}

function startPhasePowder() {
  state.setPhase(Phases.POWDER);
  showPhasePanel(Phases.POWDER);
  spawnToppingsFromBoardStock();
  loop();
}

function startPhaseToppings() {
  state.setPhase(Phases.TOPPINGS);
  showPhasePanel(Phases.TOPPINGS);
}

function startPhasePour() {
  state.setPhase(Phases.POUR);
  showPhasePanel(Phases.POUR);
}

function startPhaseWait() {
  state.setPhase(Phases.LID_WAIT);
  showPhasePanel(Phases.LID_WAIT);
}

function startPhaseResult() {
  state.setPhase(Phases.RESULT);
  showPhasePanel(Phases.RESULT);
  showResult();
}

function spawnToppingsFromBoardStock() {
  state.toppings = [];
  const { width: W, height: H } = canvas;
  const boardRect = { x: W*0.12, y: H*0.56, w: W*0.56, h: H*0.22 };
  const stock = state.stage.target.boardStock || [];
  for (const s of stock) {
    const r = radiusForKind(s.name);
    for (let i = 0; i < s.count; i++) {
      state.toppings.push({
        kind: s.name,
        x: boardRect.x + Math.random()*boardRect.w,
        y: boardRect.y + Math.random()*boardRect.h,
        vx: 0, vy: 0,
        r,
        onBoard: true,
        boardRect,
        captured: false,
        removed: false,
        landX: 0, landY: 0,
      });
    }
  }
}

function radiusForKind(kind) {
  switch (kind) {
    case "corn": return 6;
    case "negi": return 5;
    case "menma": return 7;
    case "chashu": return 20;
    default: return 6;
  }
}

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.033, (now - state._lastTS) / 1000);
  state._lastTS = now;

  state.elapsed += dt;

  // Draw and get geometry
  const { cup } = drawScene(ctx, state, state.stage);

  // Powder sim (no HUD numbers)
  if (state.phase === Phases.POWDER) {
    const p = state.stage.physics.powder;
    const total = state.powder.A + state.powder.B + state.spill + 1e-6;
    const remainFracA = 1 - (state.powder.A / (total + 50));
    const remainFracB = 1 - (state.powder.B / (total + 50));
    const fa = computePowderFlowDeg(state.tilt.A, p, remainFracA);
    const fb = computePowderFlowDeg(state.tilt.B, p, remainFracB);
    state.powder.A += fa.flow * dt * 10;
    state.powder.B += fb.flow * dt * 10;
    state.spill += (fa.spill + fb.spill) * dt * 8;
  }

  // Toppings sim (2-axis -> edge -> world fall)
  if (state.phase === Phases.TOPPINGS) {
    const muMap = state.stage.physics.ingredient.mu;
    const bounce = state.stage.physics.ingredient.bounce;
    updateToppings(
      state.toppings,
      state.boardTilt.roll,
      state.boardTilt.pitch,
      dt,
      cup,
      muMap,
      bounce,
      grams => state.spill += grams,
      { width: canvas.width, height: canvas.height }
    );
  }

  if (state.phase === Phases.POUR && typeof state._updatePour === "function") {
    state._updatePour(dt);
  }

  state.cleanliness = Math.max(0.7, Math.exp(-state.spill / 3.0));
}

function showResult() {
  const stage = state.stage;
  const powderRes = scorePowder(state.powder, stage.target.powder);
  const capped = state.toppings.filter(t => t.captured);
  const topRes = scoreToppings(capped, stage.target, cupGeom());
  const timeRes = scoreTiming(state.openPressedAt, state.lidClosedAt, stage.target.waitSeconds);
  const { total, rank, C } = finalScore(powderRes.score, topRes.score, timeRes.score, state.spill);

  const detailRows = (topRes.details || []).map(d => {
    const sign = d.delta > 0 ? "+" : (d.delta < 0 ? "" : "±");
    const deltaTxt = d.delta === 0 ? "OK" : `${sign}${d.delta}`;
    return `<li>${d.name}：指示${d.need} → 投入${d.got}（${deltaTxt}）</li>`;
  }).join("");

  const msg = [];
  msg.push(`<div class="rank">RANK ${rank}　総合 ${total.toFixed(1)}</div>`);
  msg.push(`<div>粉末比率：${powderRes.score.toFixed(1)}</div>`);
  msg.push(`<div>具材（注文）スコア：${topRes.score.toFixed(1)}</div>`);
  if (detailRows) msg.push(`<ul>${detailRows}</ul>`);
  msg.push(`<div>10秒感覚：${timeRes.score.toFixed(1)}${timeRes.delta!=null?`（誤差 ${timeRes.delta.toFixed(2)}s / 実測 ${timeRes.measured.toFixed(2)}s）`:""}</div>`);
  msg.push(`<div>清潔度係数：×${C.toFixed(2)}（こぼし合計 ≒ ${state.spill.toFixed(1)}g）</div>`);
  document.querySelector("#scoreSummary").innerHTML = msg.join("");
}

function cupGeom() {
  const w = canvas.width, h = canvas.height;
  const boardRect  = { x: w*0.12, y: h*0.56, w: w*0.56, h: h*0.22 };
  return { cx: boardRect.x + boardRect.w/2, cy: boardRect.y + boardRect.h + h*0.10, r: Math.min(w,h)*0.10 };
}

function clampRange(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
