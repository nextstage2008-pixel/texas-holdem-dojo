// CPUの打ち方（4タイプ）。「この場面で、この2枚なら、どの行動をどの確率でとるか」を返す。
// CPUはこの確率で行動を選び、コーチは同じ確率を使って相手の手を絞る（ベイズの考え方）。
// どの行動にも小さな確率（揺らぎ）を残すので、どんな行動を見ても推定が破綻しない。
//
// 数字の意味（プリフロップの範囲は「169種類を強い順に並べた上位何%」）
//   openMult：参加表の参加率に掛ける倍率（上級者＝1.0＝コーチと同じ参加表）
//   limp：レイズせずにコールで参加する範囲／threeBet：レイズに再レイズする範囲／defend：レイズにコールする範囲
//   keep：自分のレイズに再レイズされたとき、自分の参加範囲のうち続ける割合
//   push：持ち点12BB以下でオールインする範囲の広さ（倍率）／callAllIn：大きな額やオールインにコールする範囲
//   bet：誰も賭けていないときに賭ける確率（手の強さの区分ごと）
//   fold：賭けに対して、払う額の割合（払う額÷払った後のポット）がこれを超えると降りる（区分ごと）。
//         割合は賭けの大きさで決まり 0.5 未満：½ポット＝0.25、⅔ポット＝0.29、ポット＝0.33、2倍＝0.4、4.5倍＝0.45。
//         強い手（strong）はどのタイプも 0.5 以上＝どんな額でも降りない（降りると、大きなはったりが得になってしまう）。
//         0.5 以上にした区分は、どんな額でも降りない
//   raise：賭けに対してレイズする確率／float：何もない手でコールする確率／betSize：賭ける額（ポットに対する割合）
// 上級者だけは、押す・受ける場面（段階4-1）をコーチと同じ基準（calc/pushfold.js）で打つ（下の proAllin）。
import { legalActions } from '../engine/hand.js';
import { classOf } from '../calc/combos.js';
import { CLASS_PCT } from '../calc/chart.js';
import { openCutoff, positionOf } from '../calc/position.js';
import { potTotal } from '../calc/sizes.js';
import { isUnopened, pusherOf, spotOf, prizeOf, solveSpot } from '../calc/pushfold.js';
import { handClass } from './features.js';
import { ALLIN } from './config.js';

export const TYPES = {
  tight: {
    name: '堅い人', noise: 0.01, openMult: 0.5, limp: 0.12, threeBet: 0.02, defend: 0.08, keep: 0.7, push: 0.6, callAllIn: 0.06,
    bet: { strong: 0.75, good: 0.55, weak: 0.1, draw: 0.15, air: 0.03 },
    fold: { strong: 0.6, good: 0.3, weak: 0.14, draw: 0.2 },
    raise: { strong: 0.3, good: 0.03, weak: 0.01, draw: 0.02, air: 0.005 }, float: 0.01, betSize: 0.66,
  },
  station: {
    name: 'コールしすぎる人', noise: 0.03, openMult: 0.55, limp: 0.45, threeBet: 0.012, defend: 0.4, keep: 0.8, push: 0.9, callAllIn: 0.25,
    bet: { strong: 0.45, good: 0.3, weak: 0.15, draw: 0.15, air: 0.05 },
    fold: { strong: 0.75, good: 0.65, weak: 0.5, draw: 0.45 },
    raise: { strong: 0.15, good: 0.02, weak: 0.01, draw: 0.02, air: 0.01 }, float: 0.3, betSize: 0.5,
  },
  aggro: {
    name: '荒い人', noise: 0.04, openMult: 2.5, limp: 0.15, threeBet: 0.14, defend: 0.28, keep: 0.5, push: 1.4, callAllIn: 0.18,
    bet: { strong: 0.9, good: 0.8, weak: 0.5, draw: 0.65, air: 0.4 },
    fold: { strong: 0.6, good: 0.45, weak: 0.3, draw: 0.38 },
    raise: { strong: 0.5, good: 0.15, weak: 0.08, draw: 0.25, air: 0.08 }, float: 0.08, betSize: 0.75,
  },
  pro: {
    name: '上級者', noise: 0.02, openMult: 1.0, limp: 0.0, threeBet: 0.18, defend: 0.25, keep: 0.55, push: 1.0, callAllIn: 0.12,
    bet: { strong: 0.85, good: 0.65, weak: 0.25, draw: 0.5, air: 0.25 },
    fold: { strong: 0.6, good: 0.4, weak: 0.3, draw: 0.33 },
    raise: { strong: 0.35, good: 0.05, weak: 0.02, draw: 0.12, air: 0.04 }, float: 0.15, betSize: 0.66,
  },
};
export const TYPE_KEYS = Object.keys(TYPES);

