// 手の強さの区分（CPUの打ち方と相手の手の推定で使う）。
//   strong：自分のカードを使ったスリーカード以上か、場にペアがないときのツーペア
//   good：自分のカードで作ったペアが、場の一番高いカード以上（トップペア・オーバーペア）
//   weak：それより下のペア
//   draw：フラッシュドローか、1枚でストレートになるランクが2つ以上（リバーでは無し）
//   air：何もない（場のペアだけを含む）
import { evalFast, straightHighOf } from '../engine/fast-eval.js';

export const CLASSES = ['strong', 'good', 'weak', 'draw', 'air'];
const catOf = (s) => Math.floor(s / 16 ** 5);
const rankAt = (s, k) => Math.floor(s / 16 ** (4 - k)) % 16; // 点数の k 番目のランク

function flushDraw(cards, hole) {
  const n = [0, 0, 0, 0];
  for (const c of cards) n[c & 3]++;
  return hole.some((c) => n[c & 3] === 4);
}

function straightDrawRanks(cards) {
  let mask = 0;
  for (const c of cards) mask |= 1 << (c >> 2);
  let k = 0;
  for (let r = 0; r < 13; r++) if (!(mask & (1 << r)) && straightHighOf(mask | (1 << r)) >= 0) k++;
  return k;
}

export function handClass(hole, board) {
  const all = [...hole, ...board];
  const s = evalFast(all);
  const cat = catOf(s);
  const b = evalFast(board);
  const boardCat = catOf(b);
  if (cat >= 3 && cat > boardCat) return 'strong';
  if (cat === 2 && boardCat === 0) return 'strong';
  let pair = -1; // 自分のカードで作ったペアのランク
  if (cat === 1 && boardCat === 0) pair = rankAt(s, 0);
  if (cat === 2 && boardCat === 1) pair = rankAt(s, 0) === rankAt(b, 0) ? rankAt(s, 1) : rankAt(s, 0);
  if (pair >= 0) return pair >= Math.max(...board.map((c) => c >> 2)) ? 'good' : 'weak';
  if (board.length < 5) {
    if (flushDraw(all, hole)) return 'draw';
    if (straightDrawRanks(all) >= 2 && straightDrawRanks(board) < 2) return 'draw';
  }
  return 'air';
}
