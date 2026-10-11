// 成績と統計（設計書 段階4-2 第5節。見本 mock-stats-v1.html の案A）。上のタブで「判断の質／運と実力／大会の成績／章ごと」を切り替える。
import { esc, fmt } from '../format.js';
import { PLAYABLE, chapterLabel, chapterOf } from '../../dojo/chapters.js';
import { rankOf, isOpen } from '../../dojo/progress.js';
import { totalsOf, situationRows, leaks, luckView, MIN_HANDS } from '../../dojo/stats.js';
import { DAN, MASTER, MASTER_WINS, nextStep } from '../../dojo/ranks.js';
import { MAIN } from '../../engine/field.js';

export const STATS_TABS = [['quality', '判断の質'], ['luck', '運と実力'], ['events', '大会の成績'], ['chapters', '章ごと']];

const pct = (x) => (x === null ? '―' : `${Math.round(x * 100)}%`);
const sbb = (x) => (x >= 0.05 ? `+${x.toFixed(1)}BB` : x <= -0.05 ? `−${(-x).toFixed(1)}BB` : '0.0BB');
const lossText = (mean, half) => (mean === null ? '―' : `${mean.toFixed(2)}BB（±${half.toFixed(2)}）`);

function quality(rec) {
  const s = rec.stats;
  const t = totalsOf(s);
  return {
    total: { n: t.n, rate: pct(t.rate), loss: lossText(t.mean, t.half) },
    rows: situationRows(s, rec.coach).map((r) => [r.label, fmt(r.n), pct(r.rate), lossText(r.mean, r.half), `段階${r.level}`]),
    leaks: leaks(s).map((x, i) => ({
      no: i + 1, label: x.label, chapter: x.chapter, open: isOpen(rec, x.chapter), chapterLabel: chapterLabel(x.chapter),
      text: `損の合計 ${x.lossSum.toFixed(1)}BB（1回あたり ${x.mean.toFixed(2)}BB × ${fmt(x.n)}回）`,
    })),
  };
}

function luck(rec) {
  const L = luckView(rec.stats);
  const t = totalsOf(rec.stats);
  const tag = L.total.luck >= 0.05 ? 'ついていた' : L.total.luck <= -0.05 ? 'ついていなかった' : null;
  const note = L.total.luck >= 0.05 ? `オールインで勝つ見込みより多く勝った分が ${sbb(L.total.luck)}。これは実力ではありません。`
    : L.total.luck <= -0.05 ? `オールインで勝つ見込みより負けた分が ${sbb(L.total.luck)}。これは実力のせいではありません。`
      : 'オールインの勝ち負けは、ほぼ勝つ見込みどおりでした。';
  let per100 = null;
  if (L.enough) {
    const { mean, half, straddles } = L.per100;
    per100 = {
      mean, half, lo: mean - half, hi: mean + half, straddles,
      text: `${sbb(mean)}／100ハンド（幅 ${sbb(mean - half)}〜${sbb(mean + half)}）`,
      verdict: straddles ? '0 をまたいでいる＝まだ運の範囲' : mean > 0 ? '幅が0より上＝勝ち越しと言える' : '幅が0より下＝負け越しと言える',
    };
  }
  return {
    n: L.n, enough: L.enough, actual: L.actual, ev: L.ev,
    numbers: { actual: sbb(L.total.actual), ev: sbb(L.total.ev), luck: sbb(L.total.luck) }, tag, note, per100,
    skill: t.n ? `判断の質（平均損失）は ${t.mean.toFixed(2)}BB ±${t.half.toFixed(2)}（判断${fmt(t.n)}回）` : null,
  };
}

// 大会の種類。なくした遊び方（試験の大会・章の対局。2026-10-12）の古い行は消さずに「以前の〜の大会」と出す
const kindLabel = (e) => (e.kind === 'free' ? '自由対局' : e.kind === 'main' ? '本番大会' : e.kind === 'exam' ? '以前の試験の大会' : `以前の${chapterLabel(e.kind)}の大会`);
// 順位：途中でやめた古い行は「途中」、45人の大会（本番大会・以前の試験の大会）の入賞（6位以内）は「（入賞）」
const MAIN_PAID = MAIN.payouts.length;
const placeText = (e) => (e.place === null ? '途中' : (e.kind === 'main' || e.kind === 'exam') && e.place <= MAIN_PAID ? `${e.place}位（入賞）` : `${e.place}位`);
const events = (rec) => rec.stats.events.slice().reverse().map((e) => [
  e.date, kindLabel(e), placeText(e), fmt(e.hands), fmt(e.decisions),
  e.decisions ? pct(e.good / e.decisions) : '―', e.decisions ? `${(e.lossSum / e.decisions).toFixed(2)}BB` : '―', sbb(e.luck),
]);

