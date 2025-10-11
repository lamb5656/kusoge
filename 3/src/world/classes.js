// src/world/classes.js
export const CLASSES = [
  // 既存4職
  { id: 'rogue',    name: '盗賊',   desc: '素早い連撃。SPDが高くATKは中程度。', base: { hp: 85,  atk: 16, def: 5,  spd: 14, critRate: 0.15, critMult: 1.7 } },
  { id: 'knight',   name: '騎士',   desc: '堅牢。HPとDEFが高いが遅い。',         base: { hp: 115, atk: 14, def: 10, spd: 9,  critRate: 0.08, critMult: 1.6 } },
  { id: 'seer',     name: '祈祷師', desc: '幸運と伸びしろの使い手。',             base: { hp: 95,  atk: 15, def: 6,  spd: 11, critRate: 0.12, critMult: 1.75 } },
  { id: 'alchemist',name: '錬金術師', desc:'遺物との相性に優れる。継戦力あり。',   base: { hp: 100, atk: 14, def: 6,  spd: 11, critRate: 0.10, critMult: 1.7 } },
  { id: 'samurai',  name: '侍',     desc: '高ATKと高クリ倍。安定した斬撃。',       base: { hp: 100, atk: 18, def: 6,  spd: 12, critRate: 0.12, critMult: 1.8 } },
  { id: 'berserker',name: '狂戦士', desc: '攻め特化。紙装甲だが手数と会心に長ける。', base: { hp: 90,  atk: 20, def: 4,  spd: 12, critRate: 0.18, critMult: 1.6 } },
  { id: 'sentinel', name: '守護者', desc: '鉄壁の防御。遅いがHP/DEFが極めて高い。', base: { hp: 125, atk: 13, def: 12, spd: 8,  critRate: 0.06, critMult: 1.5 } },
  { id: 'ranger',   name: '狩人',   desc: '俊敏と会心で削る。軽装の技巧派。',       base: { hp: 90,  atk: 15, def: 5,  spd: 14, critRate: 0.20, critMult: 1.6 } },
  { id: 'monk',     name: '武僧',   desc: '均整の取れた格闘。長期戦で強い。',       base: { hp: 100, atk: 16, def: 8,  spd: 12, critRate: 0.10, critMult: 1.75 } },
  { id: 'witch',    name: '魔女',   desc: '高会心倍率の技巧魔撃。',               base: { hp: 95,  atk: 17, def: 5,  spd: 11, critRate: 0.14, critMult: 1.85 } },
];
