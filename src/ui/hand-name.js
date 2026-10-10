// 詳しい役の名前（設計書 段階5-5 第2-3節）。画面に触れない。役の判定は engine/evaluator.js をそのまま使う（変えない）。
// 「A のワンペア」「K と 9 のツーペア」「6 から 10 のストレート」「♥ のフラッシュ（A が最高）」のように、札の数字とマークで言う
import { evaluate5, categoryOf, CATEGORY } from '../engine/evaluator.js';
import { rankOf, suitOf, RANK_CHARS, SUIT_SYMBOLS } from '../engine/cards.js';
import { bestFive } from './best-five.js';

// 札の数字の言い方（T は 10）。r：ランク（0＝2 … 12＝A）
export const rankLabel = (r) => (RANK_CHARS[r] === 'T' ? '10' : RANK_CHARS[r]);
// 点数の、比べる順の k 番目のランク（evaluator.js の点数＝役 × 16^5 ＋ ランク5つ）
const digit = (s, k) => Math.floor(s / 16 ** (4 - k)) % 16;
const straightOf = (hi) => (hi === 3 ? 'A から 5' : `${rankLabel(hi - 4)} から ${rankLabel(hi)}`);

// 5枚の詳しい役の名前。cards：5枚
export function handDetail(cards) {
  const s = evaluate5(cards);
  const r = (k) => rankLabel(digit(s, k));
  const suit = SUIT_SYMBOLS[suitOf(cards[0])];
  switch (categoryOf(s)) {
    case CATEGORY.STRAIGHT_FLUSH: return digit(s, 0) === 12 ? `${suit} のロイヤルフラッシュ` : `${suit} の ${straightOf(digit(s, 0))} のストレートフラッシュ`;
    case CATEGORY.QUADS: return `${r(0)} のフォーカード`;
    case CATEGORY.FULL_HOUSE: return `${r(0)} が3枚と ${r(1)} が2枚のフルハウス`;
    case CATEGORY.FLUSH: return `${suit} のフラッシュ（${r(0)} が最高）`;
    case CATEGORY.STRAIGHT: return `${straightOf(digit(s, 0))} のストレート`;
    case CATEGORY.TRIPS: return `${r(0)} のスリーカード`;
    case CATEGORY.TWO_PAIR: return `${r(0)} と ${r(1)} のツーペア`;
    case CATEGORY.PAIR: return `${r(0)} のワンペア`;
    default: return `${r(0)} が最高のハイカード`;
  }
}

// 見せる順の5枚：枚数の多い順、同じならランクの高い順（同じランクはマークの順）。ストレートは高い順で、A から 5 は A を最後に
export function orderFive(cards) {
  const s = evaluate5(cards);
  const cat = categoryOf(s);
  const count = new Map();
  for (const c of cards) count.set(rankOf(c), (count.get(rankOf(c)) ?? 0) + 1);
  const wheel = (cat === CATEGORY.STRAIGHT || cat === CATEGORY.STRAIGHT_FLUSH) && digit(s, 0) === 3;
  const key = (c) => (wheel && rankOf(c) === 12 ? -1 : rankOf(c));
  return [...cards].sort((a, b) => count.get(rankOf(b)) - count.get(rankOf(a)) || key(b) - key(a) || suitOf(b) - suitOf(a));
}

// 手札（2枚）と場の札（3〜5枚）から、役を作った5枚（見せる順）と詳しい役の名前。5枚の選び方は 5-3 の光らせ方と同じ（best-five.js）。
// 返す値：{ cards（5枚）, name }
export function bestHand(hole, board) {
  const pick = bestFive(hole, board);
  const cards = [...hole.filter((_, i) => pick.hole[i]), ...board.filter((_, k) => pick.board[k])];
  return { cards: orderFive(cards), name: handDetail(cards) };
}
