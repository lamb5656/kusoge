
export function enemyForFloor(floor){
  const base = 60 + floor*6;
  return {
    name: `影の徘徊者 Lv.${floor}`,
    maxHp: base,
    hp: base,
    atk: 10 + Math.floor(floor*1.2),
    def: 4 + Math.floor(floor*0.6),
    spd: 10 + Math.floor(floor*0.2),
    critRate: 0.05 + Math.min(0.25, floor*0.002),
    critMult: 1.5
  };
}
