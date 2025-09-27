
const META_KEY = 'et_meta_v1';
const RUN_KEY  = 'et_run_v1';

export function loadMeta(){
  try {
    const s = localStorage.getItem(META_KEY);
    if (!s) return defaultMeta();
    const m = JSON.parse(s);
    if (!m.version) return defaultMeta();
    return m;
  } catch(e){
    return defaultMeta();
  }
}

export function saveMeta(meta){
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function defaultMeta(){
  return {
    version: 1,
    soul: 0,
    upgrades: {
      vitality: 0,
      sharpness: 0,
      haste: 0,
      barrier: 0
    }
  };
}

export function loadRun(){
  try {
    const s = localStorage.getItem(RUN_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch(e){
    return null;
  }
}

export function saveRun(run){
  localStorage.setItem(RUN_KEY, JSON.stringify(run));
}

export function clearRun(){
  localStorage.removeItem(RUN_KEY);
}
