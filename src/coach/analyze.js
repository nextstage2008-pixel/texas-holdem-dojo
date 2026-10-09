// 判断1回分の分析。勝つ見込み・損益分岐点・行動ごとの期待値（または参加表）を計算する。
//   押す・受ける場面（段階4-1）：前の人が全員降りて15BB以下／1人だけのオールインを受ける → coach/allin.js
//   参加表で決める場面：プリフロップで誰もレイズしておらず、BB以外で、持ち点が16BB以上
//   それ以外：相手の手を推定し、「降りる＝0」を基準にした期待値（点）で比べる
// 期待値は1つ先までの近似：あなたの行動のあとに相手が降りるか続けるかを相手の打ち方から確率で出し、
// 続けた相手とは今の勝つ見込みでポットを分け合うとみなす（その先の賭けは数えない）。
import { legalActions, applyAction } from '../engine/hand.js';
import { buildEquity, summarize } from '../calc/equity.js';
import { classOf, COMBO_COUNT, COMBO_A, COMBO_B } from '../calc/combos.js';
import { CLASS_PCT, TOP25_EQ, lineEq } from '../calc/chart.js';
import { openCutoff, isHeadsUp, positionOf } from '../calc/position.js';
import { potTotal, presetTargets } from '../calc/sizes.js';
import { policyContext, probsFor } from './policy.js';
import { estimateRange } from './range.js';
import { situationOf } from './situations.js';
import { allinKind, analyzeAllin } from './allin.js';
import { CHART, GRADE, ALLIN } from './config.js';

// 推定の誤差（点）：勝つ見込みの幅 × 取れる額 ＋（レイズなら）相手が降りる確率の幅 × 降りたときと続けたときの差
const errChips = (o) => o.err * o.W + (o.type === 'raise' ? GRADE.foldUncertainty * Math.abs(o.P - (o.eq * o.W - o.A)) : 0);
// 確実に見込める期待値（推定の誤差を差し引いた値）。最善はこれで比べ、確信の持てない差なら手堅い方を選ぶ
const withLow = (o) => ({ ...o, low: o.ev - errChips(o) });

// あなたが勝ったときに取れる額（サイドポットを考え、各人からはあなたの賭けの合計 heroTotal までしか取れない）
export function winnable(hand, seat, heroTotal) {
  let w = hand.deadMoney;
  hand.seats.forEach((s, i) => { w += i === seat ? heroTotal : Math.min(s.committed, heroTotal); });
  return w;
}

const raisesOn = (hand) => hand.log.filter((e) => e.street === hand.street && e.type === 'raise').length;

function chartAnalysis(base, hand, hole, pos) {
  const cls = classOf(hole[0], hole[1]);
  const pct = CLASS_PCT[cls];
  const cutoff = openCutoff(hand, pos);
  const where = isHeadsUp(hand) ? '2人のボタン' : pos; // 解説で使う席の呼び名
  const d = pct - cutoff;
  const border = Math.abs(d) <= CHART.border;
  const off = Math.min(CHART.cap, CHART.base + CHART.perPct * Math.max(0, Math.abs(d) - CHART.border) * 100);
  const best = d <= 0 ? 'raise' : 'fold';
  // null は「境目なので許容」。コール（レイズせずに参加）は境目でも最低 limpMin の損失とみなす
  const lossOf = {
    raise: best === 'raise' ? 0 : border ? null : off,
    fold: best === 'fold' ? 0 : border ? null : off,
    call: Math.max(CHART.limpMin, border ? 0 : off),
  };
  // 参加するときの標準の額：2.5BB（参加者がいれば1人ごとに+1BB）。maxOpen を超える額は大きすぎる
  const limpers = hand.log.filter((e) => e.street === 'preflop' && e.type === 'call').length;
  const bb = hand.blinds.bb;
  const openTo = Math.round((2.5 + limpers) * bb);
  const maxOpen = (CHART.maxOpenBB + limpers) * bb;
  return {
    ...base, mode: 'chart',
    chart: { cls, pct, cutoff, where, d, border, best, lossOf, openTo, maxOpen, eq: TOP25_EQ[cls], line: lineEq(cutoff) },
  };
}

