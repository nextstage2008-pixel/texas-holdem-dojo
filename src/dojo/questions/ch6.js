// 第6章の問題：賞金の見込みは？／バブルで受ける？／バブルで押す？（設計書 段階4-1 第6-2節）
// バブルは残り4人・入賞3人（賞金50・30・20%）。正解は賞金の見込みで解いた基準（上級者どうし）。境目の手（差が0.3BB相当未満）は出さない。
import { icmShares, placeProbs } from '../../calc/icm.js';
import { spotOf, solveSpot, payoffs, prizeOf, pushEvOf, callEvOf, rangeShare, weightsOf } from '../../calc/pushfold.js';
import { CLASS_COUNT } from '../../calc/combos.js';
import { pushFormula, callFormula } from '../../coach/explain.js';
import { ALLIN } from '../../coach/config.js';
import { foldedToHand, SEATS4, seatName, PUSH_BLINDS } from '../scene.js';
import { holeOf, shownLabel, MARGIN_BB } from './ch5.js';
import { pick, withChoices, retry, pct, pct1, sbb, spct, fmt } from './util.js';

const BB = PUSH_BLINDS.bb;
export const PAY3 = [0.5, 0.3, 0.2];
const NAMES = ['あなた', 'B', 'C', 'D'];
export const BUBBLE_ORDER = ['CO', 'BTN', 'SB', 'BB'];

export function icmValue(rng) {
  return retry(rng, (r) => {
    const n = 3 + Math.floor(r() * 2); // 3〜4人
    const stacks = Array.from({ length: n }, () => 1000 * (2 + Math.floor(r() * 19))); // 2,000〜20,000
    const total = stacks.reduce((a, x) => a + x, 0);
    const chip = stacks[0] / total;
    const v = icmShares(stacks, PAY3)[0];
    if (Math.abs(v - chip) < 0.015) return null; // 持ち点の割合とほぼ同じなら出さない（違いを見せる問題）
    const correct = pct1(v);
    const wrongs = [chip, v + 0.04, v - 0.04, v + 0.07, v - 0.07, 1 / n].filter((x) => x > 0 && x < 1).map(pct1);
    if (new Set(wrongs.filter((w) => w !== correct)).size < 3) return null;
    const p = placeProbs(stacks, PAY3.length)[0];
    const list = stacks.map((s, i) => `${NAMES[i]} ${fmt(s)}`);
    return {
      prompt: `残り${n}人・入賞3人（賞金 50%・30%・20%）。持ち点は ${list.join('・')}。あなたの賞金の見込み（賞金総額に対する割合）は？`,
      scene: { board: [], hole: null, others: [], pills: list },
      ...withChoices(r, correct, wrongs),
      explain: [
        `持ち点の割合は ${pct1(chip)}、賞金の見込みは ${pct1(v)}（持ち点の割合より${v > chip ? '高い' : '低い'}）。`,
        '賞金は1位だけでなく2位・3位にもあるので、持ち点の多い人の見込みは持ち点の割合より低く、少ない人は高くなる。',
      ],
      calc: `1位 ${pct1(p[0])} × 50% ＋ 2位 ${pct1(p[1])} × 30% ＋ 3位 ${pct1(p[2])} × 20% ＝ ${correct}`,
    };
  });
}

// バブル（残り4人・入賞3人）の場面：賞金の見込みで解いた基準と、点で数えた結果の価値
export function bubbleSpot(stacksBB, pusherPos) {
  const pusher = SEATS4[pusherPos];
  const hand = foldedToHand({ stacksBB, pusher, tour: { payouts: PAY3 } });
  const spot = spotOf(hand, pusher);
  if (!spot) return null;
  return { spot, solved: solveSpot(spot, prizeOf(hand, ALLIN.icmWithin)), chipPay: payoffs(spot, null), total: stacksBB.reduce((a, x) => a + x, 0) * BB };
}
// 席ごとの持ち点は6〜25BB。押す人は6〜15BB（押す・受けるの場面は15BB以下。段階4-2 第8節）
const randomStacks = (r, pusher) => [0, 1, 2, 3].map((i) => 6 + Math.floor(r() * (i === pusher ? 10 : 20)));
const stackPills = (stacksBB) => BUBBLE_ORDER.map((pos) => `${pos} ${stacksBB[SEATS4[pos]]}BB`);

