// Small math helpers
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
