import { spawnEnemy } from "./enemies.js";
import { showToast } from "./dom.js";


export function createSpawner(getWaveConfig, state){
return {
running:false, cfg:null, count:0, t:0, bossSpawned:false,
beginWave(n){
const { base, boss } = getWaveConfig(n);
this.running = true; this.cfg = { base, boss }; this.count = 0; this.t = 0; this.bossSpawned = false;
},
update(dt){
if (!this.running) return;
this.t += dt;
if (this.count < this.cfg.base.count && this.t >= this.cfg.base.spawnInterval){
this.t = 0; this.count++; spawnEnemy(this.cfg.base.hp, this.cfg.base.speed, state);
}
// 通常終了後にボス1体
if (this.count >= this.cfg.base.count && !this.bossSpawned && this.cfg.boss){
this.bossSpawned = true; spawnEnemy(this.cfg.boss.hp, this.cfg.boss.speed, state);
}
if (this.count >= this.cfg.base.count && state.enemiesAlive <= 0 && (!this.cfg.boss || this.bossSpawned)){
this.running = false; showToast(`ウェーブ ${state.wave} クリア！`);
}
}
};
}