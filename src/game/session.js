// 大会・ハンド・CPU・コーチをつなぐ。画面はこの関数だけを呼ぶ。
import { createRng } from '../engine/rng.js';
import { createTournament, startHand, finishHand, aliveSeats } from '../engine/tournament.js';
import { applyAction } from '../engine/hand.js';
import { decideCpu } from '../coach/policy.js';
import { analyzeDecision } from '../coach/analyze.js';
import { gradeAction } from '../coach/grade.js';
import { createCoachState, levelFor, recordDecision } from '../coach/levels.js';
import { actionLabel, bestLabel } from '../coach/explain.js';
import { expectedWon } from '../calc/runout.js';

// 既定のタイプ：堅い人（tight）・コールしすぎる人（station）・荒い人（aggro）・上級者（pro）
export const CAST = [
  { id: 'hero', name: 'あなた', avatar: 'av_hero', type: null },
  { id: 'tanaka', name: 'タナカ', avatar: 'av_tanaka', type: 'tight' },
  { id: 'sato', name: 'サトウ', avatar: 'av_sato', type: 'pro' },
  { id: 'suzuki', name: 'スズキ', avatar: 'av_suzuki', type: 'tight' },
  { id: 'yamada', name: 'ヤマダ', avatar: 'av_yamada', type: 'station' },
  { id: 'ito', name: 'イトウ', avatar: 'av_ito', type: 'aggro' },
  { id: 'watanabe', name: 'ワタナベ', avatar: 'av_watanabe', type: 'pro' },
  { id: 'kobayashi', name: 'コバヤシ', avatar: 'av_kobayashi', type: 'tight' },
  { id: 'kato', name: 'カトウ', avatar: 'av_kato', type: 'aggro' },
];
export const HERO_SEAT = 0;
// 席のタイプ（あなたの席を自動で打たせるときは上級者として打つ）
export const seatType = (seat) => CAST[seat].type ?? 'pro';

// coachMode：'auto'（場面ごとに自動で段階を調整）か 1〜5（固定）
// players：9人（席0があなた。既定は CAST）、heroName：あなたの名前、coach：続きから使う指南の状態（自動のときだけ）、
// minLevel：指南の段階の下限（章の対局は2）、hideTypes：相手のタイプを伏せる（第7章。コーチは標準的な相手＝上級者として推定する）、
// stacks・places・startLevel：大会の途中から始めるとき（第5・6章。engine/tournament.js の createTournament と同じ）
export function createSession({
  seed, handsPerLevel = 8, coachMode = 'auto', players = CAST, heroName = null, coach = null, minLevel = 1, hideTypes = false,
  stacks = null, places = null, startLevel = 0,
}) {
  const rng = createRng(seed);
  const seats = players.map((p, i) => (i === HERO_SEAT && heroName ? { ...p, name: heroName } : p));
  const tournament = createTournament({
    players: seats, handsPerLevel, stacks, places, startLevel, firstButton: Math.floor(rng() * seats.length),
  });
  return {
    seed, rng, tournament, hand: null, trail: [],
    decisions: [], coach: coach && coachMode === 'auto' ? structuredClone(coach) : createCoachState(coachMode),
    types: seats.map((p) => p.type ?? 'pro'), minLevel, hideTypes,
  };
}

// この大会での席のタイプ（CPUの打ち方）
export const typeAt = (session, seat) => session.types[seat];
// コーチが相手の手の推定に使うタイプ（タイプを伏せる対局では、標準的な相手＝上級者とみなす。
// trueTypes：伏せても本当のタイプで推定・採点する。設計書 段階4-4 第4節）
export const coachTypeOf = (session) => (seat) => (session.hideTypes && !session.trueTypes ? 'pro' : session.types[seat]);
// 画面に出すタイプ（伏せる章では null ＝「？」）
export const shownTypeOf = (session) => (seat) => (session.hideTypes ? null : session.types[seat]);
// 指南の段階（下限つき）
export const levelNow = (session, situation) => Math.max(session.minLevel, levelFor(session.coach, situation));
// 画面に渡す指南の状態（段階を下限で持ち上げたもの。記録そのものは変えない）
export function coachForView(session) {
  if (session.minLevel <= 1) return session.coach;
  const levels = {};
  for (const [k, v] of Object.entries(session.coach.levels)) levels[k] = Math.max(v, session.minLevel);
  return { ...session.coach, levels };
}

export function dealNext(session) {
  const { tournament, hand } = startHand(session.tournament, session.rng);
  return { ...session, tournament, hand, trail: [] };
}

export const actor = (session) => (session.hand ? session.hand.toAct : null);
export const isHeroTurn = (session) => actor(session) === HERO_SEAT;
export const heroAlive = (session) => session.tournament.players[HERO_SEAT].stack > 0;

