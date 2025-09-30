const cardsEl = document.getElementById("cards");
const maxInput = document.getElementById("maxNum");
const baseInput = document.getElementById("basePath");
const scanBtn  = document.getElementById("scanBtn");
const exportBtn = document.getElementById("exportBtn");
const hintEl = document.getElementById("hint");

// URLパラメータから初期値
const params = new URLSearchParams(location.search);
if (params.has("max"))  maxInput.value = String(Math.max(1, Number(params.get("max")||20)));
if (params.has("base")) baseInput.value = params.get("base") || "/kusoge/";

// ローカル保存から復元
try {
  const saved = JSON.parse(localStorage.getItem("kusoge-index-prefs")||"{}");
  if (saved.max)  maxInput.value = saved.max;
  if (saved.base) baseInput.value = saved.base;
} catch {}

function savePrefs(){
  localStorage.setItem("kusoge-index-prefs", JSON.stringify({max:maxInput.value, base:baseInput.value}));
}

function summarize(text, len=140){
  if(!text) return "";
  const s = text.replace(/\s+/g," ").trim();
  return s.length>len ? s.slice(0,len)+"…" : s;
}

async function headOk(url){
  try{
    const r = await fetch(url, {method:"HEAD", cache:"no-store"});
    if (r.ok) return true;
    // HEADが拒否される場合のフォールバック
    const r2 = await fetch(url, {method:"GET", cache:"no-store"});
    return r2.ok;
  }catch{ return false; }
}

async function getLastModified(url){
  try{
    const r = await fetch(url, {method:"HEAD", cache:"no-store"});
    return r.headers.get("last-modified") || "";
  }catch{ return ""; }
}

async function fetchMeta(url){
  try{
    const [htmlRes, lm] = await Promise.all([
      fetch(url, {cache:"no-store"}),
      getLastModified(url)
    ]);
    if (!htmlRes.ok) throw new Error("status "+htmlRes.status);
    const text = await htmlRes.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    const title = (doc.querySelector("title")?.textContent || "").trim();
    const metaDesc = (doc.querySelector('meta[name="description"]')?.getAttribute("content") || "").trim();
    const h1 = (doc.querySelector("h1")?.textContent || "").trim();

    let bodyText = "";
    const scope = doc.querySelector("main") || doc.body;
    if (scope) {
      bodyText = Array.from(scope.querySelectorAll("p,li,small"))
        .map(n=>n.textContent.trim())
        .filter(Boolean).join(" ");
    }
    return { ok:true, title:title||h1, desc: metaDesc || summarize(bodyText, 180), lastModified: lm };
  }catch(e){
    return { ok:false, title:"（取得できませんでした）", desc:"リンクを開いて内容をご確認ください。", lastModified:"" };
  }
}

function fmtDateRFC(dstr){
  if(!dstr) return "";
  const d = new Date(dstr);
  if (isNaN(d)) return "";
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), da=String(d.getDate()).padStart(2,"0");
  const hh=String(d.getHours()).padStart(2,"0"), mm=String(d.getMinutes()).padStart(2,"0");
  return `${y}/${m}/${da} ${hh}:${mm}`;
}

function createCard(item){
  const { url, title, desc, lastModified } = item;
  const card = document.createElement("article");
  card.className = "card";

  const t = document.createElement("div");
  t.className = "title";
  t.textContent = title || "(無題)";

  const u = document.createElement("div");
  u.className = "url";
  u.textContent = url;

  const d = document.createElement("div");
  d.className = "desc";
  d.textContent = desc || "";

  const meta = document.createElement("div");
  meta.className = "meta";
  const lm = document.createElement("span");
  lm.className = "badge";
  lm.innerHTML = "最終更新: " + (lastModified ? fmtDateRFC(lastModified) : '<span class="warn">不明</span>');
  meta.appendChild(lm);

  const actions = document.createElement("div");
  actions.className = "actions";

  const open = document.createElement("a");
  open.className = "btn";
  open.href = url; open.target = "_blank"; open.rel = "noopener";
  open.textContent = "新しいタブで開く";

  const pv = document.createElement("details");
  const sum = document.createElement("summary"); sum.className = "btn"; sum.textContent = "プレビューを表示";
  const frame = document.createElement("iframe"); frame.className="preview"; frame.loading="lazy"; frame.src=url;
  pv.appendChild(sum); pv.appendChild(frame);

  actions.appendChild(open); actions.appendChild(pv);

  card.appendChild(t);
  card.appendChild(u);
  card.appendChild(d);
  card.appendChild(meta);
  card.appendChild(actions);

  return card;
}

// list.json を読む（存在しないなら null）
async function tryLoadListJson(base){
  const url = new URL(base.replace(/\/+$/,"") + "/list.json", location.origin).toString();
  try{
    const r = await fetch(url, {cache:"no-store"});
    if(!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j.items)) return null;
    // {items:[{path:"/kusoge/1/", title?, desc?}, ...]}
    return j.items.map(it => ({
      url: new URL(it.path, location.origin).toString(),
      title: it.title || "",
      desc: it.desc || "",
      lastModified: ""
    }));
  }catch{ return null; }
}

// 自動スキャン（/1..max）
async function autoScan(base, maxN){
  const list = [];
  const baseUrl = new URL(base, location.origin);
  for (let i=1; i<=maxN; i++){
    const url = new URL(String(i).replace(/\/?$/,"/"), baseUrl).toString();
    // 例: https://.../kusoge/1/
    /* eslint-disable no-await-in-loop */
    const ok = await headOk(url);
    if (ok) {
      list.push({ url, title:"", desc:"", lastModified:"" });
    }
  }
  return list;
}

async function build(){
  savePrefs();
  cardsEl.innerHTML = "";
  const base = baseInput.value;
  const maxN = Math.max(1, Number(maxInput.value||20));
  hintEl.textContent = `ゲームをスキャン中...）`;

  // 1) list.json 優先
  let items = await tryLoadListJson(base);

  // 2) なければ自動スキャン
  if (!items) {
    items = await autoScan(base, maxN);
  }

  if (items.length === 0) {
    hintEl.innerHTML = `ページが見つかりませんでした。<br>・${base} 配下に <code>1</code> 〜 <code>${maxN}</code> のフォルダ（index.html）があるか確認してください。<br>・または <code>${base.replace(/\/+$/,"")}/list.json</code> を用意してください。`;
    return;
  }

  // メタ取得
  const metas = await Promise.all(items.map(async it => {
    const m = await fetchMeta(it.url);
    return {
      url: it.url,
      title: it.title || m.title,
      desc: it.desc || m.desc,
      lastModified: m.lastModified
    };
  }));

  // 表示
  hintEl.textContent = "";
  for (const item of metas){
    cardsEl.appendChild(createCard(item));
  }

  // 現在の一覧を保持（書き出し用）
  window.__currentItems = metas.map(m => {
    return { path: new URL(m.url).pathname, title: m.title, desc: m.desc };
  });
}

scanBtn.addEventListener("click", build);

// 初回ビルド
build();
