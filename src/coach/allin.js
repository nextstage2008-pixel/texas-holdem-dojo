// 押す・受ける判断の分析（形「オールイン」。設計書 段階4-1 第4-1節）。
//   場面A（push）：前の人が全員降りて、持ち点15BB以下（BB以外）→ 押す（オールイン）か降りるか
//   場面B（call）：1人がオールインし、ほかは全員降りた → 受ける（コール）か降りるか
// 得は「降りる＝0」を基準にした点。賞金で計算する場面では、賞金の見込みの差を点に直した値で比べ、点で計算した値も持つ。
// pay（結果ごとの価値。calc/pushfold.js の payoffs）と、受ける場面の k（受ける人の order の番号−1）は、1万回やり直す（coach/repeat.js）が使う。
import { legalActions, applyAction } from '../engine/hand.js';
import { classOf, CLASS_COUNT, CLASS_COMBOS, COMBO_COUNT, COMBO_A, COMBO_B, COMBO_CLASS } from '../calc/combos.js';
import { buildEquity } from '../calc/equity.js';
import { TABLE_ERR } from '../calc/preflop.js';
import { isUnopened, pusherOf, spotOf, prizeOf, solveSpot, payoffs, pushEvOf, callEvOf, rangeShare } from '../calc/pushfold.js';
import { policyContext, probsFor } from './policy.js';
import { ALLIN } from './config.js';

// どの場面か：'push'・'call'・null
export function allinKind(hand, seat) {
  if (hand.street !== 'preflop' || hand.toAct !== seat) return null;
  const s = hand.seats[seat];
  if (isUnopened(hand)) {
    if (seat === hand.bbSeat || !legalActions(hand).raise) return null;
    if ((s.stack + s.bet) / hand.blinds.bb > ALLIN.maxBB) return null;
    return spotOf(hand, seat) ? 'push' : null;
  }
  const p = pusherOf(hand);
  if (p === null || p === seat) return null;
  const spot = spotOf(hand, p);
  return spot && spot.order.includes(seat) ? 'call' : null;
}

// 種類ごとの代表の2枚（打ち方の確率は、プリフロップでは手の種類だけで決まる）
const REP = Array.from({ length: CLASS_COUNT }, (_, c) => [COMBO_A[CLASS_COMBOS[c][0]], COMBO_B[CLASS_COMBOS[c][0]]]);

// あなたが押したあと、後ろの人が受ける割合（169種類ごと）。相手のタイプの打ち方（上級者は基準）で決める
function callFreqs(hand, spot, typeOf) {
  const after = applyAction(hand, { type: 'raise', to: legalActions(hand).raise.max });
  return spot.order.slice(1).map((j) => {
    const ctx = policyContext({ ...after, toAct: j }, j, typeOf(j));
    return Float64Array.from(REP, (hole) => probsFor(ctx, hole).call);
  });
}

// 相手の手の一覧（カード一覧）に出す重み（1,326通り）：種類ごとの割合を、あなたの2枚と重ならない組合せに置く
function comboWeights(freq, hole) {
  const w = new Float64Array(COMBO_COUNT);
  for (let i = 0; i < COMBO_COUNT; i++) {
    if (hole.includes(COMBO_A[i]) || hole.includes(COMBO_B[i])) continue;
    w[i] = freq[COMBO_CLASS[i]];
  }
  return w;
}

// 一覧に出す相手（1人）と、その手の重み・勝率の計算。重みがなければ出さない
function viewOf(seat, w, hole) {
  if (!w.some((x) => x > 0)) return { opps: [], ranges: [], main: null, model: null };
  return { opps: [seat], ranges: [w], main: 0, model: buildEquity({ hero: hole, board: [], ranges: [w] }) };
}

// base：analyzeDecision が作った共通の項目（席・手札・合法な行動・相手の推定 ranges など）
export function analyzeAllin(base, hand, seat, kind, typeOf) {
  const prize = prizeOf(hand, ALLIN.icmWithin);
  const h = classOf(base.hole[0], base.hole[1]);
  // 卓の持ち点の合計（賞金の見込みの差を点に直すときの、賞金総額にあたる額）
  const total = hand.seats.reduce((a, s) => a + s.stack + s.committed, 0) + hand.deadMoney;
  const fold = { type: 'fold', ev: 0, low: 0, chipEv: 0 };
  if (kind === 'push') {
    const spot = spotOf(hand, seat);
    const solved = solveSpot(spot, prize);
    const freqs = callFreqs(hand, spot, typeOf);
    const chipPay = prize ? payoffs(spot, null) : solved.pay; // 点で数えた結果ごとの価値（解説の計算式に使う）
    const r = pushEvOf(solved.pay, h, freqs);
    const chip = prize ? pushEvOf(chipPay, h, freqs) : r;
    // 推定の誤差：受ける見込みの幅 ×（全員が降りたときと受けられたときの差）＋ 勝率表の誤差 × 動く額
    const gainFold = solved.pay.allFold - solved.pay.fold;
    const gainCalled = r.pCalled > 0 ? (r.ev - r.pAllFold * gainFold) / r.pCalled : 0;
    const swing = r.callers.reduce((a, c) => a + c.swing, 0);
    const err = ALLIN.foldUncertainty * Math.abs(gainFold - gainCalled) + TABLE_ERR * swing;
    const push = { type: 'raise', to: base.legal.raise.max, ev: r.ev, low: r.ev - err, chipEv: chip.ev, detail: r, chip };
    const options = [fold, push];
    const best = push.low > fold.low ? push : fold;
    const main = r.callers.reduce((b, c) => (!b || c.P > b.P ? c : b), null);
    const k = r.callers.indexOf(main);
    return {
      ...base, mode: 'allin', kind, prize: !!prize, total, options, best, cls: h,
      eq: r.eqCalled, breakeven: r.breakeven, chipBreakeven: chip.breakeven,
      chipPay, pay: solved.pay,
      ref: { share: rangeShare(solved.push), inRange: solved.push[h] >= 0.5 },
      ...viewOf(main.seat, comboWeights(freqs[k], base.hole), base.hole),
    };
  }
  const p = pusherOf(hand);
  const spot = spotOf(hand, p);
  const solved = solveSpot(spot, prize);
  const k = spot.order.indexOf(seat) - 1;
  // 押した人の手：相手の行動からの推定（全体設計 第5-2節）を種類ごとにまとめた重み
  const est = base.ranges[base.opps.indexOf(p)];
  const pushW = new Float64Array(CLASS_COUNT);
  for (let i = 0; i < COMBO_COUNT; i++) pushW[COMBO_CLASS[i]] += est[i];
  const r = callEvOf(solved.pay, k, h, pushW);
  const chip = prize ? callEvOf(payoffs(spot, null), k, h, pushW) : r;
  const pr = solved.pay.pairs[k];
  const err = TABLE_ERR * Math.abs(pr.jWin - pr.jLose);
  const call = { type: 'call', ev: r.ev, low: r.ev - err, chipEv: chip.ev, detail: r, chip };
  const options = [fold, call];
  const best = call.low > fold.low ? call : fold;
  return {
    ...base, mode: 'allin', kind, prize: !!prize, total, options, best, cls: h, pusher: p, pay: solved.pay, k,
    eq: r.eq, breakeven: r.breakeven, chipBreakeven: chip.breakeven,
    ref: { share: rangeShare(solved.call[k]), inRange: solved.call[k][h] >= 0.5 },
    ...viewOf(p, est, base.hole),
  };
}
