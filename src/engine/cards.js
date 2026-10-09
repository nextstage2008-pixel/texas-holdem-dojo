// カードは 0〜51 の整数で表す。rank = c >> 2（0=2 … 12=A）、suit = c & 3（0=♣ 1=♦ 2=♥ 3=♠）。
export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'cdhs';
export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

export const rankOf = (c) => c >> 2;
export const suitOf = (c) => c & 3;
export const makeCard = (rank, suit) => (rank << 2) | suit;

export function parseCard(s) {
  if (typeof s !== 'string' || s.length !== 2) throw new Error(`カードの表記が不正: ${s}`);
  const r = RANK_CHARS.indexOf(s[0].toUpperCase());
  const u = SUIT_CHARS.indexOf(s[1].toLowerCase());
  if (r < 0 || u < 0) throw new Error(`カードの表記が不正: ${s}`);
  return makeCard(r, u);
}

export const parseCards = (str) => str.trim().split(/\s+/).map(parseCard);

export function cardLabel(c) {
  const r = RANK_CHARS[rankOf(c)];
  return (r === 'T' ? '10' : r) + SUIT_SYMBOLS[suitOf(c)];
}

export const isRed = (c) => suitOf(c) === 1 || suitOf(c) === 2;

export function newDeck() {
  return Array.from({ length: 52 }, (_, i) => i);
}

// フィッシャー–イェーツ。元の配列は変えない。
export function shuffle(deck, rng) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
