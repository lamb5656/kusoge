import { startMinigameStairs } from './minigame-stairs.js';
window.devStartStairs = () => startMinigameStairs({ onWin:()=>console.log('WIN'), onLose:()=>console.log('LOSE') });
// トンパのハンター試験合格記 - main.js（ミニゲーム対応版）
// ・CSV駆動の会話/選択肢
// ・クリック/タップで行送り
// ・選択肢は一度押したら即非表示＆二重押下防止
// ・MINIGAME: 15秒回避ゲーム（毎秒 n 体スポーン、接触で失敗/耐久で成功）

const logEl = document.getElementById('log');
const choicesEl = document.getElementById('choices');
const hintEl = document.getElementById('hint');
const screenEl = document.getElementById('screen');
const confettiEl = document.getElementById('confetti');

let scenes = {}; // { sceneId: { lines: [{speaker,text}], choices: [{key,label,next}], outcome? } }
let currentChoices = [];
let choiceLocked = false; // 二重選択防止
let nextIndicator;        // 進行ヒント
let minigameActive = false;

// ---------------- CSV Loader ----------------
async function loadCSV(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('CSV load error: ' + res.status);
    const text = await res.text();
    return parseCSV(text);
}

function parseCSV(str) {
    // シンプルCSV（ダブルクオート対応）\r\n / \n どちらもOK
    const rows = [];
    let i = 0, field = '', row = [], inQuotes = false;
    while (i < str.length) {
        const c = str[i];
        if (inQuotes) {
            if (c === '"') {
                if (str[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
            } else { field += c; }
        } else {
            if (c === '"') inQuotes = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
            else if (c === '\r') { /* ignore */ }
            else { field += c; }
        }
        i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    // 末尾の空行除去
    return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

function buildScenes(rows) {
    if (!rows.length) throw new Error('CSV is empty');
    const headerRaw = rows[0];
    const headerNorm = headerRaw.map(h => normalizeHeader(h));
    const want = ['scene_id', 'type', 'speaker', 'text', 'choice_key', 'choice_label', 'next_scene', 'meta'];
    const idx = Object.fromEntries(want.map(w => [w, headerNorm.indexOf(w)]));
    // 必須列チェック
    if (idx.scene_id === -1 || idx.type === -1) {
        console.error('Header raw:', headerRaw);
        console.error('Header norm:', headerNorm);
        throw new Error('CSV header missing required columns (scene_id/type).');
    }

    const out = {};
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const get = (name) => idx[name] >= 0 ? (row[idx[name]] ?? '') : '';
        const scene_id = String(get('scene_id')).trim();
        const type = String(get('type')).trim() || 'line';
        const speaker = String(get('speaker')).trim();
        const text = String(get('text'));
        const choice_key = String(get('choice_key')).trim();
        const choice_lbl = String(get('choice_label')).trim();
        const next_scene = String(get('next_scene')).trim();
        const meta = String(get('meta')).trim();

        if (!scene_id) continue; // 空行スキップ
        if (!out[scene_id]) out[scene_id] = { lines: [], choices: [], outcome: null };

        if (type === 'line') {
            out[scene_id].lines.push({ speaker, text });
        } else if (type === 'choice') {
            out[scene_id].choices.push({ key: String(choice_key), label: choice_lbl, next: next_scene });
        } else if (type === 'outcome') {
            out[scene_id].outcome = meta; // e.g., GAMEOVER1, PROLOGUE_CLEAR, HAPPY_END, MINIGAME
        }
    }
    return out;
}

function normalizeHeader(h) {
    return String(h).replace(/^\ufeff/, '').trim().toLowerCase();
}

// ---------------- UI helpers ----------------
function clearLog() { logEl.innerHTML = ''; }
function addLine(name, text) {
    const line = document.createElement('div');
    line.className = 'line';
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = name || '';
    const textEl = document.createElement('div');
    textEl.className = 'text';
    textEl.textContent = text;
    if (!name) { nameEl.style.display = 'none'; textEl.classList.add('sys'); }
    line.append(nameEl, textEl);
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
    return line;
}

function showChoices(list) {
    choicesEl.innerHTML = '';
    list.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.dataset.key = c.key;
        btn.textContent = `${c.key}. ${c.label}`;
        btn.addEventListener('click', (ev) => { ev.stopPropagation(); onChoice(c); });
        choicesEl.appendChild(btn);
    });
    currentChoices = list;
    choicesEl.hidden = false; hintEl.hidden = false;
    choicesEl.style.display = 'grid';
    choiceLocked = false;
}
function hideChoices() {
    choicesEl.hidden = true;
    choicesEl.style.display = 'none';
    choicesEl.innerHTML = '';
    hintEl.hidden = true;
    currentChoices = [];
}

function outcomeScreen({ title, className = '', body = '', actions = [] }) {
    const wrap = document.createElement('div');
    wrap.className = 'center';
    const h = document.createElement('div'); h.className = className; h.textContent = title;
    const p = document.createElement('div'); p.textContent = body;
    const btns = document.createElement('div'); btns.style.display = 'flex'; btns.style.gap = '10px'; btns.style.flexWrap = 'wrap'; btns.style.justifyContent = 'center';
    for (const a of actions) {
        const b = document.createElement('button'); b.className = 'btn'; b.textContent = a.label;
        b.addEventListener('click', a.onClick);
        btns.appendChild(b);
    }
    wrap.append(h, p, btns);
    screenEl.appendChild(wrap);
    return wrap;
}

function clearOutcomeScreens() {
    [...screenEl.querySelectorAll('.center')].forEach(n => n.remove());
}

function confetti(count = 80) {
    const EMOJIS = ['🎉', '✨', '🔥', '🥩', '🏆', '🍽️', '💫'];
    for (let i = 0; i < count; i++) {
        const e = document.createElement('div');
        e.className = 'piece';
        e.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        const startX = Math.random() * 100;
        const dur = 2.5 + Math.random() * 2.2;
        const delay = Math.random() * 0.5;
        e.style.left = startX + 'vw';
        e.style.animationDuration = dur + 's';
        e.style.animationDelay = delay + 's';
        e.style.transform = `translateY(-10vh) rotate(${Math.random() * 360}deg)`;
        confettiEl.appendChild(e);
        setTimeout(() => e.remove(), (dur + delay) * 1000 + 400);
    }
}

// ---------------- Flow ----------------
async function playScene(sceneId) {
    clearOutcomeScreens();
    hideChoices();

    const sc = scenes[sceneId];
    if (!sc) {
        addLine('', `シーン '${sceneId}' が見つかりません`);
        return;
    }

    // 1行ずつ表示。最後の行が MINIGAME のときは
    // その場で outcome を解決して即 return（確実起動）
    for (let i = 0; i < sc.lines.length; i++) {
        const l = sc.lines[i];
        const isLast = i === sc.lines.length - 1;

        addLine(l.speaker, l.text);

        if (isLast && sc.outcome === 'MINIGAME') {
            // ちょっと間を置いてから即ミニゲームへ（クリック不要）
            await new Promise(r => setTimeout(r, 2000));
            await resolveOutcome(sceneId, 'MINIGAME');
            return; // ここで関数を抜ける（下の分岐に行かない）
        } else {
            await waitAdvance();
        }
    }

    if (sc.choices && sc.choices.length) {
        showChoices(sc.choices);
    } else if (sc.outcome) {
        await resolveOutcome(sceneId, sc.outcome);
    }
}



async function resolveOutcome(sceneId, outcome) {
    if (outcome === 'MINIGAME_STAIRS') {
        // 階段を上がりながら下剤ジュースを避けるミニゲーム
        const start = () => startMinigameStairs({
            onWin: () => {
                removeMinigame();
                // クリア後はプロローグクリアへ
                resolveOutcome('postMini', 'PROLOGUE_CLEAR');
            },
            onLose: () => {
                removeMinigame();
                // 同じ場所でもう一度挑戦できるUI
                outcomeScreen({
                    title: 'M I S S !',
                    className: 'gameover',
                    body: '階段で転倒！下痢になった！ もう一度挑戦する？',
                    actions: [
                        { label: 'リトライ', onClick: () => { clearOutcomeScreens(); start(); } },
                        { label: '最初から', onClick: () => { removeMinigame(); startGame(); } },
                    ]
                });
            }
        });
        clearOutcomeScreens();
        start();
        return;
    } else 
    if (outcome === 'GAMEOVER') {
        addLine('', 'みんなの冷たい視線が鋭く刺さる…！');
        await waitAdvance();
        await waitAdvance();
        outcomeScreen({
            title: 'G A M E  O V E R',
            className: 'gameover',
            body: 'セクシャルハラスメントで逮捕された...。',
            actions: [{ label: '最初から', onClick: () => startGame() }]
        });
    } else if (outcome === 'GAMEOVER2') {
        addLine('', 'みんなの冷たい視線が鋭く刺さる…！');
        await waitAdvance();
        await waitAdvance();
        outcomeScreen({
            title: 'G A M E  O V E R',
            className: 'gameover',
            body: 'その選択は自分の乳首インクド・ホロ欠けを修正してからにしよう。',
            actions: [{ label: '最初から', onClick: () => startGame() }]
        });
    } else if (outcome === 'GAMEOVER3') {
        addLine('', 'シャワーを浴びながら配信を始めた');
        await waitAdvance();
        await waitAdvance();
        outcomeScreen({
            title: 'G A M E  O V E R',
            className: 'gameover',
            body: 'わいせつ物陳列罪で逮捕された...。',
            actions: [{ label: '最初から', onClick: () => startGame() }]
        });
    } else if (outcome === 'PROLOGUE_CLEAR') {
        addLine('', '……つづく');
        await waitAdvance();
        outcomeScreen({
            title: 'プロローグ クリア',
            body: '次のシーンへ進めます。続きの実装を追加してください。',
            actions: [{ label: 'もう一回やる', onClick: () => startGame() }]
        });
    } else if (outcome === 'HAPPY_END') {
        confetti(120);
        outcomeScreen({
            title: 'H A P P Y  E N D !!!',
            className: 'happy',
            body: 'yukiの竹刀(3cm)は自身に装着されていたのだ。yuki、栄光の追放。',
            actions: [{ label: '最初から', onClick: () => startGame() }]
        });
    } else if (outcome === 'MINIGAME') {
        // 何度でもリトライできるようにローカル関数でまとめる
        const start = () => startMinigame({
            onWin: () => {
                removeMinigame();
                playScene('postMini');
            },
            onLose: () => {
                removeMinigame();
                showFail();
            }
        });

        function showFail() {
            clearOutcomeScreens();
            outcomeScreen({
                title: 'ミニゲーム失敗',
                className: 'gameover',
                body: 'ジュース直撃！下痢になった！ もう一度挑戦する？',
                actions: [
                    {
                        label: 'リトライ', onClick: () => {
                            clearOutcomeScreens();
                            start();                   // ← 毎回同じ onLose を使って再起動
                        }
                    },
                    {
                        label: '最初から', onClick: () => {
                            removeMinigame();
                            startGame();
                        }
                    },
                ]
            });
        }
        start();
    }
}

function onChoice(choice) {
    if (choiceLocked) return; // 二重押下防止
    choiceLocked = true;
    hideChoices();
    // レイアウト反映後に遷移（rAF）
    requestAnimationFrame(() => {
        if (choice && choice.next) playScene(choice.next);
    });
}

function bindKeyboard() {
    window.addEventListener('keydown', (e) => {
        if (!choicesEl.hidden && !choiceLocked && ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
            const c = currentChoices.find(x => String(x.key) === e.key);
            if (c) onChoice(c);
        }
    });
}

// ---------------- 次へインジケータ（クリック/タップで進む） ----------------
function mountNextIndicator() {
    if (nextIndicator) return;
    nextIndicator = document.createElement('div');
    nextIndicator.textContent = 'タップ/クリックで進む';
    Object.assign(nextIndicator.style, {
        position: 'absolute', right: '18px', bottom: '22px',
        background: '#0e0f1c', border: '1px solid rgba(255,255,255,.12)',
        padding: '6px 10px', borderRadius: '999px', fontSize: '12px',
        color: 'var(--muted)', opacity: '0', transform: 'translateY(4px)',
        transition: 'opacity .2s, transform .2s', pointerEvents: 'none', zIndex: 1
    });
    if (getComputedStyle(screenEl).position === 'static') {
        screenEl.style.position = 'relative';
    }
    screenEl.appendChild(nextIndicator);
}
function setNextIndicator(visible) {
    mountNextIndicator();
    nextIndicator.style.opacity = visible ? '1' : '0';
    nextIndicator.style.transform = visible ? 'translateY(0)' : 'translateY(4px)';
}
function waitAdvance() {
    return new Promise(resolve => {
        // ミニゲーム中は進行クリック無効
        if (minigameActive) { resolve(); return; }
        setNextIndicator(true);
        const onClick = () => { cleanup(); resolve(); };
        const onKey = (e) => { if (['Enter', ' ', 'Spacebar', 'ArrowRight'].includes(e.key)) { cleanup(); resolve(); } };
        screenEl.addEventListener('click', onClick, { once: true });
        window.addEventListener('keydown', onKey);
        function cleanup() { setNextIndicator(false); screenEl.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey); }
    });
}

