// 音の指揮役（設計書 段階4-5 第4・5・7節）。設定（入／切・大きさ・一言の量・あなたの声）を見て、
// sound-cues.js が決めた音の並びを、鳴らす部品（audio.js）に渡す。どこが失敗しても例外を外に出さない（その音を飛ばして続ける）。
// audio：{ play(url, { gain, rate, offset, voice, direct }) → Promise, voiceLeft() → 秒, preload(urls) → Promise, setSilentPlay(on), setOutput(on) }
// manifest：assets/voice/manifest.json（読めなければ null。声だけ鳴らさない）、settings()：今の音の設定（soundSettings の形）
// rng：揺らぎと言い回しの始めに使う乱数（ゲームの乱数とは別）、wait(ms, fn)：時間をおいて鳴らす（試験では手で進める）
import { SFX, SFX_DIR, MAX_GAIN } from './sfx.js';
import { createVoiceBook, CHATTER_RATE } from './sound-cues.js';

export const VOICE_WAIT = 0.8; // 鳴っている声の残りがこの秒数以内なら、終わってから続けて言う（掛け声）
export const CHATTER_WAIT = 5; // 一言は、鳴っている声が終わるまでこの秒数まで待つ（2026-10-08 先生が決定）
const CALLS = ['call', 'bet', 'raise', 'allin']; // 先読みする掛け声
const JITTER = new Set(['chip', 'chipAllin', 'deal', 'flip', 'knock']); // 大きさと高さを少し揺らす音