// hand：いまのハンド、seat：あなたの席、trail：このハンドの行動の記録、typeOf(seat)：相手のタイプ、
// alive・paid：残り人数と入賞人数（バブルの判定）、ranges：相手ごとの推定を外から渡すとき（練習問題・テスト用）
export function analyzeDecision({ hand, seat, trail, typeOf, rng, alive = 9, paid = 3, ranges: given = null }) {
  const legal = legalActions(hand);
  if (!legal || legal.seat !== seat) throw new Error(`席${seat}の手番ではない`);
  const me = hand.seats[seat];
  const bb = hand.blinds.bb;
  const hole = me.hole;
  const dead = new Set([...hole, ...hand.board]);
  const opps = hand.seats.map((_, i) => i).filter((i) => i !== seat && hand.seats[i].inHand && !hand.seats[i].folded);
  const ranges = given ?? opps.map((i) => estimateRange({ trail, seat: i, typeKey: typeOf(i), dead }));
  const pos = hand.street === 'preflop' ? positionOf(hand, seat) : null;
  const P = potTotal(hand);
  // 相手の手の一覧に出す相手：最後にレイズ（ベット）した人、いなければ最後に行動した人
  const lastBy = (types) => [...hand.log].reverse().find((e) => opps.includes(e.seat) && types.includes(e.type));
  const main = lastBy(['raise']) ?? lastBy(['call', 'check']);
  const stackBB = (me.stack + me.bet) / bb;
  const base = {
    seat, hole, board: hand.board, street: hand.street, pos, bb, legal, opps, ranges, pot: P, stack: me.stack, stackBB,
    main: main ? opps.indexOf(main.seat) : 0,
    situation: situationOf(hand, seat, { alive, paid }),
  };
  if (!given) {
    const kind = allinKind(hand, seat);
    if (kind) return analyzeAllin(base, hand, seat, kind, typeOf);
  }
  // 参加表は「レイズで参加するか降りるか」の表なので、レイズできない場面（例：BBがもうオールイン）では使わない
  if (!given && hand.street === 'preflop' && raisesOn(hand) === 0 && pos !== 'BB' && legal.raise
    && (me.stack + me.bet) / bb >= CHART.minStackBB) {
    return chartAnalysis(base, hand, hole, pos);
  }

  const model = buildEquity({ hero: hole, board: hand.board, ranges, rng });

  // あなたの行動のあと、相手ごとに「この手なら続ける確率」と「続けるときに足す額」
  const hc = [0, 0];
  function responses(after, heroTotal) {
    const conts = [];
    const ys = [];
    if (after.street !== hand.street) return { conts, ys }; // 通りが終わった＝誰も応じない
    opps.forEach((j, k) => {
      const s = after.seats[j];
      if (s.folded || s.allIn || s.bet >= after.currentBet) return;
      const ctx = policyContext({ ...after, toAct: j }, j, typeOf(j));
      const c = new Float64Array(COMBO_COUNT);
      const w = ranges[k];
      for (let i = 0; i < COMBO_COUNT; i++) {
        if (!(w[i] > 0)) continue;
        hc[0] = COMBO_A[i];
        hc[1] = COMBO_B[i];
        c[i] = 1 - probsFor(ctx, hc).fold;
      }
      conts[k] = c;
      const add = Math.min(after.currentBet, s.bet + s.stack) - s.bet;
      ys[k] = Math.max(0, Math.min(s.committed + add, heroTotal) - s.committed);
    });
    return { conts, ys };
  }

  const options = [];
  let shown; // 計器に出す勝つ見込みと損益分岐点
  if (legal.canCheck) {
    const sm = summarize(model);
    const W = winnable(hand, seat, me.committed);
    options.push(withLow({ type: 'check', ev: sm.eq * W, W, eq: sm.eq, err: sm.err }));
    shown = { eq: sm.eq, err: sm.err, breakeven: 0 };
  } else {
    options.push(withLow({ type: 'fold', ev: 0, W: 0, eq: 0, err: 0 }));
    const c = legal.toCall;
    const heroTotal = me.committed + c;
    const sm = summarize(model, responses(applyAction(hand, { type: 'call' }), heroTotal));
    const W = winnable(hand, seat, heroTotal) + sm.called;
    options.push(withLow({ type: 'call', ev: sm.eq * W - c, W, c, eq: sm.eq, err: sm.err }));
    shown = { eq: sm.eq, err: sm.err, breakeven: c / W };
  }

  const maxOpp = Math.max(...opps.map((i) => hand.seats[i].bet + hand.seats[i].stack));
  function evRaise(to) {
    const A = Math.min(to, maxOpp) - me.bet; // 誰も払えない分は返ってくるので数えない
    const sm = summarize(model, responses(applyAction(hand, { type: 'raise', to }), me.committed + A));
    const W = P + A + sm.called;
    const ev = sm.pAllFold * P + (1 - sm.pAllFold) * (sm.eq * W - A);
    return withLow({ type: 'raise', to, ev, pFold: sm.pAllFold, eq: sm.eq, err: sm.err, W, A, P });
  }

  // 勧める額の候補は目盛り（½・⅔・ポット／2.5倍・3倍・ポット）。オールインは持ち点がポットの2倍以下
  // （プリフロップは25BB以下）のときだけ候補にする。1つ先までの近似では、大きすぎる賭けを過大に評価しやすいため。
  const shortEnough = hand.street === 'preflop' ? (me.stack + me.bet) / bb <= CHART.allInBB : me.stack <= CHART.allInSpr * P;
  let targets = legal.raise ? presetTargets(hand, seat).filter((p) => p.label !== 'オールイン' || shortEnough || p.to === legal.raise.min) : [];
  // プリフロップで15BB以下なら、オールインに満たないレイズは勧めない（中途半端な額。段階2の繰越の修正）
  if (hand.street === 'preflop' && stackBB <= ALLIN.maxBB) targets = targets.filter((p) => p.to === legal.raise.max);
  const raises = [...new Set(targets.map((p) => p.to))].map(evRaise);
  const bestRaise = raises.reduce((b, o) => (!b || o.low > b.low ? o : b), null);
  if (bestRaise) options.push(bestRaise);
  const best = options.reduce((b, o) => (o.low > b.low ? o : b));
  return { ...base, mode: 'ev', ...shown, method: model.kind, options, raises, best, evRaise, model };
}
