// 動きの設定（設計書 段階5-3 第5節）。初めの値と、記録から読んだ値の直し方。画面にも保存先にも触れない。
// 記録の settings.motion に残す。保存の版は4のまま（読むたびにこの直し方を通す）。

// 動きの速さ（設定の画面で選ぶ）。factor：動きの長さに掛ける係数
export const SPEEDS = [
  { key: 'normal', label: 'ふつう', factor: 1 },
  { key: 'fast', label: '速い', factor: 0.5 },
  { key: 'faster', label: 'とても速い', factor: 0.25 },
];
export const FAST_FACTOR = 0.25; // ⏩ を押している間と、あなたが降りたあと（勝負になったハンドの勝負と結果は除く）
// reduce：動きを減らす（入 true・切 false）。null は端末の「動きを減らす」（prefers-reduced-motion）に従う
export const DEFAULT_MOTION = { speed: 'normal', reduce: null };

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const SPEED_KEYS = new Set(SPEEDS.map((s) => s.key));

// 記録の settings から、動きの設定を読む（ない・おかしい項目は初めの値）
export function motionSettings(settings) {
  const m = isObj(settings) && isObj(settings.motion) ? settings.motion : {};
  return {
    speed: SPEED_KEYS.has(m.speed) ? m.speed : DEFAULT_MOTION.speed,
    reduce: typeof m.reduce === 'boolean' ? m.reduce : DEFAULT_MOTION.reduce,
  };
}

// 動きの設定の一部を変えた新しい記録
export function withMotion(rec, patch) {
  const motion = motionSettings({ motion: { ...motionSettings(rec.settings), ...patch } });
  return { ...rec, settings: { ...rec.settings, motion } };
}

// いまの動き：{ factor（速さの係数）, reduce（動きを減らすか）}。prefersReduced：端末の「動きを減らす」が入っているか
export function motionNow(settings, prefersReduced) {
  const m = motionSettings(settings);
  return { factor: SPEEDS.find((s) => s.key === m.speed).factor, reduce: m.reduce === null ? !!prefersReduced : m.reduce };
}
