// public/render.js — 敵タイプ別グラフィック表示版（ライトテーマ対応）
import { assets } from "./assets.js";

let _waveBannerUntil = 0;   // ミリ秒の期限
let _lastWaveSeen = 0;

export function setupRender() {
  const cvs = document.getElementById("canvas");
  const ctx = cvs.getContext("2d", { alpha: false });

  // ★テーマ切替（必要なら false に）
  const IS_LIGHT = true;

  const BG_COLOR   = IS_LIGHT ? "#CFCFCF" : "#0b0f14";
  const GRID_COLOR = IS_LIGHT ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const RING_COLOR = IS_LIGHT ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)";
  const INVULN_RING= IS_LIGHT ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)";
  const HEAD_MARK  = IS_LIGHT ? "#111111" : "#ffffff";
  const BAR_TRACK  = IS_LIGHT ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)";

  function resize(){
    const dpr = Math.max(1, devicePixelRatio || 1);
    cvs.width = Math.floor(cvs.clientWidth * dpr);
    cvs.height = Math.floor(cvs.clientHeight * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize(); addEventListener("resize", resize);

  return { cvs, ctx, resize, draw };

  function draw(state) {

   const w = cvs.clientWidth, h = cvs.clientHeight;
   ctx.fillStyle = BG_COLOR; ctx.fillRect(0,0,w,h);

   const nowMs = performance.now();

   // Wave切替を検知 → 1.6秒のバナーを出す
   if (typeof state.wave === "number" && state.wave > 0 && state.wave !== _lastWaveSeen) {
     _lastWaveSeen = state.wave;
     _waveBannerUntil = nowMs + 1600; // 1.6s 表示
   }
 
   const self = state.players.get(state.me);
    if (self) { state.cam.x = self.x; state.cam.y = self.y; }

    // 少し引き気味
    const ZOOM = 0.5;

    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.scale(ZOOM, ZOOM);
    ctx.translate(-state.cam.x, -state.cam.y);

    grid(state.world, 80, ctx, GRID_COLOR);

    // XP orbs
    if (state.orbs && state.orbs.length) {
      const now = Date.now();
      for (const o of state.orbs) {
        const rOuter = 8 + 1.0 * Math.sin((o.x*0.03 + o.y*0.03 + now*0.008));
        ctx.fillStyle = "rgba(94,234,212,0.28)";
        ctx.beginPath(); ctx.arc(o.x, o.y, rOuter, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#5eead4";
        ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, Math.PI*2); ctx.fill();
      }
    }

    // enemies（★タイプ別）
    for (const e of state.enemies) {
      drawEnemy(e, ctx);
      const ratio = (e.maxHp && e.maxHp>0) ? (e.hp/e.maxHp) : (e.hp/60);
      bar(ctx, e.x-18, e.y-26, 36, 5, Math.max(0,Math.min(1,ratio)), e.elite ? "#eab308" : "#c0392b", BAR_TRACK);
      if (e.elite) {
        ctx.strokeStyle = e.shield>0 ? "rgba(0,135,190,0.85)" : "rgba(160,120,0,0.7)";
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x,e.y,24,0,Math.PI*2); ctx.stroke();
      }
    }

    // bullets
    ctx.fillStyle = "#FFFF00";
    for (const b of state.bullets) ctx.fillRect(b.x-3, b.y-3, 6,6);

    // players（自機ハイライト）
    for (const [id,p] of state.players) {
      const me = id===state.me;
      const auraR  = me ? 30 : 22;
      const coreA  = me ? 0.45 : 0.25;
      glow(ctx, p.x, p.y, auraR, `rgba(80,255,170,${coreA})`);
      outlineRing(ctx, p.x, p.y, 18, RING_COLOR);
      if (me) headMarker(ctx, p.x, p.y - 34, HEAD_MARK);

      drawPlayer(p, ctx);
      bar(ctx, p.x-18, p.y+20, 36, 5, (p.hp||100)/(p.maxHp||100), "#2ecc71", BAR_TRACK);

      ctx.fillStyle = IS_LIGHT ? "#0b0f14" : "#e6f1ff";
      ctx.font = "12px system-ui"; ctx.textAlign="center";
      ctx.fillText(`P${id}`, p.x, p.y-26);

      if ((p.invuln||0) > 0) { ctx.strokeStyle = INVULN_RING; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x,p.y,22,0,Math.PI*2); ctx.stroke(); }

      if (p.downed) {
        ctx.strokeStyle = "rgba(200,30,30,0.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x,p.y,22,0,Math.PI*2); ctx.stroke();
        const prog = Math.max(0, Math.min(1, p.revive||0));
        ctx.strokeStyle = "#34d399"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x,p.y,22,-Math.PI/2,-Math.PI/2+Math.PI*2*prog); ctx.stroke();
        ctx.strokeStyle = IS_LIGHT ? "#111" : "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x-6,p.y); ctx.lineTo(p.x+6,p.y); ctx.moveTo(p.x,p.y-6); ctx.lineTo(p.x,p.y+6); ctx.stroke();
      }
    }

    ctx.restore();

    if (nowMs < _waveBannerUntil) {
      const w = cvs.clientWidth, h = cvs.clientHeight;
      const t = (_waveBannerUntil - nowMs) / 1600;       // 1 → 0
      const alpha = Math.min(1, t * 2);                  // フェードイン→アウト
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 36px system-ui";
      // ふち取りして視認性UP
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.strokeText(`WAVE ${state.wave}`, w/2, 48);
      ctx.fillStyle = "#111"; // ライト背景で読みやすい色
      ctx.fillText(`WAVE ${state.wave}`, w/2, 48);
    
      // ブレイク中ならサブテキスト
      if (state.break && state.break > 0) {
        ctx.font = "bold 16px system-ui";
        const sec = typeof state.break === "number" ? state.break.toFixed(1) : state.break;
        ctx.strokeText(`Break ${sec}s`, w/2, 76);
        ctx.fillText(`Break ${sec}s`, w/2, 76);
      }
      ctx.restore();
    }


    // HUD
    const hud = document.getElementById("hud");
    hud.style.color = IS_LIGHT ? "#0b0f14" : "#e6f1ff";
    hud.style.textShadow = IS_LIGHT ? "0 1px 0 rgba(255,255,255,0.5)" : "none";
    // ★既存のHUDテキストを Wave 付きに（if(self) ... の行を差し替え）
    if (self) {
      const brk = state.break && state.break > 0 ? ` (Break ${Number(state.break).toFixed(1)}s)` : "";
      hud.textContent =
        `HP:${self.hp}/${self.maxHp}  Lv.${self.level}  XP:${self.xp}/${self.nextXp}  ` +
        `Wave:${state.wave || 0}${brk}  Players:${state.players.size}  Enemies:${state.enemies.length}`;
    } else {
      hud.textContent = `Wave:${state.wave || 0}  Players:${state.players.size}  Enemies:${state.enemies.length}`;
    }

  }
}

