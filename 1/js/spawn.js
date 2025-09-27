// Spawn rows: two side-by-side walls per row
import { state } from "./state.js";
import { randInt, choice } from "./math.js";

export function spawnInitial() {
  spawnRow(0);
}

export function maybeSpawnRow() {
  const lastY = state.walls.length ? state.walls[state.walls.length - 1].y : 0;
  if (lastY > -state.spawnEvery) spawnRow(state.spawnEvery);
}

function spawnRow(offsetY) {
  const baseY = -offsetY - 40;
  // Choose a pair type. Mostly (+ vs -). Sometimes (R+ vs R-). Rarely include neutral block.
  const pairs = [
    ["plus", "minus"], ["minus", "plus"],           // common
    ["rapidPlus", "rapidMinus"], ["rapidMinus", "rapidPlus"], // sometimes
    ["plus", "block"], ["block", "plus"],           // rare spice
  ];
  const pair = weightedChoice(pairs, [4, 4, 1, 1, 1, 1]);

  // HP scales; power/rapid walls are a bit softer
  const base = 10 + Math.floor(6 * state.difficulty);
  const make = (side, type) => {
    const soft = (type === "plus" || type === "minus" || type === "rapidPlus" || type === "rapidMinus");
    const hp = soft ? randInt(Math.max(5, base - 4), base + 2) : randInt(base, base + 10);
    const w = { y: baseY - 260, hp, max: hp, side, type, broken: false, alpha: 1 };
    if (type === "plus") w.amount = randInt(2 + Math.floor(state.difficulty), 6 + Math.floor(2 * state.difficulty));
    if (type === "minus") w.amount = randInt(2, 6 + Math.floor(1.5 * state.difficulty));
    if (type === "rapidPlus") w.amount = 1;
    if (type === "rapidMinus") w.amount = 1;
    return w;
  };

  // Randomly decide which side gets the first element of pair
  const leftType = pair[0];
  const rightType = pair[1];
  state.walls.push(make("L", leftType));
  state.walls.push(make("R", rightType));
}

function weightedChoice(items, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) {
    if ((r -= weights[i]) < 0) return items[i];
  }
  return items[items.length - 1];
}
