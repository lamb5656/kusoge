// 画像アセットをまとめてロードして、完了したものを assets に保持するにゃ
export const assets = {};
export async function loadAssets(manifest) {
  const entries = Object.entries(manifest);
  await Promise.all(entries.map(([key, src]) => {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { assets[key] = img; res(); };
      img.onerror = (e) => { console.warn("[asset load failed]", key, src, e); res(); };
      img.src = src;
    });
  }));
  return assets;
}