function chapters(rec) {
  const rows = PLAYABLE.map((id) => {
    const c = rec.chapters[id];
    return [`${chapterLabel(id)}　${chapterOf(id).title}`, c?.passedAt ? `合格（${c.passedAt}）` : '―', c?.testBest != null ? `${c.testBest}点` : '―'];
  });
  const { answered, correct } = rec.practiceStats;
  const g = rec.graduation;
  const grad = g.passedAt ? `合格（${g.passedAt}）・最高 ${g.best}点` : g.best !== null ? `まだ卒業していません・最高 ${g.best}点` : 'まだ受けていません';
  return { rows, practice: answered ? `${pct(correct / answered)}（${correct} / ${answered}問）` : '―', grad };
}

// 段位の欄（設計書 段階4-4 第7節）：いまの段位・直近300回の数字・次の段の基準
function danView(rec) {
  const r = rankOf(rec);
  const { step, quality: q } = nextStep(rec);
  return { label: r.label, n: q.n, need: DAN.recent, accuracy: q.accuracy, loss: q.loss, step, all: r.passed === PLAYABLE.length, level: rec.dan.level, titles: rec.mainTitles };
}

// tab：開くタブ（省くと「判断の質」）
export function buildStatsView(rec, tab = 'quality') {
  return {
    tab, rank: rankOf(rec).label, name: rec.profile.name,
    quality: { ...quality(rec), dan: danView(rec) }, luck: luck(rec), events: events(rec), chapters: chapters(rec),
  };
}

const table = (head, rows) => `<table class="fg-tb"><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table>`;

