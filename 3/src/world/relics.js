
export const RELICS_POOL = [
  {
    id: 'twin_tails',
    name: '猫又の二尾',
    desc: 'クリティカル上限+50%。クリ時に追加の10%一撃。',
    hooks: {
      onGain(ctx){
        ctx.state.player.critCap = (ctx.state.player.critCap || 0.5) + 0.5;
      },
      onAfterAttack(ctx){
        if (ctx.lastHit && ctx.lastHit.attacker === 'player' && ctx.lastHit.wasCrit && ctx.lastHit.damage > 0){
          const extra = Math.max(1, Math.floor(ctx.lastHit.damage * 0.10));
          ctx.state.enemy.hp = Math.max(0, ctx.state.enemy.hp - extra);
          ctx.log(`猫又の二尾: 追加ダメージ +${extra}`);
        }
      }
    }
  },
  {
    id: 'moon_honey',
    name: '月光の蜜',
    desc: 'オーバーヒールがシールド化（最大HPの15%まで）。',
    hooks: {
      onHeal(ctx){
        const p = ctx.state.player;
        const overflow = Math.max(0, p.hp - p.maxHp);
        if (overflow > 0){
          const cap = Math.floor(p.maxHp * 0.15 * (1 + (ctx.state.metaUpgrades.barrier || 0)));
          p.hp = p.maxHp;
          p.shield = Math.min(cap, (p.shield || 0) + overflow);
          ctx.log(`オーバーヒール→シールド +${overflow}（上限 ${cap}）`);
        }
      },
      onBeforeDamageTaken(ctx){
        if (ctx.target === 'player' && ctx.amount > 0){
          const p = ctx.state.player;
          const sh = p.shield || 0;
          if (sh > 0){
            const block = Math.min(sh, ctx.amount);
            p.shield = sh - block;
            ctx.amount -= block;
            ctx.log(`シールドが ${block} を軽減`);
          }
        }
      }
    }
  },
  {
    id: 'soul_gear',
    name: '魂の歯車',
    desc: 'ターン毎にSPD+1%（最大+30%）。',
    hooks: {
      onTurnEnd(ctx){
        const b = ctx.state.player.bonusSpdPct || 0;
        if (b < 0.30){
          ctx.state.player.bonusSpdPct = Math.min(0.30, b + 0.01);
          ctx.log(`魂の歯車: 速度ボーナス ${(ctx.state.player.bonusSpdPct*100).toFixed(0)}%`);
        }
      }
    }
  },
  {
    id: 'lucky_token',
    name: '幸運の護符',
    desc: 'クリティカル率 +10%。',
    hooks: {
      onGain(ctx){
        ctx.state.player.critRate += 0.10;
      }
    }
  },
  {
    id: 'steel_plating',
    name: '鋼の外装',
    desc: 'DEF +3。',
    hooks: {
      onGain(ctx){
        ctx.state.player.def += 3;
      }
    }
  },
  {
    id: 'sharp_fang',
    name: '鋭い牙',
    desc: 'ATK +4。',
    hooks: {
      onGain(ctx){
        ctx.state.player.atk += 4;
      }
    }
  }
];
