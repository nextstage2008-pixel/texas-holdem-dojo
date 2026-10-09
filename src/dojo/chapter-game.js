// 指南つき対局（設計書 段階3 第3節・段階4-1 第6節）：章ごとの相手の顔ぶれと始め方・合格の判定・判断の集計。
import { CAST } from '../game/session.js';
import { shuffle } from '../engine/cards.js';
import { chapterOf, GAME_RULE } from './chapters.js';

// 序章〜第2章は弱め（コールしすぎる人4・堅い人3・荒い人1）
const WEAK_TYPES = ['station', 'station', 'station', 'station', 'tight', 'tight', 'tight', 'aggro'];

// 返す値：{ players（9人。席0があなた）, hideTypes（タイプを伏せるか）}
export function chapterCast(chapterId, rng) {
  const mode = chapterOf(chapterId).cast;
  if (mode === 'default') return { players: CAST, hideTypes: false };
  const types = shuffle(mode === 'weak' ? WEAK_TYPES : CAST.slice(1).map((p) => p.type), rng);
  return { players: CAST.map((p, i) => (i === 0 ? p : { ...p, type: types[i - 1] })), hideTypes: mode === 'hidden' };
}

// 第5章：9人とも15BB（3,000点）・ブラインド100/200から。
// 第6章：9人の大会の残り5人から（4人は6〜9位で飛んだ扱い）。合計180,000点を5人に分け（1人6〜40BB・100点単位）、ブラインド1,000/2,000から
export const SHORT_STACK = 3000;
export const BUBBLE = { alive: 5, total: 180000, min: 12000, max: 80000, unit: 100, startLevel: 9 };

// 合計 total を n 人に分ける（unit 単位で、1人 min〜max）。区切りを乱数で選び、範囲に入るまで選び直す
function splitStacks(rng, { total, min, max, unit }, n) {
  const units = total / unit;
  for (let k = 0; k < 2000; k++) {
    const cuts = Array.from({ length: n - 1 }, () => 1 + Math.floor(rng() * (units - 1))).sort((a, b) => a - b);
    const parts = [...cuts, units].map((x, i) => (x - (i ? cuts[i - 1] : 0)) * unit);
    if (parts.every((x) => x >= min && x <= max)) return parts;
  }
  return new Array(n).fill(total / n); // 選び直しても入らないとき（実際には起きない）は等分
}

// 章の対局の顔ぶれと始め方。返す値：{ players, hideTypes, stacks, places, startLevel }（stacks・places は null なら全員20,000点から）
export function chapterSetup(chapterId, rng) {
  const cast = chapterCast(chapterId, rng);
  const { start } = chapterOf(chapterId);
  const n = cast.players.length;
  if (start === 'short') return { ...cast, stacks: new Array(n).fill(SHORT_STACK), places: null, startLevel: 0 };
  if (start !== 'bubble') return { ...cast, stacks: null, places: null, startLevel: 0 };
  // あなた（席0）と、相手から選んだ4人が残る。ほかの4人は 6〜9位で飛んだ扱い
  const others = shuffle(Array.from({ length: n - 1 }, (_, i) => i + 1), rng);
  const alive = [0, ...others.slice(0, BUBBLE.alive - 1)].sort((a, b) => a - b);
  const out = shuffle(others.slice(BUBBLE.alive - 1), rng);
  const parts = splitStacks(rng, BUBBLE, BUBBLE.alive);
  const stacks = new Array(n).fill(0);
  alive.forEach((seat, k) => { stacks[seat] = parts[k]; });
  const places = new Array(n).fill(null);
  out.forEach((seat, k) => { places[seat] = BUBBLE.alive + 1 + k; });
  return { ...cast, stacks, places, startLevel: BUBBLE.startLevel };
}

// 対局の始めに出す、その章の始め方の説明（ない章は null）
export function startNote(chapterId) {
  const { start } = chapterOf(chapterId);
  if (start === 'short') return '9人とも15BB（3,000点）から・ブラインド100/200から。最初から押すか降りるかの場面です。';
  if (start === 'bubble') return '9人の大会の残り5人から・入賞3人（50%・30%・20%）・ブラインド1,000/2,000から。最初から賞金で計算する場面です。';
  return null;
}

// 第5・6章：判断20回に届く前に大会が終わったら、同じ形の次の大会を続ける
export const continueGame = (chapterId, tally) => !!chapterOf(chapterId).keepGoing && tally.decisions < GAME_RULE.minDecisions;

// 続けた大会の判断の帳簿。all(今の大会の判断)＝前の大会までの判断＋今の大会の判断。
// 終わった大会の判断は、次の大会を始めるとき（carry）に繰り越す。「次の大会へ」の札が出ている間は、まだ今の大会の判断として数える（二重に数えない）
export function createCarry() {
  let carried = [];
  return {
    all: (current) => [...carried, ...current],
    carry: (current) => { carried = [...carried, ...current]; },
    reset: () => { carried = []; },
  };
}

// ハンドの結果（game/session.js の handResult）の帳簿（段階4-2）。all()：続けた大会の分も含む（大会の終わりの成績表の「運と実力」）、
// close()：今の大会の分を返す（大会の成績の1件に使う）。1大会に1回だけ返し、2回目は null（「次の大会へ」の札のあとに
// 「やめて判定する」を押しても、同じ大会を二重に残さない）。start(keep)：大会を始めるとき（keep＝第5・6章の次の大会）
export function createResultBook() {
  let all = [];
  let tour = [];
  let closed = false;
  return {
    start: (keep) => { if (!keep) all = []; tour = []; closed = false; },
    add: (r) => { all = [...all, r]; tour = [...tour, r]; },
    all: () => all,
    close: () => {
      if (closed) return null;
      closed = true;
      return tour;
    },
  };
}

// 採点した判断の列（session.decisions）から集計する。good＝「最善」と「許容」の数
export function tallyOf(decisions) {
  return {
    decisions: decisions.length,
    good: decisions.filter((d) => d.correct).length,
    lossSum: decisions.reduce((a, d) => a + d.loss, 0),
  };
}

// 合格の判定：判断20回以上で正答率80%以上
export function judgeGame(tally) {
  const accuracy = tally.decisions ? tally.good / tally.decisions : 0;
  const enough = tally.decisions >= GAME_RULE.minDecisions;
  return { enough, accuracy, passed: enough && accuracy >= GAME_RULE.passAccuracy };
}
