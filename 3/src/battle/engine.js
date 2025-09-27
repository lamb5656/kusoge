
import { clamp } from '../core/math.js';

export function runBattle(state, hooks, rng, pushLog){
  const player = state.player;
  const enemy  = state.enemy;

  const ctxBase = { state, log: pushLog, metaUpgrades: state.metaUpgrades };

  for (const r of state.relics){
    if (r.hooks?.onBattleStart){
      r.hooks.onBattleStart({ ...ctxBase });
    }
  }

  let turn = 0;
  let pGauge = 0; let eGauge = 0;
  const speed = () => {
    const b = player.bonusSpdPct || 0;
    return Math.max(1, Math.floor(player.spd * (1 + b)));
  };

  while (player.hp > 0 && enemy.hp > 0 && turn < 5000){
    pGauge += Math.max(1, speed());
    eGauge += Math.max(1, enemy.spd);

    while ((pGauge >= 100 || eGauge >= 100) && player.hp > 0 && enemy.hp > 0){
      if (pGauge >= eGauge){
        pGauge -= 100;
        actOnce('player');
      } else {
        eGauge -= 100;
        actOnce('enemy');
      }
    }
    turn++;
  }

  const win = enemy.hp <= 0 && player.hp > 0;
  return { win, turns: turn };

  function actOnce(side){
    if (side === 'player'){
      const ctx = { ...ctxBase, actor: 'player', target: 'enemy', amount: 0, lastHit: null };
      const dmg = computeDamage(player, enemy, rng, hooks, ctx);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      pushLog(`あなたの攻撃: ${dmg} ダメージ (敵HP: ${enemy.hp}/${enemy.maxHp})`);
      ctx.lastHit = { attacker: 'player', damage: dmg, wasCrit: ctx._wasCrit || false };
      if (hooks?.onAfterAttack) hooks.onAfterAttack(ctx);
      if (hooks?.onTurnEnd) hooks.onTurnEnd(ctx);
    } else {
      const ctx = { ...ctxBase, actor: 'enemy', target: 'player', amount: 0, lastHit: null };
      let dmg = computeDamage(enemy, player, rng, hooks, ctx);
      let amount = dmg;
      if (hooks?.onBeforeDamageTaken){
        ctx.amount = amount;
        hooks.onBeforeDamageTaken(ctx);
        amount = Math.max(0, Math.floor(ctx.amount));
      }
      player.hp = Math.max(0, player.hp - amount);
      pushLog(`敵の攻撃: ${amount} ダメージ (あなたのHP: ${player.hp}/${player.maxHp}${player.shield?` +S${player.shield}`:''})`);
      ctx.lastHit = { attacker: 'enemy', damage: amount, wasCrit: ctx._wasCrit || false };
      if (hooks?.onAfterAttack) hooks.onAfterAttack(ctx);
      if (hooks?.onTurnEnd) hooks.onTurnEnd(ctx);
    }
  }
}

function computeDamage(attacker, defender, rng, hooks, ctx){
  const base = Math.max(1, attacker.atk - Math.floor(defender.def * 0.7));
  const cr = Math.max(0, Math.min(attacker.critRate, (attacker.critCap || 0.5)));
  const isCrit = rng() < cr;
  ctx._wasCrit = isCrit;
  let dmg = base * (isCrit ? attacker.critMult : 1);
  dmg = Math.floor(dmg);
  return Math.max(1, dmg);
}
