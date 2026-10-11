// コーチ欄のHTML。表示用データ（coach-view.js）を受け取って文字列にするだけ。
import { gaugeSVG } from './gauge.js';
import { cardLabel, isRed } from '../engine/cards.js';
import { SITUATIONS, SITUATION_LABEL } from '../coach/situations.js';
import { LEAK_CHAPTER } from '../dojo/stats.js';
import { chapterLabel } from '../dojo/chapters.js';
import { MASTER } from '../dojo/ranks.js';

const pct = (x) => `${Math.round(x * 100)}%`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function miniCard(c) {
  const label = cardLabel(c);
  return `<span class="mc${isRed(c) ? ' r' : ''}">${label.slice(0, -1)}<br>${label.slice(-1)}</span>`;
}

function oppHTML(opp) {
  const items = opp.items.map((it) => `<div class="it">
      <div class="cs">${it.cards ? it.cards.map(miniCard).join('') : ''}</div>
      <div class="nm">${esc(it.name)}<div class="often">${'<i class="on"></i>'.repeat(it.often)}${'<i></i>'.repeat(10 - it.often)}</div></div>
      <div class="tag ${it.tag}">${it.text}<small>${pct(it.eq)}</small></div></div>`).join('');
  return `<div class="sec">相 手 の 手</div><div class="otitle">${esc(opp.title)}</div><div class="lc">${items}</div><div class="ofoot">${esc(opp.foot)}</div>`;
}

const GLOSS = {
  勝つ見込み: '最後まで行ったら勝つ確率（勝率）。相手のありうる手すべてに対して計算します',
  損益分岐点: '損をしないために最低限必要な勝率。払う額 ÷ 払った後のポット',
  参加ライン: 'この席で参加してよい一番弱い手の、上位25%の手に対する勝つ見込み',
  '損益分岐点（賞金）': '賞金の見込みで損をしないために最低限必要な勝率。飛ぶと賞金がもらえないので、点で計算するより高くなります',
};

// コーチ欄の中身を、縦の並べ方の板のタブ（助言・根拠・相手の手）ごとに区切って作る（設計書 段階5-1 第4-3節）。
// 返す値：[タブ, HTML] の列（PC のコーチ欄に並べる順）
function coachPieces(v) {
  const parts = [];
  const add = (tab, html) => parts.push([tab, html]);
  if (v.error) add('advice', `<div class="note warn">${esc(v.error)}</div>`);
  if (v.change) add('advice', `<div class="note up">★ ${esc(v.change)}</div>`);
  if (v.mode === 'idle' || v.mode === 'none') add('advice', `<div class="idle">${idleText(v)}</div>`);
  if (v.hint) add('advice', `<div class="hint"><b>考えてみよう</b>${esc(v.hint)}</div>`);
  if (v.plaque && v.mode === 'verdict') add('advice', plaqueHTML(v.plaque));
  if (v.gauge) {
    const g = v.gauge;
    add('advice', `<div class="gwrap">${gaugeSVG(g)}<div class="glabel"><span title="${GLOSS[g.valueLabel]}">${g.valueLabel}</span> <b>${pct(g.value)}</b>　／　<span class="dot">●</span> <span title="${GLOSS[g.markLabel]}">${g.markLabel}</span> <b class="red">${pct(g.mark)}</b></div></div>`);
  }
  if (v.note) add('advice', `<div class="note"><span class="new">NEW</span>${esc(v.note)}</div>`);
  if (v.plaque && v.mode !== 'verdict') add('advice', plaqueHTML(v.plaque));
  if (v.basis) add('basis', `<div class="sec">根 拠</div><ul class="basis">${v.basis.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`);
  if (v.opp) add('opp', oppHTML(v.opp));
  if (v.canGrid || v.canRepeat) {
    add('opp', `<div class="gbs">${v.canGrid ? '<button class="gb alt" data-grid>手の表を詳しく</button>' : ''}${v.canRepeat ? '<button class="gb alt" data-repeat>1万回やり直す</button>' : ''}</div>`);
  }
  if (v.review) {
    const rows = v.review.map((r) => `<div class="rv"><span class="g ${r.grade}">${r.gradeLabel}</span>${esc(r.text)}${r.best ? `<small>${esc(r.best)}</small>` : ''}</div>`).join('');
    add('advice', `<div class="sec">${v.reviewTitle}</div>${rows}`);
  }
  const lv = v.levels.map((l) => `<span>${l.label}<b>${l.level}</b></span>`).join('');
  add('basis', `<div class="sec">指 南 の 段 階</div><div class="lvls">${lv}</div>`);
  return parts;
}

const idleText = (v) => (v.mode === 'none' ? `自分で考えて打ちましょう（${esc(v.situation)}：指南 段階${v.level}）` : 'あなたの番になると、ここに助言が出ます');

// PC のコーチ欄：全部を並べる
export function coachHTML(v) {
  return coachPieces(v).map(([, html]) => html).join('');
}

// 縦の並べ方の板のタブ（手の表と大会は、卓の進行が中身を入れる）
export const SHEET_TABS = [
  { key: 'advice', label: '助言' }, { key: 'basis', label: '根拠' }, { key: 'opp', label: '相手の手' },
  { key: 'grid', label: '手の表' }, { key: 'side', label: '大会' },
];
export function coachParts(v) {
  const out = { advice: '', basis: '', opp: '' };
  for (const [tab, html] of coachPieces(v)) out[tab] += html;
  return out;
}

