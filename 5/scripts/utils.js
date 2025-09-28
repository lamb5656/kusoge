import { TILE, PATH_Y_TOP, PATH_Y_BOTTOM } from "./consts.js";

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const now = () => performance.now() / 1000;


export const inPath = (y) => y >= PATH_Y_TOP && y <= PATH_Y_BOTTOM;
export const worldToCell = (x, y) => ({ cx: Math.floor(x / TILE), cy: Math.floor(y / TILE) });
export const cellToWorld = (cx, cy) => ({ x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 });