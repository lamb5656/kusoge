// scripts/render.js
import { ctx } from "./dom.js";
import { W, H, TILE, PATH_Y_TOP, PATH_Y_BOTTOM } from "./consts.js";
import { clamp } from "./utils.js";
import { towers, enemies, bullets, state } from "./state.js";
import { getTowerStats } from "./upgrades.js";
import { TOWERS } from "./towers_def.js"; // ★ 追加：色を参照

export function draw(){
  // 背景クリア
  ctx.clearRect(0,0,W,H);

  // グリッド
  ctx.save();
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid");
  ctx.lineWidth = 1;
  for (let x=0; x<=W; x+=TILE){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0; y<=H; y+=TILE){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  // 道
  const path1 = getComputedStyle(document.documentElement).getPropertyValue("--path");
  const path2 = getComputedStyle(document.documentElement).getPropertyValue("--path-2");
  const g = ctx.createLinearGradient(0, PATH_Y_TOP, 0, PATH_Y_BOTTOM);
  g.addColorStop(0, path1.trim());
  g.addColorStop(1, path2.trim());
  ctx.fillStyle = g;
  ctx.fillRect(0, PATH_Y_TOP, W, PATH_Y_BOTTOM - PATH_Y_TOP);

  // タワー（タイプごとに色分け）
  ctx.save();
  for (let i=0;i<towers.length;i++){
    const t = towers[i];
    const S = getTowerStats(t.typeId, t.level);
    const color = (TOWERS[t.typeId]?.color) || getComputedStyle(document.documentElement).getPropertyValue("--tower");

    // 射程円（選択中は濃く）
    ctx.globalAlpha = (state.selectedTowerIndex === i) ? 0.22 : 0.10;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(t.x, t.y, S.range, 0, Math.PI*2); ctx.fill();

    // 本体
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(t.x, t.y, 16, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // 敵
  ctx.save();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--enemy");
  for (const e of enemies){
    // スロー中の淡い輪郭
    if (e.slowT > 0){
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath(); ctx.arc(e.x, e.y, 16, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // 本体
    ctx.beginPath(); ctx.arc(e.x, e.y, 14, 0, Math.PI*2); ctx.fill();

    // HPバー（★ maxHp を使って割合計算）
    ctx.fillStyle = "#111827";
    ctx.fillRect(e.x-18, e.y-22, 36, 6);
    const maxHp = e.maxHp || 1;
    const w = clamp((e.hp / maxHp) * 36, 0, 36);
    ctx.fillStyle = "#34d399";
    ctx.fillRect(e.x-18, e.y-22, w, 6);

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--enemy");
  }
  ctx.restore();

  // 弾
  ctx.save();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bullet");
  for (const b of bullets){
    ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // オーバーレイ（モード/ポーズ）
  if (state.placeMode || state.sellMode || state.isPaused){
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "20px system-ui, sans-serif";
    ctx.textAlign = "center";
    const txt = state.isPaused
      ? "一時停止中"
      : (state.placeMode ? "配置モード: クリックで塔を設置" : "売却モード: 塔をクリックで売却");
    ctx.fillText(txt, W/2, 34);
    ctx.restore();
  }
}
