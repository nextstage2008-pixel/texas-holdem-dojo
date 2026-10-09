// 役判定。点数 = 役 × 16^5 + 比べる順のランク（各4ビット）。大きいほど強く、同じなら引き分け。
// 段階2で勝率を大量に計算するときは高速版に差し替え、この版と突き合わせて検証する。
import { rankOf, suitOf } from './cards.js';

export const CATEGORY = {
  HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4,
  FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8,
};
export const CATEGORY_NAMES = [
  'ハイカード', 'ワンペア', 'ツーペア', 'スリーカード', 'ストレート',
  'フラッシュ', 'フルハウス', 'フォーカード', 'ストレートフラッシュ',
];

const BASE = 16 ** 5;

function score(category, ranks) {
  let s = category;
  for (let i = 0; i < 5; i++) s = s * 16 + (ranks[i] ?? 0);
  return s;
}

export const categoryOf = (s) => Math.floor(s / BASE);

// 5種類のランク（降順）がストレートなら一番上のランク。A-2-3-4-5 は 3（＝5）を返す。
function straightHigh(ranks) {
  const set = new Set(ranks);
  for (let hi = 12; hi >= 3; hi--) {
    let ok = true;
    for (let k = 0; k < 5; k++) {
      const r = hi - k;
      if (!set.has(r === -1 ? 12 : r)) { ok = false; break; }
    }
    if (ok) return hi;
  }
  return -1;
}

export function evaluate5(cards) {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // 枚数の多い順、同じ枚数ならランクの高い順
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const top = groups.map((g) => g[0]);
  const sHigh = groups.length === 5 ? straightHigh(ranks) : -1;
  if (sHigh >= 0 && flush) return score(CATEGORY.STRAIGHT_FLUSH, [sHigh]);
  if (groups[0][1] === 4) return score(CATEGORY.QUADS, top);
  if (groups[0][1] === 3 && groups[1][1] === 2) return score(CATEGORY.FULL_HOUSE, top);
  if (flush) return score(CATEGORY.FLUSH, ranks);
  if (sHigh >= 0) return score(CATEGORY.STRAIGHT, [sHigh]);
  if (groups[0][1] === 3) return score(CATEGORY.TRIPS, top);
  if (groups[0][1] === 2 && groups[1][1] === 2) return score(CATEGORY.TWO_PAIR, top);
  if (groups[0][1] === 2) return score(CATEGORY.PAIR, top);
  return score(CATEGORY.HIGH_CARD, ranks);
}

function combos(n, k) {
  const out = [];
  const rec = (start, acc) => {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < n; i++) { acc.push(i); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}
const COMBOS = { 5: combos(5, 5), 6: combos(6, 5), 7: combos(7, 5) };

export function evaluate(cards) {
  const list = COMBOS[cards.length];
  if (!list) throw new Error(`評価できるのは5〜7枚: ${cards.length}枚`);
  let best = -1;
  for (const idx of list) {
    const s = evaluate5(idx.map((i) => cards[i]));
    if (s > best) best = s;
  }
  return best;
}

export function describe(s) {
  const cat = categoryOf(s);
  const topRank = Math.floor(s / 16 ** 4) % 16;
  if (cat === CATEGORY.STRAIGHT_FLUSH && topRank === 12) return 'ロイヤルフラッシュ';
  return CATEGORY_NAMES[cat];
}
