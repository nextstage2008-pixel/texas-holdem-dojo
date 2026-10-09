// 解説文（コーチ欄に出す言葉と数字）。分析（analyze.js）と採点（grade.js）の結果を、初心者にも読める文にする。
import { classLabel } from '../calc/combos.js';
import { drawOuts, outsChance, ruleOfThumb } from '../calc/odds.js';
import { GRADE_LABEL, gradeOf, lossOf } from './grade.js';
import { SITUATION_LABEL } from './situations.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (x) => `${Math.round(x * 100)}%`;
const pct1 = (x) => `${(x * 100).toFixed(1)}%`;
const signed = (n) => (n >= 0 ? `+${fmt(n)}` : `−${fmt(-n)}`);
const bbs = (x) => `${x.toFixed(1)}BB`;
const sbb = (x) => (x >= 0 ? `+${x.toFixed(1)}BB` : `−${(-x).toFixed(1)}BB`);
const spct = (x) => (x >= 0 ? `+${(x * 100).toFixed(1)}%` : `−${(-x * 100).toFixed(1)}%`);
const HALF = '15BB以下は押すか降りるか。中途半端に賭けると、押し返されたら降りるしかない';
const METHOD = { table: '勝率表', exact: '全通り', mc: 'ランダム試行2万回' };

// 行動の呼び名。フロップ以降で誰も賭けていなければ「ベット」、それ以外は「レイズ」。持ち点すべてなら「オールイン」
export function actionLabel(analysis, action) {
  if (action.type === 'fold') return '降りる';
  if (action.type === 'check') return 'チェック';
  if (action.type === 'call') return analysis.legal.toCall >= analysis.stack ? 'オールイン（コール）' : 'コール';
  if (analysis.legal.raise && action.to >= analysis.legal.raise.max) return `オールイン ${fmt(action.to)}`;
  const word = analysis.street !== 'preflop' && analysis.legal.canCheck ? 'ベット' : 'レイズ';
  return `${word} ${fmt(action.to)}`;
}

export function bestAction(analysis) {
  if (analysis.mode === 'chart') return analysis.chart.best === 'raise' ? { type: 'raise', to: null } : { type: 'fold' };
  return analysis.best.type === 'raise' ? { type: 'raise', to: analysis.best.to } : { type: analysis.best.type };
}

export function bestLabel(analysis) {
  if (analysis.mode === 'chart') return analysis.chart.best === 'raise' ? 'レイズで参加' : '降りる';
  return actionLabel(analysis, bestAction(analysis));
}

const handName = (analysis) => classLabel(analysis.chart.cls);

// 計器：勝つ見込みと損益分岐点（参加表の場面は、上位25%の手に対する勝つ見込みと参加ライン。
// 賞金で計算する押す・受ける場面は、賞金の見込みで元が取れる勝つ見込み）
export function gaugeData(analysis) {
  if (analysis.mode === 'chart') {
    return { value: analysis.chart.eq, mark: analysis.chart.line, valueLabel: '勝つ見込み', markLabel: '参加ライン' };
  }
  if (analysis.mode === 'allin') {
    return { value: analysis.eq, mark: analysis.breakeven, valueLabel: '勝つ見込み', markLabel: analysis.prize ? '損益分岐点（賞金）' : '損益分岐点' };
  }
  return { value: analysis.eq, mark: analysis.breakeven, valueLabel: '勝つ見込み', markLabel: '損益分岐点' };
}

// 押す・受ける場面の言葉：最善の手（押す・受ける・降りる）。もう一方の手も許容（差が推定の誤差の範囲）なら、そう言う
const allinBest = (a) => (a.best.type === 'fold' ? '降りる' : a.kind === 'push' ? '押す' : '受ける');
function allinVerdict(a) {
  const other = a.options.find((o) => o !== a.best);
  const g = gradeOf(lossOf(a, other));
  return g === 'best' || g === 'ok' ? 'どちらも許容（差は推定の誤差の範囲）' : allinBest(a);
}
const timesTail = (e, b) => (e > b ? `${e - b}回分お得` : e < b ? `${b - e}回分足りない` : 'ちょうど五分');

