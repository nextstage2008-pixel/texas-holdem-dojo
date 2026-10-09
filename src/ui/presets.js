// レイズ額の目盛りと丸め（計算は calc/sizes.js。コーチも同じ目盛りを使う）
export { potTotal, clampTo, presetTargets } from '../calc/sizes.js';

// ダイヤルの最初の額。新しい判断の始まりは、前の判断の額を持ち越さずに目盛りの最初（½ポット・2.5倍）にする。
// 同じ判断の中で描き直すときは、合法な範囲にある今の額を保つ。
export function dialStart(controls, current, fresh) {
  const r = controls.raise;
  if (!fresh && current !== null && current >= r.min && current <= r.max) return current;
  return controls.presets[0]?.to ?? r.min;
}
