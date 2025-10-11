// src/world/events.js
// 汎用イベント定義。Accept/Declineの2択UIに合わせてテキストと効果を返す。

import { RELICS_POOL } from './relics.js';

function pickRelic(rng){
  const i = Math.max(0, Math.floor(rng() * RELICS_POOL.length)) % RELICS_POOL.length;
  return RELICS_POOL[i];
}

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

export function pickEvent(rng, run, meta){
  const p = run.player;

  const pool = [
    // 1) 回復の祠（既存強化版）
    {
      id: 'healing_shrine',
      weight: 3,
      text: () => '静かな祠が温かな光を放っている。癒やしを受ける？（HP +30%／オーバーヒールは「月光の蜜」でシールド化）',
      accept: () => {
        const heal = Math.floor(p.maxHp * 0.3);
        p.hp += heal;
        for (const r of run.relics){
          if (r.hooks?.onHeal){
            r.hooks.onHeal({ state: run, log: ()=>{}, metaUpgrades: run.metaUpgrades });
          }
        }
      },
      decline: () => {}
    },

    // 2) 呪われた偶像（既存）
    {
      id: 'cursed_idol',
      weight: 2,
      text: () => '呪われた偶像が囁く。力を受け入れる？（ATK +3, HP -10）',
      accept: () => {
        p.atk += 3;
        p.maxHp = Math.max(1, p.maxHp - 10);
        p.hp = Math.min(p.hp, p.maxHp);
      },
      decline: () => {}
    },

    // 3) 闇市（ソウル→遺物）
    {
      id: 'black_market',
      weight: 2,
      text: () => '闇市の商人が現れた。「ソウル20で遺物ひとつ、どうだい？」（受け入れるとソウル-20でランダム遺物獲得）',
      accept: () => {
        if (meta.soul >= 20){
          meta.soul -= 20;
          const relic = pickRelic(rng);
          run.relics.push(relic);
          if (relic.hooks?.onGain){
            relic.hooks.onGain({ state: run, log: ()=>{}, metaUpgrades: run.metaUpgrades });
          }
        }
      },
      decline: () => {}
    },

    // 4) 鍛冶場（小強化・小代償）
    {
      id: 'smith_forge',
      weight: 2,
      text: () => '寡黙な鍛冶師。「鍛え直してやろう」 （ATK +2, DEF +1, HP -10）',
      accept: () => {
        p.atk += 2; p.def += 1;
        p.hp = Math.max(1, p.hp - 10);
      },
      decline: () => {}
    },

    // 5) 俊足の泉（恒久SPD）
    {
      id: 'fountain_haste',
      weight: 2,
      text: () => '透明な泉。ひと口飲む？（SPD +2）',
      accept: () => { p.spd += 2; },
      decline: () => {}
    },

    // 6) 修練場（ターン毎SPDボーナス上限型）
    {
      id: 'training_ground',
      weight: 1,
      text: () => '修練場で型を磨く（ターン毎SPDボーナス +2%／最大+20%）',
      accept: () => {
        p.bonusSpdPct = clamp((p.bonusSpdPct || 0) + 0.02, 0, 0.20);
      },
      decline: () => {}
    },

    // 7) 月の加護（回復→シールド化シナジー）
    {
      id: 'moon_blessing',
      weight: 2,
      text: () => '月光が降り注ぐ。身体が満たされる…（HP +50%／オーバーヒールはシールドに変換）',
      accept: () => {
        const heal = Math.floor(p.maxHp * 0.5);
        p.hp += heal;
        for (const r of run.relics){
          if (r.hooks?.onHeal){
            r.hooks.onHeal({ state: run, log: ()=>{}, metaUpgrades: run.metaUpgrades });
          }
        }
      },
      decline: () => {}
    },

    // 8) 魂の契約（HPをソウルに変換）
    {
      id: 'soul_pact',
      weight: 1,
      text: () => '薄闇の声「血の代価で力を」 （HP -15 → 今回の魂 +8）',
      accept: () => {
        p.hp = Math.max(1, p.hp - 15);
        run.soulsThisRun += 8;
      },
      decline: () => {}
    },

    // 9) 呪鏡（超リスク高報酬）
    {
      id: 'cursed_mirror',
      weight: 1,
      text: () => '呪鏡に手を触れる？（HP=1／クリ率+20%、クリ上限+25%）',
      accept: () => {
        p.hp = 1;
        p.critRate += 0.20;
        p.critCap = (p.critCap || 0.5) + 0.25;
      },
      decline: () => {}
    },

    // 10) 財宝の隠し部屋（被ダメの代償）
    {
      id: 'treasure_cache',
      weight: 2,
      text: () => '隠し部屋を発見！ ただし罠が…（ランダム遺物獲得／HP -20）',
      accept: () => {
        const relic = pickRelic(rng);
        run.relics.push(relic);
        if (relic.hooks?.onGain){
          relic.hooks.onGain({ state: run, log: ()=>{}, metaUpgrades: run.metaUpgrades });
        }
        p.hp = Math.max(1, p.hp - 20);
      },
      decline: () => {}
    },

    // 11) 守護の祠（防御寄り）
    {
      id: 'guardian_shrine',
      weight: 2,
      text: () => '守護の気配。加護を受ける？（DEF +3）',
      accept: () => { p.def += 3; },
      decline: () => {}
    },

    // 12) 命脈の泉（最大HPと引き換えの微調整）
    {
      id: 'life_font',
      weight: 1,
      text: () => '生命の泉。活力が溢れる（最大HP +10、HP +10、ただしDEF -1）',
      accept: () => {
        p.maxHp += 10; p.hp += 10; p.def = Math.max(0, p.def - 1);
      },
      decline: () => {}
    },
  ];

  // 重み付きランダム
  const totalW = pool.reduce((a,e)=>a+(e.weight||1), 0);
  let r = rng() * totalW;
  let ev = pool[0];
  for (const e of pool){ r -= (e.weight||1); if (r <= 0){ ev = e; break; } }

  return {
    id: ev.id,
    text: ev.text(),
    accept: ev.accept,
    decline: ev.decline || (()=>{})
  };
}
