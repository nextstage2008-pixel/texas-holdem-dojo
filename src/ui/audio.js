// 音を鳴らす部品（設計書 段階4-5 第7-1節）。麻雀道場の audio.js を写して直したもの。
// ブラウザの決まりで、最初に画面に触れるまでは鳴らせない。触れたとき（unlock）に準備し、それまでは鳴らさない（頼まれても何もしない）。
// 読み込んだ音は使い回す。鳴らし始めの位置（offset）と倍率（gain）を受け取る。
// 声は1本ずつ鳴らす決まり（sound.js）のために、鳴っている声の残りの秒数を返す（voiceLeft）。読み込みの間も鳴っている扱いにする。
// 音はすべて全体の大きさ（master）を通し、音を出す・出さない（setOutput）で、いま鳴っている音もすぐ消す。
// onUnlock：初めて準備できたときに1回呼ぶ（効果音の読み込みを始める）
// スマホの守り（設計書 段階5-1 第7節）：電話・画面を消した・裏に回ったあとも鳴るように、触れたときと表に戻ったときに再開し（revive）、
// 裏に回ったら止める（suspend）。再開が RESUME_LIMIT ミリ秒で終わらなければ部品を作り直す（読み込んだ音はそのまま使える）。
// 声は一度に VOICE_LOADS つまで読み込み、読み込んだ声は VOICE_KEEP 個まで残す（長く使っていないものから捨てる。効果音は捨てない）。
// later：時間をおいて呼ぶ（テストで差し替える）

const LOADING = 0.3; // 声を読み込んでいる間、鳴っている扱いにする秒数（読み込みが済めば本当の長さに置き換える）
export const RESUME_LIMIT = 1500;
export const VOICE_LOADS = 3;
export const VOICE_KEEP = 120;
const isVoice = (url) => url.includes('voice/');

