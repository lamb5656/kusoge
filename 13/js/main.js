import { state } from "./state.js";
import { setupInput } from "./input.js";
import { setupRender } from "./render.js";
import { loadAssets } from "./assets.js";

const WS_URL =
  location.hostname === "localhost"
    ? "ws://localhost:8787/room"                    // ローカル開発用
    : "wss://archero-like.lamb565.workers.dev/room"; // 本番（Cloudflare等）

const statusEl = document.getElementById("status");
const { draw } = setupRender();
let sendTick = null;

// XPバーDOM
const xpbar = document.getElementById("xpbar");
const xpfill = document.getElementById("xpfill");
const xptext = document.getElementById("xptext");

// Level-up overlay
const overlay = document.getElementById("levelup");
const choiceGrid = document.getElementById("choiceGrid");

document.getElementById("connect").onclick = connect;

const ASSET_MANIFEST = {
  player:  "/img/player.png",
  shadow:  "/img/shadow.png",
  enemy_chaser:   "/img/enemy_chaser.png",
  enemy_dasher:   "/img/enemy_dasher.png",
  enemy_tank:     "/img/enemy_tank.png",
  enemy_weaver:   "/img/enemy_weaver.png",
  enemy_splitter: "/img/enemy_splitter.png",
  enemy_mini:     "/img/enemy_mini.png",
  // （必要なら既存の enemy / elite も残してOK）
};

async function ensureAssets() {
  // すでに読み込んでいたら何もしない
  if (window.__assetsLoaded__) return;
  await loadAssets(ASSET_MANIFEST);
  window.__assetsLoaded__ = true;
}

function showChoices(choices){
  state.pendingChoices = choices;
  choiceGrid.innerHTML = "";
  for (const c of choices) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${c.name}</h3>
      <p>${c.desc}</p>
      <button data-id="${c.id}">選ぶ</button>
      <div class="note">取得済: ${c.stacks || 0}</div>
    `;
    choiceGrid.appendChild(card);
  }
  choiceGrid.querySelectorAll("button").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute("data-id");
      if (state.ws && state.ws.readyState===1) state.ws.send(JSON.stringify({ t:"choose", pick:id }));
      overlay.classList.remove("show"); state.pendingChoices = null;
    };
  });
  overlay.classList.add("show");
}

async function connect(){
  await ensureAssets(); // ★接続前に画像を読み込むにゃ

  const roomId = document.getElementById("room").value.trim() || "test";
  if (state.ws) try{ state.ws.close(); }catch{}
  state.ws = new WebSocket(getWsBase()+"/room/"+encodeURIComponent(roomId));
  state.ws.onopen = ()=> statusEl.textContent = "connected";
  state.ws.onclose = ()=> { statusEl.textContent = "disconnected"; state.me = null; };
  state.ws.onmessage = (ev)=>{
    const msg = JSON.parse(ev.data);
    if (msg.t === "welcome") {
      state.me = msg.playerId; state.world = msg.world; state.myGhost = null;
    } else if (msg.t === "level") {
      showChoices(msg.choices || []);
    } else if (msg.t === "state") {
      state.world  = msg.world || state.world;
      state.enemies = msg.enemies;
      state.bullets = msg.bullets;
      state.orbs    = msg.orbs || [];

      const incoming = new Map(msg.players.map(p=>[p.id,p]));
      for (const [id,p] of incoming) {
        if (id === state.me) {
          if (!state.myGhost) state.myGhost = { x:p.x, y:p.y, seq:p.seq };
          const a = 0.35;
          state.myGhost.x += (p.x - state.myGhost.x) * a;
          state.myGhost.y += (p.y - state.myGhost.y) * a;
          state.players.set(id, { ...p, x: state.myGhost.x, y: state.myGhost.y });
          if (p.choices && !state.pendingChoices) showChoices(p.choices);
        } else {
          state.players.set(id, p);
        }
      }
      for (const id of Array.from(state.players.keys())) if (!incoming.has(id)) state.players.delete(id);

      // XPバー更新
      const me = state.players.get(state.me);
      if (me) {
        const ratio = Math.max(0, Math.min(1, (me.nextXp>0? (me.xp / me.nextXp) : 0)));
        xpfill.style.width = (ratio*100).toFixed(1) + "%";
        xptext.textContent = `Lv.${me.level}  ${me.xp}/${me.nextXp}`;
        xpbar.style.opacity = "1";
      } else {
        xpbar.style.opacity = "0.5";
      }
    }
  };

  sendTick = setupInput(state, sendInput, sendDash);
}

function sendInput({ seq, ax, ay }){
  if (!state.ws || state.ws.readyState!==1 || state.me==null) return;
  state.ws.send(JSON.stringify({ t:"inp", seq, ax, ay }));

  // client-side prediction（移動のみ）
  const self = state.players.get(state.me) || { x: state.world.w/2, y: state.world.h/2, dashT:0 };
  if (!state.myGhost) state.myGhost = { x:self.x, y:self.y, seq };
  const speed = 220 + (self.dashT > 0 ? 520 : 0);
  const m = Math.hypot(ax, ay)||1;
  state.myGhost.x = clamp(state.myGhost.x + (ax/m)*speed*(1/60), 0, state.world.w);
  state.myGhost.y = clamp(state.myGhost.y + (ay/m)*speed*(1/60), 0, state.world.h);
  state.players.set(state.me, { ...self, id: state.me, x: state.myGhost.x, y: state.myGhost.y });
}
function sendDash(){ if (!state.ws || state.ws.readyState!==1) return; state.ws.send(JSON.stringify({ t:"dash" })); }

let last = performance.now();
requestAnimationFrame(loop);
function loop(ts){ const dt = Math.min(0.033, (ts-last)/1000); last = ts; if (sendTick) sendTick(dt); draw(state); requestAnimationFrame(loop); }

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function getWsBase(){ const loc = window.location; const proto = loc.protocol === "https:" ? "wss:" : "ws:"; return proto + "//" + loc.host; }