// 実際の増減（金）と本来の取り分で数えた増減（緑）の累計の線。縦の目盛りは 0・最大・最小（0 に近すぎる目盛りは省く）
export function luckChartSVG(actual, ev, w = 720, h = 420) {
  const L = 64; // 左の目盛りの幅
  const n = actual.length - 1;
  const all = [...actual, ...ev];
  let lo = Math.min(0, ...all);
  let hi = Math.max(0, ...all);
  const pad = Math.max(2, (hi - lo) * 0.08);
  lo -= pad;
  hi += pad;
  const X = (i) => (L + (i / Math.max(1, n)) * (w - L - 12)).toFixed(1);
  const Y = (v) => (h - 26 - ((v - lo) / (hi - lo)) * (h - 40)).toFixed(1);
  const path = (s) => s.map((v, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(v)}`).join('');
  return `<svg class="st-chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="${L}" y="8" width="${w - L - 12}" height="${h - 34}" fill="#fffaf0" stroke="#e3d6bb"/>
  <line x1="${L}" x2="${w - 12}" y1="${Y(0)}" y2="${Y(0)}" stroke="#b9a37c" stroke-dasharray="4 4"/>
  <text x="${L - 6}" y="${(+Y(0) + 4).toFixed(1)}" font-size="11" text-anchor="end" fill="#6a5236">0</text>
  ${[hi - pad, lo + pad].filter((v) => Math.abs(Y(v) - Y(0)) > 14).map((v) => `<text x="${L - 6}" y="${(+Y(v) + 4).toFixed(1)}" font-size="11" text-anchor="end" fill="#6a5236">${esc(sbb(v))}</text>`).join('')}
  <text x="${w - 12}" y="${h - 8}" font-size="11" text-anchor="end" fill="#6a5236">${fmt(n)}ハンド</text>
  <path d="${path(ev)}" fill="none" stroke="#2f8a52" stroke-width="3"/>
  <path d="${path(actual)}" fill="none" stroke="#c79a2c" stroke-width="3"/>
</svg>`;
}

// 100ハンドあたりの成績の95%の幅（0を真ん中にした帯）
function ciHTML(p) {
  const span = Math.max(Math.abs(p.lo), Math.abs(p.hi)) * 1.15 || 1;
  const at = (x) => (50 + (x / span) * 50).toFixed(1);
  return `<div class="st-ci"><span class="z"></span><span class="bar" style="left:${at(p.lo)}%;width:${(at(p.hi) - at(p.lo)).toFixed(1)}%"></span><span class="dot" style="left:${at(p.mean)}%"></span></div>
  <div class="st-cil"><span>${esc(sbb(-span))}</span><span>0</span><span>${esc(sbb(span))}</span></div>`;
}

// 段位の欄の棒：value（いま）と goal（次の段の基準。赤い線）。正答率は線より右、平均損失は線より左が基準を満たす
function danBar(label, value, goal, max, text) {
  const at = (x) => Math.max(0, Math.min(100, (x / max) * 100)).toFixed(1);
  return `<div class="dan-bar"><span>${label}</span><span class="track"><i style="width:${at(value)}%"></i><em style="left:${at(goal)}%"></em></span><span><b>${text(value)}</b>　基準 ${text(goal)}</span></div>`;
}

function danHTML(d) {
  const nums = d.n ? `直近${d.n}回：正答率 <b>${pct(d.accuracy)}</b>・平均損失 <b>${d.loss.toFixed(2)}BB</b>` : 'まだ数えた判断がありません';
  let note;
  if (d.level >= MASTER) note = `達人です（本番大会の優勝 ${d.titles.wins}回・入賞 ${d.titles.cashes}回）。`;
  else if (d.level >= DAN.steps.length) note = '三段です。';
  else if (!d.all) note = '初段は、全9章に合格してから判定します。';
  else if (d.n < d.need) note = `${d.need}回たまると段位を判定します（指南の段階2以上の判断だけを数えます。自由対局・本番大会では段階2〜5を選ぶと数えられます）。`;
  else {
    const gaps = [];
    if (d.accuracy < d.step.accuracy) gaps.push(`正答率をあと${Math.ceil((d.step.accuracy - d.accuracy) * 100 - 1e-9)}ポイント上げる`);
    if (d.loss > d.step.loss) gaps.push(`平均損失をあと${(d.loss - d.step.loss).toFixed(2)}BB下げる`);
    note = gaps.length ? `${d.step.label}まで：${gaps.join('・')}（赤い線が${d.step.label}の基準）。` : `${d.step.label}の基準を満たしています（次の大会の終わりに昇段します）。`;
  }
  const bars = d.step && d.n ? danBar('正答率', d.accuracy, d.step.accuracy, 1, pct) + danBar('平均損失', d.loss, d.step.loss, 1, (x) => `${x.toFixed(2)}BB`) : '';
  return `<div class="det dan"><h5>段位の判定（答えを見ずにした判断の直近${d.need}回）</h5>
    <p>いまの段位 <b>${esc(d.label)}</b>　${nums}　<small>（数えた判断 ${d.n} / ${d.need}回）</small></p>${bars}<p class="small">${esc(note)}</p>${d.level >= MASTER ? '' : `<p class="small">達人まで　本番大会の優勝 ${d.titles.wins} / ${MASTER_WINS}回</p>`}</div>`;
}

function qualityHTML(q) {
  const leaksHTML = q.leaks.length
    ? q.leaks.map((x) => `<div class="st-leak"><span class="n">${x.no}</span><span><b>${esc(x.label)}</b><small>${esc(x.text)}</small></span>
      ${x.open ? `<button class="go" data-go="stats-review" data-ch="${x.chapter}">${esc(x.chapterLabel)}で復習</button>` : `<button class="go" disabled>🔒 ${esc(x.chapterLabel)}</button>`}</div>`).join('')
    : '<p>まだ判断の記録がありません。対局すると、損の大きい場面から順に出ます。</p>';
  return `<div class="st-tabbody q">
  ${danHTML(q.dan)}
  <div class="det light"><h5>判断の質（累計 ${fmt(q.total.n)}回）</h5>
    <p>正答率 <b>${esc(q.total.rate)}</b>・平均損失 <b>${esc(q.total.loss)}</b>（95%の幅）</p>
    ${table(['場面', '判断', '正答率', '平均損失（95%の幅）', '指南'], q.rows)}</div>
  <div class="det light"><h5>弱点の順位</h5>${leaksHTML}<p class="small">損の合計＝1回あたりの損失×回数。損の合計が大きい場面ほど、直すと成績が上がる。</p></div>
</div>`;
}

function luckHTML(l) {
  if (!l.n) return '<div class="st-tabbody one"><div class="det light"><h5>運と実力</h5><p>まだハンドの記録がありません。対局すると、ここに実際の増減と本来の取り分で数えた増減が出ます。</p></div></div>';
  const per100 = l.per100
    ? `${ciHTML(l.per100)}<p class="small"><b>${esc(l.per100.text)}</b>。<span class="pill ${l.per100.straddles ? 'luck' : 'skill'}">${esc(l.per100.verdict)}</span></p>`
    : `<p>まだハンドが少ない（${fmt(l.n)}ハンド）。${MIN_HANDS}ハンドを超えると、100ハンドあたりの成績と幅を出します。</p>`;
  return `<div class="st-tabbody luck">
  <div class="det light chart"><h5>実際の増減と、本来の取り分（直近 ${fmt(l.n)}ハンド）</h5>${luckChartSVG(l.actual, l.ev)}
    <div class="st-legend"><span><i class="a"></i>実際の増減（BB）</span><span><i class="e"></i>本来の取り分で数えた増減（オールインの時点の勝つ見込みで分けた額）</span></div>
    <p class="small">2本の線の差が「運」。オールインで勝ちすぎると金の線が上に、負けすぎると下に離れる。</p></div>
  <div class="det"><h5>運と実力を分けると</h5>
    <div class="st-nums"><span>実際の増減</span><span class="big">${esc(l.numbers.actual)}</span><span>本来の取り分</span><span class="big g">${esc(l.numbers.ev)}</span>
      <span>運</span><span class="big s">${esc(l.numbers.luck)}${l.tag ? ` <span class="pill luck">${esc(l.tag)}</span>` : ''}</span></div>
    <p class="small">${esc(l.note)}</p></div>
  <div class="det light"><h5>100ハンドあたりの成績（95%の幅）</h5>${per100}
    ${l.skill ? `<p class="small">${esc(l.skill)}。<span class="pill skill">実力はこちらで測る</span></p>` : ''}</div>
</div>`;
}

function eventsHTML(rows) {
  // 100大会までの一覧は枠の中でスクロールする（舞台の高さを超えるため）
  const body = rows.length ? `<div class="st-scroll">${table(['日付', '種類', '順位', 'ハンド', '判断', '正答率', '平均損失', '運'], rows)}</div>`
    : '<p>まだ大会の記録がありません。自由対局か本番大会を最後まで打つと、ここに1行ずつ残ります。</p>';
  return `<div class="st-tabbody one"><div class="det light"><h5>大会の成績（直近 ${rows.length}大会・新しい順）</h5>${body}</div></div>`;
}

function chaptersHTML(c) {
  return `<div class="st-tabbody one"><div class="det light"><h5>章ごとの成績</h5>${table(['章', '章末試験', '試験の最高点'], c.rows)}<p>練習問題の正答率（累計）：<b>${esc(c.practice)}</b></p><p>卒業試験：<b>${esc(c.grad)}</b></p></div></div>`;
}

export function statsHTML(v) {
  const tabs = STATS_TABS.map(([k, label]) => `<button class="st-tab${k === v.tab ? ' on' : ''}" data-go="stats-tab" data-tab="${k}">${label}</button>`).join('');
  const body = { quality: () => qualityHTML(v.quality), luck: () => luckHTML(v.luck), events: () => eventsHTML(v.events), chapters: () => chaptersHTML(v.chapters) }[v.tab]();
  return `<div class="scr st-s">
  <div class="sbar"><button class="back" data-go="title">◀ タイトル</button><h4>成績と統計</h4><span class="sp"></span><span class="medal">${esc(v.rank)}</span>${v.name ? `<span class="who">${esc(v.name)} さん</span>` : ''}</div>
  <div class="st-tabs">${tabs}</div>
  ${body}
</div>`;
}
