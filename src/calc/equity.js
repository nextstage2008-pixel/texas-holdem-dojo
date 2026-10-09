// 勝率（エクイティ）。相手は1つの手ではなく「ありうる手の集合（レンジ）＝1,326通りそれぞれの重み」。
//   プリフロップで相手1人：勝率表を組合せの重みで平均（table）
//   ターン・リバーで相手1人：残りのカードを全通り数える（exact）
//   それ以外（フロップ・相手が複数）：ランダム試行（mc。既定2万回）
// 一度作った結果から、「相手ごとに、この手なら降りずに続ける確率」を変えて何度でも集計し直せる（summarize）。
import { evalFast } from '../engine/fast-eval.js';
import { COMBO_COUNT, COMBO_A, COMBO_B, COMBO_CLASS, classOf } from './combos.js';
import { classVsClass, TABLE_ERR } from './preflop.js';

export const MC_SAMPLES = 20000;
const Z = 1.96; // 95%の幅

const deadOf = (cards) => {
  const d = new Uint8Array(52);
  for (const c of cards) d[c] = 1;
  return d;
};

function masked(w, dead) {
  const m = new Float64Array(COMBO_COUNT);
  for (let i = 0; i < COMBO_COUNT; i++) if (w[i] > 0 && !dead[COMBO_A[i]] && !dead[COMBO_B[i]]) m[i] = w[i];
  return m;
}

function tableModel(hero, base) {
  const hc = classOf(hero[0], hero[1]);
  const per = new Float64Array(COMBO_COUNT);
  for (let i = 0; i < COMBO_COUNT; i++) if (base[i] > 0) per[i] = classVsClass(hc, COMBO_CLASS[i]);
  return { kind: 'table', K: 1, bases: [base], per, err0: TABLE_ERR };
}

function exactModel(hero, board, base) {
  const per = new Float64Array(COMBO_COUNT);
  const dead = deadOf([...hero, ...board]);
  const h = [...hero, ...board];
  const o = [0, 0, ...board];
  for (let i = 0; i < COMBO_COUNT; i++) {
    if (!(base[i] > 0)) continue;
    o[0] = COMBO_A[i];
    o[1] = COMBO_B[i];
    if (board.length === 5) {
      const a = evalFast(h);
      const b = evalFast(o);
      per[i] = a > b ? 1 : a === b ? 0.5 : 0;
      continue;
    }
    // ターンまで：残りのカードを全通り（ターンならリバー44〜46通り、フロップなら2枚の組合せ）
    let won = 0;
    let k = 0;
    const rest = [];
    for (let c = 0; c < 52; c++) if (!dead[c] && c !== o[0] && c !== o[1]) rest.push(c);
    const need = 5 - board.length;
    const hh = [...h, 0, 0].slice(0, 7);
    const oo = [...o, 0, 0].slice(0, 7);
    const add = (x, y) => {
      hh[2 + board.length] = x; oo[2 + board.length] = x;
      if (need === 2) { hh[6] = y; oo[6] = y; }
      const a = evalFast(hh);
      const b = evalFast(oo);
      won += a > b ? 1 : a === b ? 0.5 : 0;
      k++;
    };
    for (let p = 0; p < rest.length; p++) {
      if (need === 1) add(rest[p]);
      else for (let q = p + 1; q < rest.length; q++) add(rest[p], rest[q]);
    }
    per[i] = won / k;
  }
  return { kind: 'exact', K: 1, bases: [base], per, err0: 0 };
}

function cdfOf(w) {
  const c = new Float64Array(COMBO_COUNT);
  let acc = 0;
  for (let i = 0; i < COMBO_COUNT; i++) { acc += w[i]; c[i] = acc; }
  return c;
}

function pick(cdf, rng) {
  const x = rng() * cdf[COMBO_COUNT - 1];
  let lo = 0;
  let hi = COMBO_COUNT - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] > x) hi = mid; else lo = mid + 1;
  }
  return lo;
}

