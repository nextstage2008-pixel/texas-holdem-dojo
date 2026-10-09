// 押す・受ける（オールイン基準）の計算（設計書 段階4-1 第3-1節）。
//   場面A（押す）：プリフロップで、前の人が全員降りた（参加もレイズもない）
//   場面B（受ける）：1人がオールインのレイズをし、ほかは全員降りた（参加者なし）
// 押した人のあと、後ろの人が行動順に受けるか降りるかを決め、誰かが受けたら残りは降りるとみなす（受けるのは最大1人）。
// 勝つ見込みは169種類どうしのプリフロップ勝率表。手札とのカードの重なりは数えない（近似）。
// 価値は「点」か「賞金の見込みを点に直したもの」（賞金総額＝全員の持ち点の合計とみなす）。どちらも単位は点。
import { CLASS_COUNT, classSize, COMBO_COUNT } from './combos.js';
import { classVsClass } from './preflop.js';
import { prizeShares, ICM_MAX_PLAYERS } from './icm.js';

const N = CLASS_COUNT;
// 種類ごとの組合せの割合（合計1）
export const CLASS_W = Float64Array.from({ length: N }, (_, i) => classSize(i) / COMBO_COUNT);
const EQ = new Float64Array(N * N);
for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) EQ[a * N + b] = classVsClass(a, b);

const BLINDS = ['sb', 'bb', 'ante'];
const preflopActs = (hand) => hand.log.filter((e) => e.street === 'preflop' && !BLINDS.includes(e.type));

// 場面A：プリフロップで、まだ誰も参加もレイズもしていない（前の人は全員降りた）
export const isUnopened = (hand) => hand.street === 'preflop' && preflopActs(hand).every((e) => e.type === 'fold');

// 場面B：1人だけがオールインのレイズをし、参加者はいない。押した人の席（なければ null）
export function pusherOf(hand) {
  if (hand.street !== 'preflop') return null;
  const acts = preflopActs(hand);
  const raises = acts.filter((e) => e.type === 'raise');
  if (raises.length !== 1 || !raises[0].allIn) return null;
  if (acts.some((e) => e.type === 'call' || e.type === 'check')) return null;
  return raises[0].seat;
}

// 場面の形。order：押す人と、そのあと行動する人（行動順。BBまで）。
// cap：勝負に出せる上限（手元＋もう出した額）、posted：もう出したブラインド、dead：アンティ（死に金）。
// 後ろの人がブラインドを払っただけですでにオールインなら、この形では扱わない（null）
export function spotOf(hand, pusher) {
  const n = hand.seats.length;
  const posted = hand.seats.map(() => 0);
  for (const e of hand.log) if (e.street === 'preflop' && (e.type === 'sb' || e.type === 'bb')) posted[e.seat] += e.amount;
  const cap = hand.seats.map((s) => s.stack + s.committed);
  const order = [pusher];
  for (let k = 1; k < n; k++) {
    const i = (pusher + k) % n;
    if (hand.seats[i].inHand) order.push(i);
    if (i === hand.bbSeat) break;
  }
  if (order.length < 2 || order.slice(1).some((i) => cap[i] - posted[i] <= 0)) return null;
  return { pusher, order, cap, posted, dead: hand.deadMoney, bb: hand.blinds.bb, bbSeat: hand.bbSeat };
}

// 賞金で計算する場面か：残り人数が「入賞人数＋within」以下（9人卓は入賞3人なら残り6人から）。
// 賞金の割合は hand.tour.payouts、残り人数は大会全体の hand.tour.alive（大会の進行が付ける。ない形は卓の人数で数える）。返す値：{ payouts } か null
export function prizeOf(hand, within) {
  const payouts = hand.tour?.payouts;
  if (!payouts) return null;
  const alive = hand.tour.alive ?? hand.seats.filter((s) => s.inHand).length;
  if (alive > payouts.length + within || alive > ICM_MAX_PLAYERS) return null;
  return { payouts };
}

// ハンドの初めの持ち点（BBはアンティの分を足す）
const startOf = (spot) => spot.cap.map((c, i) => c + (i === spot.bbSeat ? spot.dead : 0));

// 結果の持ち点 → 人ごとの価値（点）
export function valueFor(spot, prize) {
  if (!prize) return (fin) => fin;
  const start = startOf(spot);
  const total = start.reduce((a, x) => a + x, 0);
  return (fin) => Array.from(prizeShares(fin, start, prize.payouts), (x) => x * total);
}

