export const Phases = {
  POWDER: "powder",
  TOPPINGS: "toppings",
  POUR: "pour",
  LID_WAIT: "lidWait",
  RESULT: "result",
};

export class GameState {
  constructor(stage) {
    this.stage = stage;
    this.phase = Phases.POWDER;

    // Powder
    this.powder = { A: 0, B: 0 };
    this.spill = 0;
    this.tilt = { A: 0, B: 0 };

    // Board (2-axis)
    this.toppings = [];
    this.boardTilt = { roll: 0, pitch: 15 }; // 左右/奥行き（度）

    // Pour / timing
    this.waterFill = 0;
    this.lidClosedAt = null;
    this.openPressedAt = null;

    this.cleanliness = 1.0;
    this._lastTS = performance.now();
    this.elapsed = 0;
  }

  resetForStage(stage) {
    this.stage = stage;
    this.phase = Phases.POWDER;
    this.powder = { A: 0, B: 0 };
    this.spill = 0;
    this.tilt = { A: 0, B: 0 };
    this.toppings = [];
    this.boardTilt = { roll: 0, pitch: 15 };
    this.waterFill = 0;
    this.lidClosedAt = null;
    this.openPressedAt = null;
    this.cleanliness = 1.0;
    this._lastTS = performance.now();
    this.elapsed = 0;
  }

  setPhase(p) {
    this.phase = p;
  }
}
