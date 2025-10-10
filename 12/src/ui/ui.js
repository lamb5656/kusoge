export function qs(id) { return document.querySelector(id); }
export function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

export function initSidebar(stageList, onStageChange) {
  const sel = qs("#stageSelect");
  sel.innerHTML = "";
  stageList.forEach((stg, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${i+1}. ${stg.name}`;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => onStageChange(Number(sel.value)));
}

export function updateRecipeUI(stage) {
  qs("#targetA").textContent = Math.round(stage.target.powder.A * 100) + "%";
  qs("#targetB").textContent = Math.round(stage.target.powder.B * 100) + "%";
  qs("#waitSec").textContent = stage.target.waitSeconds;
  if (stage.target.orders) {
    qs("#toppingList").textContent = stage.target.orders.map(o => `${o.name}×${o.need}`).join(" / ");
  } else {
    qs("#toppingList").textContent = "-";
  }
}

export function showPhasePanel(phase) {
  qsa(".phase-panel").forEach(p => p.classList.add("hidden"));
  const panel = qs(`[data-phase="${phase}"]`);
  if (panel) panel.classList.remove("hidden");
}

/** return { powderZone, boardRect, cup } */
export function drawScene(ctx, state, stage) {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#10131c"; ctx.fillRect(0, 0, W, H);

  // Layout zones
  const powderZone = { x: W*0.08, y: H*0.06, w: W*0.84, h: H*0.36 };   // 上段
  const boardRect  = { x: W*0.12, y: H*0.56, w: W*0.56, h: H*0.22 };   // 下段の板
  const cup = { cx: boardRect.x + boardRect.w/2, cy: boardRect.y + boardRect.h + H*0.10, r: Math.min(W,H)*0.10 };

  // --- Powder zone (visual only, no numbers) ---
  ctx.save();
  ctx.strokeStyle = "#2a2f42"; ctx.lineWidth = 2;
  ctx.strokeRect(powderZone.x, powderZone.y, powderZone.w, powderZone.h);

  // Sachets
  drawSachet(ctx, powderZone.x + powderZone.w*0.25, powderZone.y + powderZone.h*0.6, "A", state.tilt.A);
  drawSachet(ctx, powderZone.x + powderZone.w*0.55, powderZone.y + powderZone.h*0.6, "B", state.tilt.B);
  ctx.restore();

  // --- Board (flat rect; 傾きは矢印ベクトルで示す) ---
  ctx.save();
  ctx.fillStyle = "#2a2f42";
  roundedRect(ctx, boardRect.x, boardRect.y, boardRect.w, boardRect.h, 14); ctx.fill();

  // Slope indicator (矢印)
  const cx = boardRect.x + boardRect.w/2, cy = boardRect.y + boardRect.h/2;
  const vx = Math.sin((state.boardTilt.roll * Math.PI)/180);
  const vy = Math.sin((state.boardTilt.pitch * Math.PI)/180);
  const L  = 60;
  ctx.strokeStyle = "#23b5e5"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + vx*L, cy + vy*L); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + vx*L, cy + vy*L, 4, 0, Math.PI*2); ctx.fillStyle="#23b5e5"; ctx.fill();
  ctx.restore();

  // Ingredients on board
  for (const it of state.toppings) {
    if (it.removed || it.captured) continue;
    if (!it.onBoard) continue;
    ctx.fillStyle = ingredientColor(it.kind);
    circle(ctx, it.x, it.y, it.r); ctx.fill();
  }

  // Cup
  ctx.strokeStyle = "#e0e3ee"; ctx.lineWidth = 3;
  circle(ctx, cup.cx, cup.cy, cup.r); ctx.stroke();

  // Water (pour phase)
  ctx.save();
  ctx.beginPath(); circle(ctx, cup.cx, cup.cy, cup.r); ctx.clip();
  ctx.fillStyle = "rgba(60,160,255,0.35)";
  const fillH = state.waterFill;
  const fillY = cup.cy + cup.r - fillH * (cup.r * 2);
  ctx.fillRect(cup.cx - cup.r, fillY, cup.r*2, cup.r*2);
  ctx.restore();

  // Flying + landed ingredients
  for (const it of state.toppings) {
    if (it.removed || it.captured || it.onBoard) continue;
    ctx.fillStyle = ingredientColor(it.kind);
    circle(ctx, it.x, it.y, it.r); ctx.fill();
  }
  for (const it of state.toppings) {
    if (!it.captured) continue;
    ctx.fillStyle = ingredientColor(it.kind);
    circle(ctx, it.landX, it.landY, it.r); ctx.fill();
  }

  // Sidebar labels (not numbers for powder)
  document.querySelector("#cleanliness").textContent = Math.round(100 * state.cleanliness) + "%";

  return { powderZone, boardRect, cup };
}

function ingredientColor(kind) {
  switch (kind) {
    case "corn": return "#ffd85e";
    case "negi": return "#81e67a";
    case "menma": return "#caa37a";
    case "chashu": return "#d88686";
    default: return "#cccccc";
  }
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.closePath(); }
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function drawSachet(ctx, x, y, label, tiltDeg) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((tiltDeg * Math.PI) / 180);
  ctx.fillStyle = label === "A" ? "#a5e887" : "#ffd170";
  roundedRect(ctx, -30, -50, 60, 100, 10); ctx.fill();
  ctx.fillStyle = "#1a1d27"; ctx.font = "bold 18px ui-sans-serif"; ctx.textAlign = "center";
  ctx.fillText(label, 0, 6); ctx.restore();
}
