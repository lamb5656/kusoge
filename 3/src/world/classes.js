
export const CLASSES = [
  {
    id: 'rogue',
    name: '盗賊',
    desc: '素早い連撃。SPDが高くATKは中程度。',
    base: { hp: 85, atk: 16, def: 5, spd: 14, critRate: 0.15, critMult: 1.7 }
  },
  {
    id: 'knight',
    name: '騎士',
    desc: '堅牢。HPとDEFが高いが遅い。',
    base: { hp: 115, atk: 14, def: 10, spd: 9, critRate: 0.08, critMult: 1.6 }
  },
  {
    id: 'seer',
    name: '祈祷師',
    desc: '幸運と伸びしろの使い手。',
    base: { hp: 95, atk: 15, def: 6, spd: 11, critRate: 0.12, critMult: 1.75 }
  },
  {
    id: 'alchemist',
    name: '錬金術師',
    desc: '遺物との相性に優れる。継戦力あり。',
    base: { hp: 100, atk: 14, def: 6, spd: 11, critRate: 0.1, critMult: 1.7 }
  }
];
