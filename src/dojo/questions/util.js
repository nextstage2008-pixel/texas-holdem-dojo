// 問題づくりの共通部品。問題は「型」と「種」から毎回同じものを作る（乱数はシード付きだけを使う）。
import { createRng } from '../../engine/rng.js';
import { cardLabel } from '../../engine/cards.js';

export const rngOf = (seed) => createRng((seed ^ 0x9e3779b9) >>> 0);
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// 見えているカード（used）と重ならないカードを n 枚
export function drawCards(rng, n, used = new Set()) {
  const out = [];
  while (out.length < n) {
    const c = Math.floor(rng() * 52);
    if (used.has(c) || out.includes(c)) continue;
    out.push(c);
  }
  return out;
}

export function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 正解と、重ならない間違いの選択肢を並べる（並びは種で決まる）。fixed のときは渡した順のまま
export function withChoices(rng, correct, wrongs, { count = 4, fixed = null } = {}) {
  if (fixed) {
    const answer = fixed.indexOf(correct);
    if (answer < 0) throw new Error(`選択肢に正解がない: ${correct}`);
    return { choices: fixed, answer };
  }
  const uniq = [...new Set(wrongs.filter((w) => w !== correct))];
  if (uniq.length < count - 1) throw new Error(`間違いの選択肢が足りない: ${correct}`);
  const choices = shuffled(rng, [correct, ...shuffled(rng, uniq).slice(0, count - 1)]);
  return { choices, answer: choices.indexOf(correct) };
}

export const pct = (x) => `${Math.round(x * 100)}%`;
// 強い順の「上位○%」（四捨五入で 0% になるとても強い手は「1%未満」）
export const topPct = (x) => (x < 0.005 ? '1%未満' : pct(x));
// 手の言い方（書き方の記号 AKs・TT などを使わず、ふだんの言葉で。2026-10-12）：'AKs' → 'A と K（同じマーク）'・'TT' → '10 のペア'・'AK' → 'A と K'
const rankWord = (ch) => (ch === 'T' ? '10' : ch);
export function handName(label) {
  const a = rankWord(label[0]);
  const b = rankWord(label[1]);
  if (label[0] === label[1]) return `${a} のペア`;
  const suit = { s: '（同じマーク）', o: '（違うマーク）' }[label[2]] ?? '';
  return `${a} と ${b}${suit}`;
}
export const cardsText = (cards) => cards.map(cardLabel).join(' ');
export const fmt = (n) => Math.round(n).toLocaleString('en-US');

// 答えのはっきりした場面が見つかるまで作り直す（種から決まる乱数で回すので、同じ種なら同じ結果）
export function retry(rng, make, limit = 4000) {
  for (let k = 0; k < limit; k++) {
    const q = make(rng);
    if (q) return q;
  }
  throw new Error('問題を作れなかった');
}
// 小数1けたの%（32.75% のような半ちょうどを、小数の誤差で切り捨てないよう四捨五入する）
export const pct1 = (x) => `${(Math.round(x * 1000 + 1e-9) / 10).toFixed(1)}%`;
export const sbb = (x) => (x >= 0 ? `+${x.toFixed(1)}BB` : `−${(-x).toFixed(1)}BB`);
export const spct = (x) => (x >= 0 ? `+${(x * 100).toFixed(1)}%` : `−${(-x * 100).toFixed(1)}%`);
