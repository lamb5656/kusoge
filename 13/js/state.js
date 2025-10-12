export const state = {
  ws: null,
  me: null,
  world: { w: 2000, h: 2000 },
  players: new Map(),
  enemies: [],
  bullets: [],
  orbs: [],          // ★ XPオーブ
  cam: { x: 0, y: 0 },
  seq: 0,
  myGhost: null,
  pendingChoices: null,
};
