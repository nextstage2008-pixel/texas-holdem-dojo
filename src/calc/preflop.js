// プリフロップの勝率表を引く（表は scripts/build-preflop-table.mjs で作る）。
import { PREFLOP_EQ, SAMPLES } from '../../data/preflop-equity.js';
import { CLASS_COUNT } from './combos.js';

// 表の1件あたりの誤差（95%の幅）。各組 SAMPLES 回の試行なので、最大でも 1.96×√(0.25/SAMPLES)。
export const TABLE_ERR = 1.96 * Math.sqrt(0.25 / SAMPLES);

const rowStart = new Int32Array(CLASS_COUNT);
for (let a = 1; a < CLASS_COUNT; a++) rowStart[a] = rowStart[a - 1] + (CLASS_COUNT - (a - 1));

// 種類 a の手が種類 b の手に勝つ見込み（0〜1。引き分けは半分）
export function classVsClass(a, b) {
  if (a <= b) return PREFLOP_EQ[rowStart[a] + (b - a)] / 10000;
  return 1 - PREFLOP_EQ[rowStart[b] + (a - b)] / 10000;
}