// ---------------- ミニゲーム ----------------
let mg = null; // minigame state

function startMinigame({ onWin, onLose }) {
    if (mg) removeMinigame();
    minigameActive = true;

    const overlay = document.createElement('div');
    overlay.id = 'minigame-overlay';
    Object.assign(overlay.style, {
        position: 'absolute', inset: '0', zIndex: 10, background: 'rgba(0,0,0,.25)'
    });
    // クリックが背面に届かないように
    overlay.addEventListener('click', e => e.stopPropagation());
    overlay.addEventListener('pointerdown', e => e.stopPropagation());
    overlay.addEventListener('pointermove', e => e.stopPropagation());

    const canvas = document.createElement('canvas');
    overlay.appendChild(canvas);
    screenEl.appendChild(overlay);

    const ctx = canvas.getContext('2d');
    function resize() {
        const r = screenEl.getBoundingClientRect();
        canvas.width = Math.floor(r.width);
        canvas.height = Math.floor(r.height);
    }
    resize();
    window.addEventListener('resize', resize);

    const state = {
        onWin, onLose,
        t0: performance.now(),
        last: performance.now(),
        elapsed: 0,
        duration: 15, // 秒
        spawnSecond: 0,
        enemies: [],
        player: { x: canvas.width * 0.5, y: canvas.height * 0.5, r: 14 },
        running: true,
    };

    // 入力（マウス/タッチ/ペン）
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => moveToPointer(e, state, canvas));
    canvas.addEventListener('pointermove', (e) => moveToPointer(e, state, canvas));

    mg = { overlay, canvas, ctx, state, resizeHandler: resize };
    loop();

    function loop() {
        if (!state.running) return;
        const now = performance.now();
        const dt = Math.min(0.033, (now - state.last) / 1000);
        state.last = now;
        state.elapsed = (now - state.t0) / 1000;

        // スポーン：1秒毎に、その秒数ぶんスポーン
        const sec = Math.floor(state.elapsed);
        if (sec > state.spawnSecond && sec <= state.duration) {
            const count = sec; // 1,2,3,...
            spawnEnemies(count, state, canvas);
            state.spawnSecond = sec;
        }

        // 進行
        update(state, dt, canvas);
        draw(ctx, state, canvas);

        // 判定
        if (state.elapsed >= state.duration) {
            // 時間切れ＝勝利
            state.running = false;
            setTimeout(() => { if (state.onWin) state.onWin(); }, 0);
            return;
        }

        requestAnimationFrame(loop);
    }
}

