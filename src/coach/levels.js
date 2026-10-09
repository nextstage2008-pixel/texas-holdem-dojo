// 指南の段階（場面ごとに 1〜5）。設計書 第6-2節。
//   1：行動の前に推奨の手とその理由／2：行動の前は考えるきっかけだけ、行動の後に正誤
//   3：間違えた時だけ指摘／4：ハンドが終わってからまとめて振り返り／5：大会が終わってから成績表だけ
// 自動（auto）のときは、場面ごとの直近50回で「正答率90%以上かつ平均損失0.3BB以下」なら1段階進め、
// 「正答率75%未満」なら1段階戻す。段階が変わったら、その場面の記録は数え直す。
import { SITUATIONS } from './situations.js';
import { LEVELS } from './config.js';

export function createCoachState(mode = 'auto') {
  if (mode !== 'auto' && !(Number.isInteger(mode) && mode >= 1 && mode <= 5)) throw new Error(`指南の設定が不正: ${mode}`);
  const levels = {};
  const recent = {};
  for (const s of SITUATIONS) {
    levels[s] = mode === 'auto' ? 1 : mode;
    recent[s] = [];
  }
  return { mode, levels, recent };
}

export const levelFor = (state, situation) => state.levels[situation];

// 判断を1つ記録する。返す値：{ state（新しい状態）, change（段階が変わったら { situation, from, to, accuracy, avgLoss }）}
export function recordDecision(state, situation, { correct, loss }) {
  const next = structuredClone(state);
  const list = next.recent[situation];
  list.push({ correct, loss });
  if (list.length > LEVELS.recent) list.shift();
  if (next.mode !== 'auto' || list.length < LEVELS.recent) return { state: next, change: null };
  const accuracy = list.filter((d) => d.correct).length / list.length;
  const avgLoss = list.reduce((a, d) => a + d.loss, 0) / list.length;
  const from = next.levels[situation];
  let to = from;
  if (accuracy >= LEVELS.upAccuracy && avgLoss <= LEVELS.upLoss) to = Math.min(5, from + 1);
  else if (accuracy < LEVELS.downAccuracy) to = Math.max(1, from - 1);
  if (to === from) return { state: next, change: null };
  next.levels[situation] = to;
  next.recent[situation] = [];
  return { state: next, change: { situation, from, to, accuracy, avgLoss } };
}

// いつ何を見せるか。phase：before（行動の前）・after（行動の直後）・handEnd（ハンドの終わり）
// 返す値：full（すべて）・hint（考えるきっかけ）・verdict（採点と理由）・review（振り返り）・none
export function coachShows(level, phase, grade = null) {
  if (phase === 'before') return level === 1 ? 'full' : level === 2 ? 'hint' : 'none';
  if (phase === 'after') {
    if (level <= 2) return 'verdict';
    if (level === 3) return grade === 'dubious' || grade === 'bad' ? 'verdict' : 'none';
    return 'none';
  }
  if (phase === 'handEnd') return level === 4 ? 'review' : 'none';
  throw new Error(`知らない場面: ${phase}`);
}
