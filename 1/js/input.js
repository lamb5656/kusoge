// Pointer + keyboard input (press-and-hold to fire)
import { WORLD, state } from "./state.js";
import { clamp } from "./math.js";

export function attachInput(canvas) {
  canvas.addEventListener("pointerdown", (e) => {
    state.controls.dragging = true;
    state.controls.hold = true;       // start hold (but first shot will be delayed)
    state.fireHoldTimer = 0;          // reset hold timer
    canvas.setPointerCapture(e.pointerId);
    state.player.targetX = pickX(e, canvas);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!state.controls.dragging) return;
    state.player.targetX = pickX(e, canvas);
  });
  const stop = () => { state.controls.dragging = false; state.controls.hold = false; state.fireHoldTimer = 0; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("pointerleave", stop);

  // Keyboard: arrows/A-D to move, Space to hold fire
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") state.controls.keys.add("left");
    if (e.key === "ArrowRight" || e.key === "d") state.controls.keys.add("right");
    if (e.key === " " || e.code === "Space") {
      if (!state.controls.hold) state.fireHoldTimer = 0; // new hold -> reset timer
      state.controls.hold = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") state.controls.keys.delete("left");
    if (e.key === "ArrowRight" || e.key === "d") state.controls.keys.delete("right");
    if (e.key === " " || e.code === "Space") { state.controls.hold = false; state.fireHoldTimer = 0; }
  });
}

function pickX(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  let x = ((clientX - rect.left) / rect.width) * WORLD.w;
  return clamp(x, 20, WORLD.w - 20);
}
