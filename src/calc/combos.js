// 2枚の組合せ（1,326通り）と、169種類の手（13×13の表の升目）。
// 升目 id ＝ 行 × 13 ＋ 列。行・列は 0=A … 12=2。
//   行＝列：ペア（6通り）／行＜列：同じマーク（4通り。行が高い方）／行＞列：違うマーク（12通り。列が高い方）
import { RANK_CHARS } from '../engine/cards.js';

export const COMBO_COUNT = 1326;
export const CLASS_COUNT = 169;

export const comboIndex = (a, b) => {
  if (a > b) [a, b] = [b, a];
  return a * 51 - (a * (a - 1)) / 2 + b - a - 1;
};

export function classOf(c1, c2) {
  let hi = c1 >> 2;
  let lo = c2 >> 2;
  if (lo > hi) [hi, lo] = [lo, hi];
  const gh = 12 - hi;
  const gl = 12 - lo;
  if (hi === lo) return gh * 13 + gh;
  return (c1 & 3) === (c2 & 3) ? gh * 13 + gl : gl * 13 + gh;
}

export const COMBO_A = new Uint8Array(COMBO_COUNT);
export const COMBO_B = new Uint8Array(COMBO_COUNT);
export const COMBO_CLASS = new Uint8Array(COMBO_COUNT);
export const CLASS_COMBOS = Array.from({ length: CLASS_COUNT }, () => []);
for (let a = 0; a < 52; a++) {
  for (let b = a + 1; b < 52; b++) {
    const i = comboIndex(a, b);
    COMBO_A[i] = a;
    COMBO_B[i] = b;
    COMBO_CLASS[i] = classOf(a, b);
    CLASS_COMBOS[COMBO_CLASS[i]].push(i);
  }
}

export function classLabel(id) {
  const row = Math.floor(id / 13);
  const col = id % 13;
  if (row === col) return RANK_CHARS[12 - row].repeat(2);
  if (row < col) return `${RANK_CHARS[12 - row]}${RANK_CHARS[12 - col]}s`;
  return `${RANK_CHARS[12 - col]}${RANK_CHARS[12 - row]}o`;
}

export function classFromLabel(label) {
  const id = CLASS_LABELS.indexOf(label);
  if (id < 0) throw new Error(`手の表記が不正: ${label}`);
  return id;
}
export const CLASS_LABELS = Array.from({ length: CLASS_COUNT }, (_, i) => classLabel(i));

export const classSize = (id) => CLASS_COMBOS[id].length;

// 見えているカード（dead）と重ならない組合せだけを数える
export function liveCombos(id, dead) {
  return CLASS_COMBOS[id].filter((i) => !dead.has(COMBO_A[i]) && !dead.has(COMBO_B[i]));
}

// レンジ＝1,326通りそれぞれの重み。見えているカードと重なる組合せは 0。
export function uniformRange(dead = new Set()) {
  const w = new Float64Array(COMBO_COUNT);
  for (let i = 0; i < COMBO_COUNT; i++) w[i] = dead.has(COMBO_A[i]) || dead.has(COMBO_B[i]) ? 0 : 1;
  return w;
}