const sig = (x) => 1 / (1 + Math.exp(-x));
const SOFT = 0.02;  // 参加範囲の境目のなだらかさ（上位2%分）
const PSOFT = 0.03; // 降りる境目のなだらかさ（払う額の割合で3%分）

// 押す（オールイン）範囲の広さ：持ち点が少ないほど広い。10BBで上級者は約30%。
const pushShare = (stackBB, k) => Math.min(0.95, (3 / Math.max(stackBB, 1)) * k);
const openShare = (t, ctx) => (ctx.pos === 'BB' ? 0.2 * t.openMult : Math.min(0.9, ctx.cutoff * t.openMult));

// 上級者の押す・受ける（設計書 段階4-1 第5節）。前の人が全員降りて持ち点15BB以下なら押すか降りるか、
// 1人だけがオールインしてほかが降りたなら受けるか降りるかを、基準（賞金で計算する場面では賞金の見込み）で決める。
// 返す値：{ kind（'push'|'call'）, freq（169種類ごとの押す・受ける割合）} か null
function proAllin(hand, seat, legal, stackBB, pos) {
  if (hand.street !== 'preflop') return null;
  const prize = prizeOf(hand, ALLIN.icmWithin);
  if (isUnopened(hand)) {
    if (pos === 'BB' || !legal.raise || stackBB > ALLIN.maxBB) return null;
    const spot = spotOf(hand, seat);
    return spot ? { kind: 'push', freq: solveSpot(spot, prize).push } : null;
  }
  const pusher = pusherOf(hand);
  if (pusher === null || pusher === seat) return null;
  const spot = spotOf(hand, pusher);
  const k = spot ? spot.order.indexOf(seat) - 1 : -1;
  return k >= 0 ? { kind: 'call', freq: solveSpot(spot, prize).call[k] } : null;
}

// 場面の数字（手札によらない部分）。同じ場面で多くの手札の確率を出すときに一度だけ作る。
export function policyContext(hand, seat, typeKey) {
  const type = TYPES[typeKey];
  if (!type) throw new Error(`知らないCPUのタイプ: ${typeKey}`);
  const legal = legalActions(hand);
  if (!legal || legal.seat !== seat) throw new Error(`席${seat}の手番ではない`);
  const s = hand.seats[seat];
  const bb = hand.blinds.bb;
  const pot = potTotal(hand);
  const mine = hand.log.filter((e) => e.street === hand.street && e.seat === seat);
  const pos = hand.street === 'preflop' ? positionOf(hand, seat) : null;
  const stackBB = (s.stack + s.bet) / bb;
  return {
    type, typeKey, legal, bb, pot,
    allin: typeKey === 'pro' ? proAllin(hand, seat, legal, stackBB, pos) : null,
    street: hand.street, board: hand.board,
    raises: hand.log.filter((e) => e.street === hand.street && e.type === 'raise').length,
    ownRaise: mine.some((e) => e.type === 'raise'),
    limpers: hand.log.filter((e) => e.street === 'preflop' && e.type === 'call').length,
    pos,
    cutoff: pos && pos !== 'BB' ? openCutoff(hand, pos) : null, // この席の参加表の参加率（2人のボタンは HU）
    stackBB,
    toCallBB: legal.toCall / bb,
    price: legal.toCall / (pot + legal.toCall),
    allInCall: legal.toCall > 0 && legal.toCall >= s.stack,
    bigCall: legal.toCall >= 0.4 * s.stack,
  };
}

function preflopRaw(ctx, hole) {
  if (ctx.allin) {
    const f = ctx.allin.freq[classOf(hole[0], hole[1])];
    return ctx.allin.kind === 'push' ? { raise: f, call: 0 } : { raise: 0, call: f };
  }
  const t = ctx.type;
  const p = CLASS_PCT[classOf(hole[0], hole[1])];
  const out = { raise: 0, call: 0 };
  if (ctx.raises === 0 && ctx.stackBB <= 12) {
    out.raise = sig((pushShare(ctx.stackBB, t.push) - p) / SOFT);
    return out;
  }
  if (ctx.raises === 0) {
    out.raise = sig((openShare(t, ctx) - p) / SOFT);
    out.call = (1 - out.raise) * sig((t.limp - p) / SOFT);
    return out;
  }
  if (ctx.allInCall || ctx.bigCall) {
    const c = sig((t.callAllIn * (ctx.raises > 1 ? 0.6 : 1) - p) / SOFT);
    out.raise = ctx.allInCall ? 0 : c * 0.5;
    out.call = c - out.raise;
    return out;
  }
  const price = Math.min(1.6, Math.max(0.35, 3 / ctx.toCallBB));
  let cont = t.defend * price * (ctx.raises > 1 ? 0.45 : 1);
  if (ctx.ownRaise) cont = Math.max(cont, openShare(t, ctx) * t.keep); // 自分のレイズに再レイズされた
  out.raise = sig((t.threeBet * (ctx.raises > 1 ? 0.5 : 1) - p) / SOFT);
  out.call = (1 - out.raise) * sig((cont - p) / SOFT);
  return out;
}

