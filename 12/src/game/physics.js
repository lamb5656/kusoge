// --- Powder (unchanged) ---
export function computePowderFlowDeg(thetaDeg, params, remainingFrac) {
  const { k, n, thetaMinDeg } = params;
  const thetaEff = Math.max(0, thetaDeg - thetaMinDeg);
  if (thetaEff <= 0) return { flow: 0, spill: 0 };
  const sinTerm = Math.sin((thetaEff * Math.PI) / 180);
  const compaction = Math.min(0.25, (1 - remainingFrac) * 0.25);
  const flow = Math.max(0, k * Math.pow(Math.max(0, sinTerm), n) * (1 - compaction));
  const spillRate = thetaDeg > 100 ? (thetaDeg - 100) / 60 : 0;
  const spill = flow * spillRate * 0.5;
  return { flow, spill };
}

// --- Toppings (2-axis board -> world fall) ---
/**
 * @param {Array} toppings  items with {x,y,vx,vy,onBoard,boardRect,kind,...}
 * @param {number} rollDeg  左右回転（+で右へ流れる）
 * @param {number} pitchDeg 奥行き回転（+で手前→下方向に流れる）
 * @param {number} dt       seconds
 * @param {object} cup      {cx,cy,r}
 * @param {object} muMap    摩擦係数テーブル
 * @param {number} bounce   反発（ボード上のみ）
 * @param {function} onSpill grams callback on floor spill
 * @param {object} canvasSize {width,height}
 */
export function updateToppings(
  toppings, rollDeg, pitchDeg, dt, cup, muMap, bounce, onSpill, canvasSize
) {
  const gSlide = 1600;   // 面上の“見た目が気持ち良い”加速
  const gWorld = 2400;   // 自由落下の重力
  const W = canvasSize?.width ?? 960;
  const H = canvasSize?.height ?? 600;

  const axSlide = gSlide * Math.sin((rollDeg * Math.PI) / 180);  // +で右
  const aySlide = gSlide * Math.sin((pitchDeg * Math.PI) / 180); // +で下

  for (const it of toppings) {
    if (it.captured || it.removed) continue;

    const mu = muMap[it.kind] ?? 0.12;
    const R = it.boardRect;

    if (it.onBoard) {
      // 面上の運動（左右=roll, 下=奥行き）
      const fx = -mu * it.vx;
      const fy = -mu * it.vy;
      it.vx += (axSlide + fx) * dt;
      it.vy += (aySlide + fy) * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;

      // 板の端判定：出たらワールドへ
      let left = false, right = false, top = false, bottom = false;
      if (it.x < R.x) { it.x = R.x; it.vx = -it.vx * bounce; left = true; }
      if (it.x > R.x + R.w) { it.x = R.x + R.w; right = true; }
      if (it.y < R.y) { it.y = R.y; top = true; }
      if (it.y > R.y + R.h) { it.y = R.y + R.h; bottom = true; }

      // “落ちる”条件：流れが外向き or 明確に端越え
      const leaving =
        right && axSlide > 20 ||
        left && axSlide < -20 ||
        bottom && aySlide > 20 ||
        top && aySlide < -20 ||
        it.x <= R.x - 0.1 || it.x >= R.x + R.w + 0.1 ||
        it.y <= R.y - 0.1 || it.y >= R.y + R.h + 0.1;

      if (leaving) {
        it.onBoard = false;
        // ワールドへ移るとき、水平速度は維持（少しだけ減衰）
        it.vx *= 0.95;
        // 縦速度は下向き最小値を与えて“落ちる”感
        it.vy = Math.max(it.vy, 60);
      }
    } else {
      // 自由落下（縦=重力、横=慣性のみ）
      it.vy += gWorld * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;

      // カップ捕捉
      const dx = it.x - cup.cx;
      const dy = it.y - cup.cy;
      if (dx * dx + dy * dy <= cup.r * cup.r) {
        it.captured = true;
        it.landX = it.x;
        it.landY = it.y;
        continue;
      }

      // 画面外→床こぼし
      if (it.y > H + 40 || it.x < -40 || it.x > W + 40) {
        it.removed = true;
        onSpill && onSpill(0.5); // 具材1個≈0.5gとして清潔度ペナルティ
      }
    }
  }
}
