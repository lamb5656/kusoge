
import { choice } from '../core/math.js';

export function nextNodeOptions(rng, floor){
  const arr = [
    { t:'BATTLE', label:'戦闘', d:'敵と戦う' }
  ];
  if (rng() < 0.65) arr.push({ t:'BATTLE', label:'戦闘', d:'強敵と戦う' });
  if (rng() < 0.55) arr.push({ t:'EVENT', label:'イベント', d:'奇妙な祠' });
  while (arr.length < 3) arr.push({ t:'BATTLE', label:'戦闘', d:'もう一度戦う' });
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0,3);
}