export function act(session, action) {
  const step = { state: session.hand, seat: session.hand.toAct, action };
  return { ...session, hand: applyAction(session.hand, action), trail: [...session.trail, step] };
}

export function cpuAct(session) {
  const seat = actor(session);
  if (seat === null || seat === HERO_SEAT) throw new Error('CPUの手番ではない');
  return act(session, decideCpu(session.hand, seat, typeAt(session, seat), session.rng));
}

// 大会全体の残り人数（多卓の大会では卓の外の人も数える。1卓の大会は卓の残り人数）
export const aliveCount = (session) => session.tournament.aliveTotal ?? aliveSeats(session.tournament).length;

// コーチの分析の乱数の元：大会の種・ハンドの番号・このハンドであなたがもう行動した数（設計書 段階4-4 第6節）。
// 採点したかどうかや、閉じて続きから再開したかどうかで変わらないので、同じ場面ならいつも同じ助言と採点になる
export const coachSeed = (seed, handNumber, k) => (Math.imul(seed ^ 0x5eed, 0x2c1b3c6d) + Math.imul(handNumber + 1, 0x297a2d39) + k) >>> 0;
const heroActed = (session) => session.trail.filter((st) => st.seat === HERO_SEAT).length;

// あなたの手番の分析（コーチ欄と採点に使う）
export function analyzeHero(session) {
  if (!isHeroTurn(session)) throw new Error('あなたの手番ではない');
  const rng = createRng(coachSeed(session.seed, session.tournament.handNumber, heroActed(session)));
  return analyzeDecision({
    hand: session.hand, seat: HERO_SEAT, trail: session.trail, typeOf: coachTypeOf(session), rng,
    alive: aliveCount(session), paid: session.tournament.payouts.length,
  });
}

// あなたの行動を採点して記録し、行動を進める。返す値：{ session, verdict }
export function heroAct(session, action, analysis) {
  const g = gradeAction(analysis, action);
  const level = levelNow(session, analysis.situation);
  const rec = recordDecision(session.coach, analysis.situation, g);
  const verdict = {
    handNo: session.tournament.handNumber + 1, street: analysis.street, situation: analysis.situation, level,
    action, grade: g.grade, loss: g.loss, correct: g.correct, change: rec.change, reason: g.reason ?? null,
    actionText: actionLabel(analysis, action), bestText: bestLabel(analysis),
  };
  const next = act({ ...session, coach: rec.state, decisions: [...session.decisions, verdict] }, action);
  return { session: next, verdict };
}

// ハンドの結果（設計書 段階4-2 第3-2節）。ハンドが終わったあと、closeHand の前に呼ぶ。
// 返す値：{ bb（そのハンドのBB）, r（実際の増減）, e（本来の取り分で数えた増減）, allin（残りのカードが自動で配られたか） }。r・e はBB単位
// 対象（allin）：その席がショーダウンまで残り、最後の行動のときに場のカードが5枚そろっていない。それ以外は e＝r
export function handResult(session, seat = HERO_SEAT) {
  const { hand } = session;
  if (!hand || hand.street !== 'complete') throw new Error('ハンドが終わっていない');
  const bb = hand.blinds.bb;
  const start = session.tournament.players[seat].stack;
  const end = hand.seats[seat].stack;
  const r = (end - start) / bb;
  const board = session.trail.length ? session.trail.at(-1).state.board : [];
  const s = hand.seats[seat];
  if (!(hand.result.showdown && s.inHand && !s.folded && board.length < 5)) return { bb, r, e: r, allin: false };
  // 乱数の元はハンドごと（大会の種とハンドの番号から）。何度呼んでも同じ値
  const rng = createRng((Math.imul(session.seed ^ 0x2f1e, 0x9e3779b1) + session.tournament.handNumber) >>> 0);
  const exp = expectedWon(hand, board, rng);
  return { bb, r, e: (end - hand.result.won[seat] + exp[seat] - start) / bb, allin: true };
}

export function closeHand(session) {
  return { ...session, tournament: finishHand(session.tournament, session.hand), hand: null };
}

// テストと早送り用：あなたの席も上級者のCPUで打たせて、大会を最後まで回す。opts は createSession にそのまま渡す
export function playToEnd(seed, { maxHands = 5000, onHand, ...opts } = {}) {
  let s = createSession({ seed, ...opts });
  let hands = 0;
  while (!s.tournament.finished) {
    if (hands++ > maxHands) throw new Error(`seed ${seed}：大会が${maxHands}ハンドで終わらない`);
    s = dealNext(s);
    while (s.hand.street !== 'complete') {
      const seat = actor(s);
      s = act(s, decideCpu(s.hand, seat, typeAt(s, seat), s.rng));
    }
    if (onHand) onHand(s);
    s = closeHand(s);
  }
  return s;
}
