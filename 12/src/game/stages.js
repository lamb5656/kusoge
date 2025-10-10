// Stage definitions for "Order" mode: boardStock = 在庫, orders = 指示
export const STAGES = [
  {
    id: "tutorial",
    name: "Tutorial",
    target: {
      toppingMode: "order",
      // まな板の在庫（合計 ~10）
      boardStock: [
        { name: "corn", count: 10 },
      ],
      // レシピ指示：「◯個入れろ！」
      orders: [
        { name: "corn", need: 6 },
      ],
      powder: { A: 0.5, B: 0.5, tolerance: 0.12 }, // 粉は従来ルール（表示は出さない）
      waitSeconds: 10,
      fillLine: 0.85,
    },
    timers: { total: 9999, powder: 9999, toppings: 9999, pour: 9999 }, // 実質無制限
    physics: {
      powder: { k: 8.0, n: 1.6, thetaMinDeg: 25 },
      ingredient: { mu: { corn: 0.10, negi: 0.12, menma: 0.14, chashu: 0.18 }, bounce: 0.10 }
    }
  },
  {
    id: "basic",
    name: "Basic",
    target: {
      toppingMode: "order",
      boardStock: [
        { name: "corn", count: 8 },
        { name: "negi", count: 6 },
      ],
      orders: [
        { name: "corn", need: 6 },
        { name: "negi", need: 4 },
      ],
      powder: { A: 0.6, B: 0.4, tolerance: 0.10 },
      waitSeconds: 10,
      fillLine: 0.85,
    },
    timers: { total: 9999, powder: 9999, toppings: 9999, pour: 9999 },
    physics: {
      powder: { k: 8.0, n: 1.8, thetaMinDeg: 25 },
      ingredient: { mu: { corn: 0.10, negi: 0.12, menma: 0.14, chashu: 0.18 }, bounce: 0.10 }
    }
  },
  {
    id: "pro",
    name: "Pro",
    target: {
      toppingMode: "order",
      boardStock: [
        { name: "corn", count: 10 },
        { name: "negi", count: 8 },
        { name: "chashu", count: 1 },
      ],
      orders: [
        { name: "corn", need: 8 },
        { name: "negi", need: 6 },
        { name: "chashu", need: 1 },
      ],
      powder: { A: 0.55, B: 0.45, tolerance: 0.08 },
      waitSeconds: 10,
      fillLine: 0.83,
    },
    timers: { total: 9999, powder: 9999, toppings: 9999, pour: 9999 },
    physics: {
      powder: { k: 8.5, n: 2.0, thetaMinDeg: 25 },
      ingredient: { mu: { corn: 0.10, negi: 0.12, menma: 0.14, chashu: 0.18 }, bounce: 0.08 }
    }
  }
];

export function describeToppings(target) {
  // レシピカードには「◯個入れろ」を表示
  if (target.orders) {
    return target.orders.map(o => `${o.name}×${o.need}`).join(" / ");
  }
  return "-";
}
