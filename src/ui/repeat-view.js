// 1万回やり直すの札（設計書 段階4-2 第4-3節）。coach/repeat.js の結果から表示用データを作り、HTML・SVGにする（DOMは触らない）。
// 線とヒストグラムと横棒は、第8章の講義の図（ui/screens/figures.js）でも使う。
import { esc } from './format.js';
import { optionLabel, kindLabels, partsOf, partsText, spreadText, spts, bestNote } from '../coach/repeat.js';
import { REPEAT_STEP } from '../calc/repeat.js';

const W = 360;
const H = 130;
const PAD = { l: 52, r: 8, t: 10, b: 22 };
const x0 = PAD.l;
const x1 = W - PAD.r;
const y0 = PAD.t;
const y1 = H - PAD.b;
const n1 = (x) => +x.toFixed(1);

// 縦軸の範囲（0 と期待値を必ず含め、少し余白を足す）
function rangeOf(values, exact) {
  let lo = Math.min(0, exact, ...values);
  let hi = Math.max(0, exact, ...values);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}
const yOf = ([lo, hi]) => (v) => n1(y1 - ((v - lo) / (hi - lo)) * (y1 - y0));
const hline = (y, cls) => `<line class="${cls}" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;
const ylab = (y, text) => `<text class="rp-ax" x="${x0 - 4}" y="${n1(y + 3)}" text-anchor="end">${esc(text)}</text>`;

// 回数と平均の線（50回ごとの、そこまでの平均）。点線＝期待値
export function lineSVG(line, exact) {
  const r = rangeOf(line, exact);
  const y = yOf(r);
  const n = line.length;
  const pts = line.map((v, i) => `${n1(x0 + ((i + 1) / n) * (x1 - x0))},${y(v)}`).join(' ');
  const last = n * REPEAT_STEP;
  return `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${hline(y(0), 'rp-zero')}${hline(y(exact), 'rp-exact')}
  <polyline class="rp-line" points="${pts}"/>
  ${ylab(y(exact), spts(exact))}${Math.abs(y(0) - y(exact)) > 10 ? ylab(y(0), '0') : ''}
  <text class="rp-ax" x="${x0}" y="${H - 6}">1回</text><text class="rp-ax" x="${x1}" y="${H - 6}" text-anchor="end">${last.toLocaleString('en-US')}回</text>
</svg>`;
}

// 100回ずつの組の平均のヒストグラム。点線＝期待値、実線＝0
export const HIST_BINS = 20;
export function histBins(groups, bins = HIST_BINS) {
  const lo = Math.min(...groups);
  const hi = Math.max(...groups);
  const width = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const g of groups) counts[Math.min(bins - 1, Math.floor((g - lo) / width))]++;
  return { lo, hi: lo + width * bins, width, counts };
}
export function histSVG(groups, exact) {
  const b = histBins(groups);
  const xs = (v) => n1(x0 + ((v - b.lo) / (b.hi - b.lo)) * (x1 - x0));
  const top = Math.max(...b.counts);
  const bw = (x1 - x0) / b.counts.length;
  const bars = b.counts.map((c, i) => {
    const h = (c / top) * (y1 - y0);
    const mid = b.lo + (i + 0.5) * b.width;
    return `<rect class="rp-bin${mid < 0 ? ' neg' : ''}" x="${n1(x0 + i * bw + 1)}" y="${n1(y1 - h)}" width="${n1(bw - 2)}" height="${n1(h)}"/>`;
  }).join('');
  const mark = (v, cls) => (v >= b.lo && v <= b.hi ? `<line class="${cls}" x1="${xs(v)}" y1="${y0}" x2="${xs(v)}" y2="${y1}"/>` : '');
  return `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${bars}${mark(0, 'rp-zero')}${mark(exact, 'rp-exact')}
  <line class="rp-base" x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}"/>
  <text class="rp-ax" x="${x0}" y="${H - 6}">${esc(spts(b.lo))}</text><text class="rp-ax" x="${x1}" y="${H - 6}" text-anchor="end">${esc(spts(b.hi))}</text>
</svg>`;
}

// 結果の内訳の横棒（parts：coach/repeat.js の partsOf）
export function barHTML(parts, n) {
  return `<span class="rp-bar">${parts.map((p) => `<i class="${p.kind}" style="width:${((p.count / n) * 100).toFixed(1)}%"></i>`).join('')}</span>`;
}

// 表示用データ。rows：coach/repeat.js の repeatAnalysis の結果、focus：線とヒストグラムを出す行（省くと選んだ手、なければ最善手）
export function buildRepeatView(analysis, rows, focus = null) {
  const chosen = rows.findIndex((r) => r.chosen);
  const best = rows.findIndex((r) => r.best);
  const f = focus ?? (chosen >= 0 ? chosen : Math.max(0, best));
  const items = rows.map((r) => {
    const parts = partsOf(r.outcomes, r.counts, kindLabels(analysis, r.option));
    return { label: optionLabel(analysis, r.option), chosen: r.chosen, best: r.best, ok: r.ok, parts, text: partsText(parts), n: r.n, mean: r.mean, exact: r.exact };
  });
  const r = rows[f];
  return {
    prize: !!analysis.prize, rows: items, focus: f, note: bestNote(analysis, rows),
    head: `${items[f].label}：1万回の平均 ${spts(r.mean)}（期待値 ${spts(r.exact)}）`,
    line: r.line, groups: r.groups, exact: r.exact, flat: r.sd === 0, spread: spreadText(r),
  };
}

export function repeatHTML(v) {
  const rows = v.rows.map((r, i) => `<button class="rp-row${i === v.focus ? ' on' : ''}" data-rp="${i}">
    <span class="rp-name">${esc(r.label)}${r.chosen ? '<i class="mk me">あなた</i>' : ''}${r.best ? '<i class="mk best">最善</i>' : ''}${r.ok ? '<i class="mk ok">許容</i>' : ''}</span>
    ${barHTML(r.parts, r.n)}<span class="rp-txt">${esc(r.text)}</span><span class="rp-mean">平均 ${esc(spts(r.mean))}</span></button>`).join('');
  const figs = v.flat
    ? `<p class="rp-flat">${esc(v.spread)}</p>`
    : `<div class="rp-figs"><figure>${lineSVG(v.line, v.exact)}<figcaption>回数と平均（50回ごと）。点線＝期待値</figcaption></figure>
      <figure>${histSVG(v.groups, v.exact)}<figcaption>100回だけなら：100回ずつ100組の平均。${esc(v.spread)}</figcaption></figure></div>`;
  return `<div class="rp-card">
  <h2>1万回やり直したら</h2>
  <p class="rp-sub">いまの判断を1万回くり返したことにして、1回ずつ結果を引きました（相手の手と残りのカードを1万回引き直したのと同じ散らばり。このあとの賭けは数えません）。${v.prize ? '賞金で計算する場面なので、賞金の見込みを点に直した値で数えています。' : ''}</p>
  <div class="rp-rows">${rows}</div>
  ${v.note ? `<p class="rp-note">${esc(v.note)}</p>` : ''}
  <h3 class="rp-head">${esc(v.head)}</h3>
  ${figs}
  <button class="mb" data-close="1">とじる</button>
</div>`;
}
