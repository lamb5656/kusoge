export function setupInput(state, sendInput, sendDash) {
  const padL = document.getElementById("padL");
  const stickBase = document.getElementById("stickBase");
  const dashBtn = document.getElementById("dashBtn");

  padL.style.touchAction = "none";
  dashBtn.style.touchAction = "none";

  const DEAD = 10, R = 60; // CSS px
  const joy = { active:false, id:null, ax:0, ay:0, base:{x:0,y:0} };

  function baseCenter() {
    const rc = stickBase.getBoundingClientRect();
    return { x: rc.left + rc.width/2, y: rc.top + rc.height/2 };
  }
  function placeStick(dx, dy) {
    stickBase.style.setProperty("--dx", `${dx}px`);
    stickBase.style.setProperty("--dy", `${dy}px`);
  }
  placeStick(0,0);
  addEventListener("resize", ()=> placeStick(0,0));

  padL.addEventListener("pointerdown", (e)=>{
    if (joy.active) return;
    padL.setPointerCapture(e.pointerId);
    joy.active = true; joy.id = e.pointerId;
    joy.base = baseCenter();
    move(e);
  });
  padL.addEventListener("pointermove", move);
  function move(e){
    if (!joy.active || joy.id !== e.pointerId) return;
    const dx = e.clientX - joy.base.x;
    const dy = e.clientY - joy.base.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(R, dist);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const mag = clamped < DEAD ? 0 : (clamped - DEAD) / (R - DEAD);
    joy.ax = nx * mag; joy.ay = ny * mag;
    placeStick(nx*clamped, ny*clamped);
  }
  padL.addEventListener("pointerup", end);
  padL.addEventListener("pointercancel", end);
  function end(e){
    if (!joy.active || (e && joy.id !== e.pointerId)) return;
    joy.active = false; joy.id = null; joy.ax = 0; joy.ay = 0;
    placeStick(0,0);
  }

  dashBtn.addEventListener("pointerdown", ()=> sendDash());

  return function tick(){
    state.seq++;
    sendInput({ seq: state.seq, ax: joy.ax, ay: joy.ay });
  };
}
