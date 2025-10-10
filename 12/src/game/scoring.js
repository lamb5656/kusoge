export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function scorePowder(powder, target) {
  const total = powder.A + powder.B;
  if (total <= 0) return { pA: 0, score: 0 };
  const pA = powder.A / total;
  const e = Math.abs(pA - target.A) / (target.tolerance ?? 0.10);
  const score = clamp(100 * (1 - e), 0, 100);
  return { pA, score };
}

// NEW: Orderモード（◯個入れろ）の採点
function scoreToppingsOrder(captured, orders) {
  const got = new Map();
  for (const c of captured) {
    got.set(c.kind, (got.get(c.kind) ?? 0) + 1);
  }
  const need = new Map();
  for (const o of orders) need.set(o.name, (need.get(o.name) ?? 0) + o.need);

  // 不足/過剰カウント
  let missing = 0, extra = 0;
  const details = [];
  // 指示にある種類
  for (const [name, nNeed] of need.entries()) {
    const nGot = got.get(name) ?? 0;
    if (nGot < nNeed) missing += (nNeed - nGot);
    if (nGot > nNeed) extra += (nGot - nNeed);
    details.push({ name, need: nNeed, got: nGot, delta: nGot - nNeed });
    got.delete(name);
  }
  // 指示外の種類は全部“入れ過ぎ”
  for (const [name, nGot] of got.entries()) {
    extra += nGot;
    details.push({ name, need: 0, got: nGot, delta: nGot });
  }

  // 減点ルール：不足は厳しめ、過剰はやや軽め
  const penaltyMissing = 12;
  const penaltyExtra = 8;
  let score = Math.max(0, 100 - penaltyMissing * missing - penaltyExtra * extra);

  return { score, missing, extra, details };
}

// 既存のレイアウト一致モード（互換用）
function scoreToppingsLayout(captured, target, cup) {
  // (前実装のまま)…省略せず残しておくと互換性が高い
  // Build target points
  const targets = [];
  for (const t of (target.toppings || [])) {
    const count = t.count;
    if (t.pattern === "center") {
      for (let i = 0; i < count; i++) targets.push({ kind: t.name, x: cup.cx, y: cup.cy });
    } else if (t.pattern === "ring") {
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        targets.push({
          kind: t.name,
          x: cup.cx + Math.cos(ang) * (cup.r * 0.5),
          y: cup.cy + Math.sin(ang) * (cup.r * 0.5),
        });
      }
    } else {
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        targets.push({
          kind: t.name,
          x: cup.cx + Math.cos(ang) * (cup.r * 0.3),
          y: cup.cy + Math.sin(ang) * (cup.r * 0.3),
        });
      }
    }
  }
  const remainTargets = targets.map(t => ({ ...t, used: false }));
  let scoreAccum = 0;
  let matched = 0;
  const R = cup.r, R_tol = 0.35;

  for (const c of captured) {
    let bestIdx = -1, bestD2 = Infinity;
    for (let i = 0; i < remainTargets.length; i++) {
      const t = remainTargets[i];
      if (t.used || t.kind !== c.kind) continue;
      const dx = c.landX - t.x, dy = c.landY - t.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      const t = remainTargets[bestIdx]; t.used = true; matched++;
      const d = Math.sqrt(bestD2);
      const m = Math.max(0, 1 - (d / R) / R_tol);
      scoreAccum += m;
    }
  }
  const N = targets.length || 1;
  let score = 100 * (scoreAccum / N);
  const missing = Math.max(0, N - matched);
  const extra = Math.max(0, captured.length - matched);
  score = Math.max(0, score - 10 * (missing + extra));
  return { score, missing, extra, details: [] };
}

export function scoreToppings(captured, target, cup) {
  if (target.toppingMode === "order" && target.orders) {
    return scoreToppingsOrder(captured, target.orders);
  }
  return scoreToppingsLayout(captured, target, cup);
}

export function scoreTiming(openPressedAt, lidClosedAt, waitSeconds = 10) {
  if (!openPressedAt || !lidClosedAt) return { score: 0, delta: null };
  const dt = (openPressedAt - lidClosedAt) / 1000;
  const delta = Math.abs(dt - waitSeconds);
  const sigma = 2.0;
  const s = 100 * Math.exp(-(delta * delta) / (2 * sigma * sigma));
  return { score: s, delta, measured: dt };
}

export function cleanlinessFactor(spillTotal) {
  const s0 = 3.0;
  const C = Math.exp(-spillTotal / s0);
  return clamp(C, 0.7, 1.0);
}

export function finalScore(pow, top, time, spill) {
  const C = cleanlinessFactor(spill);
  const total = (0.5 * pow + 0.3 * top + 0.2 * time) * C;
  let rank = "D";
  if (total >= 90) rank = "S";
  else if (total >= 80) rank = "A";
  else if (total >= 70) rank = "B";
  else if (total >= 55) rank = "C";
  return { total, rank, C };
}
