// 1万回やり直す（設計書 段階4-2 第4節）：分析（形「期待値」・「オールイン」）の手ごとに結果の表を作り、1万回引く。
// 結果を引く確率はコーチの計算と同じ（勝つ見込み・相手が降りる見込み・押す場面なら受ける人ごとの見込み）。
// このあとの賭けは数えない、いまのコーチと同じ近似。点は「降りる＝0」を基準にした増減（賞金で計算する場面は、賞金の見込みを点に直した値）。
import { createRng } from '../engine/rng.js';
import { repeatOutcomes } from '../calc/repeat.js';
import { actionLabel } from './explain.js';
import { gradeOf, lossOf } from './grade.js';

export const canRepeat = (analysis) => analysis.mode === 'ev' || analysis.mode === 'allin';

// 乱数の元：大会の種・ハンドの番号・判断の番号から（押し直しても同じ図になる）
export const repeatSeed = (seed, handNo, k) => (Math.imul(Math.imul(seed ^ 0x7e9a, 0x9e3779b1) + handNo, 0x85ebca6b) + k) >>> 0;

// 手ごとの結果の表：[{ p, v, kind, seat? }]。kind：'zero'（降りる）・'allFold'（全員が降りる）・'win'・'lose'、
// seat：押す場面で受けた人の席
export function outcomesOf(analysis, option) {
  if (option.type === 'fold') return [{ p: 1, v: 0, kind: 'zero' }];
  if (analysis.mode === 'allin') {
    const { pay } = analysis;
    if (analysis.kind === 'call') {
      const pr = pay.pairs[analysis.k];
      const eq = option.detail.eq;
      return [{ p: eq, v: pr.jWin - pr.jFold, kind: 'win' }, { p: 1 - eq, v: pr.jLose - pr.jFold, kind: 'lose' }];
    }
    const d = option.detail;
    const rows = [{ p: d.pAllFold, v: pay.allFold - pay.fold, kind: 'allFold' }];
    d.callers.forEach((c, k) => {
      const pr = pay.pairs[k];
      rows.push({ p: c.P * c.eq, v: pr.pWin - pay.fold, kind: 'win', seat: c.seat });
      rows.push({ p: c.P * (1 - c.eq), v: pr.pLose - pay.fold, kind: 'lose', seat: c.seat });
    });
    return rows;
  }
  const o = option;
  if (o.type === 'check') return [{ p: o.eq, v: o.W, kind: 'win' }, { p: 1 - o.eq, v: 0, kind: 'lose' }];
  if (o.type === 'call') return [{ p: o.eq, v: o.W - o.c, kind: 'win' }, { p: 1 - o.eq, v: -o.c, kind: 'lose' }];
  return [
    { p: o.pFold, v: o.P, kind: 'allFold' },
    { p: (1 - o.pFold) * o.eq, v: o.W - o.A, kind: 'win' },
    { p: (1 - o.pFold) * (1 - o.eq), v: -o.A, kind: 'lose' },
  ];
}

const same = (o, action) => !!action && o.type === action.type && (o.type !== 'raise' || o.to === action.to);

// 手ごとに1万回やり直す。action：あなたが選んだ手（行動の前は null）。
// 期待値の形で、最善でない額にレイズしたときは、その額の行を足す
// 返す値：[{ option, outcomes, chosen, best, ok（最善でないが採点では最善・許容の手）, ...repeatOutcomes の値 }]
export function repeatAnalysis(analysis, seed, action = null) {
  const opts = analysis.options.slice();
  if (analysis.mode === 'ev' && action?.type === 'raise' && !opts.some((o) => same(o, action))) opts.push(analysis.evRaise(action.to));
  return opts.map((option, i) => {
    const outcomes = outcomesOf(analysis, option);
    return {
      option, outcomes, chosen: same(option, action), best: option === analysis.best,
      ok: option !== analysis.best && ['best', 'ok'].includes(gradeOf(lossOf(analysis, option))),
      ...repeatOutcomes(outcomes, createRng((seed + i) >>> 0)),
    };
  });
}

// ---- 札に出す言葉（ui/repeat-view.js と第8章の講義の図が使う） ----
const fmt = (n) => Math.round(n).toLocaleString('en-US');
// 符号つきの点（−0 は +0 にする）
export const spts = (x) => {
  const v = Math.round(x) || 0;
  return v >= 0 ? `+${fmt(v)}点` : `−${fmt(-v)}点`;
};

// 手の呼び名
export function optionLabel(analysis, option) {
  if (analysis.mode === 'allin' && option.type !== 'fold') return analysis.kind === 'push' ? '押す（オールイン）' : '受ける（コール）';
  return actionLabel(analysis, option);
}

// 結果の種類の呼び名
export function kindLabels(analysis, option) {
  if (option.type === 'fold') return { zero: 'いつも0点' };
  if (option.type === 'raise') {
    const by = analysis.mode === 'allin' ? '受けられて' : '続けられて';
    return { allFold: '全員が降りる', win: `${by}勝ち`, lose: `${by}負け` };
  }
  return { win: '勝ち', lose: '負け' };
}

const PART_ORDER = ['allFold', 'win', 'lose', 'zero'];
// 結果の内訳：同じ種類の結果をまとめる（押す場面の受ける人ごとの勝ち負けは1つに）。v は確率で重みづけした1回あたりの点
export function partsOf(outcomes, counts, labels) {
  const m = new Map();
  outcomes.forEach((o, i) => {
    const g = m.get(o.kind) ?? { count: 0, pv: 0, p: 0 };
    g.count += counts[i];
    g.pv += o.p * o.v;
    g.p += o.p;
    m.set(o.kind, g);
  });
  return PART_ORDER.filter((k) => m.get(k)?.p > 0).map((k) => {
    const g = m.get(k);
    return { kind: k, label: labels[k], count: g.count, v: g.pv / g.p };
  });
}

// 「勝ち 3,512回（+6,000点）／負け 6,488回（−2,000点）」。降りるは「いつも0点（10,000回）」
export const partsText = (parts) => parts.map((p) => (p.kind === 'zero' ? `${p.label}（${fmt(p.count)}回）` : `${p.label} ${fmt(p.count)}回（${spts(p.v)}）`)).join('／');

// 最善の印より平均（期待値）の大きい手があるときの一文。なければ null。
// コーチは「推定の誤差を差し引いても見込める値」で最善を選ぶので、期待値は大きくても推定の幅も大きい手は最善にしない
export function bestNote(analysis, rows) {
  const best = rows.find((r) => r.best);
  if (!best) return null;
  const higher = rows.filter((r) => !r.best && r.option.ev > best.option.ev + 1e-9).sort((a, b) => b.option.ev - a.option.ev)[0];
  if (!higher) return null;
  const label = optionLabel(analysis, higher.option);
  return `最善の印は、推定の誤差を差し引いても見込める値で選んでいます。平均の大きい「${label}」は推定の幅も大きいので、${higher.ok ? '許容としています' : '手堅い方を最善にしています'}（この図は、コーチの推定が当たっているとしたときの散らばりです）。`;
}

// 100回ずつの組の平均の散らばりの説明
export function spreadText(row) {
  const [lo, hi] = row.range95;
  if (row.sd === 0) return `毎回 ${spts(row.exact)}。散らばりはありません。`;
  const head = `100回の平均は ${spts(lo)}〜${spts(hi)} に散らばる（100組のうち95組）。`;
  if (row.exact > 0 && lo < 0) return `${head}100回では、得な判断でも損に見えることがある。`;
  if (row.exact < 0 && hi > 0) return `${head}100回では、損な判断でも得に見えることがある。`;
  return head;
}
