import { CONFIG } from './config.js';

export function getLocalXY(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
}
export function randBetween(a, b) { return a + Math.random() * (b - a); }

export function pointSegmentDistanceSq(px, py, x1, y1, x2, y2) {
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

export function gridKey(gx, gy) { return `${gx}|${gy}`; }

export function insertSegmentToGrid(state, seg) {
  const GS = CONFIG.gridSize;
  const xMin = Math.min(seg.x1, seg.x2), xMax = Math.max(seg.x1, seg.x2);
  const yMin = Math.min(seg.y1, seg.y2), yMax = Math.max(seg.y1, seg.y2);
  const gx0 = Math.floor(xMin / GS), gx1 = Math.floor(xMax / GS);
  const gy0 = Math.floor(yMin / GS), gy1 = Math.floor(yMax / GS);
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gy = gy0; gy <= gy1; gy++) {
      const key = gridKey(gx, gy);
      if (!state.grid.has(key)) state.grid.set(key, []);
      state.grid.get(key).push(seg);
    }
  }
}

export function gatherSegmentsNear(state, x, y, radius = 20) {
  const GS = CONFIG.gridSize;
  const gx = Math.floor(x / GS);
  const gy = Math.floor(y / GS);
  const reach = Math.ceil(radius / GS) + 1;
  const out = [];
  for (let ix = -reach; ix <= reach; ix++) {
    for (let iy = -reach; iy <= reach; iy++) {
      const key = gridKey(gx + ix, gy + iy);
      const arr = state.grid.get(key);
      if (!arr) continue;
      for (const s of arr) if (s.alive) out.push(s);
    }
  }
  return out;
}

export function updateLinesStat(ui, state) {
  let count = 0;
  for (const s of state.segments) if (s.alive) count++;
  ui.lines.textContent = count.toString();
}

export function addInterpolatedSegments(addSegment, x1, y1, x2, y2, step = 2) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist <= step) { addSegment(x1, y1, x2, y2); return; }
  const n = Math.ceil(dist / step);
  let px = x1, py = y1;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const nx = x1 + dx * t;
    const ny = y1 + dy * t;
    addSegment(px, py, nx, ny);
    px = nx; py = ny;
  }
}

export function normAngle(a) {
  const tau = Math.PI * 2;
  a %= tau; if (a < 0) a += tau;
  return a;
}

// ---------------- CCD: Ray vs Capsule ----------------
// レイ P(t) = p + d * t （t∈[0,1]でサブステップ内の移動）
// カプセル = 線分ABを半径rで太らせた形
// 返値: { hit: true/false, t: 0..1, nx, ny }  ※nx,ny は衝突面法線（外向き）
export function rayCapsuleIntersect(p, d, a, b, r, tMax = 1.0) {
  const ax = a.x, ay = a.y, bx = b.x, by = b.y;
  const px = p.x, py = p.y, dx = d.x, dy = d.y;

  const ex = bx - ax, ey = by - ay;            // e = b - a
  const mx = px - ax, my = py - ay;            // m = p - a
  const ee = ex * ex + ey * ey;
  const EPS = 1e-8;

  let bestT = Infinity;
  let hit = false;
  let nX = 0, nY = 0;

  if (ee > EPS) {
    // 無限直線方向への射影を除いた直交成分で二次方程式を作る
    const oDotE = dx * ex + dy * ey;
    const mDotE = mx * ex + my * ey;

    const kx = dx - ex * (oDotE / ee);
    const ky = dy - ey * (oDotE / ee);
    const jx = mx - ex * (mDotE / ee);
    const jy = my - ey * (mDotE / ee);

    const A = kx * kx + ky * ky;
    const B = 2 * (kx * jx + ky * jy);
    const C = (jx * jx + jy * jy) - r * r;

    if (A > EPS) {
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const sdisc = Math.sqrt(disc);
        const invA2 = 1 / (2 * A);
        const t1 = (-B - sdisc) * invA2;
        const t2 = (-B + sdisc) * invA2;

        // 早い方からチェック
        const tryT = (t) => {
          if (t < -EPS || t > tMax + EPS) return;
          // 線分の内側に当たっているか（s∈(0,1)）
          const s = (mDotE + oDotE * t) / ee;
          if (s > 0 && s < 1) {
            const cx = ax + ex * s;
            const cy = ay + ey * s;
            const hx = (px + dx * t) - cx;
            const hy = (py + dy * t) - cy;
            const len = Math.hypot(hx, hy) || 1;
            if (len > 0) {
              if (t < bestT) {
                bestT = t; hit = true; nX = hx / len; nY = hy / len;
              }
            }
          }
        };
        tryT(t1); tryT(t2);
      }
    }
  }

  // 円キャップ（A端／B端）との交差
  const testCircle = (cx, cy) => {
    const ox = px - cx, oy = py - cy;
    const A = dx * dx + dy * dy;
    const B = 2 * (ox * dx + oy * dy);
    const C = ox * ox + oy * oy - r * r;
    if (A <= EPS) return;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return;
    const sdisc = Math.sqrt(disc);
    const invA2 = 1 / (2 * A);
    const t1 = (-B - sdisc) * invA2;
    const t2 = (-B + sdisc) * invA2;

    const tryT = (t) => {
      if (t < -EPS || t > tMax + EPS) return;
      const hx = (px + dx * t) - cx;
      const hy = (py + dy * t) - cy;
      const len = Math.hypot(hx, hy) || 1;
      if (t < bestT) {
        bestT = t; hit = true; nX = hx / len; nY = hy / len;
      }
    };
    tryT(t1); tryT(t2);
  };
  testCircle(ax, ay);
  testCircle(bx, by);

  if (!hit || bestT < -EPS || bestT > tMax + EPS) return { hit: false };
  // クランプ
  const t = Math.max(0, Math.min(bestT, tMax));
  return { hit: true, t, nx: nX, ny: nY };
}
