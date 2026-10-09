// コーチ欄のHTML。表示用データ（coach-view.js）を受け取って文字列にするだけ。
import { gaugeSVG } from './gauge.js';
import { cardLabel, isRed } from '../engine/cards.js';
import { SITUATIONS, SITUATION_LABEL } from '../coach/situations.js';
import { LEAK_CHAPTER } from '../dojo/stats.js';
import { chapterLabel } from '../dojo/chapters.js';
import { EXAM } from '../dojo/exam.js';

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

// 最終試験の間の帯。a：examCoachHTML と同じ（この受験の判断の数）
export function examStripHTML(a, { open = false } = {}) {
  return `<div class="cstrip"><div class="cs-msg">試験中は指南なし（この受験の判断 ${a.decisions}回）</div>${pullHTML(open)}</div>`;
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

// 最終試験（設計書 段階4-4 第4節・第7節）
const RULE = `判断${EXAM.minDecisions}回以上で、正答率${Math.round(EXAM.accuracy * 100)}%以上・平均損失${EXAM.loss.toFixed(2)}BB以下`;
// 始めの札。a：この受験の途中 { decisions（足してきた判断の数）, tournaments（終えた試験の大会の数）}
export function examStartHTML(a) {
  const now = a.decisions || a.tournaments ? `<p>この受験の判断 ${a.decisions}回（${a.tournaments + 1}大会目）</p>` : '';
  return `<h1>最終試験</h1><p>45人・9人×5卓・上位6人入賞・開始20,000点（10ハンドごとにブラインドが上がる）。指南なしで打ちます。<br>
相手は本番大会と同じ44人で、相手のタイプは伏せます（見た目と打ち方から見抜く）。</p>
<p>${RULE}なら合格（達人）。判断が${EXAM.minDecisions}回に届くまで、試験の大会を続けます（判断の数は足していきます）。入賞したかどうかは問いません。</p>${now}
<button class="mb main" data-start="exam">始める</button><button class="mb" data-exit="1">道場へ戻る</button>`;
}

// 試験中のコーチ欄。a：この受験の判断の数（この大会の分も足したもの）と、終えた試験の大会の数
export function examCoachHTML(a) {
  return `<div class="idle">試験中は指南なし<br><small>判断の成績は、大会の終わりに出ます</small></div>
<div class="sec">こ の 受 験</div><div class="lvls"><span>判断<b>${a.decisions}</b></span><span>判定まで<b>${Math.max(0, EXAM.minDecisions - a.decisions)}</b></span><span>大会<b>${a.tournaments + 1}</b></span></div>
<div class="idle"><small>相手のタイプは伏せています。見た目と打ち方から見抜いてください</small></div>`;
}

// 損の大きい場面（損の合計の大きい順に2つ。損が0の場面は出さない）と、復習する章
export function examLeaks(decisions) {
  return SITUATIONS.map((s) => ({ s, sum: decisions.filter((d) => d.situation === s).reduce((a, d) => a + d.loss, 0) }))
    .filter((x) => x.sum > 0).sort((a, b) => b.sum - a.sum).slice(0, 2)
    .map((x) => ({ label: SITUATION_LABEL[x.s], chapterLabel: chapterLabel(LEAK_CHAPTER[x.s]) }));
}

// 試験の大会の終わりの札。o：mainOutcome、e：{ result（'continue'・'pass'・'fail'）, tally（dojo/exam.js の tallyExam）, report（成績表）,
//   titles（この受験で増えた称号 { wins, cashes } か null）, leaks（examLeaks）, master（この受験の前から達人か）}
export function examEndHTML(o, e) {
  const p = placeHTML(o);
  const t = e.tally;
  const nums = `<p>この受験の判断 ${t.n}回・正答率 ${t.accuracy === undefined ? '' : pct(t.accuracy)}・平均損失 ${t.loss?.toFixed(2)}BB<br><small>合格の基準：${RULE}</small></p>`;
  const title = e.titles && (e.titles.wins ? '優勝' : e.titles.cashes ? '入賞' : null);
  const titleLine = title ? `<p>称号「${title}」がつきました</p>` : '';
  if (e.result === 'continue') {
    return `<h1>${p.title}</h1>${p.line}<h3>この受験の判断　${t.n}回（${EXAM.minDecisions}回で判定）</h3>
<p>判断${EXAM.minDecisions}回に届くまで、次の試験の大会を続けます（判断の数は足していきます）。<br>次の大会は、道場の「最終試験」からいつでも始められます。</p>${e.report}
<button class="mb main" data-start="exam-next">次の大会へ</button><button class="mb" data-exit="1">道場へ戻る</button>`;
  }
  if (e.result === 'pass') {
    const next = e.master ? '<button class="mb main" data-start="exam-again">もう一度受ける</button><button class="mb" data-exit="1">道場へ戻る</button>' : '<button class="mb main" data-master="1">次へ</button>';
    return `<h1 class="pass">合格</h1>${nums}<h3>${p.title}（45人・あなたが打ったのは${o.heroHands}ハンド）</h3>${titleLine}<h3>この受験の判断の成績</h3>${e.report}${next}`;
  }
  const leaks = (e.leaks ?? []).map((x) => `<b>${esc(x.label)}</b>（${esc(x.chapterLabel)}で復習）`).join('・');
  return `<h1>もう一歩</h1>${nums}<h3>${p.title}（45人・あなたが打ったのは${o.heroHands}ハンド）</h3>${titleLine}<h3>この受験の判断の成績</h3>${e.report}${leaks ? `<p>損の大きい場面：${leaks}</p>` : ''}
<button class="mb main" data-start="exam-again">もう一度受ける</button><button class="mb" data-exit="1">道場へ戻る</button>`;
}

// 達人の祝いの札（初めて合格したとき）
export function tatsujinHTML(name) {
  return `<div class="tatsujin">達人</div><h1>達人になりました</h1>
<p>${esc(name)}さん、最終試験に合格しました。<br>指南なしで、45人の大会を戦える判断ができています。</p>
<p>これからも最終試験を受けられます。試験の大会で6位以内なら「入賞」、1位なら「優勝」の称号がつき、タイトルに出ます。</p>
<button class="mb main" data-exit="1">道場へ戻る</button>`;
}

// 昇段のお知らせの1行（どの大会の終わりの札にも出す）。p：{ label, quality（直近300回の正答率・平均損失）, step（次の段か null）} か null
export function promoteHTML(p) {
  if (!p) return '';
  const next = p.step ? `（${p.step.label}まで：正答率${pct(p.step.accuracy)}以上・平均損失${p.step.loss.toFixed(2)}BB以下）` : '';
  return `<p class="promote">★ 昇段しました：${esc(p.label)}<small>直近300回の判断　正答率${pct(p.quality.accuracy)}・平均損失${p.quality.loss.toFixed(2)}BB${next}</small></p>`;
}

// 大会の終わりの成績表。noCoach：指南なし（最終試験）なら「指南」の列を「なし」にする
export function reportHTML(r, { noCoach = false } = {}) {
  if (r.n === 0) return '<p>この大会では、あなたの判断の記録はありません。</p>';
  const rows = r.rows.filter((x) => x.n > 0).map((x) => `<tr><td>${x.label}</td><td>${x.n}</td><td>${pct(x.accuracy)}</td><td>${x.avgLoss.toFixed(2)}BB</td><td>${noCoach ? 'なし' : `段階${x.level}`}</td></tr>`).join('');
  return `<table class="report"><tr><th>場面</th><th>判断</th><th>正答率</th><th>平均損失</th><th>指南</th></tr>${rows}
  <tr class="sum"><td>合計</td><td>${r.n}</td><td>${pct(r.accuracy)}</td><td>${r.avgLoss.toFixed(2)}BB</td><td></td></tr></table>`;
}
