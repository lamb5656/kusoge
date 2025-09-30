export const CONFIG = {
  // 物理（塩）
  gravity: 3200,
  particleRadius: 1.0,
  spawnPerSecond: 100,
  spawnJitterX: 6,
  maxParticles: 10000,

  // 速度抑制
  particleVTerminal: 350,
  particleHDrag: 2.2,
  spawnVxJitter: 20,

  // 線
  lineThickness: 4,
  lineFriction: 0.14,
  lineBounce: 0.0,

  // CCD
  collisionThickness: 6,
  particleSubstepsMax: 6,
  ccdMaxIterations: 3,
  ccdEpsilon: 0.4,

  // 球体
  shrinkPerHit: 0.06,
  minRadiusToExplode: 14,
  baseRadius: 15,
  growPerStage: 1.5,
  groundYMargin: 96,

  // 破片
  fragCount: 28,
  fragSpeedMin: 600,
  fragSpeedMax: 1200,
  fragRadius: 1,
  fragLife: 1.2,
  fragDrag: 0.98,

  // グリッド
  gridSize: 40,
  spawnTopMargin: 12,

  // 球体 横移動
  kickPerHit: 36,
  sphereFriction: 3.2,
  sphereVxMax: 260,
  wallBounce: 0.22,

  // ぷるぷる
  sbNodeCount: 28,
  sbKCenter: 120,
  sbKNeighbor: 60,
  sbDamping: 6.0,
  sbImpulsePerHit: 8.0,
  sbImpulseSpread: 2,

  // ====== ハイトマップ ======
  pileCellSize: 3,

  // ★ 横流れを弱めて中央に溜まりやすく
  pileMaxSlopePx: 3.2,     // 許容勾配UP（尖りを保持）
  pileRelaxRate: 0.35,     // 移送率DOWN（流しすぎ防止）
  pileRelaxBudget: 6000,   // 1フレームで流せる回数を制限
  pileRelaxIterations: 10, // 呼び出し互換のため残す

  // 堆積（置き方）
  depositHeightPerGrain: 0.9,
  depositKernelRadiusPx: 28,

  // 地形クランプ（面押し戻し）
  surfaceClampEps: 1.0,

  canvasMaxHeightPx: 420,

  // ★ 追加：クリップ（侵食）で削れた塩 → 玉のダメージ換算
  erosionShrinkPerPx: 0.02,       // 削れた“高さpx”あたりの玉半径の減少量
  erosionShrinkMinTriggerPx: 0.6  // このフレーム合計で削れ量がこの値を超えたら適用


};
