// Minimal effect executor. Effects are arrays of {kind, n, target}
// kinds: damage, heal, draw, buffAttack, buffHealth

import { draw } from "./state.js";

export function applySpell(state, who, effect, ctx) {
  for (const e of effect) {
    switch (e.kind) {
      case "damage":
        damageTarget(state, who, e);
        break;
      case "heal":
        healTarget(state, who, e);
        break;
      case "draw":
        for (let i = 0; i < (e.n ?? 1); i++) draw(state, who);
        break;
      case "buffAttack":
      case "buffHealth":
        buffTarget(state, who, e);
        break;
    }
  }
}

function damageTarget(state, who, e) {
  const opp = who === "A" ? "B" : "A";
  if (e.target === "face") {
    state.players[opp].hp -= e.n;
  } else if (typeof e.target === "number") {
    const u = state.players[opp].row[e.target];
    if (u) { u.hp -= e.n; if (u.hp <= 0) state.players[opp].row.splice(e.target, 1); }
  }
}

function healTarget(state, who, e) {
  if (e.target === "face") {
    state.players[who].hp += e.n;
  }
}

function buffTarget(state, who, e) {
  const opp = who === "A" ? "B" : "A";
  const side = e.self ? who : opp;
  const u = state.players[side].row[e.target];
  if (!u) return;
  if (e.kind === "buffAttack") u.atk += e.n;
  if (e.kind === "buffHealth") u.hp += e.n;
}
