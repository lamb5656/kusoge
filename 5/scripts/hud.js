// scripts/hud.js
// その場でDOMを取りにいき、無ければ何もしない安全版

function el(id){ return document.getElementById(id); }

export function updateHud(state){
  const g = el("gold"), l = el("lives"), w = el("wave"), e = el("enemies");
  if (!g || !l || !w || !e) return; // DOM未準備やID不一致時は黙ってスキップ
  g.textContent = `ゴールド: ${state.gold}`;
  l.textContent = `ライフ: ${state.lives}`;
  w.textContent = `ウェーブ: ${state.wave}`;
  e.textContent = `敵: ${state.enemiesAlive}`;
}

export function updateFps(fps){
  const f = el("fps");
  if (f) f.textContent = `FPS: ${fps}`;
}
