
export function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
export function randInt(rng, min, max){
  return Math.floor(rng() * (max - min + 1)) + min;
}
export function choice(rng, arr){
  return arr[Math.floor(rng() * arr.length)];
}
export function formatNum(n){
  if (typeof n === 'number') {
    if (!isFinite(n)) return '∞';
    if (Math.abs(n) < 1000) return String(Math.round(n));
    const units = ['K','M','B','T','Q'];
    let u = -1;
    let v = Math.abs(n);
    while (v >= 1000 && u < units.length-1){ v /= 1000; u++; }
    return (n < 0 ? '-' : '') + v.toFixed(1).replace(/\.0$/, '') + units[u];
  }
  return String(n);
}
