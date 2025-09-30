import { CONFIG } from './config.js';

export const DPR = Math.max(1, window.devicePixelRatio || 1);

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d', { alpha: false });

export const ui = {
  level: document.getElementById('stat-level'),
  lines: document.getElementById('stat-lines'),
  salt:  document.getElementById('stat-salt'),
  fps:   document.getElementById('stat-fps'),
  btnClear: document.getElementById('btn-clear'),
  btnReset: document.getElementById('btn-reset'),
};

export const state = {
  particles: [],                 // {x,y,vx,vy,alive}
  segments: [],                  // {x1,y1,x2,y2,alive}
  grid: new Map(),               // "gx|gy" -> segment[]
  drawing: false,
  lastDrawPt: null,
  pointerId: null,

  level: 1,
  groundY: 0,

  sphere: {
    x: 0, y: 0, vx: 0, vy: 0,
    radius: CONFIG.baseRadius,
    targetY: 0,
    state: 'idle',              // 'falling' | 'idle' | 'explode'
    frags: [],
    // ぷるぷる用ノード（角度ごとに半径方向のオフセットと速度）
    nodes: []                   // [{ang, off, vel}]
  },

  runtime: {
    spawnCarry: 0,
    lastTime: performance.now(),
    fpsSmoother: 60,
    frameCount: 0,
  }
};
