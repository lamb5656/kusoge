// scripts/save.js
const KEY_NEW = "tdx-save-v2";
const KEY_OLD = "tdx-save";

function toNum(v, def = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function saveGame(state){
  const data = {
    gold:  toNum(state.gold),
    lives: toNum(state.lives, 12),
    wave:  toNum(state.wave,  0),
    ts: Date.now(),
    v: 2,
  };
  localStorage.setItem(KEY_NEW, JSON.stringify(data));
}

export function loadGame(state){
  // まず新キーを試し、無ければ旧キーを読む
  const raw = localStorage.getItem(KEY_NEW) ?? localStorage.getItem(KEY_OLD);
  if (!raw) return false;

  try{
    const d = JSON.parse(raw);
    const gold  = toNum(d.gold);
    const lives = toNum(d.lives, 12);
    const wave  = toNum(d.wave, 0);

    state.gold  = gold;
    state.lives = lives;
    state.wave  = wave;

    // 旧キーから来た場合は新キーに書き戻して移行完了
    if (!localStorage.getItem(KEY_NEW)){
      localStorage.setItem(KEY_NEW, JSON.stringify({ gold, lives, wave, ts: Date.now(), v: 2 }));
    }
    return true;
  }catch{
    return false;
  }
}