// 結果ごとの価値（手札によらない）。fold：押す人が降りた（ポットは BB が取るとみなす。賞金の見込みで数えるとき、
// 持ち点の合計を変えないため。2人なら正確）、allFold：押して全員が降りた、
// pairs[k]：order[k+1] が受けた（pWin・pLose＝押した人が勝った・負けたときの押した人の価値、jWin・jLose＝受けた人の価値、
// jFold＝受けずに降りたときの受ける人の価値（押した人がポットを取るとみなす））
export function payoffs(spot, prize = null) {
  const value = valueFor(spot, prize);
  const { order, cap, posted, dead, pusher: p } = spot;
  const now = cap.map((c, i) => c - posted[i]);
  const pot = posted.reduce((a, x) => a + x, 0) + dead;
  const all = now.slice();
  all[p] = now[p] + pot;
  const folded = now.slice();
  folded[spot.bbSeat] += pot;
  const vNow = value(folded);
  const vAll = value(all);
  const pairs = order.slice(1).map((j) => {
    const e = Math.min(cap[p], cap[j]);
    const potC = 2 * e + pot - posted[p] - posted[j];
    const pw = now.slice();
    pw[p] = cap[p] - e + potC;
    pw[j] = cap[j] - e;
    const jw = now.slice();
    jw[p] = cap[p] - e;
    jw[j] = cap[j] - e + potC;
    const vp = value(pw);
    const vj = value(jw);
    return { seat: j, e, potC, posted: posted[j], pWin: vp[p], pLose: vj[p], jWin: vj[j], jLose: vp[j], jFold: vAll[j] };
  });
  return { pusher: p, pot, postedP: posted[p], fold: vNow[p], allFold: vAll[p], pairs };
}

// 範囲の広さ（全1,326通りのうち、範囲に入る組合せの割合）
export const rangeShare = (freq) => freq.reduce((a, x, i) => a + x * CLASS_W[i], 0);

// 相手の範囲 x（169種類ごとの割合）に対する「勝つ見込み×組合せの割合」の和 S[h]＝Σc x[c]・W[c]・EQ[h,c] と、範囲の広さ q。
// 割合が変わった手の分だけ足し引きして更新する（基準を解く計算の大半がここなので、毎回の掛け算を軽くする）
const EQT = new Float64Array(N * N); // EQT[c×N＋h]＝h が c に勝つ見込み
for (let h = 0; h < N; h++) for (let c = 0; c < N; c++) EQT[c * N + h] = EQ[h * N + c];
function mixOf(x0) {
  const m = { x: new Float64Array(N), S: new Float64Array(N), q: 0 };
  m.set = (y) => {
    for (let c = 0; c < N; c++) {
      const d = (y[c] - m.x[c]) * CLASS_W[c];
      if (d === 0) continue;
      m.x[c] = y[c];
      m.q += d;
      const col = c * N;
      for (let h = 0; h < N; h++) m.S[h] += d * EQT[col + h];
    }
  };
  m.set(x0);
  return m;
}

// 受ける人の範囲（mixes）に対する、押す人の手ごとの得（降りる＝0）
function pusherEv(pay, mixes) {
  let reach = 1;
  let base = -pay.fold;
  const parts = mixes.map((m, k) => {
    const pr = pay.pairs[k];
    const part = { S: m.S, coef: reach * (pr.pWin - pr.pLose) };
    base += reach * m.q * pr.pLose;
    reach *= 1 - m.q;
    return part;
  });
  base += reach * pay.allFold;
  const ev = new Float64Array(N).fill(base);
  for (const { S, coef } of parts) for (let h = 0; h < N; h++) ev[h] += coef * S[h];
  return ev;
}

// 押す人の範囲（mixR）に対する、order[k+1] の人の手ごとの得（降りる＝0）
function callerEv(pay, mixR, k) {
  const pr = pay.pairs[k];
  const ev = new Float64Array(N);
  for (let c = 0; c < N; c++) {
    const eq = mixR.q > 0 ? mixR.S[c] / mixR.q : 0.5;
    ev[c] = eq * pr.jWin + (1 - eq) * pr.jLose - pr.jFold;
  }
  return ev;
}

// 互いに相手に最善で応じる範囲を、後悔の積み上げ（CFR+）で求める。各手の「押す（受ける）／降りる」の後悔の正の部分から
// 今の割合を決め、回数で重みづけした平均を答えにする。100回で得をする余地は0.005BB程度まで小さくなる。
function solve(pay, iters) {
  const K = pay.pairs.length;
  const rp = new Float64Array(N);
  const rf = new Float64Array(N);
  const cp = Array.from({ length: K }, () => new Float64Array(N));
  const cf = Array.from({ length: K }, () => new Float64Array(N));
  const R = new Float64Array(N).fill(0.5);
  const C = Array.from({ length: K }, () => new Float64Array(N).fill(0.5));
  const mR = mixOf(R);
  const mC = C.map(mixOf);
  const aR = new Float64Array(N);
  const aC = Array.from({ length: K }, () => new Float64Array(N));
  const cur = (a, b) => (a + b > 0 ? a / (a + b) : 0.5);
  let wsum = 0;
  for (let t = 1; t <= iters; t++) {
    const evP = pusherEv(pay, mC);
    for (let h = 0; h < N; h++) {
      const v = R[h] * evP[h];
      rp[h] = Math.max(0, rp[h] + evP[h] - v);
      rf[h] = Math.max(0, rf[h] - v);
      R[h] = cur(rp[h], rf[h]);
    }
    mR.set(R);
    // 受ける人に番が回ってくる見込み（前の受ける人が全員降りる見込み）で重みづけ
    const reach = [];
    let r = 1;
    for (let k = 0; k < K; k++) { reach.push(r); r *= 1 - mC[k].q; }
    for (let k = 0; k < K; k++) {
      const evC = callerEv(pay, mR, k);
      const w = reach[k] * mR.q;
      for (let c = 0; c < N; c++) {
        const v = C[k][c] * evC[c];
        cp[k][c] = Math.max(0, cp[k][c] + w * (evC[c] - v));
        cf[k][c] = Math.max(0, cf[k][c] - w * v);
        C[k][c] = cur(cp[k][c], cf[k][c]);
      }
      mC[k].set(C[k]);
    }
    wsum += t;
    for (let h = 0; h < N; h++) aR[h] += t * R[h];
    for (let k = 0; k < K; k++) for (let c = 0; c < N; c++) aC[k][c] += t * C[k][c];
  }
  return { push: aR.map((x) => x / wsum), call: aC.map((a) => a.map((x) => x / wsum)) };
}

