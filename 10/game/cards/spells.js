export const SPELL_CARDS = [
  { id: "s_bolt",     name: "魔力の矢",        type: "spell", cost: 2, effect: [ { kind: "damage", n: 2, target: "face" } ] },
  { id: "s_missile",  name: "マジック・ミサイル", type: "spell", cost: 2, effect: [ { kind: "damage", n: 2, target: 0 } ] },
  { id: "s_bless",    name: "祝福",            type: "spell", cost: 2, effect: [ { kind: "buffAttack", n: 1, target: 0, self: true } ] },
  { id: "s_heal",     name: "回復",            type: "spell", cost: 2, effect: [ { kind: "heal", n: 3, target: "face" } ] },
  { id: "s_draw",     name: "洞察",            type: "spell", cost: 1, effect: [ { kind: "draw", n: 2 } ] },
  { id: "s_fireball", name: "ファイアボール",  type: "spell", cost: 4, effect: [ { kind: "damage", n: 4, target: "face" } ] },
];
