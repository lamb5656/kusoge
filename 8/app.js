const API_BASE="https://bidfight.lamb565.workers.dev"
const N=7
const $=id=>document.getElementById(id)
const boardMe=$("boardMe"),boardOp=$("boardOp")
let ws=null,seat=null,roomId=null,placing=false,playing=false,orientation="H"
let myShip=null,mySalt=null,deadline=0,timerId=null,firedThisTurn=false,activeTab="op"
let anchorX=null,anchorY=null,previewCells=null,placed=false
const cellsMe=[],cellsOp=[]

for(let y=0;y<N;y++){for(let x=0;x<N;x++){const cM=document.createElement("div");cM.className="cell me";cM.dataset.x=x;cM.dataset.y=y;cM.onclick=onPlaceClick;boardMe.appendChild(cM);cellsMe.push(cM);const cO=document.createElement("div");cO.className="cell";cO.dataset.x=x;cO.dataset.y=y;cO.onclick=()=>onFireClick(x,y,cO);boardOp.appendChild(cO);cellsOp.push(cO)}}

$("tabOp").onclick=()=>showTab("op")
$("tabMe").onclick=()=>showTab("me")
function showTab(t){activeTab=t;$("tabOp").classList.toggle("active",t==="op");$("tabMe").classList.toggle("active",t==="me");$("boardOpWrap").classList.toggle("hidden",t!=="op");$("boardMeWrap").classList.toggle("hidden",t!=="me")}

$("queue").onclick=async()=>{
  resetForNewMatch()
  if(ws&&ws.readyState<2){try{ws.close()}catch{}}
  const r=await fetch(API_BASE+"/enqueue",{method:"POST"})
  const j=await r.json()
  seat=j.seat;roomId=j.roomId||null
  setStatus(`相手待ち…（あなたは ${seat.toUpperCase()}）`)
  ws=new WebSocket(j.wsUrl)
  ws.onopen=()=>{ws.send(JSON.stringify({action:"READY"})); setTimeout(()=>ws.send(JSON.stringify({action:"NUDGE"})),1000)}
  ws.onmessage=e=>handle(JSON.parse(e.data))
  ws.onclose=()=>setStatus("切断されました")
}

$("toggle").onclick=()=>{orientation=orientation==="H"?"V":"H";if(placing){updatePreview();paintPlacement()}}
$("confirm").onclick=async()=>{if(!placing||placed||!myShip)return;placed=true;$("confirm").disabled=true;setPhase("配置を送信しました。相手を待っています…");await sendPlacement(myShip);vibe(10)}
$("rematch").onclick=()=>{ws?.send(JSON.stringify({action:"REMATCH"}));$("rematch").disabled=true;resetForNewMatch();setStatus("再戦待ち…")}

function setStatus(s){$("status").textContent=s}
function setPhase(s){$("phaseInfo").textContent=s}
function log(s){const el=$("log");el.textContent+=s+"\n";el.scrollTop=el.scrollHeight}
function vibe(ms){if("vibrate"in navigator)navigator.vibrate(ms)}

function handle(m){
  if(m.type==="WELCOME"){}
  if(m.type==="SEATS"){if(m.a&&m.b){setStatus(`接続完了（あなたは ${seat.toUpperCase()}）`)}}
  if(m.type==="MATCH_FOUND"){resetForNewMatch();setStatus(`対戦相手が見つかりました。${Math.floor(m.startInMs/1000)}秒後に開始`);startCountdown(m.startInMs)}
  if(m.type==="PLACE_START"){setStatus("配置フェーズ");$("toggle").disabled=false;$("confirm").disabled=false;placing=true;playing=false;myShip=null;mySalt=null;firedThisTurn=false;placed=false;anchorX=null;anchorY=null;previewCells=null;deadline=m.deadlineMs;startTimer(deadline);setPhase("艦（長さ2）を置いてください");showTab("me")}
  if(m.type==="PLACE_STATUS"){}
  if(m.type==="PLACE_OK"){}
  if(m.type==="PLACE_INVALID"){placed=false;setPhase("無効な配置です。やり直してください");$("confirm").disabled=false}
  if(m.type==="TURN_START"){placing=false;playing=true;$("round").textContent=m.round;$("hpMe").textContent=(seat==="a"?m.hitsLeft.a:m.hitsLeft.b);$("hpOp").textContent=(seat==="a"?m.hitsLeft.b:m.hitsLeft.a);setStatus(`ラウンド ${m.round} 開始`);setPhase("相手の盤のマスを1つ選んで発射");firedThisTurn=false;deadline=m.deadlineMs;startTimer(deadline);showTab("op")}
  if(m.type==="TURN_RESULT"){paintTurnResult(m);$("hpMe").textContent=(seat==="a"?m.hitsLeft.a:m.hitsLeft.b);$("hpOp").textContent=(seat==="a"?m.hitsLeft.b:m.hitsLeft.a);$("timer").textContent="--"}
  if(m.type==="MATCH_RESULT"){const msg=m.result==="draw"?"引き分け":(m.result==="win"?"あなたの勝ち！":"あなたの負け…");setStatus(`試合終了：${msg}（${labelReason(m.reason)}）`);$("rematch").disabled=false;playing=false;placing=false;stopTimer()}
}