// 帯の右の「コーチ ▲」（板を開く）。板を開いている間は「コーチ ▼」（閉じる）
const pullHTML = (open) => (open ? '<button class="cs-pull" data-sheet="close">コーチ ▼</button>' : '<button class="cs-pull" data-sheet="open">コーチ ▲</button>');

// 縦の並べ方の帯（いつも見える）：最善手か採点・勝つ見込みと損益分岐点の棒・場面の一言・「コーチ ▲」。
// 行動のあとの採点・振り返り・段階が上がったときは光らせる（lit）。open：板を開いているか
export function coachStripHTML(v, { open = false } = {}) {
  const fresh = v.mode === 'verdict' || v.mode === 'review' || !!v.change;
  let main = '';
  if (v.error) main = `<div class="cs-msg warn">${esc(v.error)}</div>`;
  else if (v.plaque) main = `<div class="cs-best${v.plaque.grade ? ` ${v.plaque.grade}` : ''}">${esc(v.plaque.k)}<b>${esc(v.plaque.v)}</b></div>`;
  else if (v.hint) main = `<div class="cs-msg">考えてみよう：${esc(v.hint)}</div>`;
  else if (v.mode === 'review') main = `<div class="cs-msg">振り返りがあります（${v.review.length}件）</div>`;
  else main = `<div class="cs-msg">${idleText(v)}</div>`;
  const g = v.gauge;
  const eq = g ? `<div class="cs-eq"><span>${g.valueLabel} <b>${pct(g.value)}</b></span><span>${g.markLabel} <b>${pct(g.mark)}</b></span>`
    + `<div class="cs-bar"><i class="f" style="width:${pct(g.value)}"></i><i class="m" style="left:${pct(g.mark)}"></i></div></div>` : '';
  return `<div class="cstrip${fresh ? ' lit' : ''}">${main}${eq}${pullHTML(open)}</div>`;
}

function plaqueHTML(p) {
  return `<div class="plaque${p.grade ? ` ${p.grade}` : ''}"><div class="k">${esc(p.k)}</div><div class="v">${esc(p.v)}</div><div class="s">${esc(p.s)}</div></div>`;
}

// 大会の終わりの成績表に足す1行（段階4-2）：「運と実力：実際 +12.0BB／本来の取り分 +3.5BB（運 +8.5BB）」。results：ハンドの結果の列
const sbb = (x) => (x >= 0.05 ? `+${x.toFixed(1)}BB` : x <= -0.05 ? `−${(-x).toFixed(1)}BB` : '0.0BB');
export function luckLineHTML(results) {
  if (!results.length) return '';
  const a = results.reduce((s, x) => s + x.r, 0);
  const e = results.reduce((s, x) => s + x.e, 0);
  return `<p class="luckline">運と実力：実際 ${sbb(a)}／本来の取り分 ${sbb(e)}（運 ${sbb(a - e)}）</p>`;
}

// 多卓の大会の順位の札の上の段：見出し（優勝・入賞・敗退）、賞金とハンド数の行、優勝者の行
function placeHTML(o) {
  const title = o.place === 1 ? '優勝！' : o.share > 0 ? `${o.place}位入賞` : `${o.place}位で敗退`;
  const detail = o.share > 0 ? `賞金の${Math.round(o.share * 100)}%を獲得しました` : '入賞は6位までです。もう一度挑戦しましょう';
  const winner = o.place === 1 || !o.winner ? '' : `<p>優勝：${esc(o.winner)}さん（大会は${o.hands}ハンドで終わりました）</p>`;
  return { title, line: `<p>${detail}（${o.total}人・あなたが打ったのは${o.heroHands}ハンド）</p>${winner}` };
}

// 本番大会の終わりの札（設計書 段階4-3 第5節）。o：game/main-event.js の mainOutcome、report：判断の成績表と運と実力の1行
export function mainEndHTML(o, report) {
  const p = placeHTML(o);
  return `<h1>${p.title}</h1>${p.line}<h3>判断の成績</h3>${report}`;
}

// 昇段のお知らせの1行（どの大会の終わりの札にも出す）。p：{ label, quality（直近300回の正答率・平均損失）, step（次の段か null）} か null
// 達人（本番大会で通算10回優勝）は p.wins を出す（直近300回の数字は使わない）
export function promoteHTML(p) {
  if (!p) return '';
  if (p.to === MASTER) return `<p class="promote">★ 達人になりました<small>本番大会で通算${p.wins}回優勝</small></p>`;
  const next = p.step ? `（${p.step.label}まで：正答率${pct(p.step.accuracy)}以上・平均損失${p.step.loss.toFixed(2)}BB以下）` : '';
  return `<p class="promote">★ 昇段しました：${esc(p.label)}<small>直近300回の判断　正答率${pct(p.quality.accuracy)}・平均損失${p.quality.loss.toFixed(2)}BB${next}</small></p>`;
}

// 大会の終わりの成績表
export function reportHTML(r) {
  if (r.n === 0) return '<p>この大会では、あなたの判断の記録はありません。</p>';
  const rows = r.rows.filter((x) => x.n > 0).map((x) => `<tr><td>${x.label}</td><td>${x.n}</td><td>${pct(x.accuracy)}</td><td>${x.avgLoss.toFixed(2)}BB</td><td>段階${x.level}</td></tr>`).join('');
  return `<table class="report"><tr><th>場面</th><th>判断</th><th>正答率</th><th>平均損失</th><th>指南</th></tr>${rows}
  <tr class="sum"><td>合計</td><td>${r.n}</td><td>${pct(r.accuracy)}</td><td>${r.avgLoss.toFixed(2)}BB</td><td></td></tr></table>`;
}