// 使われていないカードだけの組合せから、重みに比例して1つ選ぶ
function pickFree(w, used, rng) {
  let total = 0;
  for (let i = 0; i < COMBO_COUNT; i++) if (!used[COMBO_A[i]] && !used[COMBO_B[i]]) total += w[i];
  let x = rng() * total;
  let last = -1;
  for (let i = 0; i < COMBO_COUNT; i++) {
    if (used[COMBO_A[i]] || used[COMBO_B[i]] || !(w[i] > 0)) continue;
    last = i;
    x -= w[i];
    if (x < 0) return i;
  }
  if (last < 0) throw new Error('相手のありうる手が残っていない（ほかの相手の手と重なる）');
  return last;
}

function mcModel(hero, board, bases, rng, samples) {
  const K = bases.length;
  const cdfs = bases.map(cdfOf);
  const idx = new Int16Array(samples * K);
  const oppScore = new Float64Array(samples * K);
  const heroScore = new Float64Array(samples);
  const u = new Float32Array(samples * K); // 「降りずに続けるか」を決めるための乱数（どの行動を比べるときも同じ値を使う）
  const dead0 = deadOf([...hero, ...board]);
  const used = new Uint8Array(52);
  const rest = new Uint8Array(52);
  const h = [hero[0], hero[1], 0, 0, 0, 0, 0];
  const o = [0, 0, 0, 0, 0, 0, 0];
  for (let t = 0; t < samples; t++) {
    // 相手の手を重みに比例して選ぶ（重なったら全員を選び直す）。
    // 何度やっても重なる（例：2人ともほぼAAしかない）ときは、1人ずつ空いているカードの中から選ぶ。
    let ok = false;
    for (let attempt = 0; attempt < 30 && !ok; attempt++) {
      used.set(dead0);
      ok = true;
      for (let k = 0; k < K; k++) {
        const i = pick(cdfs[k], rng);
        if (used[COMBO_A[i]] || used[COMBO_B[i]]) { ok = false; break; }
        used[COMBO_A[i]] = 1;
        used[COMBO_B[i]] = 1;
        idx[t * K + k] = i;
      }
    }
    if (!ok) {
      used.set(dead0);
      for (let k = 0; k < K; k++) {
        const i = pickFree(bases[k], used, rng);
        used[COMBO_A[i]] = 1;
        used[COMBO_B[i]] = 1;
        idx[t * K + k] = i;
      }
    }
    let n = 0;
    for (let c = 0; c < 52; c++) if (!used[c]) rest[n++] = c;
    for (let j = 0; j < 5; j++) {
      let card;
      if (j < board.length) card = board[j];
      else {
        const r = j - board.length;
        const x = r + Math.floor(rng() * (n - r));
        const tmp = rest[r]; rest[r] = rest[x]; rest[x] = tmp;
        card = rest[r];
      }
      h[2 + j] = card;
      o[2 + j] = card;
    }
    heroScore[t] = evalFast(h);
    for (let k = 0; k < K; k++) {
      const i = idx[t * K + k];
      o[0] = COMBO_A[i];
      o[1] = COMBO_B[i];
      oppScore[t * K + k] = evalFast(o);
      u[t * K + k] = rng();
    }
  }
  return { kind: 'mc', K, bases, idx, heroScore, oppScore, u, samples };
}

// hero：自分の2枚、board：場のカード、ranges：相手ごとの重み（Float64Array 1,326）
export function buildEquity({ hero, board, ranges, rng, samples = MC_SAMPLES, method }) {
  const dead = deadOf([...hero, ...board]);
  const bases = ranges.map((w) => masked(w, dead));
  if (bases.some((b) => !b.some((x) => x > 0))) throw new Error('相手のありうる手が残っていない');
  const kind = method ?? (ranges.length === 1 && board.length === 0 ? 'table' : ranges.length === 1 && board.length >= 4 ? 'exact' : 'mc');
  if (kind === 'table') return tableModel(hero, bases[0]);
  if (kind === 'exact') return exactModel(hero, board, bases[0]);
  if (!rng) throw new Error('ランダム試行には乱数が要る');
  return mcModel(hero, board, bases, rng, samples);
}

