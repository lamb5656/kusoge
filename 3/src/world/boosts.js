// src/world/boosts.js
// Boostは「消費型」or「次の戦闘限定バフ（tempRelic）」のみ

export const BOOSTS_POOL = [
  // 消費型（その場で消費／恒久ではない）
  {
    id: 'lunar_film',
    name: '月護の膜',
    type: 'consumable',
    desc: 'シールド +40',
    apply: (s) => { s.player.shield = (s.player.shield || 0) + 40; }
  },
  {
    id: 'second_wind',
    name: '深呼吸',
    type: 'consumable',
    desc: 'HP +35（オーバーヒールは遺物があれば変換）',
    apply: (s) => { s.player.hp += 35; }
  },

  // 次の戦闘限定（仮レリックとして1戦だけhooksを有効化）
  {
    id: 'adrenaline',
    name: 'アドレナリン',
    type: 'tempRelic',
    desc: '次の戦闘中 ATK +30',
    relicHooks: {
      onBattleStart(ctx){ ctx.state.player.atk += 30; ctx.log?.('アドレナリン: この戦闘中 ATK +30'); }
    },
    durationBattles: 1
  },
  {
    id: 'iron_skin',
    name: '鉄皮',
    type: 'tempRelic',
    desc: '次の戦闘中 DEF +25',
    relicHooks: {
      onBattleStart(ctx){ ctx.state.player.def += 25; ctx.log?.('鉄皮: この戦闘中 DEF +25'); }
    },
    durationBattles: 1
  },
  {
    id: 'focus',
    name: '集中',
    type: 'tempRelic',
    desc: '次の戦闘中 クリ率 +50%',
    relicHooks: {
      onBattleStart(ctx){ ctx.state.player.critRate += 0.5; ctx.log?.('集中: この戦闘中 クリ率 +50%'); }
    },
    durationBattles: 1
  }
];