function allinNote(a) {
  if (a.kind === 'push') {
    const d = a.options[1].detail;
    const head = `全員が降りる見込み${pct(d.pAllFold)}（そのまま${bbs(a.chipPay.pot / a.bb)}もらえる）。`;
    const word = a.eq >= a.breakeven ? '受けられても' : '受けられると';
    if (!a.prize) return `${head}${word}勝つ見込み${pct(a.eq)}（元が取れるのは${pct(a.breakeven)}）→ ${allinVerdict(a)}`;
    return `${head}${word}勝つ見込み${pct(a.eq)}。賞金で元が取れるのは${pct(a.breakeven)}（点なら${pct(a.chipBreakeven)}）→ ${allinVerdict(a)}`;
  }
  const e = Math.round(a.eq * 100);
  const b = Math.round(a.breakeven * 100);
  if (!a.prize) return `100回受けると${e}回勝つ見込み。${b}回勝てば元が取れる → ${timesTail(e, b)}`;
  return `100回受けると${e}回勝つ見込み。賞金で元が取れるのは${b}回（点なら${Math.round(a.chipBreakeven * 100)}回）→ ${timesTail(e, b)}`;
}

// 一行の解説
export function noteText(analysis) {
  if (analysis.mode === 'allin') return allinNote(analysis);
  if (analysis.mode === 'chart') {
    const c = analysis.chart;
    return `${c.where}は上位${pct(c.cutoff)}の手で参加。この手（${handName(analysis)}）は上位${pct1(c.pct)} → ${bestLabel(analysis)}${c.border ? '（境目なので、どちらも許容）' : ''}`;
  }
  if (analysis.legal.canCheck) {
    const r = analysis.raises.reduce((b, o) => (!b || o.low > b.low ? o : b), null);
    const tail = r ? `${actionLabel(analysis, r)}なら相手が降りる見込み${pct(r.pFold)}` : '';
    return `チェックなら無料で次へ進めます。${tail}`;
  }
  const e = Math.round(analysis.eq * 100);
  const b = Math.round(analysis.breakeven * 100);
  const d = e - b;
  const tail = d > 0 ? `${d}回分お得` : d < 0 ? `${-d}回分足りない` : 'ちょうど五分';
  return `100回コールすると${e}回勝つ見込み。${b}回勝てば元が取れる → ${tail}`;
}

// 段階2：行動の前に出す「考えるきっかけ」
export function hintText(analysis) {
  if (analysis.mode === 'chart') return `${analysis.chart.where}の参加ラインは上位何%？ この手（${handName(analysis)}）は上位何%？`;
  if (analysis.mode === 'allin') {
    const tail = analysis.prize ? ' 飛んだら賞金の見込みはどれだけ減る？' : '';
    if (analysis.kind === 'push') return `全員が降りる見込みは？ 受けられたら勝つ見込みは？${tail}`;
    const d = analysis.options[1].chip;
    return `損益分岐点はいくら？（払う額 ${bbs((d.e - d.posted) / analysis.bb)}・勝てば取れる額 ${bbs(d.potC / analysis.bb)}） 押した人の手に対する勝つ見込みは？${tail}`;
  }
  if (analysis.legal.canCheck) return '賭けたら相手は降りそう？ 勝つ見込みはどのくらい？';
  const call = analysis.options.find((o) => o.type === 'call');
  return `損益分岐点はいくら？（払う額 ${fmt(call.c)}・払った後のポット ${fmt(call.W)}）`;
}

// 期待値の計算式（行動ごと）
function formula(analysis, o) {
  if (o.type === 'fold') return '降りる：0';
  if (o.type === 'check') return `チェック：${pct(o.eq)} × ${fmt(o.W)} ＝ ${signed(o.ev)}`;
  if (o.type === 'call') return `コール：${pct(o.eq)} × ${fmt(o.W)} − ${fmt(o.c)} ＝ ${signed(o.ev)}`;
  return `${actionLabel(analysis, o)}：降りる${pct(o.pFold)} × ${fmt(o.P)} ＋ 続ける${pct(1 - o.pFold)} ×（${pct(o.eq)} × ${fmt(o.W)} − ${fmt(o.A)}）＝ ${signed(o.ev)}`;
}