export function bubbleCall(rng) {
  const disagree = rng() < 0.6; // 点で計算すると答えが逆になる場面を半分以上に
  const want = rng() < 0.5;
  return retry(rng, (r) => {
    const pusherPos = pick(r, ['CO', 'BTN', 'SB']);
    const stacksBB = randomStacks(r, SEATS4[pusherPos]);
    const b = bubbleSpot(stacksBB, pusherPos);
    if (!b) return null;
    const k = Math.floor(r() * (b.spot.order.length - 1));
    const callerPos = seatName(SEATS4, b.spot.order[k + 1]);
    const pushW = weightsOf(b.solved.push);
    const pool = [];
    for (let c = 0; c < CLASS_COUNT; c++) {
      const p = callEvOf(b.solved.pay, k, c, pushW).ev / BB;
      const ch = callEvOf(b.chipPay, k, c, pushW).ev / BB;
      if (Math.abs(p) < MARGIN_BB) continue;
      if (disagree ? (p > 0) === (ch > 0) : (p > 0) !== want) continue;
      pool.push(c);
    }
    if (!pool.length) return null;
    const c = pick(r, pool);
    const dp = callEvOf(b.solved.pay, k, c, pushW);
    const dc = callEvOf(b.chipPay, k, c, pushW);
    const yes = dp.ev > 0;
    const same = yes === (dc.ev > 0);
    return {
      prompt: `残り4人・入賞3人（バブル。賞金 50%・30%・20%）。${pusherPos}（${stacksBB[SEATS4[pusherPos]]}BB）が押してきました（オールイン）。間の人は降りました。${callerPos}（${stacksBB[SEATS4[callerPos]]}BB）のあなたは受ける？`,
      scene: { board: [], hole: holeOf(r, c), others: [], pills: stackPills(stacksBB) },
      ...withChoices(r, yes ? '受ける（コール）' : '降りる', [], { fixed: ['受ける（コール）', '降りる'] }),
      explain: [
        `点で計算：受ける ${sbb(dc.ev / BB)}／賞金で計算：受ける ${spct(dp.ev / b.total)}（点に直すと ${sbb(dp.ev / BB)}）。`,
        same ? `点でも賞金でも${yes ? '得なので受ける' : '損なので降りる'}。`
          : yes ? '点では損でも、賞金では得なので受ける。' : '点では得でも、負けて飛ぶと賞金がもらえないので、賞金では損 → 降りる。',
        `押した人の範囲（賞金で計算した目安）は全体の${pct(rangeShare(b.solved.push))}。損益分岐点は点なら ${pct(dc.breakeven)}、賞金なら ${pct(dp.breakeven)}。`,
      ],
      calc: `点で計算：${callFormula(dc, BB)}`,
    };
  }, 400);
}

export function bubblePush(rng) {
  const want = rng() < 0.5;
  return retry(rng, (r) => {
    const pos = pick(r, ['CO', 'BTN', 'SB']);
    const stacksBB = randomStacks(r, SEATS4[pos]);
    const b = bubbleSpot(stacksBB, pos);
    if (!b) return null;
    const pool = [];
    for (let c = 0; c < CLASS_COUNT; c++) {
      const p = pushEvOf(b.solved.pay, c, b.solved.call).ev / BB;
      if (Math.abs(p) >= MARGIN_BB && (p > 0) === want) pool.push(c);
    }
    if (!pool.length) return null;
    const c = pick(r, pool);
    const dp = pushEvOf(b.solved.pay, c, b.solved.call);
    const dc = pushEvOf(b.chipPay, c, b.solved.call);
    const yes = dp.ev > 0;
    return {
      prompt: `残り4人・入賞3人（バブル。賞金 50%・30%・20%）。前の人は降りました。${pos}（${stacksBB[SEATS4[pos]]}BB）のあなたは、この手で押す（オールイン）？`,
      scene: { board: [], hole: holeOf(r, c), others: [], pills: stackPills(stacksBB) },
      ...withChoices(r, yes ? '押す（オールイン）' : '降りる', [], { fixed: ['押す（オールイン）', '降りる'] }),
      explain: [
        `賞金で計算：押す ${spct(dp.ev / b.total)}（点に直すと ${sbb(dp.ev / BB)}）／点で計算：押す ${sbb(dc.ev / BB)}。`,
        `この席の押す範囲（賞金で計算した目安）は全体の${pct(rangeShare(b.solved.push))}。${shownLabel(c)} は範囲の${yes ? '中' : '外'}。`,
      ],
      calc: `点で計算：${pushFormula(dc, b.chipPay, BB)}`,
    };
  }, 400);
}
