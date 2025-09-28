export const $ = (sel) => document.querySelector(sel);


export const canvas = $("#game");
export const ctx = canvas.getContext("2d", { alpha: true });


export const elGold = $("#gold");
export const elLives = $("#lives");
export const elWave = $("#wave");
export const elEnemies = $("#enemies");
export const elFps = $("#fps");


export const btnPlace = $("#btnPlace");
export const btnSell = $("#btnSell");
export const btnStartWave = $("#btnStartWave");
export const btnSpeed = $("#btnSpeed");
export const btnPause = $("#btnPause");
export const btnReset = $("#btnReset");


export const toast = $("#toast");
export const tooltip = $("#tooltip");
export const shopList = $("#shopList");


// Inspector
export const inspectNone = $("#inspectNone");
export const inspectBox = $("#inspectBox");
export const insType = $("#insType");
export const insLv = $("#insLv");
export const insDps = $("#insDps");
export const insRange = $("#insRange");
export const btnUpgrade = $("#btnUpgrade");
export const btnSellOne = $("#btnSellOne");
export const insHint = $("#insHint");


export function showToast(msg){
toast.textContent = msg;
toast.style.opacity = "1";
toast.style.transform = "translateX(-50%) translateY(0)";
clearTimeout(showToast._t);
showToast._t = setTimeout(()=>{
toast.style.opacity = "0";
toast.style.transform = "translateX(-50%) translateY(-6px)";
}, 1400);
}