export function createAudio({ onUnlock = () => {}, later = (fn, ms) => setTimeout(fn, ms) } = {}) {
  let ctx = null;
  let master = null; // 全体の大きさ
  let outOn = true; // 音を出すか（準備の前に決めても、準備したときに効く）
  let unlocked = false; // 準備の知らせ（onUnlock）は最初の1回だけ
  let reviving = false; // 再開を待っている間（何度触れても待つのは1回）
  let attempt = 0; // 何回目の再開か（古い待ちを無視する）
  const cache = new Map(); // url → 読み込んだ音の Promise（声は使った順に並べ直す）
  let voiceEnd = 0; // 鳴っている声が終わる時刻（ctx.currentTime の秒）

  function make() {
    const C = typeof window === 'undefined' ? null : window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = outOn ? 1 : 0;
    master.connect(ctx.destination);
    voiceEnd = 0;
    return ctx;
  }

  // create：触れたときだけ true（音の準備を始める）
  function ensure(create = false) {
    if (!ctx) {
      if (!create || !make()) return null;
      if (!unlocked) {
        unlocked = true;
        try { onUnlock(); } catch { /* 読み込みの始めに失敗しても鳴らす部品は使える */ }
      }
    }
    return ctx;
  }

  // 「中断」（iPhone の電話など）・「止まっている」（裏に回った）なら再開する。終わらなければ作り直す
  function revive() {
    if (!ctx || reviving || (ctx.state !== 'suspended' && ctx.state !== 'interrupted')) return;
    const c = ctx;
    const mine = ++attempt;
    reviving = true;
    try { Promise.resolve(c.resume()).then(() => { if (attempt === mine) reviving = false; }, () => {}); } catch { /* 再開できなければ作り直しを待つ */ }
    later(() => {
      if (attempt !== mine || !reviving) return; // 再開できた（そのあと裏に回って止めたときも作り直さない）
      reviving = false;
      if (ctx !== c || c.state === 'running') return;
      try { c.close(); } catch { /* 閉じられなくても作り直す */ }
      ctx = null;
      make();
    }, RESUME_LIMIT);
  }

  // 声の読み込み：一度に VOICE_LOADS つまで。first：鳴らす声（待ちの先頭に）
  let loading = 0;
  const waiting = [];
  function queue(task, first, url) {
    return new Promise((res, rej) => {
      const item = { url, run: () => { loading++; task().then(res, rej).finally(() => { loading--; waiting.shift()?.run(); }); } };
      if (loading < VOICE_LOADS) item.run();
      else if (first) waiting.unshift(item);
      else waiting.push(item);
    });
  }
  // 先読みの列で待っている声を、列の先頭に回す（鳴らす声を先読みの後ろで待たせない）
  function promote(url) {
    const k = waiting.findIndex((w) => w.url === url);
    if (k > 0) waiting.unshift(...waiting.splice(k, 1));
  }
  // 読み込んだ声が VOICE_KEEP 個を超えたら、長く使っていない声から捨てる
  function trim() {
    const voices = [...cache.keys()].filter(isVoice);
    for (const url of voices.slice(0, Math.max(0, voices.length - VOICE_KEEP))) cache.delete(url);
  }

  // 読み込みに失敗した音は覚えておかない（次にもう一度読む）
  function buffer(url, first = false) {
    if (!ensure()) return Promise.resolve(null);
    if (cache.has(url)) {
      const p = cache.get(url);
      if (isVoice(url)) { cache.delete(url); cache.set(url, p); } // 使った声は新しい扱い
      if (first && isVoice(url)) promote(url);
      return p;
    }
    const load = () => fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.arrayBuffer(); })
      .then((ab) => ensure().decodeAudioData(ab));
    const p = isVoice(url) ? queue(load, first, url) : load();
    p.catch(() => cache.delete(url));
    cache.set(url, p);
    if (isVoice(url)) trim();
    return p;
  }

  // 鳴らし終わったら解決する Promise を返す。まだ準備していないときは何もせずに解決する。読めない音は失敗で返す。
  // direct：全体の大きさを通さない（設定画面の「試しに聞く」は、音を消していても聞こえる）
  async function play(url, { gain = 1, rate = 1, offset = 0, voice = false, direct = false } = {}) {
    const c = ensure();
    if (!c) return;
    if (voice) voiceEnd = Math.max(voiceEnd, c.currentTime + LOADING);
    const b = await buffer(url, true);
    if (!b || !ctx) return;
    const c2 = ctx; // 読み込みの間に作り直していれば、新しい部品で鳴らす
    const s = c2.createBufferSource();
    s.buffer = b;
    s.playbackRate.value = rate;
    const g = c2.createGain();
    g.gain.value = gain;
    s.connect(g);
    g.connect(direct ? c2.destination : master);
    const from = Math.min(offset, Math.max(0, b.duration - 0.01));
    const length = (b.duration - from) / rate;
    if (voice) voiceEnd = c2.currentTime + length;
    // 鳴り終わりの知らせが来ない（裏に回った等）ときも、音の長さ＋0.5秒で先へ進める
    const done = new Promise((res) => {
      s.onended = res;
      later(res, length * 1000 + 500);
    });
    s.start(0, from);
    return done;
  }

  return {
    unlock: () => { ensure(true); revive(); },
    revive,
    suspend() { if (ctx && ctx.state === 'running') { try { Promise.resolve(ctx.suspend()).catch(() => {}); } catch { /* 止められなくても続ける */ } } },
    play,
    voiceLeft: () => (ctx ? Math.max(0, voiceEnd - ctx.currentTime) : 0),
    // まとめて読み込む（準備の前は何もしない）
    preload: (urls) => Promise.all(urls.map((u) => buffer(u).catch(() => null))).then(() => undefined),
    // 音を出す・出さない（全体の大きさ。いま鳴っている音もすぐ消える）
    setOutput(on) {
      outOn = on !== false;
      if (master) master.gain.value = outOn ? 1 : 0;
    },
    // iPhone のマナーモード中も鳴らすか（対応していないブラウザでは何もしない）
    setSilentPlay(on) {
      try {
        if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = on ? 'playback' : 'auto';
      } catch { /* 対応していない */ }
    },
  };
}

// 音を鳴らせるようにする操作。Android のタッチは押した瞬間（pointerdown）を利用者の操作と数えないので、
// 離したとき・クリック・キーでも準備する（準備ずみなら何もしない）
export const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
export function bindUnlock(target, audio) {
  for (const ev of UNLOCK_EVENTS) target.addEventListener(ev, () => audio.unlock(), { capture: true, passive: true });
}