// 集計。conts[k]：相手 k がこの手なら降りずに続ける確率（1,326通り。省くと必ず続ける）、ys[k]：続けるときに相手 k が足す額。
// 返す値：eq（誰かが続けたときのあなたの勝つ見込み）、err（eq の95%の幅）、
//         pAllFold（全員が降りる確率）、called（誰かが続けたときに相手が足す額の合計の平均）
export function summarize(model, { conts = [], ys = [] } = {}) {
  if (model.kind !== 'mc') {
    const base = model.bases[0];
    const c = conts[0];
    let ws = 0;
    let wc = 0;
    let se = 0;
    let sAll = 0;
    for (let i = 0; i < COMBO_COUNT; i++) {
      const w = base[i];
      if (!(w > 0)) continue;
      const p = c ? c[i] : 1;
      ws += w;
      wc += w * p;
      se += w * p * model.per[i];
      sAll += w * model.per[i];
    }
    return { eq: wc > 0 ? se / wc : sAll / ws, err: model.err0, pAllFold: 1 - wc / ws, called: ys[0] ?? 0 };
  }
  const { K, idx, heroScore, oppScore, u, samples } = model;
  let n = 0;
  let s = 0;
  let folds = 0;
  let calledSum = 0;
  let sAll = 0;
  for (let t = 0; t < samples; t++) {
    let best = -1;
    let ties = 0;
    let bestAll = -1;
    let tiesAll = 0;
    let any = false;
    let add = 0;
    for (let k = 0; k < K; k++) {
      const sc = oppScore[t * K + k];
      if (sc > bestAll) { bestAll = sc; tiesAll = 1; } else if (sc === bestAll) tiesAll++;
      const c = conts[k];
      if (c && !(u[t * K + k] < c[idx[t * K + k]])) continue;
      any = true;
      add += ys[k] ?? 0;
      if (sc > best) { best = sc; ties = 1; } else if (sc === best) ties++;
    }
    const hs = heroScore[t];
    sAll += hs > bestAll ? 1 : hs < bestAll ? 0 : 1 / (tiesAll + 1);
    if (!any) { folds++; continue; }
    n++;
    s += hs > best ? 1 : hs < best ? 0 : 1 / (ties + 1);
    calledSum += add;
  }
  const eq = n > 0 ? s / n : sAll / samples;
  const m = n > 0 ? n : samples;
  return { eq, err: Z * Math.sqrt(Math.max(eq * (1 - eq), 0.01) / m), pAllFold: folds / samples, called: n > 0 ? calledSum / n : 0 };
}

// 相手 k の手をグループに分けたときの、グループごとの1対1の勝つ見込み（相手の手の一覧に使う）。
// groupOf：組合せ番号 → グループ番号。返す値：[{ share（そのグループの重みの割合）, eq, err }]
export function groupEquity(model, k, groupOf, groups) {
  const base = model.bases[k];
  const total = base.reduce((a, x) => a + x, 0);
  const out = Array.from({ length: groups }, () => ({ share: 0, eq: null, err: null, w: 0, s: 0, n: 0 }));
  for (let i = 0; i < COMBO_COUNT; i++) if (base[i] > 0) out[groupOf[i]].share += base[i] / total;
  if (model.kind !== 'mc') {
    for (let i = 0; i < COMBO_COUNT; i++) {
      if (!(base[i] > 0)) continue;
      const g = out[groupOf[i]];
      g.w += base[i];
      g.s += base[i] * model.per[i];
    }
    for (const g of out) if (g.w > 0) { g.eq = g.s / g.w; g.err = model.err0; }
  } else {
    const { K, idx, heroScore, oppScore, samples } = model;
    for (let t = 0; t < samples; t++) {
      const g = out[groupOf[idx[t * K + k]]];
      const hs = heroScore[t];
      const os = oppScore[t * K + k];
      g.n++;
      g.s += hs > os ? 1 : hs < os ? 0 : 0.5;
    }
    for (const g of out) if (g.n > 0) { g.eq = g.s / g.n; g.err = Z * Math.sqrt(Math.max(g.eq * (1 - g.eq), 0.01) / g.n); }
  }
  return out.map(({ share, eq, err }) => ({ share, eq, err }));
}