/* ============ プレイヤー/敵の描画 ============ */
function drawPlayer(p, ctx){
  const img = assets.player;
  const shadow = assets.shadow;
  if (shadow) ctx.drawImage(shadow, p.x-24, p.y-14, 48, 28);
  if (img) ctx.drawImage(img, p.x-32, p.y-32, 64, 64);
  else circle(ctx, p.x, p.y, 16, "#2ecc71");
}

const TYPE_TO_KEY = {
  chaser:   "enemy_chaser",
  dasher:   "enemy_dasher",
  tank:     "enemy_tank",
  weaver:   "enemy_weaver",
  splitter: "enemy_splitter",
  mini:     "enemy_mini",
};

// 置き換え先：render.js の drawEnemy 関数
function drawEnemy(e, ctx){
  const type   = e.type || "chaser";
  const x      = e.x, y = e.y;
  const elite  = !!e.elite;
  const shield = e.shield || 0;

  // 画像キー決定 → 読み込み済みなら画像、未読込ならフォールバック図形にゃ
  const key = TYPE_TO_KEY[type] || "enemy_chaser";
  const img = assets[key];

  // 影
  const shadow = assets.shadow;
  if (shadow) ctx.drawImage(shadow, x-24, y-14, 48, 28);

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x-30, y-30, 60, 60);
  } else {
    // フォールバック図形描画にゃ
    switch(type){
      case "dasher":   // 矢じり
        tri(ctx, x, y, 20, 0, "#ff6b6b", "#11111122");
        break;
      case "tank":     // 角丸＋装甲リング
        roundRect(ctx, x-18, y-18, 36, 36, 8, "#8c9aa6");
        outlineRing(ctx, x, y, 22, "rgba(40,40,40,0.35)");
        break;
      case "weaver":   // しま模様
        circle(ctx, x, y, 18, "#6aa9ff");
        stripe(ctx, x, y, 18, 5, "rgba(255,255,255,0.5)");
        break;
      case "splitter": // 半々カラー
        halfCircle(ctx, x, y, 18, "#f59e0b", "#ef4444");
        break;
      case "mini":     // 小さめ
        circle(ctx, x, y, 12, "#fb7185");
        break;
      case "chaser":
      default:
        circle(ctx, x, y, 18, "#e74c3c");
    }
  }

  // エリート＆シールド装飾
  if (elite)  outlineRing(ctx, x, y, 24, "rgba(234,179,8,0.85)");
  if (shield>0) outlineRing(ctx, x, y, 20, "rgba(0,135,190,0.9)");
}

