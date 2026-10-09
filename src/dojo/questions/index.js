// 問題の型の一覧。makeQuestion({ type, seed }) で、型と種から毎回同じ問題を作る。
// 問題の形：{ type, seed, chapter, prompt, scene: { board, hole, others: [{ label, cards }], pills }, choices, answer, explain: [文], calc }
import { winner, bestHand } from './prologue.js';
import { open, combos } from './ch1.js';
import { outs, breakeven, drawCall } from './ch2.js';
import { handClassQ, betOrCheck } from './ch3.js';
import { rangeCount } from './ch4.js';
import { pushFold, callPush, foldEquity } from './ch5.js';
import { icmValue, bubbleCall, bubblePush } from './ch6.js';
import { typeGuess, counter } from './ch7.js';
import { allinShare, longRun, sampleSize } from './ch8.js';
import { CHAPTERS } from '../chapters.js';
import { rngOf } from './util.js';

const MAKERS = {
  winner, bestHand, open, combos, outs, breakeven, drawCall, handClass: handClassQ, betOrCheck, rangeCount, pushFold, callPush, foldEquity,
  icmValue, bubbleCall, bubblePush, typeGuess, counter, allinShare, longRun, sampleSize,
};

export const QUESTION_TYPES = Object.keys(MAKERS);
export const chapterOfType = (type) => CHAPTERS.find((c) => c.types.includes(type))?.id ?? null;

// 作り直しの上限まで作れなかったとき（「ベットする？」で数万問に1問ほど）は、種から決まる別の乱数で作り直す。
// 同じ種なら必ず同じ問題になり、作れずに止まることはない。最初の乱数は今までと同じなので、作れていた問題は変わらない
const FALLBACKS = 12;
export function generateWithFallback(make, seed) {
  for (let k = 0; k <= FALLBACKS; k++) {
    try {
      return make(rngOf(k === 0 ? seed : (seed + k * 0x9e3779b1) >>> 0));
    } catch (e) {
      if (e.message !== '問題を作れなかった' || k === FALLBACKS) throw e;
    }
  }
  throw new Error('問題を作れなかった');
}

export function makeQuestion({ type, seed }) {
  const make = MAKERS[type];
  if (!make) throw new Error(`知らない問題の型: ${type}`);
  if (!Number.isInteger(seed) || seed < 0) throw new Error(`種が不正: ${seed}`);
  return { type, seed, chapter: chapterOfType(type), ...generateWithFallback(make, seed) };
}

// 作った問題を覚えておく（同じ型と種なら作り直さない。第3章の「ベットする？」は1問0.1秒ほどかかるため、
// 試験の終わりの採点で20問を作り直すと画面が止まる）
const memo = new Map();
export function cachedQuestion(item) {
  const key = `${item.type}:${item.seed}`;
  if (!memo.has(key)) memo.set(key, makeQuestion(item));
  return memo.get(key);
}