function removeMinigame() {
    if (!mg) return;
    window.removeEventListener('resize', mg.resizeHandler);
    mg.overlay.remove();
    mg = null;
    minigameActive = false;
}

function moveToPointer(e, state, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    state.player.x = Math.max(state.player.r, Math.min(canvas.width - state.player.r, x));
    state.player.y = Math.max(state.player.r, Math.min(canvas.height - state.player.r, y));
}

function spawnEnemies(n, state, canvas) {
    for (let i = 0; i < n; i++) {
        const edge = Math.floor(Math.random() * 4); // 0 top,1 right,2 bottom,3 left
        let x, y;
        if (edge === 0) { x = Math.random() * canvas.width; y = -20; }
        else if (edge === 1) { x = canvas.width + 20; y = Math.random() * canvas.height; }
        else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 20; }
        else { x = -20; y = Math.random() * canvas.height; }

        const px = state.player.x, py = state.player.y; // スポーン時点のプレイヤー位置へ突撃
        const dx = px - x, dy = py - y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = 120 + Math.random() * 80; // px/s
        const vx = (dx / len) * speed;
        const vy = (dy / len) * speed;
        state.enemies.push({ x, y, vx, vy, r: 12 });
    }
}

function update(state, dt, canvas) {
    // 敵移動
    for (const e of state.enemies) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
    }
    // 画面外に出た敵を軽く消す（パフォーマンス）
    state.enemies = state.enemies.filter(e => e.x > -60 && e.x < canvas.width + 60 && e.y > -60 && e.y < canvas.height + 60);
    // 当たり判定
    for (const e of state.enemies) {
        const dx = e.x - state.player.x;
        const dy = e.y - state.player.y;
        const rr = (e.r + state.player.r);
        if (dx * dx + dy * dy <= rr * rr) {
            // ヒット
            state.running = false;
            if (state.onLose) state.onLose();
            break;
        }
    }
}

function draw(ctx, state, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, 'rgba(20,22,40,.95)');
    g.addColorStop(1, 'rgba(10,12,24,.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // HUD （時間）
    const remain = Math.max(0, Math.ceil(state.duration - state.elapsed));
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#e8ebff';
    ctx.fillText(`残り ${remain} 秒`, 12, 24);
    ctx.fillStyle = '#9aa3c7';
    ctx.fillText(`敵: ${state.enemies.length}`, 12, 44);

    // プレイヤー
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2);
    ctx.fillStyle = '#6aa6ff';
    ctx.fill();

    // 敵（トンパのジュース突撃）
    for (const e of state.enemies) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6a8a';
        ctx.fill();
    }
}

// ---------------- Boot ----------------
async function startGame() {
    clearOutcomeScreens();
    clearLog();
    await playScene('intro');
}

async function init() {
    mountNextIndicator();
    const rows = await loadCSV('./data/script.csv');
    scenes = buildScenes(rows);
    bindKeyboard();
    startGame();
}

init().catch(err => {
    console.error(err);
    addLine('', 'データの読み込みに失敗しました。CSVとコンソールを確認してください。');
});