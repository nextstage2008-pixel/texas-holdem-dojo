// 統計（設計書 段階4-2 第3節・第5節）：場面ごとの判断の累計・直近1,000ハンドの結果・直近100大会の成績と、成績画面の数字。
// どの操作も統計を書き換えず、新しい統計を返す。ハンドの結果の単位はBB（r＝実際の増減、e＝本来の取り分で数えた増減）。
import { SITUATIONS, SITUATION_LABEL } from '../coach/situations.js';

export const HAND_LIMIT = 1000;
export const EVENT_LIMIT = 100;
export const MIN_HANDS = 100; // 運と実力：これより少ないうちは「まだハンドが少ない」
// 弱点の場面を教える章（復習のボタン）
export const LEAK_CHAPTER = { entry: 'ch1', draw: 'ch2', bet: 'ch3', allin: 'ch5', bubble: 'ch6' };

const round2 = (x) => Math.round(x * 100) / 100 || 0; // 0.01単位（−0 にしない）
const emptySituation = () => ({ n: 0, good: 0, lossSum: 0, lossSq: 0 });

// recent：段位の判定に使う、数えた判断の直近300回（dojo/ranks.js の addRecent。版4から）
export function emptyStats() {
  return { situations: Object.fromEntries(SITUATIONS.map((k) => [k, emptySituation()])), hands: [], events: [], recent: [] };
}

// 採点した判断（session の verdict：situation・loss・correct）を足す
export function addDecisions(stats, verdicts) {
  const situations = { ...stats.situations };
  for (const v of verdicts) {
    const c = situations[v.situation];
    situations[v.situation] = { n: c.n + 1, good: c.good + (v.correct ? 1 : 0), lossSum: c.lossSum + v.loss, lossSq: c.lossSq + v.loss * v.loss };
  }
  return { ...stats, situations };
}

// ハンドの結果（game/session.js の handResult の r・e）を足す
export function addHand(stats, { r, e }) {
  return { ...stats, hands: [...stats.hands, { r: round2(r), e: round2(e) }].slice(-HAND_LIMIT) };
}

// 大会の成績1件。date：端末の暦の日、kind：'free'・'main'・'exam' か章の id、place：順位（やめて判定したときは null）、
// results：その大会のハンドの結果、verdicts：その大会の判断、exam：以前の試験の大会の合否の印（'pass'・'fail'・null。古い記録の行だけ）
export function eventOf({ date, kind, place, results, verdicts, exam }) {
  return {
    date, kind, place, hands: results.length, decisions: verdicts.length, good: verdicts.filter((d) => d.correct).length,
    lossSum: round2(verdicts.reduce((a, d) => a + d.loss, 0)), luck: round2(results.reduce((a, x) => a + x.r - x.e, 0)),
    ...(exam === undefined ? {} : { exam }),
  };
}

export function addTournament(stats, event) {
  return { ...stats, events: [...stats.events, event].slice(-EVENT_LIMIT) };
}

// 回数・合計・2乗の合計から、平均・ばらつき（標本の標準偏差）・95%の幅（1.96×標準偏差÷√回数）。0回なら null
export function meanCI(n, sum, sq) {
  if (n <= 0) return null;
  const mean = sum / n;
  const sd = n > 1 ? Math.sqrt(Math.max(0, (sq - n * mean * mean) / (n - 1))) : 0;
  return { mean, sd, half: (1.96 * sd) / Math.sqrt(n) };
}

const rowOf = (c) => {
  const ci = meanCI(c.n, c.lossSum, c.lossSq);
  return { n: c.n, good: c.good, lossSum: c.lossSum, rate: c.n ? c.good / c.n : null, mean: ci?.mean ?? null, half: ci?.half ?? null };
};

// 全部の場面の累計
export function totalsOf(stats) {
  const t = emptySituation();
  for (const c of Object.values(stats.situations)) { t.n += c.n; t.good += c.good; t.lossSum += c.lossSum; t.lossSq += c.lossSq; }
  return rowOf(t);
}

// 場面ごとの表。coach：記録の指南の状態（いまの段階を添える）
export const situationRows = (stats, coach) => SITUATIONS.map((key) => ({
  key, label: SITUATION_LABEL[key], level: coach.levels[key], ...rowOf(stats.situations[key]),
}));

// 弱点の順位：損の合計が大きい順に limit 個（損が0の場面は出さない）
export const leaks = (stats, limit = 3) => SITUATIONS
  .map((key) => ({ key, label: SITUATION_LABEL[key], chapter: LEAK_CHAPTER[key], ...rowOf(stats.situations[key]) }))
  .filter((x) => x.lossSum > 0)
  .sort((a, b) => b.lossSum - a.lossSum)
  .slice(0, limit);

// 運と実力の数字。actual・ev：0から始まる累計の線（ハンド数＋1点）、total：実際・本来の取り分・運の合計、
// per100：100ハンドあたりの成績（100×実際の増減の平均）と95%の幅（1.96×100×標準偏差÷√ハンド数）。straddles：幅が0をまたぐ
export function luckView(stats) {
  const hs = stats.hands;
  const actual = [0];
  const ev = [0];
  let sq = 0;
  for (const h of hs) { actual.push(actual.at(-1) + h.r); ev.push(ev.at(-1) + h.e); sq += h.r * h.r; }
  const total = { actual: actual.at(-1), ev: ev.at(-1), luck: actual.at(-1) - ev.at(-1) };
  const ci = meanCI(hs.length, total.actual, sq);
  const per100 = ci && { mean: 100 * ci.mean, half: 100 * ci.half, straddles: Math.abs(ci.mean) <= ci.half };
  return { n: hs.length, enough: hs.length >= MIN_HANDS, actual, ev, total, per100 };
}