export function createSound({ audio, manifest: first = null, settings, rng = Math.random, wait = (ms, fn) => setTimeout(fn, ms) }) {
  let manifest = first;
  let book = createVoiceBook(manifest, rng);
  const stats = { sfx: 0, voice: 0, dropped: 0, failed: 0 };
  const turn = new Map(); // 効果音の順番
  const fetched = new Set(); // 先読みした人
  let warmed = false;
  let pending = null; // 待っている声（1つだけ）

  const guard = (fn) => (...args) => {
    try {
      return fn(...args);
    } catch {
      stats.failed++;
      return undefined;
    }
  };
  const send = (url, opts) => {
    const p = audio.play(url, opts);
    if (p && typeof p.catch === 'function') p.catch(() => { stats.failed++; });
  };
  const jitter = (a) => 1 + (rng() * 2 - 1) * a;
  const heroKey = (s) => (s.heroVoice === 'none' ? null : s.heroVoice);
  const urlOf = (s, { who, scene }) => (who === 'hero' ? (heroKey(s) ? book.hero(heroKey(s), scene) : null) : book.person(who, scene));

  function playSfx(name) {
    const s = settings();
    if (!s.on || !s.sfx || s.sfxVol <= 0) return;
    const list = SFX[name];
    if (!list) return;
    const i = turn.get(name) ?? 0;
    turn.set(name, (i + 1) % list.length);
    const v = list[i];
    const shake = JITTER.has(name);
    const gain = Math.min(MAX_GAIN, v.gain * (shake ? jitter(0.08) : 1)) * (s.sfxVol / 100);
    const rate = shake ? jitter(0.02) : 1;
    send(SFX_DIR + v.file, { gain, rate, offset: v.offset, voice: false });
    stats.sfx++;
  }

  // direct：全体の大きさ（音を出す・出さない）を通さない（設定画面の「試しに聞く」）
  function startVoice(url, s, direct = false) {
    send(url, { gain: s.voiceVol / 100, rate: 1, offset: 0, voice: true, ...(direct ? { direct: true } : {}) });
    stats.voice++;
  }

  // chatter：一言（一言の量の割合で言う。多めは必ず・ふつうは半分・なしは言わない）
  function playVoice(voice, chatter = false) {
    const s = settings();
    if (!s.on || !s.voice || s.voiceVol <= 0) return;
    if (chatter && !(rng() < (CHATTER_RATE[s.chatter] ?? 0))) return;
    const url = urlOf(s, voice);
    if (!url) return;
    const left = audio.voiceLeft();
    if (left <= 0) {
      // 待っている声は捨てる（前の声が終わってから待ちの時が来るまでの間に新しい声が鳴ると、2つ重なるため）
      if (pending) { stats.dropped++; pending = null; }
      startVoice(url, s);
      return;
    }
    // 待てる長さ：掛け声は VOICE_WAIT まで（古い掛け声は言わない）。一言は鳴っている声が終わるまで（CHATTER_WAIT まで）
    const limit = chatter ? CHATTER_WAIT : VOICE_WAIT;
    if (left > limit) { stats.dropped++; return; }
    if (pending) stats.dropped++;
    const token = { url };
    pending = token;
    // 待ちの時が来たら、まだ声が鳴っていないか確かめ直す（読み込みに時間がかかった声など）。
    // 残りが待てる長さ以内なら待ち直し、それより長ければ言わない
    const check = guard(() => {
      if (pending !== token) return;
      const rest = audio.voiceLeft();
      if (rest > limit) { pending = null; stats.dropped++; return; }
      if (rest > 0) { wait(rest * 1000, check); return; }
      pending = null;
      const now = settings();
      if (now.on && now.voice && now.voiceVol > 0) startVoice(url, now);
    });
    wait(left * 1000, check);
  }

  return {
    stats,
    // 声の一覧をあとから渡す（起動してから assets/voice/manifest.json を読み込むため）
    load: guard((m) => {
      manifest = m;
      book = createVoiceBook(m, rng);
      fetched.clear();
    }),
    // 音の並びを鳴らす。fast：早回しの間、paused：メニューなどの札が出ている間（どちらも何も鳴らさない）。
    // paused は「いま札が出ているか」を返す関数でもよい（時間をおいて鳴らす音も、鳴らす時に札が出ていれば鳴らさない。段階5-3）
    emit: guard((cues, { fast = false, paused = false } = {}) => {
      const isPaused = typeof paused === 'function' ? paused : () => paused;
      if (fast || isPaused() || !Array.isArray(cues) || !cues.length) return;
      if (!settings().on) return;
      for (const c of cues) {
        const fire = guard(() => (isPaused() ? undefined : c.sfx ? playSfx(c.sfx) : c.voice ? playVoice(c.voice, c.chatter === true) : undefined));
        if (c.at > 0) wait(Math.round(c.at * 1000), fire);
        else fire();
      }
    }),
    // 卓に着いた人（id の列。あなたは 'hero'）の掛け声を先読みする
    prefetch: guard((ids) => {
      const s = settings();
      if (!s.on || !s.voice) return;
      const urls = [];
      for (const id of ids) {
        const key = id === 'hero' ? (heroKey(s) ? `hero/${heroKey(s)}` : null) : id;
        const counts = id === 'hero' ? manifest?.hero?.[heroKey(s)] : manifest?.people?.[id];
        if (!key || !counts || fetched.has(key)) continue;
        fetched.add(key);
        for (const scene of CALLS) for (let n = 1; n <= (counts[scene] ?? 0); n++) urls.push(`assets/voice/${key}/${scene}_${n}.mp3`);
      }
      if (urls.length) audio.preload(urls)?.catch?.(() => { stats.failed++; });
    }),
    // 効果音をまとめて読み込む（音を鳴らせるようになったとき。1回だけ）
    warm: guard(() => {
      if (warmed) return;
      warmed = true;
      audio.preload(Object.values(SFX).flat().map((v) => SFX_DIR + v.file))?.catch?.(() => { stats.failed++; });
    }),
    // マナーモードの設定と、音を出す・出さない（全体の大きさ。いま鳴っている音もすぐ消える）を渡す（設定を変えたとき・起動したとき）
    apply: guard(() => {
      const s = settings();
      audio.setSilentPlay(s.silentPlay);
      audio.setOutput(s.on);
    }),
    // 設定画面の「試しに聞く」：選んだ声の「コール」（入／切に関係なく、声の大きさで鳴らす。全体の大きさも通さない）
    preview: guard((key) => {
      if (!key || key === 'none') return;
      const url = book.hero(key, 'call');
      if (url) startVoice(url, settings(), true);
    }),
  };
}
