// 第5章の問題：押す？降りる？／受ける？降りる？／全員が降りる見込みは？（設計書 段階4-1 第6-1節）
// 正解はオールイン基準（calc/pushfold.js。9人・全員同じ持ち点で、上級者どうしの基準）。
// 押す・受けるの得の差が0.3BB未満の境目の手は出さない。
import { spotOf, solveSpot, pushEvOf, callEvOf, rangeShare, weightsOf } from '../../calc/pushfold.js';
import { CLASS_COUNT, CLASS_COMBOS, COMBO_A, COMBO_B, classLabel } from '../../calc/combos.js';
import { pushFormula, callFormula } from '../../coach/explain.js';
import { foldedToHand, SEATS9, seatName, PUSH_BLINDS } from '../scene.js';
import { SEAT_NOTE } from './ch1.js';
import { pick, withChoices, retry, pct, pct1, sbb } from './util.js';

const BB = PUSH_BLINDS.bb;
export const MARGIN_BB = 0.3;
export const PUSH_SEATS = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB'];
const PUSH_CHOICES = ['押す（オールイン）', '降りる'];
const CALL_CHOICES = ['受ける（コール）', '降りる'];

export const shownLabel = (c) => classLabel(c).replaceAll('T', '10');
export function holeOf(rng, c) {
  const i = pick(rng, CLASS_COMBOS[c]);
  return [COMBO_A[i], COMBO_B[i]];
}

// 9人・全員 bb BB で、pos の番まで全員降りた場面の基準（上級者どうし）
export function standardAt(bb, pos) {
  const seat = SEATS9[pos];
  return solveSpot(spotOf(foldedToHand({ stacksBB: new Array(9).fill(bb), pusher: seat }), seat));
}

// 条件に合う手の種類を集める（境目の手を除く）
function classesWhere(evOf, want) {
  const pool = [];
  for (let c = 0; c < CLASS_COUNT; c++) {
    const ev = evOf(c) / BB;
    if (want ? ev >= MARGIN_BB : ev <= -MARGIN_BB) pool.push(c);
  }
  return pool;
}

export function pushFold(rng) {
  const want = rng() < 0.5;
  return retry(rng, (r) => {
    const pos = pick(r, PUSH_SEATS);
    const bb = 5 + Math.floor(r() * 11); // 5〜15BB
    const s = standardAt(bb, pos);
    const pool = classesWhere((c) => pushEvOf(s.pay, c, s.call).ev, want);
    if (!pool.length) return null;
    const c = pick(r, pool);
    const d = pushEvOf(s.pay, c, s.call);
    const yes = d.ev > 0;
    return {
      prompt: `9人卓・全員${bb}BB。前の人は全員降りました。${pos} のあなたは、この手で押す（オールイン）？`,
      scene: { board: [], hole: holeOf(r, c), others: [], pills: [`全員 ${bb}BB（BBアンティあり）`, `あなたの席：${SEAT_NOTE[pos]}`] },
      ...withChoices(r, PUSH_CHOICES[yes ? 0 : 1], [], { fixed: PUSH_CHOICES }),
      explain: [
        `${pos}・${bb}BBの押す範囲は全体の${pct(rangeShare(s.push))}（上級者どうしの基準）。${shownLabel(c)} は範囲の${yes ? '中' : '外'}。`,
        `全員が降りる見込み ${pct(d.pAllFold)}、受けられたときの勝つ見込み ${pct(d.eqCalled)}（元が取れるのは ${pct(d.breakeven)}）→ 押すと ${sbb(d.ev / BB)}。`,
      ],
      calc: pushFormula(d, s.pay, BB),
    };
  }, 400);
}

export function callPush(rng) {
  const want = rng() < 0.5;
  return retry(rng, (r) => {
    const pusherPos = pick(r, PUSH_SEATS);
    const bb = 5 + Math.floor(r() * 11);
    const s = standardAt(bb, pusherPos);
    const k = Math.floor(r() * (s.spot.order.length - 1));
    const callerPos = seatName(SEATS9, s.spot.order[k + 1]);
    const pushW = weightsOf(s.push);
    const pool = classesWhere((c) => callEvOf(s.pay, k, c, pushW).ev, want);
    if (!pool.length) return null;
    const c = pick(r, pool);
    const d = callEvOf(s.pay, k, c, pushW);
    const yes = d.ev > 0;
    const callShare = rangeShare(s.call[k]);
    const pushShare = rangeShare(s.push);
    return {
      prompt: `9人卓・全員${bb}BB。${pusherPos} が押してきました（オールイン）。間の人は全員降りました。${callerPos} のあなたは受ける？`,
      scene: { board: [], hole: holeOf(r, c), others: [], pills: [`全員 ${bb}BB（BBアンティあり）`, `押した人：${pusherPos}`, `あなたの席：${callerPos}`] },
      ...withChoices(r, CALL_CHOICES[yes ? 0 : 1], [], { fixed: CALL_CHOICES }),
      explain: [
        `${pusherPos}・${bb}BBの押す範囲は全体の${pct(pushShare)}（上級者どうしの基準）。その範囲に対する ${shownLabel(c)} の勝つ見込みは ${pct(d.eq)}、損益分岐点は ${pct(d.breakeven)}。`,
        `${callerPos} が受ける範囲は全体の${pct(callShare)}（押す範囲より${callShare < pushShare ? '狭い。受ける側には降りてもらえる得がない' : '広い'}）。${shownLabel(c)} は範囲の${yes ? '中' : '外'}。`,
      ],
      calc: callFormula(d, BB),
    };
  }, 400);
}

const CALL_PCTS = [5, 8, 10, 12, 15, 20, 25];
const decimal = (x) => String(Number(x.toFixed(2))); // 0.9・0.88

export function foldEquity(rng) {
  return retry(rng, (r) => {
    const n = 2 + Math.floor(r() * 4); // 2〜5人
    const p = pick(r, CALL_PCTS) / 100;
    const ans = (1 - p) ** n;
    const correct = pct1(ans);
    // よくある間違い：引き算で済ませる、1人分だけ、人数を数え違える、受ける見込みを掛ける
    const wrongs = [1 - n * p, 1 - p, (1 - p) ** (n + 1), (1 - p) ** (n - 1), 1 - p ** n, ans - 0.05, ans + 0.05]
      .filter((x) => x > 0 && x < 1).map(pct1);
    if (new Set(wrongs.filter((w) => w !== correct)).size < 3) return null;
    return {
      prompt: `あなたが押したあと、後ろの${n}人がそれぞれ${Math.round(p * 100)}%の手で受けます（ほかの手では降りる）。全員が降りる見込みは？`,
      scene: { board: [], hole: null, others: [], pills: [`後ろの人 ${n}人`, `1人が受ける見込み ${Math.round(p * 100)}%`] },
      ...withChoices(r, correct, wrongs),
      explain: [
        `1人が降りる見込みは ${Math.round((1 - p) * 100)}%。${n}人とも降りる見込みは、その掛け算。`,
        '全員が降りれば、ポット（2.5BB）をそのままもらえる（降りてもらえる得）。',
      ],
      calc: `${new Array(n).fill(decimal(1 - p)).join(' × ')} ＝ ${correct}`,
    };
  });
}
