// Rendering with clearer wall types and depth (perspective) feel
import { WORLD, state } from "./state.js";

export function draw(ctx, canvas, accTime) {
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = rect.height;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Perspective road (vanishing lines) to enhance depth
  drawPerspective(ctx, W, H, accTime);

  // Walls with perspective scaling
  for (const w of state.walls) {
    const yPx = mapY(w.y, H);
    const { x, width, h, depthA } = wallRectWithDepth(W, H, yPx, w.side);

    ctx.save();
    ctx.globalAlpha = (w.broken ? 0.45 : 0.95) * depthA;

    // Base fill by type
    const color = colorForType(w.type);
    ctx.fillStyle = color.fill;
    roundRect(ctx, x, yPx - h / 2, width, h, 10, true, false);

    // Type-specific pattern overlay (subtle but readable)
    ctx.globalAlpha = 0.18 * depthA;
    drawTypePattern(ctx, x, yPx, width, h, w.type);

    // HP bar
    const pct = Math.max(0, w.hp) / w.max;
    ctx.globalAlpha = 0.9 * depthA;
    ctx.fillStyle = "#0b0f14";
    roundRect(ctx, x + 6, yPx - 5, width - 12, 10, 5, true, false);
    ctx.fillStyle = "#64ffda";
    roundRect(ctx, x + 6, yPx - 5, (width - 12) * pct, 10, 5, true, false);

    // Big center glyph (very obvious)
    ctx.globalAlpha = 1 * depthA;
    ctx.font = `${Math.floor(18 + 16 * depthScale(yPx, H))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // outline for readability
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(10,14,20,0.9)";
    ctx.fillStyle = color.glyph;
    const glyph = glyphForType(w);
    ctx.strokeText(glyph, x + width / 2, yPx + 2);
    ctx.fillText(glyph, x + width / 2, yPx + 2);

    // Small badge with amount (e.g., +3 / -2 / R+1)
    ctx.globalAlpha = 0.95 * depthA;
    const badge = badgeText(w);
    if (badge) {
      const padX = 8, padY = 6;
      ctx.font = `${Math.floor(12 + 6 * depthScale(yPx, H))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      const tw = ctx.measureText(badge).width;
      const bw = tw + padX * 2;
      const bh = Math.floor(18 + 6 * depthScale(yPx, H));
      const bx = x + width - bw - 6;
      const by = yPx - h / 2 + 6;
      ctx.fillStyle = color.badge;
      roundRect(ctx, bx, by, bw, bh, 8, true, false);
      ctx.fillStyle = "#0b0f14";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badge, bx + bw / 2, by + bh / 2 + 1);
    }

    ctx.restore();
  }

  // Bullets
  ctx.save();
  ctx.fillStyle = "#a0c4ff";
  for (const b of state.bullets) {
    const x = mapX(b.x, W), y = mapY(b.y, H);
    const s = 1 + 0.25 * depthScale(y, H); // slight scale by depth
    ctx.fillRect(x - 2 * s, y - 6 * s, 4 * s, 12 * s);
  }
  ctx.restore();

  // Player
  const px = mapX(state.player.x, W);
  const py = mapY(state.player.y, H);
  ctx.save();
  ctx.shadowColor = "#64ffda";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#64ffda";
  ctx.beginPath();
  ctx.arc(px, py, state.player.r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- helpers ---------- */

function drawPerspective(ctx, W, H, t) {
  // Dark base
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0f1520");
  grad.addColorStop(1, "#090d13");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Converging lines to a vanishing point
  const vpX = W * 0.5;
  const vpY = H * 0.12;
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = "#7aa2d6";
  for (let i = 0; i <= 6; i++) {
    const bx = (W / 6) * i;
    ctx.beginPath();
    ctx.moveTo(bx, H);
    ctx.lineTo(vpX, vpY);
    ctx.stroke();
  }
  // Horizontal bands moving slowly (parallax)
  const spacing = 60;
  const offset = (t * (state.speed * 0.08)) % spacing;
  for (let y = -spacing; y < H + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y + offset);
    ctx.lineTo(W, y + offset);
    ctx.stroke();
  }
  ctx.restore();

  // Mid divider (subtle)
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#9cc7ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W * 0.5, 0);
  ctx.lineTo(W * 0.5, H);
  ctx.stroke();
  ctx.restore();
}

function wallRectWithDepth(W, H, yPx, side) {
  // Base lane rect
  const margin = 18;
  const gap = 14;
  const baseWidth = (W - margin * 2 - gap) / 2;
  const xBase = side === "L" ? margin : margin + baseWidth + gap;

  // Depth scale: near top smaller, near bottom larger
  const scale = depthScale(yPx, H); // ~0.75 .. 1.15
  const width = baseWidth * scale;
  const h = 28 * scale;

  // re-center within lane to keep margin equal
  const center = xBase + baseWidth / 2;
  const x = center - width / 2;

  // Depth alpha: far = lighter
  const depthA = 0.6 + 0.4 * ((yPx / H) ** 0.9);
  return { x, width, h, depthA };
}

function depthScale(yPx, H) {
  const n = Math.max(0, Math.min(1, yPx / H));
  // curve: smaller at top (~0.75), grow to ~1.15
  return 0.75 + 0.40 * (n ** 0.9);
}

function glyphForType(w) {
  if (w.type === "plus") return `+${w.amount ?? ""}`;
  if (w.type === "minus") return `-${w.amount ?? ""}`;
  if (w.type === "rapidPlus") return `R+`;
  if (w.type === "rapidMinus") return `R-`;
  return `WALL`;
}

function badgeText(w) {
  if (w.type === "plus") return `+${w.amount}`;
  if (w.type === "minus") return `-${w.amount}`;
  if (w.type === "rapidPlus") return `R+${w.amount || 1}`;
  if (w.type === "rapidMinus") return `R-${w.amount || 1}`;
  return ``;
}

function colorForType(type) {
  switch (type) {
    case "plus":       return { fill: "#1f9d78", glyph: "#ffffff", badge: "#b7f7e6" };
    case "minus":      return { fill: "#cf2e3d", glyph: "#ffffff", badge: "#ffd1d6" };
    case "rapidPlus":  return { fill: "#4b63e6", glyph: "#ffffff", badge: "#cdd3ff" };
    case "rapidMinus": return { fill: "#7c3aed", glyph: "#ffffff", badge: "#e2c8ff" };
    default:           return { fill: "#e76f51", glyph: "#0b0f14", badge: "#ffe1cc" };
  }
}

function drawTypePattern(ctx, x, y, w, h, type) {
  ctx.save();
  ctx.beginPath();
  roundPath(ctx, x, y - h / 2, w, h, 10);
  ctx.clip();

  if (type === "plus") {
    // diagonal stripes
    const step = 10;
    for (let i = -w; i < w * 2; i += step) {
      ctx.beginPath();
      ctx.moveTo(x + i, y - h);
      ctx.lineTo(x + i + h, y + h);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  } else if (type === "minus") {
    // horizontal stripes
    const step = 8;
    for (let yy = y - h / 2 + 4; yy < y + h / 2; yy += step) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 2, yy, w - 4, 3);
    }
  } else if (type === "rapidPlus" || type === "rapidMinus") {
    // speed ticks
    const step = 12;
    for (let i = 6; i < w - 6; i += step) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + i, y - 2, 6, 4);
    }
  }
  ctx.restore();
}

function mapX(x, W) { return (x / WORLD.w) * W; }
function mapY(y, H) { return (y / WORLD.h) * H; }

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  roundPath(ctx, x, y, w, h, r);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
function roundPath(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}
