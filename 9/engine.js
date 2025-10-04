;(function(global){
  'use strict';
  var Engine = {};

  function rndFromSeed(seedStr){
    var h = 1779033703 ^ seedStr.length;
    for(var i=0;i<seedStr.length;i++){
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h<<13) | (h>>>19);
    }
    return function(){
      h = Math.imul(h ^ (h>>>16), 2246822507);
      h = Math.imul(h ^ (h>>>13), 3266489909);
      var t = (h ^= h>>>16)>>>0;
      return t/4294967296;
    };
  }

  var state = {
    level: Number(localStorage.getItem('oneStroke.level') || 1),
    gridW: 3,
    gridH: 3,
    start: 0,
    openEdges: new Map(),
    blocked: new Set(),
    visited: new Set(),
    path: [],
    solvedPath: [],
    dragging: false,
    cleared: false,
    lastCell: null,
    seedStr: '',
    rng: Math.random
  };

  function save(k,v){ localStorage.setItem('oneStroke.'+k, (typeof v==='string') ? v : JSON.stringify(v)); }
  function load(k,d){ var v = localStorage.getItem('oneStroke.'+k); if(v==null) return d; try{ return JSON.parse(v); }catch(e){ return v; } }

  function idx(x,y){ return y*state.gridW + x; }
  function xy(i){ return [i%state.gridW, Math.floor(i/state.gridW)]; }
  function neighbors(i){
    var p = xy(i), x=p[0], y=p[1], out=[];
    if(x>0) out.push(idx(x-1,y));
    if(x<state.gridW-1) out.push(idx(x+1,y));
    if(y>0) out.push(idx(x,y-1));
    if(y<state.gridH-1) out.push(idx(x,y+1));
    return out;
  }
  function edgeKey(a,b){ return (a<b) ? (a+'-'+b) : (b+'-'+a); }
  function isOpen(a,b){ return state.openEdges.has(edgeKey(a,b)); }
  function open(a,b){ state.openEdges.set(edgeKey(a,b), true); }
  function close(a,b){ state.openEdges.delete(edgeKey(a,b)); }
  function isBlocked(i){ return state.blocked.has(i); }
  function usableCount(){ return state.gridW*state.gridH - state.blocked.size; }

  function setLevelSizeFromLevel(){
    var L = state.level;
    var base = 3 + Math.floor((L-1));
    var r = (typeof state.rng === 'function') ? state.rng : Math.random;
    var dx = (r()<0.5 ? -1 : 1) * (r()<0.5 ? 0 : 1);
    var dy = (r()<0.5 ? -1 : 1) * (r()<0.5 ? 0 : 1);
    var w = Math.max(3, base + dx);
    var h = Math.max(3, base + dy);
    state.gridW = w; state.gridH = h;
  }

  var canvas=null, ctx=null, wrap=null, statsEl=null, showWallsChk=null;

  function init(){
    canvas = document.getElementById('stage');
    ctx = canvas.getContext('2d');
    wrap = document.getElementById('stageWrap');
    statsEl = document.getElementById('stats');
    showWallsChk = document.getElementById('showWalls');
    Engine.canvas = canvas; Engine.wrap = wrap;
  }

  function draw(){
    if(!ctx) return;
    var W=canvas.width, H=canvas.height; if(W===0||H===0) return;
    ctx.clearRect(0,0,W,H);
    var nX=state.gridW, nY=state.gridH, cell=Math.min(W/nX, H/nY);
    var padX=(W-cell*nX)/2, padY=(H-cell*nY)/2;
    function center(i){ var p=xy(i), x=p[0], y=p[1]; return [padX+x*cell+cell/2, padY+y*cell+cell/2]; }

    ctx.fillStyle='#0d1624'; ctx.fillRect(0,0,W,H);

    ctx.lineWidth=Math.max(1.25, Math.min(cell*0.03, 2));
    ctx.strokeStyle='#2b3f57';
    for(var gy=0;gy<=nY;gy++){ var yy=padY+gy*cell; ctx.beginPath(); ctx.moveTo(padX,yy); ctx.lineTo(padX+cell*nX,yy); ctx.stroke(); }
    for(var gx=0;gx<=nX;gx++){ var xx=padX+gx*cell; ctx.beginPath(); ctx.moveTo(xx,padY); ctx.lineTo(xx,padY+cell*nY); ctx.stroke(); }

    if(state.blocked.size>0){
      ctx.fillStyle='#05070c';
      for(var y=0;y<nY;y++){
        for(var x=0;x<nX;x++){
          var id=idx(x,y);
          if(isBlocked(id)) ctx.fillRect(padX+x*cell+1, padY+y*cell+1, cell-2, cell-2);
        }
      }
    }

    if(showWallsChk && showWallsChk.checked){
      var bar=Math.max(7, cell*0.24);
      for(var y2=0;y2<nY;y2++){
        for(var x2=0;x2<nX;x2++){
          var a=idx(x2,y2), cx=padX+x2*cell, cy=padY+y2*cell;
          if(x2<nX-1){ var b=idx(x2+1,y2); if(!isOpen(a,b) && !isBlocked(a) && !isBlocked(b)){ ctx.fillStyle='#2a3144'; ctx.fillRect(cx+cell-bar/2, cy+cell*0.06, bar, cell*0.88); ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(cx+cell-bar/2, cy+cell*0.06, 2, cell*0.88); ctx.strokeStyle='rgba(255,95,95,0.9)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(cx+cell-bar*0.2, cy+cell*0.2); ctx.lineTo(cx+cell+bar*0.2, cy+cell*0.8); ctx.moveTo(cx+cell-bar*0.2, cy+cell*0.8); ctx.lineTo(cx+cell+bar*0.2, cy+cell*0.2); ctx.stroke(); }}
          if(y2<nY-1){ var b2=idx(x2,y2+1); if(!isOpen(a,b2) && !isBlocked(a) && !isBlocked(b2)){ ctx.fillStyle='#2a3144'; ctx.fillRect(cx+cell*0.06, cy+cell-bar/2, cell*0.88, bar); ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(cx+cell*0.06, cy+cell-bar/2, cell*0.88, 2); ctx.strokeStyle='rgba(255,95,95,0.9)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(cx+cell*0.2, cy+cell-bar*0.2); ctx.lineTo(cx+cell*0.8, cy+cell+bar*0.2); ctx.moveTo(cx+cell*0.8, cy+cell-bar*0.2); ctx.lineTo(cx+cell*0.2, cy+cell+bar*0.2); ctx.stroke(); }}
        }
      }
    }

    var s=center(state.start); ctx.fillStyle='#00e28a'; ctx.beginPath(); ctx.arc(s[0],s[1], Math.max(8,cell*0.18), 0, Math.PI*2); ctx.fill();

    if(state.path.length>0){
      ctx.lineWidth=Math.max(6,cell*0.16); ctx.strokeStyle='rgba(99,240,177,0.25)';
      ctx.beginPath(); for(var pi=0;pi<state.path.length;pi++){ var c=center(state.path[pi]); if(pi===0) ctx.moveTo(c[0],c[1]); else ctx.lineTo(c[0],c[1]); } ctx.stroke();
      ctx.lineWidth=Math.max(3.5,cell*0.1); ctx.strokeStyle='#63f0b1';
      ctx.beginPath(); for(var pj=0;pj<state.path.length;pj++){ var c2=center(state.path[pj]); if(pj===0) ctx.moveTo(c2[0],c2[1]); else ctx.lineTo(c2[0],c2[1]); } ctx.stroke();
      var t=center(state.path[state.path.length-1]); ctx.fillStyle='#3bd1ff'; ctx.beginPath(); ctx.arc(t[0],t[1], Math.max(6,cell*0.13), 0, Math.PI*2); ctx.fill();
    }

    if(statsEl){
      statsEl.innerHTML = '<span class="chip">レベル: <b>'+state.level+'</b></span>'+
        '<span class="chip">サイズ: <b>'+state.gridW+'×'+state.gridH+'</b></span>'+
        '<span class="chip">進捗: <b>'+state.path.length+'/'+usableCount()+'</b></span>'+
        '<span class="chip">SEED: <b>'+state.seedStr+'</b></span>';
    }
  }

  var fitRetry=0;
  function fit(){
    if(!canvas||!wrap||!ctx) return;
    var w=wrap.clientWidth||0, h=wrap.clientHeight||0;
    if((w===0||h===0) && fitRetry<10){ fitRetry++; setTimeout(fit,50); return; }
    fitRetry=0;
    var dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.floor(w*dpr));
    canvas.height=Math.max(1,Math.floor(h*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  }

  function flashEdge(a,b){ if(!ctx) return; var W=canvas.width,H=canvas.height; if(W===0||H===0) return; var nX=state.gridW,nY=state.gridH; var cell=Math.min(W/nX,H/nY); var padX=(W-cell*nX)/2, padY=(H-cell*nY)/2; var A=xy(a), B=xy(b); var cxA=padX+A[0]*cell+cell/2, cyA=padY+A[1]*cell+cell/2; var cxB=padX+B[0]*cell+cell/2, cyB=padY+B[1]*cell+cell/2; var t=0; var id=setInterval(function(){ t++; if(t>12){ clearInterval(id); draw(); return; } draw(); ctx.save(); ctx.strokeStyle='rgba(255,80,80,'+(1-t/12)+')'; ctx.lineWidth=Math.max(8,cell*0.22); ctx.beginPath(); ctx.moveTo(cxA,cyA); ctx.lineTo(cxB,cyB); ctx.stroke(); ctx.restore(); },16); }
  function flashCell(cellIndex){ if(!ctx) return; var W=canvas.width,H=canvas.height; if(W===0||H===0) return; var nX=state.gridW,nY=state.gridH; var size=Math.min(W/nX,H/nY); var padX=(W-size*nX)/2, padY=(H-size*nY)/2; var p=xy(cellIndex), x=p[0], y=p[1]; var cx=padX+x*size+size/2, cy=padY+y*size+size/2; var t=0; var id=setInterval(function(){ t+=1; if(t>16){ clearInterval(id); draw(); return; } draw(); ctx.beginPath(); ctx.arc(cx,cy, Math.max(9,size*0.2)+t*2, 0, Math.PI*2); ctx.strokeStyle='rgba(59,209,255,'+Math.max(0,1-t/16)+')'; ctx.lineWidth=3; ctx.stroke(); },16); }

  Engine.state=state; Engine.rndFromSeed=rndFromSeed; Engine.save=save; Engine.load=load;
  Engine.idx=idx; Engine.xy=xy; Engine.neighbors=neighbors; Engine.edgeKey=edgeKey; Engine.isOpen=isOpen; Engine.open=open; Engine.close=close; Engine.isBlocked=isBlocked; Engine.usableCount=usableCount;
  Engine.setLevelSizeFromLevel=setLevelSizeFromLevel; Engine.init=init; Engine.draw=draw; Engine.fit=fit; Engine.flashEdge=flashEdge; Engine.flashCell=flashCell;

  global.Engine = Engine;
})(window);