/* ============ 図形ユーティリティ ============ */
function glow(ctx,x,y,r,core){
  const g = ctx.createRadialGradient(x,y,0, x,y,r);
  g.addColorStop(0, core);
  g.addColorStop(1, "rgba(80,255,170,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
}
function outlineRing(ctx,x,y,r,color){
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
}
function headMarker(ctx, x, y, col="#111"){
  ctx.fillStyle = col; ctx.globalAlpha = 0.95;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x-7, y+12); ctx.lineTo(x+7, y+12);
  ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1.0;
}
function grid(world, step, ctx, color){
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
  for (let x=0;x<=world.w;x+=step){ ctx.moveTo(x,0); ctx.lineTo(x,world.h); }
  for (let y=0;y<=world.h;y+=step){ ctx.moveTo(0,y); ctx.lineTo(world.w,y); }
  ctx.stroke();
}
function circle(ctx,x,y,r,fill){ ctx.fillStyle=fill; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
function bar(ctx,x,y,w,h,ratio,fillColor,trackColor){
  ctx.fillStyle = trackColor; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = fillColor; ctx.fillRect(x,y, Math.max(0, Math.min(w, w*ratio)), h);
}
function tri(ctx, x, y, r, rot=0, fill="#000", stroke="transparent"){
  ctx.save();
  ctx.translate(x,y); ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(r,0);
  ctx.lineTo(-r*0.7, r*0.8);
  ctx.lineTo(-r*0.7,-r*0.8);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke!=="transparent"){ ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, rad, fill="#888"){
  ctx.beginPath();
  ctx.moveTo(x+rad,y);
  ctx.arcTo(x+w,y,x+w,y+h,rad);
  ctx.arcTo(x+w,y+h,x,y+h,rad);
  ctx.arcTo(x,y+h,x,y,rad);
  ctx.arcTo(x,y,x+w,y,rad);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}
function stripe(ctx,x,y,r,step, col="rgba(255,255,255,0.4)"){
  ctx.save();
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.clip();
  ctx.strokeStyle = col; ctx.lineWidth = 3;
  for (let a=-r; a<=r; a+=step){
    ctx.beginPath(); ctx.moveTo(x-r, y+a); ctx.lineTo(x+r, y+a); ctx.stroke();
  }
  ctx.restore();
}
function halfCircle(ctx,x,y,r,colA,colB){
  ctx.beginPath(); ctx.arc(x,y,r,Math.PI/2,-Math.PI/2,true);
  ctx.closePath(); ctx.fillStyle = colA; ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,r,-Math.PI/2,Math.PI/2,true);
  ctx.closePath(); ctx.fillStyle = colB; ctx.fill();
}