// 押す・受けるの計算式（点を BB で）。r：calc/pushfold.js の pushEvOf（点で数えた結果）、pay：点で数えた payoffs。
// 受けられたときの額は、受ける人ごとの見込みで重みづけした平均（受ける人が1人なら、その人との勝負の額そのもの）。道場の問題の解説でも使う
export function pushFormula(r, pay, bb) {
  const pC = r.pCalled;
  const W = pC > 0 ? r.callers.reduce((s, x) => s + x.P * x.potC, 0) / pC : 0;
  const R = pC > 0 ? r.callers.reduce((s, x) => s + x.P * (x.e - pay.postedP), 0) / pC : 0;
  return `押す：降りる見込み${pct(r.pAllFold)} × ${bbs(pay.pot / bb)} ＋ 受けられる${pct(pC)} ×（${pct(r.eqCalled)} × ${bbs(W / bb)} − ${bbs(R / bb)}）＝ ${sbb(r.ev / bb)}`;
}
// r：calc/pushfold.js の callEvOf（点で数えた結果）
export const callFormula = (r, bb) => `受ける：${pct(r.eq)} × ${bbs(r.potC / bb)} − ${bbs((r.e - r.posted) / bb)} ＝ ${sbb(r.ev / bb)}`;

// 押す・受ける場面の根拠の行（点の計算式、賞金で計算する場面は賞金の見込みの差、基準の範囲、近似の断り書き）
function allinBasis(a) {
  const bb = a.bb;
  const act = a.options[1];
  const c = act.chip;
  const lines = [];
  const pre = a.prize ? '点で計算：' : '';
  lines.push(pre + (a.kind === 'push' ? pushFormula(c, a.chipPay, bb) : callFormula(c, bb)));
  if (a.prize) lines.push(`賞金で計算：${a.kind === 'push' ? '押す' : '受ける'} ${spct(act.ev / a.total)}（点に直すと ${sbb(act.ev / bb)}）`);
  lines.push('降りる：0');
  if (a.kind === 'call') {
    lines.push(`損益分岐点：${bbs((c.e - c.posted) / bb)} ÷ ${bbs(c.potC / bb)} ＝ ${pct1(a.chipBreakeven)}${a.prize ? `（賞金で計算すると ${pct1(a.breakeven)}）` : ''}`);
  }
  // 基準（上級者どうし）と、この卓の相手の打ち方で計算した答えが違うときは、そう添える
  const gain = act.ev > 0;
  const differ = a.ref.inRange !== gain ? `（この卓の相手の打ち方で計算すると、${gain ? (a.kind === 'push' ? '押す' : '受ける') : '降りる'}方が得）` : '';
  const mine = `あなたの手 ${classLabel(a.cls)} は${a.ref.inRange ? '入る' : '入らない'}${differ}`;
  lines.push(a.kind === 'push'
    ? `この席・この持ち点の押す範囲は全体の${pct(a.ref.share)}（上級者どうしの基準）。${mine}`
    : `上級者どうしの基準では、この席は全体の${pct(a.ref.share)}で受ける。${mine}`);
  lines.push('押したあと受けるのは最大1人とみなす近似。勝つ見込みは勝率表から（カードの重なりは数えない）');
  if (a.prize) lines.push('賞金の見込みは ICM（Malmuth-Harville）。賞金総額を全員の持ち点の合計とみなして点に直します');
  return lines;
}

// 根拠の行（計算式・勝つ見込みと誤差・損益分岐点・アウツ）
export function basisLines(analysis) {
  if (analysis.mode === 'allin') return allinBasis(analysis);
  if (analysis.mode === 'chart') {
    const c = analysis.chart;
    return [
      `この手 ${handName(analysis)}：上位${pct1(c.pct)}（${c.where}の参加ラインは上位${pct(c.cutoff)}）`,
      `上位25%の手に対する勝つ見込み ${pct(c.eq)}（参加ライン ${pct(c.line)}）`,
      '持ち点16BB以上で、まだ誰もレイズしていない場面は参加表で判断します',
    ];
  }
  const lines = analysis.options.map((o) => formula(analysis, o));
  lines.push(`勝つ見込み ${pct1(analysis.eq)}（誤差 ±${pct1(analysis.err)}・${METHOD[analysis.method]}）`);
  const call = analysis.options.find((o) => o.type === 'call');
  if (call) lines.push(`損益分岐点：${fmt(call.c)} ÷ ${fmt(call.W)} ＝ ${pct1(analysis.breakeven)}`);
  const { outs } = drawOuts(analysis.hole, analysis.board);
  if (outs.length > 0) {
    const k = analysis.street === 'flop' ? 4 : 2;
    lines.push(`アウツ ${outs.length}枚：暗算 ${outs.length}×${k}＝${pct(ruleOfThumb(outs.length, analysis.street))} ／ 正確 ${pct1(outsChance(outs.length, analysis.street))}`);
  }
  lines.push('期待値は「降りる＝0」を基準にした点数。このあとの賭けは数えない近似です');
  return lines;
}

