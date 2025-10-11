// src/world/relics.js
// 既存の遺物は残しつつ、下に新規を追加。
// 使用フックは既存と同じ: onGain / onAfterAttack / onBeforeDamageTaken / onTurnEnd / onHeal

export const RELICS_POOL = [
  // === 既存 ===
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
    hooks: { onGain(ctx){ ctx.state.player.critRate += 0.10; } }
  },
  {
    id: 'steel_plating',
    name: '鋼の外装',
    desc: 'DEF +3。',
    hooks: { onGain(ctx){ ctx.state.player.def += 3; } }
  },
  {
    id: 'sharp_fang',
    name: '鋭い牙',
    desc: 'ATK +4。',
    hooks: { onGain(ctx){ ctx.state.player.atk += 4; } }
  },

  // === 追加（ここから） ===

  {
    id: 'vampiric_ring',
    name: '吸血の指輪',
    desc: '与ダメの8%を回復（最低1）。',
    hooks: {
      onAfterAttack(ctx){
        if (ctx.lastHit && ctx.lastHit.attacker === 'player' && ctx.lastHit.damage > 0){
          const heal = Math.max(1, Math.floor(ctx.lastHit.damage * 0.08));
          ctx.state.player.hp = Math.min(ctx.state.player.maxHp + (ctx.state.player.shield||0), ctx.state.player.hp + heal);
          ctx.log(`吸血の指輪: 回復 +${heal}`);
        }
      }
    }
  },

  {
    id: 'thorn_brand',
    name: '茨の呪紋',
    desc: '被弾時、受けたダメージの20%を反射。',
    hooks: {
      onAfterAttack(ctx){
        if (ctx.lastHit && ctx.lastHit.attacker === 'enemy' && ctx.lastHit.damage > 0){
          const ret = Math.max(1, Math.floor(ctx.lastHit.damage * 0.20));
          ctx.state.enemy.hp = Math.max(0, ctx.state.enemy.hp - ret);
          ctx.log(`茨の呪紋: 反射ダメージ +${ret}`);
        }
      }
    }
  },

  {
    id: 'swift_boots',
    name: '疾風のブーツ',
    desc: 'ターン毎にSPD+2%（最大+20%）。',
    hooks: {
      onTurnEnd(ctx){
        const b = ctx.state.player.bonusSpdPct || 0;
        if (b < 0.20){
          ctx.state.player.bonusSpdPct = Math.min(0.20, b + 0.02);
          ctx.log(`疾風のブーツ: 速度ボーナス ${(ctx.state.player.bonusSpdPct*100).toFixed(0)}%`);
        }
      }
    }
  },

  {
    id: 'iron_will',
    name: '不屈の意志',
    desc: '被ダメージ -2（最低0）。',
    hooks: {
      onBeforeDamageTaken(ctx){
        if (ctx.target === 'player' && ctx.amount > 0){
          const before = ctx.amount;
          ctx.amount = Math.max(0, ctx.amount - 2);
          const diff = before - ctx.amount;
          if (diff > 0) ctx.log(`不屈の意志: ${diff} 軽減`);
        }
      }
    }
  },

  {
    id: 'hawk_eye',
    name: '鷹の目',
    desc: 'クリ率 +5%、クリ倍 +0.05。',
    hooks: {
      onGain(ctx){
        ctx.state.player.critRate += 0.05;
        ctx.state.player.critMult = (ctx.state.player.critMult || 1.5) + 0.05;
      }
    }
  },

  {
    id: 'overclock_core',
    name: '過負荷コア',
    desc: '攻撃命中毎にATK+1（最大+8）。',
    hooks: {
      onAfterAttack(ctx){
        if (ctx.lastHit && ctx.lastHit.attacker === 'player' && ctx.lastHit.damage > 0){
          const p = ctx.state.player;
          const stacks = p._overclockStacks || 0;
          if (stacks < 8){
            p._overclockStacks = stacks + 1;
            p.atk += 1;
            ctx.log(`過負荷コア: ATK +1（合計 ${p._overclockStacks}/8）`);
          }
        }
      }
    }
  },

  {
    id: 'stone_skin',
    name: '石化皮膜',
    desc: 'DEF +5、SPD -1。',
    hooks: {
      onGain(ctx){
        const p = ctx.state.player;
        p.def += 5;
        p.spd = Math.max(1, p.spd - 1);
      }
    }
  },

  {
    id: 'lucky_coin',
    name: '幸運の小銭',
    desc: 'クリティカル率 +5%。',
    hooks: { onGain(ctx){ ctx.state.player.critRate += 0.05; } }
  },

  {
    id: 'guardian_crest',
    name: '守護紋章',
    desc: '被ダメージを10%軽減（端数切上げ）。',
    hooks: {
      onBeforeDamageTaken(ctx){
        if (ctx.target === 'player' && ctx.amount > 0){
          const before = ctx.amount;
          ctx.amount = Math.max(0, Math.ceil(ctx.amount * 0.9));
          const diff = before - ctx.amount;
          if (diff > 0) ctx.log(`守護紋章: ${diff} 軽減`);
        }
      }
    }
  },

  {
    id: 'cat_tail_charm',
    name: '猫のしっぽ守り',
    desc: 'クリティカル時に固定 +5 追加ダメージ。',
    hooks: {
      onAfterAttack(ctx){
        if (ctx.lastHit && ctx.lastHit.attacker === 'player' && ctx.lastHit.wasCrit && ctx.lastHit.damage > 0){
          const extra = 5;
          ctx.state.enemy.hp = Math.max(0, ctx.state.enemy.hp - extra);
          ctx.log(`猫のしっぽ守り: 追加 +${extra}`);
        }
      }
    }
  },
];
