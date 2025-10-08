import { WORKER_BASE_URL } from "./config.js";
import { connectMatchmaker, connectRoom } from "./net/client.js";
import { serializeDeck, deserializeDeck } from "./game/state.js";
import { DECK_PRESETS } from "./game/cards/index.js";
import { renderAll, bindUI, renderBlank } from "./ui/render.js";

const els = { status: document.getElementById("status"), alias: document.getElementById("alias"), quick: document.getElementById("quickMatch"), endTurn: document.getElementById("endTurn"), ai: document.getElementById("aiMatch") };

let roomConn = null; let you = null; let state = null;

function setStatus(t){ els.status.textContent = t; }

function setupDeckUI(){ const deckPanel = document.getElementById("deckList"); deckPanel.innerHTML = ""; for (const [name, deck] of Object.entries(DECK_PRESETS)) { const btn = document.createElement("button"); btn.textContent = `Use: ${name}`; btn.addEventListener("click", () => { localStorage.setItem("deck", serializeDeck(deck)); alert(`Selected deck: ${name}`); }); deckPanel.appendChild(btn);} if(!localStorage.getItem("deck")) localStorage.setItem("deck", serializeDeck(DECK_PRESETS.Starter)); }

function resetBeforeMatch(){ try{ roomConn?.close(); }catch{} roomConn=null; you=null; state=null; renderBlank(); setStatus("Reset."); }

function bindGameUI(){ bindUI({ onPlayCard:(handIdx, targetIdx)=>{ if(!roomConn?.ready) return; const msg = { type:"move", op:"play", handIdx }; if (typeof targetIdx === "number") msg.targetIdx = targetIdx; roomConn.send(msg); }, onAttack:(attackerIdx, targetIdx)=>{ if(!roomConn?.ready) return; roomConn.send({ type:"move", op:"attack", attackerIdx, targetIdx }); }, onEndTurn:()=>{ if(!roomConn?.ready) return; roomConn.send({ type:"move", op:"end" }); }, }); }

function genRoomId(){
  try {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
  } catch {}
  return "rm_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
}

async function quickMatch(){ try{ resetBeforeMatch(); setStatus("Matching..."); const alias = els.alias.value.trim() || "Anon"; const chosen = deserializeDeck(localStorage.getItem("deck")); const found = await connectMatchmaker(WORKER_BASE_URL); you = found.you; setStatus(`Matched! You are ${you}. Joining room...`); roomConn = await connectRoom(WORKER_BASE_URL, found.roomId, { onOpen(api){ setStatus(`Connected to room ${found.roomId}`); api.send({ type:"hello", alias, deck: chosen }); }, onMessage(data){ if (data.type === "sync") { state = data.state; window.__STATE__ = state; window.__YOU__ = you; renderAll(state, you); if (state.winner) { const w = state.winner === "draw" ? "Draw" : (state.winner === you ? "You win!" : "You lose."); setStatus(`Game over: ${w}`); } } else if (data.type === "info") { setStatus(data.text); } }, onClose(){ setStatus("Room closed"); roomConn=null; }, onError(err){ console.error(err); setStatus("Error"); roomConn=null; }, }); } catch(e){ console.error(e); setStatus("Match failed"); } }

async function aiMatch(){
  try{
    resetBeforeMatch();
    setStatus("Connecting AI...");
    const alias = (document.getElementById("alias")?.value || "Anon").trim();
    const roomId = genRoomId() + "?ai=1";
    you = "A"; // 人間=A
    roomConn = await connectRoom(WORKER_BASE_URL, roomId, {
      onOpen(api){ api.send({ type:"hello", alias }); setStatus("Connected vs AI"); },
      onMessage(data){
        if (data.type === "sync") { state = data.state; window.__STATE__=state; window.__YOU__=you; renderAll(state, you); }
        else if (data.type === "info") setStatus(data.text);
      },
      onClose(){ setStatus("Room closed"); roomConn=null; },
      onError(e){ console.error(e); setStatus("Error"); roomConn=null; },
    });
  } catch(e){ console.error(e); setStatus("AI match failed"); }
}

function bindAiButton(){
  const btn = document.getElementById("aiMatch");
  if (!btn) return;
  // ダブルタップ対策の簡易ガード
  let locked = false;
  const handler = (e)=>{
    if (locked) return;
    locked = true; setTimeout(()=>locked=false, 350);
    aiMatch();
  };
  // クリックが拾われない環境向けに pointerup を併用
  btn.addEventListener("click", handler, { passive:true });
  btn.addEventListener("pointerup", handler, { passive:true });
}

window.addEventListener("DOMContentLoaded", ()=>{
  bindAiButton();
  // （他のUI初期化があればここで実行）
});


setupDeckUI(); bindGameUI();
els.quick.addEventListener("click", quickMatch);
els.ai?.addEventListener("click", aiMatch);