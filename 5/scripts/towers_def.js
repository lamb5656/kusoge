// scripts/towers_def.js
// 塔タイプ定義（ショップUIに表示）
export const TOWERS = {
  cannon:  { id:"cannon",  name:"キャノン",  desc:"標準的な単体攻撃。",        cost:100, baseRange:130, cd:0.5, dmg:12, proj: { kind:"bullet", speed:420 }, color:"#a78bfa" }, // 紫
  bomb:    { id:"bomb",    name:"ボム",     desc:"着弾点に範囲ダメージ。",      cost:150, baseRange:110, cd:1.2, dmg:20, proj: { kind:"aoe",    speed:300, aoeR:48 }, color:"#f59e0b" }, // アンバー
  ice:     { id:"ice",     name:"アイス",   desc:"スロー効果を付与。",          cost:120, baseRange:120, cd:0.7, dmg:6,  proj: { kind:"bullet", speed:380, slowMul:0.65, slowT:2.5 }, color:"#60a5fa" }, // 青
  poison:  { id:"poison",  name:"ポイズン", desc:"継続ダメージを付与。",        cost:140, baseRange:120, cd:0.4, dmg:4,  proj: { kind:"bullet", speed:360, poisonDPS:12, poisonT:2.5 }, color:"#10b981" }, // 緑
  sniper:  { id:"sniper",  name:"スナイパー", desc:"超射程・高威力だが遅い。",   cost:200, baseRange:220, cd:1.4, dmg:50, proj: { kind:"bullet", speed:540 }, color:"#ef4444" }, // 赤
};