function postflopRaw(ctx, hole) {
  const t = ctx.type;
  const cls = handClass(hole, ctx.board);
  const out = { raise: 0, call: 0 };
  if (ctx.legal.toCall === 0) {
    out.raise = t.bet[cls];
    return out;
  }
  if (cls === 'air') {
    out.raise = t.raise.air;
    out.call = t.float * (1 - sig((ctx.price - 0.3) / PSOFT));
    return out;
  }
  // ドローはターンで完成の見込みが半分ほどになるので、払える額の境目も下げる
  const limit = cls === 'draw' && ctx.street === 'turn' ? t.fold.draw * 0.6 : t.fold[cls];
  const fold = sig((ctx.price - limit) / PSOFT);
  out.raise = (1 - fold) * t.raise[cls];
  out.call = 1 - fold - out.raise;
  return out;
}

// 合法な行動それぞれの確率 { fold, check, call, raise }（足して1）
export function probsFor(ctx, hole) {
  const raw = ctx.street === 'preflop' ? preflopRaw(ctx, hole) : postflopRaw(ctx, hole);
  const { legal } = ctx;
  const p = { fold: 0, check: 0, call: 0, raise: 0 };
  const raise = legal.raise ? raw.raise : 0;
  const passive = Math.max(0, 1 - raw.raise - raw.call);
  if (legal.canCheck) {
    p.check = raw.call + passive + (legal.raise ? 0 : raw.raise);
    p.raise = raise;
  } else {
    p.call = raw.call + (legal.raise ? 0 : raw.raise);
    p.fold = passive;
    p.raise = raise;
  }
  // 揺らぎ：合法な行動に均等に少しずつ混ぜる
  const keys = legal.canCheck ? ['check'] : ['fold', 'call'];
  if (legal.raise) keys.push('raise');
  const e = ctx.type.noise;
  for (const k of Object.keys(p)) p[k] = keys.includes(k) ? (1 - e) * p[k] + e / keys.length : 0;
  if (!Object.values(p).every((x) => x >= 0 && x <= 1)) throw new Error(`確率が壊れている: ${JSON.stringify(p)}`);
  return p;
}

// 選んだ行動を、エンジンに渡せる形（レイズは額つき）にする
export function sizedAction(ctx, hand, kind) {
  if (kind !== 'raise') return { type: kind };
  const r = ctx.legal.raise;
  if (ctx.allin?.kind === 'push') return { type: 'raise', to: r.max };
  let to;
  if (ctx.street === 'preflop') {
    if (ctx.raises === 0 && ctx.stackBB <= 12) to = r.max;
    else if (ctx.raises === 0) to = hand.currentBet + 1.5 * ctx.bb + ctx.bb * ctx.limpers;
    else to = hand.currentBet * 3;
  } else {
    to = hand.currentBet === 0 ? ctx.pot * ctx.type.betSize : hand.currentBet * 3;
  }
  if (to >= 0.6 * r.max) to = r.max; // 持ち点の大半を賭けるなら全部
  const rounded = Math.round(to / 100) * 100;
  return { type: 'raise', to: rounded >= r.max ? r.max : Math.min(Math.max(rounded, r.min), r.max) };
}

export function actionProbs(hand, seat, typeKey) {
  return probsFor(policyContext(hand, seat, typeKey), hand.seats[seat].hole);
}

export function decideCpu(hand, seat, typeKey, rng) {
  const ctx = policyContext(hand, seat, typeKey);
  const p = probsFor(ctx, hand.seats[seat].hole);
  let x = rng();
  for (const k of ['fold', 'check', 'call', 'raise']) {
    if (p[k] > 0 && x < p[k]) return sizedAction(ctx, hand, k);
    x -= p[k];
  }
  return sizedAction(ctx, hand, ctx.legal.canCheck ? 'check' : 'call');
}
