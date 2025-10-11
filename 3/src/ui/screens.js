import { formatNum } from '../core/math.js';

// === enemy image helper ===
function _enemyImagePath(enemy){
  if (!enemy) return '';
  // "◯◯ Lv.10" の末尾レベル表記を除去してから安全なファイル名に
  const baseName = (enemy.img || (enemy.name || '')).replace(/\s*Lv\.\d+$/,'').trim();
  const safe = baseName
    .replace(/[\\\/:*?"<>|]/g, '')   // Windows 禁止文字除去
    .replace(/\s+/g, '_')            // 空白 → _
    .replace(/^_+|_+$/g, '');        // 先頭末尾の _ を除去
  return safe ? `./img/enemies/${safe}.webp` : '';
}

// 次の戦闘で発動する一時バフ（tempRelics）表示用
function renderUpcomingTempRelics(run){
  const list = (run?.tempRelics || [])
    .filter(t => (t.battlesLeft|0) > 0)
    .map(t => `${t.name}（残り×${t.battlesLeft}）`)
    .join('、');
  return list ? `<div class="next-buffs muted">次の戦闘で発動：${list}</div>` : '';
}

// === image helpers ===
// ※ 任意で obj.img を優先（未指定なら id→name からファイル名生成）
function _classImagePath(cls){
  const base = (cls?.img || cls?.id || cls?.name || '').toString().trim();
  if (!base) return '';
  // クラスは id を使う想定（例: rogue → ./img/classes/rogue.webp）
  return `./img/classes/${base}.webp`;
}
function _relicImagePath(rel){
  const base = (rel?.img || rel?.id || rel?.name || '').toString().trim()
    .replace(/[\\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_');
  if (!base) return '';
  // レリックは id を使う想定（例: twin_tails → ./img/relics/twin_tails.webp）
  return `./img/relics/${base}.webp`;
}

function _boostImagePath(b){
  const base = (b?.img || b?.id || b?.name || '').toString().trim()
    .replace(/[\\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_');
  return base ? `./img/boosts/${base}.webp` : '';
}

// 画像フォールバック: .webp → .png → 非表示
function _imgTag(path, alt, cls='card-img'){
  if (!path) return '';
  const escAlt = (alt||'').replace(/"/g,'&quot;');
  return `<img class="${cls}" src="${path}" alt="${escAlt}"
    onload="this.closest('.card-thumb')?.classList.add('ok')"
    onerror="if(this.dataset.f!=='1'){this.dataset.f='1';this.src=this.src.replace('.webp','.png');}else{this.style.display='none';}">`;
}


export function screenTitle(meta, hasRun){
  return `
  <section class="panel">
    <h1>Endless Tower</h1>
    <p class="muted">ローグライト式オートバトラー。ビルドを組み、階層を登り、失敗しても魂で恒久強化。</p>
    <div class="row" style="margin-top:12px">
      <button class="btn primary" id="btn-new-run">新しい冒険</button>
      ${hasRun ? '<button class="btn" id="btn-continue">続きから</button>' : ''}
      <button class="btn" id="btn-meta">強化</button>
      <button class="btn ghost" id="btn-wipe">現在の冒険を消す</button>
    </div>
    <hr class="sep"/>
    <div>魂: <span class="badge">${formatNum(meta.soul)}</span></div>
  </section>
  `;
}

export function screenClassSelect(classes){
  const items = classes.map(c => {
    const img = _classImagePath(c);
    return `
    <div class="card">
      ${_imgTag(img, c.name)}
      <h4>${c.name}</h4>
      <p>${c.desc}</p>
      <div class="kv">
        <div class="key">HP</div><div class="val">${c.base.hp}</div>
        <div class="key">攻撃</div><div class="val">${c.base.atk}</div>
        <div class="key">防御</div><div class="val">${c.base.def}</div>
        <div class="key">速度</div><div class="val">${c.base.spd}</div>
      </div>
      <button class="btn select-class" data-id="${c.id}" style="margin-top:8px;">${c.name}で始める</button>
    </div>
  `;
  }).join('');

  return `
  <section class="panel">
    <h2>クラスを選ぶ</h2>
    <div class="grid3 classes-grid">${items}</div>
  </section>
  `;
}


export function screenMap(run){
  const nodes = run.nextNodes.map((n, i) => `
    <div class="node" data-i="${i}">
      <div class="t">${n.label}</div>
      <div class="d">${n.d}</div>
    </div>
  `).join('');

  return `
  <section class="panel">
    <h2>${run.floor} 階</h2>
    ${renderUpcomingTempRelics(run)}
    <div class="row">
      <div class="col">
        <div class="kv">
          <div class="key">HP</div><div class="val">${run.player.hp}/${run.player.maxHp}${run.player.shield?` +S${run.player.shield}`:''}</div>
          <div class="key">攻撃</div><div class="val">${run.player.atk}</div>
          <div class="key">防御</div><div class="val">${run.player.def}</div>
          <div class="key">速度</div><div class="val">${run.player.spd}</div>
          <div class="key">クリティカル</div><div class="val">${Math.round(run.player.critRate*100)}% x${run.player.critMult}</div>
          <div class="key">遺物</div><div class="val">${run.relics.map(r=>r.name).join(', ') || 'なし'}</div>
        </div>
      </div>
      <div class="col">
        <div class="kv">
          <div class="key">今回の魂</div><div class="val">${formatNum(run.soulsThisRun)}</div>
          <div class="key">所持魂</div><div class="val">${formatNum(run.meta.soul)}</div>
          <div class="key">クラス</div><div class="val">${run.playerClass.name}</div>
        </div>
      </div>
    </div>
    <h3>次のノードを選ぶ</h3>
    <div class="node-grid">${nodes}</div>
  </section>`;
}

export function screenBattle(run){
  const enemyName = run.enemy?.name || '???';
  const enemyImg  = _enemyImagePath(run.enemy); // 無ければ空文字

  return `
  <section class="panel">
    <h2>戦闘 - ${run.floor} 階</h2>
    <div class="row">
      <div class="col">
        <h3>あなた</h3>
        <div class="bar"><div style="width:${Math.floor(100*run.player.hp/run.player.maxHp)}%"></div></div>
        <small class="muted">HP ${run.player.hp}/${run.player.maxHp}${run.player.shield?` +S${run.player.shield}`:''}</small>
      </div>
      <div class="col">
        <h3>${enemyName}</h3>
        <div class="bar"><div style="width:${Math.floor(100*run.enemy.hp/run.enemy.maxHp)}%"></div></div>
        <small class="muted">HP ${run.enemy.hp}/${run.enemy.maxHp}</small>
        ${enemyImg ? `
          <div class="enemy-portrait">
            <img class="enemy-img" src="${enemyImg}" alt="${enemyName}"
              onerror="if(this.dataset.f!=='1'){this.dataset.f='1';this.src=this.src.replace('.webp','.png');}else{this.style.display='none';}">
          </div>
        ` : ``}
      </div>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn primary" id="btn-battle-run">自動戦闘</button>
      <button class="btn" id="btn-battle-retreat">撤退（冒険終了）</button>
      <button class="btn hidden" id="btn-battle-next">結果へ</button>
      <button class="btn ghost" id="btn-log-clear">ログを消す</button>
    </div>
    <div id="battle-status" class="muted" style="margin:6px 0 8px;"></div>
    <div class="log" id="battle-log"></div>
  </section>
  `;
}

export function screenReward(rewards){
  const items = rewards.map((r,i)=>{
    const title = r.kind === 'relic' ? `遺物: ${r.obj.name}` : `強化: ${r.obj.name}`;
    const desc  = r.obj.desc || '';

    let imgHtml = '';
    if (r.kind === 'relic'){
      // レリック：画像が読めたら onload でプレースホルダーを消す
      imgHtml = `
        <div class="card-thumb">
          <div class="card-img placeholder">RELIC</div>
          ${_imgTag(_relicImagePath(r.obj), r.obj.name)}
        </div>`;
    } else {
      // ブースト：画像ヘルパーを使う（なければプレースホルダーのまま）
      imgHtml = `
        <div class="card-thumb">
          <div class="card-img placeholder">BOOST</div>
          ${_imgTag(_boostImagePath(r.obj), r.obj.name)}
        </div>`;
    }

    return `
      <div class="card">
        ${imgHtml}
        <h4>${title}</h4>
        <p>${desc}</p>
        <button class="btn pick-reward" data-i="${i}">獲得する</button>
      </div>
    `;
  }).join('');

  return `
    <section class="panel">
      <h2>報酬を選ぶ</h2>
      <div class="grid3">${items}</div>
    </section>
  `;
}


export function screenEvent(run, eventText){
  return `
  <section class="panel">
    <h2>不思議な出来事</h2>
    <p class="muted">${eventText}</p>
    <div class="row" style="margin-top:12px">
      <button class="btn primary" id="btn-event-accept">受け入れる</button>
      <button class="btn" id="btn-event-decline">やめておく</button>
    </div>
  </section>
  `;
}

export function screenGameOver(summary){
  return `
  <section class="panel">
    <h2>敗北 - 到達 ${summary.floor} 階</h2>
    <p>獲得した魂: <span class="badge">${formatNum(summary.soulsEarned)}</span></p>
    <div class="row" style="margin-top:8px">
      <button class="btn primary" id="btn-go-title">タイトルへ</button>
      <button class="btn" id="btn-go-meta">強化へ</button>
    </div>
  </section>
  `;
}

export function screenMeta(meta){
  const cost = 50;
  const row = (id, label, v, info) => `
    <div class="card">
      <h4>${label} (+${(v*10)}%)</h4>
      <p>${info}</p>
      <p>レベル: <b>${v}</b> • 次のコスト: <span class="badge">${cost}</span></p>
      <button class="btn buy-upg" data-id="${id}">購入（${cost} 魂）</button>
    </div>`;

  return `
  <section class="panel">
    <h2>恒久強化</h2>
    <p class="muted">冒険で得た魂を消費して、恒久的に強くなる。</p>
    <p>魂: <span class="badge">${meta.soul}</span></p>
    <div class="grid3">
      ${row('vitality', '体力', meta.upgrades.vitality, '最大HP +10%/Lv')}
      ${row('sharpness', '刃', meta.upgrades.sharpness, '攻撃力 +10%/Lv')}
      ${row('haste', '俊敏', meta.upgrades.haste, '速度 +10%/Lv')}
      ${row('barrier', 'バリア', meta.upgrades.barrier, 'シールド上限 +10%/Lv（月光の蜜に影響）')}
    </div>
  </section>
  `;
}
