import { canvas, ui, state } from './store.js';
import { insertSegmentToGrid, updateLinesStat, getLocalXY, addInterpolatedSegments } from './utils.js';

export function addSegment(x1, y1, x2, y2) {
  const seg = { x1, y1, x2, y2, alive: true };
  state.segments.push(seg);
  insertSegmentToGrid(state, seg);
  updateLinesStat(ui, state);
}

export function clearAllLines() {
  state.segments.length = 0;
  state.grid.clear();
  updateLinesStat(ui, state);
}

function drawTo(pt) {
  // 2px刻みで補間して線分化（低速デバイスや指の早い移動での途切れ防止）
  addInterpolatedSegments(addSegment, state.lastDrawPt.x, state.lastDrawPt.y, pt.x, pt.y, 2);
  state.lastDrawPt = pt;
}

export function installDrawingInput() {
  canvas.addEventListener('pointerdown', (e) => {
    if (state.drawing) return;
    state.pointerId = e.pointerId;
    state.drawing = true;
    state.lastDrawPt = getLocalXY(canvas, e);
    // 連続追従のためキャプチャ
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!state.drawing || e.pointerId !== state.pointerId) return;

    // ブラウザがまとめてくれる微小移動も全部処理（高精度）
    const events = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : [e];
    for (const ce of events) {
      const pt = getLocalXY(canvas, ce);
      drawTo(pt);
    }
    e.preventDefault();
  }, { passive: false });

  function endDrawing(e) {
    if (!state.drawing || (e && e.pointerId !== state.pointerId)) return;
    state.drawing = false;
    state.lastDrawPt = null;
    if (state.pointerId != null) {
      try { canvas.releasePointerCapture(state.pointerId); } catch {}
    }
    state.pointerId = null;
  }
  canvas.addEventListener('pointerup', endDrawing);
  canvas.addEventListener('pointercancel', endDrawing);
  canvas.addEventListener('pointerleave', endDrawing);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  ui.btnClear.addEventListener('click', clearAllLines);
}
