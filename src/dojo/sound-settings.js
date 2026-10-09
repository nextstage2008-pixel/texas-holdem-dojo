// 音の設定（設計書 段階4-5 第5節）。初めの値と、記録から読んだ値の直し方。画面にも保存先にも触れない。
// 記録の settings.sound に残す。保存の版は4のまま（読むたびにこの直し方を通す）。

// あなたの声（設定で選ぶ男性の声8種類。key は assets/voice/hero/<key>/ のフォルダ名）
export const HERO_VOICES = [
  { key: 'ritoS', label: '重厚な低音' },
  { key: 'rito', label: '低く落ち着いた声' },
  { key: 'kenzaki', label: '低めで穏やかな声' },
  { key: 'kurono', label: '落ち着いた青年' },
  { key: 'kurosawa', label: 'クールな青年' },
  { key: 'suzumatsu', label: '明るい青年' },
  { key: 'kigashima', label: '高めではきはき' },
  { key: 'aru', label: '少年っぽい声' },
];
export const NO_VOICE = 'none'; // あなたの声「声なし」
// 一言の量
export const CHATTER = [{ key: 'many', label: '多め' }, { key: 'normal', label: 'ふつう' }, { key: 'none', label: 'なし' }];

export const DEFAULT_SOUND = {
  on: true, // 音を出す（卓の右上のボタンと同じもの）
  voice: true,
  sfx: true,
  voiceVol: 80, // 0〜100（10きざみ）
  sfxVol: 70,
  chatter: 'normal',
  heroVoice: 'kurono',
  silentPlay: false, // iPhone のマナーモードでも鳴らす
};

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const bool = (x, d) => (typeof x === 'boolean' ? x : d);
const vol = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(100, Math.max(0, Math.round(x / 10) * 10)) : d);
const VOICE_KEYS = new Set([...HERO_VOICES.map((v) => v.key), NO_VOICE]);
const CHATTER_KEYS = new Set(CHATTER.map((c) => c.key));

// 記録の settings から、音の設定を読む（ない・おかしい項目は初めの値）
export function soundSettings(settings) {
  const s = isObj(settings) && isObj(settings.sound) ? settings.sound : {};
  const d = DEFAULT_SOUND;
  return {
    on: bool(s.on, d.on),
    voice: bool(s.voice, d.voice),
    sfx: bool(s.sfx, d.sfx),
    voiceVol: vol(s.voiceVol, d.voiceVol),
    sfxVol: vol(s.sfxVol, d.sfxVol),
    chatter: CHATTER_KEYS.has(s.chatter) ? s.chatter : d.chatter,
    heroVoice: VOICE_KEYS.has(s.heroVoice) ? s.heroVoice : d.heroVoice,
    silentPlay: bool(s.silentPlay, d.silentPlay),
  };
}

// 音の設定の一部を変えた新しい記録
export function withSound(rec, patch) {
  const sound = soundSettings({ sound: { ...soundSettings(rec.settings), ...patch } });
  return { ...rec, settings: { ...rec.settings, sound } };
}
