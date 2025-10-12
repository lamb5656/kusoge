// public/assets.js
export const assets = {};

// どこに置いても壊れないように import.meta.url から絶対URL生成にゃ
function img(path) { return new URL(`./img/${path}`, import.meta.url).href; }

const paths = {
  player:         img("player.png"),
  shadow:         img("shadow.png"),
  enemy_chaser:   img("enemy_chaser.png"),
  enemy_dasher:   img("enemy_dasher.png"),
  enemy_tank:     img("enemy_tank.png"),
  enemy_weaver:   img("enemy_weaver.png"),
  enemy_splitter: img("enemy_splitter.png"),
  enemy_mini:     img("enemy_mini.png"),
};

for (const [key, src] of Object.entries(paths)) {
  const im = new Image();
  im.src = src;
  if (im.decode) im.decode().catch(()=>{});
  assets[key] = im;
}

// デバッグしたい時はコメントアウト外すにゃ
// for (const [k,v] of Object.entries(assets)) v.addEventListener("error", ()=>console.warn("Image load failed:", k, v.src));
