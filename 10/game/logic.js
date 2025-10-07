// Core rules processing
import { MAX_ROW } from "./constants.js";
import { applySpell } from "./effectEngine.js";

export function canPlayCard(state, who, handIdx) {
  if (state.turn !== who) return false;
  const p = state.players[who];
  const card = p.hand[handIdx];
  if (!card) return false;
  if (card.cost > p.mana) return false;
  if (card.type === "unit" && p.row.length >= MAX_ROW) return false;
  return true;
}

export function playCard(state, who, handIdx) {
  const p = state.players[who];
  const card = p.hand.splice(handIdx, 1)[0];
  p.mana -= card.cost;
  if (card.type === "unit") {
    p.row.push({ name: card.name, atk: card.atk, hp: card.hp, canAttack: false });
  } else if (card.type === "spell") {
    applySpell(state, who, card.effect, { source: card });
  }
}

export function endTurn(state) {
  // Allow new units to attack next turn
  for (const u of state.players[state.turn].row) u.canAttack = true;
}

export function attackWithUnit(state, who, attackerIdx, targetIdx) {
  if (state.turn !== who) return;
  const me = state.players[who];
  const opp = state.players[who === "A" ? "B" : "A"];
  const a = me.row[attackerIdx];
  if (!a || !a.canAttack) return;
  if (typeof targetIdx === "number") {
    const t = opp.row[targetIdx];
    if (!t) return;
    t.hp -= a.atk;
    a.hp -= t.atk;
    a.canAttack = false;
    if (t.hp <= 0) opp.row.splice(targetIdx, 1);
    if (a.hp <= 0) me.row.splice(attackerIdx, 1);
  } else if (targetIdx === "face") {
    opp.hp -= a.atk;
    a.canAttack = false;
  }
}
