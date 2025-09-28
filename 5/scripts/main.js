import { state } from "./state.js";
import { updateHud } from "./hud.js";
import { draw } from "./render.js";
import { updateEnemies } from "./enemies.js";
import { updateBullets } from "./bullets.js";
import { updateTowers } from "./towers.js";
import { startLoop } from "./loop.js";
import { createSpawner } from "./spawner.js";
import { waveConfig } from "./waves.js";
import { setupInput } from "./input.js";
import { showToast } from "./dom.js";
import { DEFAULT_GOLD, DEFAULT_LIVES } from "./consts.js";
import { saveGame, loadGame } from "./save.js";


const spawner = createSpawner(waveConfig, state);


function update(dt){
if (state.isPaused) return; // 停止
spawner.update(dt);
updateEnemies(dt, state);
updateTowers(dt, state);
updateBullets(dt, state);
updateHud(state); // 毎フレーム反映
if (state.isGameOver){ showToast("ゲームオーバー"); }
}
function shouldStop(){ return state.isGameOver; }

function init(){
  // セーブ読み込み or デフォルト
  if (!loadGame(state)) {
    state.gold = DEFAULT_GOLD;
    state.lives = DEFAULT_LIVES;
    state.wave = 0;
  }
  updateHud(state);
  showToast("準備OK");

  setupInput(state, { spawner, onWaveBegin(){ /* 必要なら */ } });

  // ★ ここを修正：MutationObserver行は削除し、オートセーブだけ残す
  // （以前の）
  // const obs = new MutationObserver(()=>{ /* HUD更新のタイミングで代替 */ });
  // obs.observe(document.body, { attributes:false, childList:false, subtree:false });

  // オートセーブ：ウェーブ停止中に保存
  setInterval(()=>{
    if (!spawner.running && !state.isPaused) saveGame(state);
  }, 1500);

  startLoop(update, draw, shouldStop);
}

// DOM 準備後に起動（安全）
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
