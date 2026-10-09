// 採点（4段階）。損失（BB）＝ 最善の手より、期待値でも「確実に見込める期待値（推定の誤差を差し引いた値）」でも劣る分。
// 推定の誤差の範囲内の差は損失にならないので、確信の持てない場面では複数の手が「最善・許容」になる。
//   最善：0.05BB以内／許容：0.3BB以下・参加表の境目／疑問手：1.0BBまで／悪手：それより大きい
//   押す・受ける場面（段階4-1）は、賞金で計算する場面なら賞金の見込みの差を点に直した値で比べる
import { GRADE, CHART, ALLIN } from './config.js';

export const GRADE_LABEL = { best: '最善', ok: '許容', dubious: '疑問手', bad: '悪手' };

export function gradeOf(loss) {
  if (loss <= GRADE.best) return 'best';
  if (loss <= GRADE.ok) return 'ok';
  if (loss <= GRADE.dubious) return 'dubious';
  return 'bad';
}

// 期待値で比べる場面の損失（BB）：最善の手より「期待値」でも「確実に見込める期待値」でも劣る分（差の小さい方）。
// どちらか一方で最善以上なら損失0。期待値は高いが不確かな手も、期待値は低いが手堅い手も許容になる。
// 期待値も確実さも劣る手（例：普通のベットの方が得な場面での、何もない手の大きなオールイン）は損失になる。
export const lossOf = (analysis, option) => Math.max(0, Math.min(analysis.best.ev - option.ev, analysis.best.low - option.low) / analysis.bb);

export function gradeAction(analysis, action) {
  const type = action.type;
  if (analysis.mode === 'chart') {
    let loss = analysis.chart.lossOf[type];
    if (loss === undefined) throw new Error(`この場面でとれない行動: ${type}`);
    // レイズの額：持ち点が多いのにオールイン（shove）、または標準より大きすぎる額（oversize）は損失を足す
    let reason = null;
    if (type === 'raise') {
      const r = analysis.legal.raise;
      if (action.to >= r.max) {
        if (r.max / analysis.bb > CHART.allInBB) reason = 'shove';
      } else if (action.to > analysis.chart.maxOpen) reason = 'oversize';
      if (reason) loss = Math.max(loss ?? 0, reason === 'shove' ? CHART.shoveLoss : CHART.oversizeLoss);
    }
    const grade = loss === null ? 'ok' : gradeOf(loss);
    return { grade, loss: loss ?? 0, correct: grade === 'best' || grade === 'ok', reason };
  }
  if (analysis.mode === 'allin') return gradeAllin(analysis, action);
  const chosen = type === 'raise' ? analysis.evRaise(action.to) : analysis.options.find((o) => o.type === type);
  if (!chosen) throw new Error(`この場面でとれない行動: ${type}`);
  let loss = lossOf(analysis, chosen);
  // プリフロップで15BB以下なのに、オールインに満たないレイズ（中途半端な額）は最低 halfLoss の損
  let reason = null;
  if (type === 'raise' && analysis.street === 'preflop' && analysis.stackBB <= ALLIN.maxBB && action.to < analysis.legal.raise.max) {
    loss = Math.max(loss, ALLIN.halfLoss);
    reason = 'halfbet';
  }
  const grade = gradeOf(loss);
  return { grade, loss, correct: grade === 'best' || grade === 'ok', chosen, reason };
}

// 押す・受ける場面（形「オールイン」）：降りる・押す（受ける）は最善との差。受ける場面のレイズ（押し返し）は受けると同じに数える。
// 押す場面で、オールインに満たないレイズやコールで参加したとき（中途半端な額）は「halfLoss」と「押した場合の損失」の大きい方
function gradeAllin(analysis, action) {
  const [fold, act] = analysis.options;
  const all = action.type === 'raise' && action.to >= analysis.legal.raise.max;
  const chosen = action.type === 'fold' ? fold : analysis.kind === 'call' || all ? act : null;
  const reason = chosen ? null : 'halfbet';
  const loss = chosen ? lossOf(analysis, chosen) : Math.max(ALLIN.halfLoss, lossOf(analysis, act));
  const grade = gradeOf(loss);
  return { grade, loss, correct: grade === 'best' || grade === 'ok', chosen, reason };
}