// 行動の前の銘板（最善手）
export function plaqueBefore(analysis) {
  if (analysis.mode === 'chart') {
    const c = analysis.chart;
    return { k: '最 善 手', v: bestLabel(analysis), s: c.border ? '境目なので、どちらも許容' : `参加表（${c.where}：上位${pct(c.cutoff)}まで）` };
  }
  if (analysis.mode === 'allin') {
    const other = analysis.options.find((o) => o !== analysis.best);
    const g = gradeOf(lossOf(analysis, other));
    if (g === 'best' || g === 'ok') return { k: '最 善 手', v: bestLabel(analysis), s: `${actionLabel(analysis, other)}も許容（差は推定の誤差の範囲）` };
    return { k: '最 善 手', v: bestLabel(analysis), s: `${actionLabel(analysis, other)}より ${sbb((analysis.best.ev - other.ev) / analysis.bb)} 得${analysis.prize ? '（賞金で計算）' : ''}` };
  }
  const others = analysis.options.filter((o) => o !== analysis.best);
  // 差が推定の誤差の範囲（許容以上）の手があれば、それも示す（確信の持てない場面では複数の手を許容）
  const alt = others.find((o) => gradeOf(lossOf(analysis, o)) === 'best' || gradeOf(lossOf(analysis, o)) === 'ok');
  if (alt) return { k: '最 善 手', v: bestLabel(analysis), s: `${actionLabel(analysis, alt)}も許容（差は推定の誤差の範囲）` };
  const second = others.reduce((b, o) => (!b || o.ev > b.ev ? o : b), null);
  return { k: '最 善 手', v: bestLabel(analysis), s: `${actionLabel(analysis, second)}より ${signed(analysis.best.ev - second.ev)}点 得` };
}

const spaced = (s) => [...s].join(' ');

// 行動の後の銘板（採点）
export function plaqueAfter(analysis, verdict) {
  const lossText = analysis.mode === 'chart' ? `約${verdict.loss.toFixed(1)}BB` : analysis.mode === 'allin' ? bbs(verdict.loss) : `${fmt(verdict.loss * analysis.bb)}点`;
  let s;
  const std = analysis.mode === 'chart' ? `標準はレイズ ${fmt(analysis.chart.openTo)}（${lossText}の損）` : '';
  if (verdict.grade === 'best') s = 'いい判断です';
  else if (verdict.reason === 'halfbet') s = `${HALF}（最善は${bestLabel(analysis)}・${lossText}の損）`;
  else if (verdict.reason === 'oversize' && analysis.chart.best === 'raise') s = `参加はよいが額が大きすぎる。${std}`;
  else if (verdict.reason === 'shove' && analysis.chart.best === 'raise') s = `持ち点が多いときのオールインは危険。${std}`;
  else if (verdict.grade === 'ok') s = `最善は${bestLabel(analysis)}。差は小さく許容（${lossText}）`;
  else s = `最善は${bestLabel(analysis)}（${lossText}の損）`;
  return { k: spaced(GRADE_LABEL[verdict.grade]), v: actionLabel(analysis, verdict.action), s, grade: verdict.grade };
}

export function changeText(change) {
  if (!change) return null;
  const word = change.to > change.from ? '進めました' : '戻しました';
  return `${SITUATION_LABEL[change.situation]}の指南を段階${change.to}に${word}（直近50回の正答率${pct(change.accuracy)}）`;
}