export const SOLVE_ITERS = 100;
const CACHE_MAX = 400;
const cache = new Map();

// 場面の基準（上級者どうし）。返す値：{ spot, pay, push（169種類ごとの押す割合）, call（order[1..] ごとの受ける割合）}
// 同じ場面の答えは覚えておいて使い回す（返す値は書き換えないこと）
export function solveSpot(spot, prize = null, iters = SOLVE_ITERS) {
  const pick = (xs) => spot.order.map((i) => xs[i]);
  const key = JSON.stringify([iters, spot.order, pick(spot.cap), pick(spot.posted), spot.dead, prize ? [prize.payouts, spot.cap] : null]);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const pay = payoffs(spot, prize);
  const res = { spot, pay, ...solve(pay, iters) };
  cache.set(key, res);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return res;
}

// 得をする余地（ほかの人を固定して、1人だけやり方を変えたときに増やせる額の最大。点）
export function exploitability(res) {
  const evP = pusherEv(res.pay, res.call.map(mixOf));
  const mR = mixOf(res.push);
  const gain = (S, ev) => ev.reduce((a, x, h) => a + CLASS_W[h] * (Math.max(0, x) - S[h] * x), 0);
  return Math.max(gain(res.push, evP), ...res.call.map((Cj, k) => gain(Cj, callerEv(res.pay, mR, k))));
}

// 押したときの得（降りる＝0）。h：自分の手の種類、callFreqs[k]：order[k+1] が受ける割合（169種類ごと）。
// eqCalled：受けられたときの勝つ見込み（動く額で重みづけ）、breakeven：押して元が取れる勝つ見込み
export function pushEvOf(pay, h, callFreqs) {
  let reach = 1;
  let A = 0;
  let B = 0;
  const callers = pay.pairs.map((pr, k) => {
    const C = callFreqs[k];
    let q = 0;
    let s = 0;
    for (let c = 0; c < N; c++) if (C[c] > 0) { q += C[c] * CLASS_W[c]; s += C[c] * CLASS_W[c] * EQ[h * N + c]; }
    const eq = q > 0 ? s / q : 0;
    const P = reach * q;
    A += P * (pr.pLose - pay.fold);
    B += P * eq * (pr.pWin - pr.pLose);
    const swing = P * (pr.pWin - pr.pLose);
    reach *= 1 - q;
    return { seat: pr.seat, q, P, eq, swing, e: pr.e, potC: pr.potC };
  });
  const pAllFold = reach;
  A += pAllFold * (pay.allFold - pay.fold);
  const swing = callers.reduce((a, c) => a + c.swing, 0);
  return {
    ev: A + B, pAllFold, pCalled: 1 - pAllFold, callers,
    eqCalled: swing > 0 ? B / swing : 0,
    breakeven: swing > 0 ? Math.min(1, Math.max(0, -A / swing)) : 0,
  };
}

// 受けたときの得（降りる＝0）。k：受ける人の order の番号−1、c：自分の手の種類、pushW：押した人の手の重み（169種類ごと）
export function callEvOf(pay, k, c, pushW) {
  const pr = pay.pairs[k];
  let t = 0;
  let s = 0;
  for (let h = 0; h < N; h++) if (pushW[h] > 0) { t += pushW[h]; s += pushW[h] * EQ[c * N + h]; }
  const eq = t > 0 ? s / t : 0.5;
  return {
    ev: eq * pr.jWin + (1 - eq) * pr.jLose - pr.jFold, eq,
    breakeven: Math.min(1, Math.max(0, (pr.jFold - pr.jLose) / (pr.jWin - pr.jLose))),
    e: pr.e, potC: pr.potC, posted: pr.posted,
  };
}

// 押す範囲（割合）を、組合せの重み（169種類ごと）に直す
export const weightsOf = (freq) => freq.map((x, i) => x * CLASS_W[i]);
