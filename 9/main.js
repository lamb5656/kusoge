;(function(){
  'use strict';
  var Engine = window.Engine, Generator = window.Generator;
  if(!Engine){ console.error('Engine not loaded'); return; }
  var state = Engine.state;

  var seedInput=document.getElementById('seed');
  var showWallsChk=document.getElementById('showWalls');
  var densityInput=document.getElementById('density');
  var densityVal=document.getElementById('densityVal');
  var btnReset=document.getElementById('reset');
  var btnNew=document.getElementById('new');
  var btnNext=document.getElementById('next');
  var btnUndo=document.getElementById('undo');
  var winOverlay=document.getElementById('winOverlay');
  var winAgain=document.getElementById('winAgain');
  var winNext=document.getElementById('winNext');
  var winClose=document.getElementById('winClose');
  var btnLevelReset=document.getElementById('levelReset');
  var btnGiveUp=document.getElementById('giveup');
  var btnHint=document.getElementById('hint');
  var btnSolver=document.getElementById('solver');
  var toast=document.getElementById('toast');
  var toastMsg=document.getElementById('toastMsg');

  function updateButtons(){ if(btnUndo) btnUndo.disabled = state.cleared || state.path.length<=1; }
  function showToast(m){
    if(showToast._lastMsg===m && Date.now() - (showToast._lastAt||0) < 600) return;
    showToast._lastMsg=m; showToast._lastAt=Date.now();
    toastMsg.textContent=m; toast.hidden=false;
    if(showToast._timer) clearTimeout(showToast._timer);
    showToast._timer=setTimeout(function(){ toast.hidden=true; showToast._timer=null; },1000);
  }
  function resetPlay(){
    state.visited=new Set([state.start]);
    state.path=[state.start];
    state.lastCell=state.start;
    state.cleared=false; if(winOverlay) winOverlay.hidden=true;
    updateButtons();
    Engine.draw();
  }
  function generate(){
    if(!Generator){ console.error('Generator not loaded'); return; }
    state.cleared=false; if(winOverlay) winOverlay.hidden=true;
    Generator.genRandomWalls();
    resetPlay();
  }
  function regen(newSeed){
    var seedStrUser=(seedInput.value||'').trim();
    state.seedStr = newSeed ? (seedStrUser || Math.random().toString(36).slice(2)) : (seedStrUser || state.seedStr || Math.random().toString(36).slice(2));
    seedInput.value=state.seedStr; state.rng=Engine.rndFromSeed(state.seedStr);
    Engine.setLevelSizeFromLevel();
    state.cleared=false; if(winOverlay) winOverlay.hidden=true;
    generate();
    Engine.draw();
  }
  function cellFromClient(x,y){
    var rect=Engine.canvas.getBoundingClientRect();
    var px=(x-rect.left)*(Engine.canvas.width/rect.width);
    var py=(y-rect.top)*(Engine.canvas.height/rect.height);
    var cellSize=Math.min(Engine.canvas.width/state.gridW, Engine.canvas.height/state.gridH);
    var padX=(Engine.canvas.width - cellSize*state.gridW)/2;
    var padY=(Engine.canvas.height - cellSize*state.gridH)/2;
    var cx=Math.floor((px-padX)/cellSize);
    var cy=Math.floor((py-padY)/cellSize);
    if(cx<0||cy<0||cx>=state.gridW||cy>=state.gridH) return -1; return Engine.idx(cx,cy);
  }
  function tryMove(to){
    var from=state.lastCell; if(to<0||to===from) return;
    if(Engine.isBlocked(to)) return;
    if(!Engine.isOpen(from,to)){
      var k=Engine.edgeKey(from,to), now=Date.now();
      if(tryMove._lastBlockKey===k && now - (tryMove._lastBlockAt||0) < 450) return;
      tryMove._lastBlockKey=k; tryMove._lastBlockAt=now;
      Engine.flashEdge(from,to); showToast('その方向は壁です');
      return;
    }
    if(state.visited.has(to)) return;
    state.visited.add(to); state.path.push(to); state.lastCell=to; Engine.draw(); updateButtons();
    if(state.path.length===Engine.usableCount()) onWin();
  }
  function onPointerDown(e){ if(state.cleared) return; var p=e.touches? e.touches[0]:e; var c=cellFromClient(p.clientX,p.clientY); if(c===state.start || (state.path.length>0 && c===state.lastCell)) state.dragging=true; }
  function onPointerMove(e){ if(!state.dragging) return; var p=e.touches? e.touches[0]:e; tryMove(cellFromClient(p.clientX,p.clientY)); }
  function onPointerUp(){ state.dragging=false; }

  function hint(){ var sol=Generator&&Generator.solveOnePath? Generator.solveOnePath() : null; if(!sol){ showToast('解が見つかりません'); return; } var pos=state.path.length-1; var next=sol[pos+1]; if(next==null){ showToast('最終マスです'); return; } Engine.flashCell(next); }
  function showSolution(){ var sol=Generator&&Generator.solveOnePath? Generator.solveOnePath() : null; if(!sol){ showToast('解が見つかりません'); return; } var target=Engine.usableCount(); state.path=sol.slice(0,target); state.visited=new Set(state.path); state.lastCell=state.path[state.path.length-1]; Engine.draw(); showToast('解答を表示しました'); }

  function onWin(){ showToast('クリア！'); state.cleared=true; if(winOverlay) winOverlay.hidden=false; updateButtons(); if(showToast._timer){ clearTimeout(showToast._timer); showToast._timer=null; } setTimeout(function(){ toast.hidden=true; },1100); }

  function bind(){
    Engine.canvas.addEventListener('mousedown', onPointerDown); window.addEventListener('mousemove', onPointerMove); window.addEventListener('mouseup', onPointerUp);
    Engine.canvas.addEventListener('touchstart', onPointerDown, {passive:true}); Engine.canvas.addEventListener('touchmove', onPointerMove, {passive:true}); Engine.canvas.addEventListener('touchend', onPointerUp, {passive:true});

    btnReset.addEventListener('click', function(){ resetPlay(); });
    btnNew.addEventListener('click', function(){ generate(); });
    btnNext.addEventListener('click', function(){ state.level++; localStorage.setItem('oneStroke.level', String(state.level)); regen(true); });
    btnGiveUp.addEventListener('click', function(){ resetPlay(); showToast('リセットしました'); });
    btnHint.addEventListener('click', hint);
    btnSolver.addEventListener('click', showSolution);

    btnUndo.addEventListener('click', function(){ if(state.cleared) return; if(state.path.length<=1){ showToast('最初のマスです'); return; } var last=state.path.pop(); state.visited.delete(last); state.lastCell=state.path[state.path.length-1]; updateButtons(); Engine.draw(); });

    winAgain.addEventListener('click', function(){ if(winOverlay) winOverlay.hidden=true; generate(); });
    winNext.addEventListener('click', function(){ if(winOverlay) winOverlay.hidden=true; state.level++; localStorage.setItem('oneStroke.level', String(state.level)); regen(true); });
    winClose.addEventListener('click', function(){ if(winOverlay) winOverlay.hidden=true; });

    btnLevelReset.addEventListener('click', function(){
      if(!window.confirm('レベルを1にリセットします。よろしいですか？')) return;
      state.level=1; localStorage.setItem('oneStroke.level','1');
      regen(true); showToast('レベルを1にリセットしました');
    });

    showWallsChk.checked=(localStorage.getItem('oneStroke.showWalls')||'true')!=='false';
    showWallsChk.addEventListener('change', function(){ localStorage.setItem('oneStroke.showWalls', String(showWallsChk.checked)); Engine.draw(); });

    var d=parseFloat(localStorage.getItem('oneStroke.density')||'0.18'); if(!(d>=0)) d=0.18; if(d>0.45) d=0.45; densityInput.value=String(d); densityVal.textContent=d.toFixed(2);
    var densityTimer=null;
    densityInput.addEventListener('input', function(){
      var v=parseFloat(densityInput.value||'0'); if(v<0) v=0; if(v>0.45) v=0.45; localStorage.setItem('oneStroke.density', String(v)); densityVal.textContent=v.toFixed(2);
      if(densityTimer) clearTimeout(densityTimer); densityTimer=setTimeout(function(){ generate(); Engine.draw(); },60);
    });

    window.addEventListener('resize', Engine.fit);
    window.addEventListener('orientationchange', Engine.fit);
    window.addEventListener('load', Engine.fit);

    updateButtons();
  }

  (function init(){
    Engine.init();
    state.seedStr=Engine.load('seed',''); if(state.seedStr) seedInput.value=state.seedStr;
    bind();
    new ResizeObserver(Engine.fit).observe(Engine.wrap);
    requestAnimationFrame(function(){ Engine.fit(); regen(!state.seedStr); setTimeout(Engine.fit,50); });
  })();
})();