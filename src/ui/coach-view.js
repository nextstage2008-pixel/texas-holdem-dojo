// コーチ欄の表示用データ（DOMを触らない純粋な関数）。指南の段階と場面（行動の前・後・ハンドの終わり）で中身を決める。
import { coachShows, levelFor } from '../coach/levels.js';
import { SITUATIONS, SITUATION_LABEL } from '../coach/situations.js';
import { gaugeData, noteText, hintText, basisLines, plaqueBefore, plaqueAfter, changeText } from '../coach/explain.js';
import { oppView } from '../coach/opp-view.js';
import { TYPES } from '../coach/policy.js';
import { GRADE_LABEL } from '../coach/grade.js';
import { canRepeat } from '../coach/repeat.js';

const STREET = { preflop: 'プリフロップ', flop: 'フロップ', turn: 'ターン', river: 'リバー' };
const pct = (x) => `${Math.round(x * 100)}%`;

// ctx：{ phase（'idle'|'before'|'after'|'review'）, analysis, verdict, review（このハンドの判断の一覧）, coach（段階の状態）,
//        players（名前つきの席の一覧）, typeOf(seat), error（分析に失敗したときの文） }
export function buildCoachView(ctx) {
  const { phase, analysis, verdict, coach } = ctx;
  const levels = SITUATIONS.map((s) => ({ key: s, label: SITUATION_LABEL[s], level: levelFor(coach, s) }));
  const view = {
    level: null, situation: null, mode: 'idle', gauge: null, note: null, plaque: null, basis: null,
    opp: null, hint: null, review: null, reviewTitle: null, change: null, canGrid: false, canRepeat: false, levels, error: ctx.error ?? null,
  };
  const reviewRows = () => (ctx.review ?? []).map((d) => ({
    text: `${STREET[d.street]}・${SITUATION_LABEL[d.situation]}：${d.actionText}`,
    grade: d.grade, gradeLabel: GRADE_LABEL[d.grade], best: d.grade === 'best' ? '' : `最善は${d.bestText}`,
  }));
  if (phase === 'review') {
    view.mode = ctx.review.length ? 'review' : 'idle';
    view.review = reviewRows();
    view.reviewTitle = '振 り 返 り';
    return view;
  }
  // 指南を出さない間も、直前の振り返り（段階4）は次の振り返りまで残す
  const keepReview = () => {
    if (!ctx.review?.length) return;
    view.review = reviewRows();
    view.reviewTitle = '前 の ハ ン ド の 振 り 返 り';
  };
  if (!analysis) { keepReview(); return view; }
  const level = phase === 'after' ? verdict.level : levelFor(coach, analysis.situation);
  view.level = level;
  view.situation = SITUATION_LABEL[analysis.situation];
  const shows = phase === 'before' ? coachShows(level, 'before') : phase === 'after' ? coachShows(level, 'after', verdict.grade) : 'none';
  view.mode = shows;
  if (phase === 'after') view.change = changeText(verdict.change);
  if (shows === 'none') { keepReview(); return view; }
  if (shows === 'hint') {
    view.hint = hintText(analysis);
    return view;
  }
  // 1万回やり直す：中身が全部出ているとき（段階1の行動の前・行動のあとの採点）で、期待値か押す・受けるの形のとき
  view.canRepeat = canRepeat(analysis);
  view.gauge = gaugeData(analysis);
  // 一行の解説は段階1・2だけ（設計書 第5-1節）。段階3で間違えた時は採点と根拠だけを出す
  view.note = shows === 'full' || level <= 2 ? noteText(analysis) : null;
  view.plaque = shows === 'full' ? plaqueBefore(analysis) : plaqueAfter(analysis, verdict);
  view.basis = basisLines(analysis);
  // 相手の手の一覧：期待値の場面と、押す・受ける場面（押す場面は一番受けそうな人の受ける手、受ける場面は押した人の手）
  if (analysis.mode === 'ev' || (analysis.mode === 'allin' && analysis.main !== null)) {
    const k = analysis.main;
    const seat = analysis.opps[k];
    const o = oppView(analysis, k);
    const type = ctx.typeOf(seat); // タイプを伏せる章では null
    const pushing = analysis.mode === 'allin' && analysis.kind === 'push';
    const eq = pushing ? analysis.options[1].detail.callers.find((c) => c.seat === seat).eq : analysis.eq;
    view.opp = {
      title: `${ctx.players[seat].name}（${type ? TYPES[type].name : '？'}）${pushing ? 'が受ける手' : 'の手'}・推定`,
      items: o.items, foot: `全部をならすと勝つ見込み ${pct(eq)}（ありうる手 約${o.effective}通り）`,
    };
    view.canGrid = true;
  }
  return view;
}

// 大会の終わりの成績表（場面ごとの判断の数・正答率・平均損失・いまの段階）
export function buildReport(decisions, coach) {
  const rows = SITUATIONS.map((s) => {
    const ds = decisions.filter((d) => d.situation === s);
    return {
      label: SITUATION_LABEL[s], n: ds.length, level: levelFor(coach, s),
      accuracy: ds.length ? ds.filter((d) => d.correct).length / ds.length : null,
      avgLoss: ds.length ? ds.reduce((a, d) => a + d.loss, 0) / ds.length : null,
    };
  });
  const n = decisions.length;
  return {
    n, rows,
    accuracy: n ? decisions.filter((d) => d.correct).length / n : null,
    avgLoss: n ? decisions.reduce((a, d) => a + d.loss, 0) / n : null,
  };
}
