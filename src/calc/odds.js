// ポットオッズとアウツ。
//   損益分岐点＝払う額 ÷（ポット＋払う額）
//   アウツ＝次に出ればストレート以上に良くなるカード（場のカードだけで作られる役は数えない）
//   完成の見込み：暗算（フロップ×4、ターン×2）と正確な値（フロップは残り2枚のどちらかで出る確率）
import { evalFast } from '../engine/fast-eval.js';

const catOf = (s) => Math.floor(s / 16 ** 5);
const STRAIGHT = 4;

export const breakeven = (toCall, potBefore) => toCall / (potBefore + toCall);

export function drawOuts(hole, board) {
  if (board.length < 3 || board.length > 4) return { outs: [], kinds: [] };
  const seen = new Set([...hole, ...board]);
  const now = catOf(evalFast([...hole, ...board]));
  const outs = [];
  let flush = 0;
  let straight = 0;
  for (let c = 0; c < 52; c++) {
    if (seen.has(c)) continue;
    const cat = catOf(evalFast([...hole, ...board, c]));
    const boardOnly = catOf(evalFast([...board, c]));
    if (cat < STRAIGHT || cat <= now || cat <= boardOnly) continue;
    outs.push(c);
    if (cat === 5) flush++;
    if (cat === 4) straight++;
  }
  const kinds = [];
  if (flush > 0) kinds.push('フラッシュドロー');
  if (straight >= 4) kinds.push('ストレートドロー');
  return { outs, kinds };
}

// アウツ n 枚のとき、次（フロップなら残り2枚のどちらか）で完成する確率
export function outsChance(n, street) {
  if (street === 'flop') return 1 - ((47 - n) * (46 - n)) / (47 * 46);
  if (street === 'turn') return n / 46;
  return 0;
}

export const ruleOfThumb = (n, street) => n * (street === 'flop' ? 4 : street === 'turn' ? 2 : 0) / 100;
