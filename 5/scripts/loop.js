import { updateFps } from "./hud.js";


export function startLoop(update, draw, shouldStop){
let last = performance.now(); let fpsS = 0, fpsC = 0;
function frame(now){
const dt = Math.min(0.033, (now - last)/1000); last = now;
fpsS += dt; fpsC++; if (fpsS >= 0.5){ updateFps(Math.round(fpsC / fpsS)); fpsS = 0; fpsC = 0; }
update(dt); draw(); if (!shouldStop()){ requestAnimationFrame(frame); }
}
requestAnimationFrame(frame);
}