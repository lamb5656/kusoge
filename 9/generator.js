;(function(global){
  'use strict';
  var Engine = global.Engine;
  if(!Engine){ console.error('Engine not found'); return; }
  var state = Engine.state;
  var neighbors = Engine.neighbors;
  var open = Engine.open;
  var isOpen = Engine.isOpen;

  function shuffle(arr, r){ for(var i=arr.length-1;i>0;i--){ var j=Math.floor(r()*(i+1)); var t=arr[i]; arr[i]=arr[j]; arr[j]=t; } return arr; }

  function reachableAll(){
    var total = state.gridW*state.gridH; var seen=new Uint8Array(total);
    var start = state.start; if(state.blocked.has(start)) return false;
    var q=[start]; seen[start]=1; var cnt=1;
    while(q.length){ var v=q.shift(); var ns=neighbors(v); for(var i=0;i<ns.length;i++){ var n=ns[i]; if(seen[n]) continue; if(state.blocked.has(n)) continue; seen[n]=1; q.push(n); cnt++; } }
    return cnt === (total - state.blocked.size);
  }

  function solveOnePathBudget(nodeBudget, timeBudgetMs){
    var total = state.gridW*state.gridH; var target = Engine.usableCount();
    var used = new Uint8Array(total); var path = new Int32Array(target);
    var nodes=0; var t0=Date.now();
    path[0]=state.start; used[state.start]=1;
    function deg(v){ var c=0, ns=neighbors(v), i; for(i=0;i<ns.length;i++){ var n=ns[i]; if(!state.blocked.has(n) && isOpen(v,n) && !used[n]) c++; } return c; }
    function step(pos, depth){
      if(depth===target) return true;
      if(++nodes>nodeBudget) return false;
      if((Date.now()-t0)>timeBudgetMs) return false;
      var ns=neighbors(pos), nbrs=[], i;
      for(i=0;i<ns.length;i++){ var n=ns[i]; if(state.blocked.has(n)) continue; if(isOpen(pos,n) && !used[n]) nbrs.push(n); }
      if(nbrs.length===0) return false;
      nbrs.sort(function(a,b){ return deg(a)-deg(b); });
      for(i=0;i<nbrs.length;i++){ var n2=nbrs[i]; used[n2]=1; path[depth]=n2; if(step(n2, depth+1)) return true; used[n2]=0; }
      return false;
    }
    if(step(state.start,1)){
      var out=new Array(target); for(var i=0;i<target;i++) out[i]=path[i]; return out;
    }
    return null;
  }
  function solveOnePath(){
    var n = Engine.usableCount();
    var budget = Math.max(12000, n*1000);
    var timeBudget = Math.max(90, n*5);
    return solveOnePathBudget(budget, timeBudget);
  }

  function applyIrregularShape(r){
    var W=state.gridW, H=state.gridH;
    var notchCount = Math.min(6, 1 + Math.floor((W+H)/6 * 0.4));
    for(var t=0;t<notchCount;t++){
      var side = Math.floor(r()*4);
      var thick = Math.max(1, Math.floor(r()*((W+H)/20)) + 1);
      var lenAxis = (side===0||side===1)? H : W;
      var span = Math.max(2, Math.floor(lenAxis*(0.25 + r()*0.45)));
      var off = Math.floor(r()*(lenAxis - span));
      for(var a=0;a<span;a++){
        for(var b=0;b<thick;b++){
          var x=-1,y=-1;
          if(side===0){ x=b; y=off+a; }
          else if(side===1){ x=W-1-b; y=off+a; }
          else if(side===2){ x=off+a; y=b; }
          else { x=off+a; y=H-1-b; }
          if(x>=0&&y>=0&&x<W&&y<H) state.blocked.add(y*W+x);
        }
      }
    }
  }

  function pickRandomStart(r){
    var W=state.gridW, H=state.gridH, total=W*H;
    var usable=[], border=[];
    for(var i=0;i<total;i++) if(!state.blocked.has(i)) usable.push(i);
    for(var j=0;j<usable.length;j++){ var id=usable[j]; var x=id%W, y=(id/W)|0; if(x===0||y===0||x===W-1||y===H-1) border.push(id); }
    if(border.length && r()<0.6) return border[Math.floor(r()*border.length)];
    return usable.length? usable[Math.floor(r()*usable.length)] : 0;
  }

  function buildAllEdges(){
    state.openEdges.clear();
    var total = state.gridW*state.gridH;
    for(var i=0;i<total;i++){
      if(state.blocked.has(i)) continue;
      var ns=neighbors(i);
      for(var k=0;k<ns.length;k++){
        var n=ns[k]; if(state.blocked.has(n)) continue; if(n>i) open(i,n);
      }
    }
  }

  function openOnlyPathAndBranches(sol, r, dens){
    state.openEdges.clear();
    var onPath = {};
    for(var i=0;i<sol.length-1;i++){
      var a=sol[i], b=sol[i+1];
      if(a===b) continue;
      open(a,b);
      var k=(a<b? a+'-'+b : b+'-'+a);
      onPath[k]=true;
    }
    var total = state.gridW*state.gridH, cands=[];
    for(var v=0; v<total; v++){
      if(state.blocked.has(v)) continue; var ns=neighbors(v);
      for(var j=0;j<ns.length;j++){
        var u=ns[j]; if(state.blocked.has(u)) continue; if(u>v){ var kk=(v<u? v+'-'+u : u+'-'+v); if(!onPath[kk]) cands.push([v,u]); }
      }
    }
    shuffle(cands, r);
    var p=Math.min(1, Math.max(0, dens/0.45));
    var branchRatio=0.60*(1-p)+0.10;
    var extra=Math.min(Math.floor(cands.length*branchRatio), cands.length);
    for(var e=0; e<extra; e++){ var pair=cands[e]; open(pair[0], pair[1]); }
  }

  function genRandomWalls(){
    var r=state.rng||Math.random;
    var total=state.gridW*state.gridH;
    var dens=parseFloat(localStorage.getItem('oneStroke.density')||'0.18');
    if(!(dens>=0)) dens=0.18; if(dens>0.45) dens=0.45;

    var attempt=0, maxAttempts=16;
    while(attempt++<maxAttempts){
      state.blocked.clear();
      applyIrregularShape(r);
      state.start = pickRandomStart(r);
      var targetBlocks=Math.min(Math.floor(total*dens), total-1-state.blocked.size);
      var picks=0, guard=0;
      while(picks<targetBlocks && guard++<total*4){
        var pick=Math.floor(r()*total);
        if(pick===state.start || state.blocked.has(pick)) continue;
        state.blocked.add(pick); picks++;
      }
      if(!reachableAll()){ state.blocked.clear(); dens*=0.9; continue; }
      buildAllEdges();
      var n=Engine.usableCount(); var budget=Math.max(12000, n*1000); var timeBudget=Math.max(90, n*5);
      var sol=solveOnePathBudget(budget, timeBudget);
      if(sol){ openOnlyPathAndBranches(sol, r, dens); state.solvedPath=sol.slice(); return; }
      dens*=0.9;
    }

    state.blocked.clear(); applyIrregularShape(r); state.start = pickRandomStart(r);
    buildAllEdges();
    var sol2=solveOnePath(); if(sol2){ openOnlyPathAndBranches(sol2, r, dens); state.solvedPath=sol2.slice(); return; }

    state.blocked.clear();
    buildAllEdges();
    var W=state.gridW, H=state.gridH, serp=[], x,y;
    for(y=0;y<H;y++){ if(y%2===0){ for(x=0;x<W;x++) serp.push(y*W+x);} else { for(x=W-1;x>=0;x--) serp.push(y*W+x);} }
    state.start = serp[0];
    openOnlyPathAndBranches(serp, r, 0.1);
    state.solvedPath=serp.slice();
  }

  global.Generator = { genRandomWalls:genRandomWalls, solveOnePath:solveOnePath };
})(window);