function labelReason(r){return r==="sink"?"撃沈":r==="timeout"?"タイムアウト":r==="maxround"?"規定ターン":r==="opponent_disconnected"?"相手切断":""}
function startCountdown(ms){
  let left=Math.ceil(ms/1000)
  $("timer").textContent=left
  const id=setInterval(()=>{
    left--
    $("timer").textContent=left>0?left:"START"
    if(left<=0){
      clearInterval(id)
      setTimeout(()=>{ try{ ws && ws.readyState===1 && ws.send(JSON.stringify({action:"NUDGE"})) }catch{} }, 300)
    }
  },1000)
}
function startTimer(deadlineMs){deadline=deadlineMs;stopTimer();timerId=setInterval(()=>{const s=Math.max(0,Math.ceil((deadline-Date.now())/1000));$("timer").textContent=s;if(s<=0)stopTimer()},250)}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}}

function onPlaceClick(){if(!placing)return;anchorX=+this.dataset.x;anchorY=+this.dataset.y;updatePreview();if(previewCells&&previewCells.valid){myShip=previewCells.cells;$("confirm").disabled=false}else{myShip=null;$("confirm").disabled=true}paintPlacement();vibe(5)}
function updatePreview(){const cand=orientation==="H"?[[anchorX,anchorY],[anchorX+1,anchorY]]:[[anchorX,anchorY],[anchorX,anchorY+1]];let valid=validCells(cand);let cells=cand;if(!valid){const alt=orientation==="H"?[[anchorX-1,anchorY],[anchorX,anchorY]]:[[anchorX,anchorY-1],[anchorX,anchorY]];cells=alt;valid=validCells(alt)}previewCells={cells,valid}}
function paintPlacement(){for(const c of cellsMe){c.classList.remove("ship","preview","invalid")}if(previewCells){const cls=previewCells.valid?(myShip?"ship":"preview"):"invalid";for(const [x,y] of previewCells.cells){const c=cellsMe.find(e=>+e.dataset.x===x&&+e.dataset.y===y);if(c)c.classList.add(cls)}}}
function validCells(c){if(!c||c.length!==2)return false;const [[x1,y1],[x2,y2]]=c;const inb=inBounds(x1,y1)&&inBounds(x2,y2);const adj=(x1===x2&&Math.abs(y1-y2)===1)||(y1===y2&&Math.abs(x1-x2)===1);return inb&&adj&&!(x1===x2&&y1===y2)}
function inBounds(x,y){return x>=0&&x<N&&y>=0&&y<N}

function clearBoards(){for(const c of cellsMe){c.className="cell me";c.textContent=""}for(const c of cellsOp){c.className="cell";c.textContent=""}$("round").textContent="--";$("timer").textContent="--";$("hpMe").textContent="2";$("hpOp").textContent="2";$("log").textContent="";setPhase("配置フェーズ：艦(長さ2)を置いてください")}
function resetForNewMatch(){clearBoards();placing=false;playing=false;orientation="H";placed=false;myShip=null;mySalt=null;deadline=0;firedThisTurn=false;anchorX=null;anchorY=null;previewCells=null;$("toggle").disabled=true;$("confirm").disabled=true;$("rematch").disabled=true;showTab("op")}

async function sendPlacement(cells){await waitWSOpen();mySalt=randHex(16);const key=seat+"|"+(roomId||"")+"|"+mySalt+"|"+JSON.stringify(cells);const commit=await sha256hex(key);ws.send(JSON.stringify({action:"PLACE_COMMIT",commit}));await delay(40);ws.send(JSON.stringify({action:"PLACE_REVEAL",cells,salt:mySalt}))}
function onFireClick(x,y,cell){if(!playing||firedThisTurn)return;ws?.send(JSON.stringify({action:"FIRE",x,y}));firedThisTurn=true;cell.style.opacity=.7;vibe(10)}
function paintTurnResult(m){const a=m.shots.a,b=m.shots.b;const mine=(seat==="a")?a:b;const opp=(seat==="a")?b:a;if(mine.x!=null)mark(boardOp,mine.x,mine.y,mine.outcome,true);if(opp.x!=null)mark(boardMe,opp.x,opp.y,opp.outcome,false);log(`R${m.round} あなた: ${fmt(mine)} / 相手: ${fmt(opp)}`)}
function fmt(s){return s.outcome+" @("+s.x+","+s.y+")"}
function mark(boardEl,x,y,outcome,isOpponent){const list=(boardEl===boardOp)?cellsOp:cellsMe;const c=list.find(e=>+e.dataset.x===x&&+e.dataset.y===y);if(!c)return;c.style.opacity=1;c.classList.remove("hit","ripple","miss","preview","invalid","ship");if(outcome==="HIT"){c.classList.add("hit");c.textContent="×"}else if(outcome==="RIPPLE"){c.classList.add("ripple");c.textContent=""}else{c.classList.add("miss");c.textContent="ミス"}}
async function waitWSOpen(){if(ws&&ws.readyState===1)return;await new Promise(res=>{const t=setInterval(()=>{if(ws&&ws.readyState===1){clearInterval(t);res()}},10)})}
function delay(ms){return new Promise(r=>setTimeout(r,ms))}
async function sha256hex(str){const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));return[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function randHex(n){const u8=new Uint8Array(n);crypto.getRandomValues(u8);return[...u8].map(b=>b.toString(16).padStart(2,"0")).join("")}
