// js/pile.js
import { CONFIG } from './config.js';

// 1D ハイトマップ
let cellSize = CONFIG.pileCellSize;
let cols = 0;
let w = 0;
let groundY = 0;
let h = new Float32Array(0);

// 初期化／リサイズ
export function initPile(widthPx, groundYPx) {
  cellSize = CONFIG.pileCellSize;
  w = Math.max(1, Math.floor(widthPx));
  groundY = groundYPx;
  cols = Math.max(2, Math.ceil(w / cellSize) + 1);
  h = new Float32Array(cols);
}
export function resizePile(widthPx, groundYPx) {
  // 旧データを保持してから再初期化
  const oldH = h;
  const oldCols = cols;
  const oldCell = cellSize;
  initPile(widthPx, groundYPx);
  // 旧→新へ線形補間でコピー（質量を維持）
  if (oldH && oldH.length > 1) {
    for (let i = 0; i < cols; i++) {
      const x = i * cellSize;
      const xi = x / oldCell;
      const j = Math.max(0, Math.min(oldCols - 2, Math.floor(xi)));
      const t = xi - j;
      h[i] = oldH[j] * (1 - t) + oldH[j + 1] * t;
    }
  }
}
export function resetPile() { if (h.length) h.fill(0); }

// クエリ
export function heightAtX(x) {
  const i = Math.max(0, Math.min(cols - 2, Math.floor(x / cellSize)));
  const t = Math.max(0, Math.min(1, (x - i * cellSize) / cellSize));
  return h[i] * (1 - t) + h[i + 1] * t;
}
export function surfaceYAtX(x) { return groundY - heightAtX(x); }

// 堆積：三角カーネルで左右に配る（横に広げる）
export function depositAtX(x, addPx) {
  if (addPx <= 0) return;
  const radCells = Math.max(1, Math.round(CONFIG.depositKernelRadiusPx / cellSize));
  const center = Math.round(x / cellSize);

  let sumW = 0;
  const W = new Array(radCells * 2 + 1);
  for (let k = -radCells; k <= radCells; k++) {
    const w = (radCells + 1 - Math.abs(k));
    W[k + radCells] = w; sumW += w;
  }
  for (let k = -radCells; k <= radCells; k++) {
    const j = center + k;
    if (j < 0 || j >= cols) continue;
    h[j] += addPx * (W[k + radCells] / sumW);
  }
}

// 雪崩（アバランシェ）安定化：許容勾配を満たすまで左右へ流す
export function relax(/*passesIgnored*/) {
  const maxDiff = CONFIG.pileMaxSlopePx;
  const rate = CONFIG.pileRelaxRate;
  const budget = CONFIG.pileRelaxBudget > 0 ? CONFIG.pileRelaxBudget : cols * 8;

  let moves = 0;
  let changed = true;
  while (changed && moves < budget) {
    changed = false;

    // 左→右
    for (let i = 0; i < cols - 1 && moves < budget; i++) {
      const d = h[i] - h[i + 1];
      if (d > maxDiff) {
        const move = Math.min((d - maxDiff) * rate, h[i]);
        if (move > 0) { h[i] -= move; h[i + 1] += move; changed = true; moves++; }
      } else if (-d > maxDiff) {
        const move = Math.min((-d - maxDiff) * rate, h[i + 1]);
        if (move > 0) { h[i] += move; h[i + 1] -= move; changed = true; moves++; }
      }
    }
    // 右→左
    for (let i = cols - 1; i > 0 && moves < budget; i--) {
      const d = h[i] - h[i - 1];
      if (d > maxDiff) {
        const move = Math.min((d - maxDiff) * rate, h[i]);
        if (move > 0) { h[i] -= move; h[i - 1] += move; changed = true; moves++; }
      } else if (-d > maxDiff) {
        const move = Math.min((-d - maxDiff) * rate, h[i - 1]);
        if (move > 0) { h[i] += move; h[i - 1] -= move; changed = true; moves++; }
      }
    }
  }
}

// 近傍の地形をセグメント化（CCD 用）
export function getSegmentsNear(x, radius) {
  const i0 = Math.max(0, Math.floor((x - radius) / cellSize));
  const i1 = Math.min(cols - 1, Math.ceil((x + radius) / cellSize));
  const segs = [];
  for (let i = i0; i < i1; i++) {
    const x1 = i * cellSize;
    const x2 = (i + 1) * cellSize;
    const y1 = groundY - h[i];
    const y2 = groundY - h[i + 1];
    segs.push({ x1, y1, x2, y2, alive: true, isPile: true });
  }
  return segs;
}

// 描画
export function drawPile(ctx) {
  ctx.fillStyle = '#f8f8ff';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let i = 0; i < cols; i++) {
    const x = i * cellSize;
    const y = groundY - h[i];
    ctx.lineTo(x, y);
  }
  ctx.lineTo((cols - 1) * cellSize, groundY);
  ctx.closePath();
  ctx.fill();
}

// 玉の下面で地形を軽くクリップ（せり上げ防止）
// 戻り値：このフレームで削った“高さ(px)”の合計
export function clipUnderSphere(cx, cy, radius, gapPx = 1.5) {
  const r = Math.max(1, radius);
  const i0 = Math.max(0, Math.floor((cx - r) / cellSize));
  const i1 = Math.min(cols - 1, Math.ceil((cx + r) / cellSize));

  let removedSum = 0;

  for (let i = i0; i <= i1; i++) {
    const x = i * cellSize;
    const dx = Math.abs(x - cx);
    if (dx > r) continue;

    // このxでの“玉が許容する表面の最大高さ”
    const yAllowed = cy + Math.sqrt(r * r - dx * dx) - gapPx; // これより上は玉に食い込む
    const ySurface = groundY - h[i];

    if (ySurface < yAllowed) {
      const newH = Math.max(0, groundY - yAllowed);
      removedSum += (h[i] - newH); // 削った量（px）
      h[i] = newH;
    }
  }
  return removedSum;
}

// 破片などで床（ハイトマップ）を円形に“えぐる”
// 戻り値: 削った高さ(px)の合計（任意で使える）
export function blastErodeCircle(cx, cy, radiusPx, marginPx = 0.5) {
  if (radiusPx <= 0) return 0;
  const r = radiusPx;
  const i0 = Math.max(0, Math.floor((cx - r) / cellSize));
  const i1 = Math.min(cols - 1, Math.ceil((cx + r) / cellSize));

  let removedSum = 0;

  for (let i = i0; i <= i1; i++) {
    const x = i * cellSize;
    const dx = Math.abs(x - cx);
    if (dx > r) continue;

    // 円の“下面”プロファイル（Canvas座標系は+Yが下）
    const yAllowed = cy + Math.sqrt(r * r - dx * dx) + marginPx;

    // 現在の地表
    const ySurface = groundY - h[i];

    // 円の下面より“上”（=玉/破片へ食い込む分）は削り落とす
    if (ySurface < yAllowed) {
      const newH = Math.max(0, groundY - yAllowed);
      removedSum += (h[i] - newH);
      h[i] = newH;
    }
  }
  return removedSum;
}
