import { choice } from '../core/math.js';

export function nextNodeOptions(rng, floor){
  const pick = [];
  // 通常戦
  pick.push({
    t: 'BATTLE', label: '戦闘', d: '敵と戦う',
    mod: { variant: 'normal' } // ← 追加
  });
  // 精鋭戦（強敵 & 報酬強化）
  if (rng() < 0.65) pick.push({
    t: 'BATTLE', label: '精鋭戦', d: '強敵と戦う',
    mod: { 
      variant: 'elite',
      enemy: { hp: 1.35, atk: 1.15, def: 1.10, spd: 1.05, critRate: +0.05 }, // 敵強化
      reward: { extraRelic: true } // 報酬で遺物+1（後述のrenderRewardで反映）
    }
  });
  // イベント
  if (rng() < 0.55) pick.push({
    t: 'EVENT', label: 'イベント', d: '奇妙な祠'
    // EVENTはmod不要でもOK
  });
  // 埋め草：連戦（軽め強化）
  while (pick.length < 3) pick.push({
    t: 'BATTLE', label: '連戦', d: 'もう一度戦う',
    mod: { variant: 'rush', enemy: { hp: 1.15, atk: 1.05 } }
  });

  // シャッフル
  for (let i = pick.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pick[i], pick[j]] = [pick[j], pick[i]];
  }
  return pick.slice(0, 3);
}
