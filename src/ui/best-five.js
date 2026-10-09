// 役を作った5枚（設計書 段階5-3 第4-4節）。画面に触れない。役の判定は engine/evaluator.js をそのまま使う（変えない）。
import { evaluate5 } from '../engine/evaluator.js';

// 手札（2枚）と場の札（3〜5枚）から、いちばん強い5枚。返す値：{ hole: [bool, bool], board: [bool…]（場の札の数）}。
// 同じ強さの組がいくつかあるときは、手札を使う数の少ない組（場の札だけで役ができたら場の5枚）
export function bestFive(hole, board) {
  const cards = [...hole, ...board];
  const n = cards.length;
  let best = -1;
  let pick = null;
  let used = 3;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const idx = [a, b, c, d, e];
    const s = evaluate5(idx.map((i) => cards[i]));
    const h = idx.filter((i) => i < hole.length).length;
    if (s > best || (s === best && h < used)) { best = s; pick = idx; used = h; }
  }
  return { hole: hole.map((_, i) => pick.includes(i)), board: board.map((_, k) => pick.includes(hole.length + k)) };
}

// 勝負の光らせ方：勝った人の5枚（分け合いならそれぞれの5枚を合わせる）。hand：{ board, seats[i].hole, result: { showdown, winners } }。
// 返す値：{ board: [bool…], hole: { 勝った人の席: [bool, bool] }}。勝負にならなかったハンドは null
export function showdownLit(hand) {
  if (!hand.result || !hand.result.showdown) return null;
  const board = hand.board.map(() => false);
  const hole = {};
  for (const w of hand.result.winners) {
    const f = bestFive(hand.seats[w].hole, hand.board);
    f.board.forEach((on, k) => { if (on) board[k] = true; });
    hole[w] = f.hole;
  }
  return { board, hole };
}
