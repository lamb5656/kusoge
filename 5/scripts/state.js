export const state = {
  gold: 0,
  lives: 0,
  wave: 0,
  enemiesAlive: 0,
  placeMode: false,
  sellMode: false,
  isPaused: false,
  speed: 1,
  selectedTowerType: "cannon",
  selectedTowerIndex: -1,
  isGameOver: false,

  tech: { cannon:1, bomb:1, ice:1, poison:1, sniper:1 },
};

export const towers = [];  // {x,y,typeId,level,last,costSpent}
export const enemies = [];
export const bullets = [];
