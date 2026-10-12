// 講義の図の部品（dojo/lectures/figures.js の blocks）をHTMLにする。カード・チップ・計器はゲームの部品を使う。
import { cardHTML } from '../cards.js';
import { chipStackSVG } from '../chips.js';
import { gaugeSVG } from '../gauge.js';
import { chipBreakdown, fmt, esc } from '../format.js';
import { cardLabel, isRed } from '../../engine/cards.js';
import { barHTML, lineSVG, histSVG } from '../repeat-view.js';

const pctText = (x) => `${Math.round(x * 100)}%`;

// 行の多い図（役の一覧など）は、数字とマークだけの小さなカードにする
const miniCard = (c) => {
  const label = cardLabel(c);
  return `<span class="mcard${isRed(c) ? ' r' : ''}">${label.slice(0, -1)}<i>${label.slice(-1)}</i></span>`;
};

const BLOCK = {
  cards: (b) => {
    const draw = b.rows.length > 3 ? miniCard : (c) => cardHTML(c);
    return b.rows.map((r) => {
      const cards = r.cards.map((c, i) => `${r.split && i === r.split ? '<i class="gap"></i>' : ''}${draw(c)}`).join('');
      return `<div class="fg-row"><span class="fg-lab">${esc(r.label)}</span><span class="fg-cards">${cards}</span><span class="fg-note">${esc(r.note ?? '')}</span></div>`;
    }).join('');
  },
  table: (b) => `<table class="fg-tb"><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${b.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table>`,
  formula: (b) => `<div class="fg-eq">${esc(b.text)} <b>${esc(b.big)}</b></div>`,
  bar: (b) => `<div class="fg-bar" style="--m:${(b.value * 100).toFixed(1)}%"><i></i></div><div class="fg-barl"><span>0%</span><span>← 損　${pctText(b.value)}　得 →</span><span>100%</span></div>`,
  gauge: (b) => `<div class="fg-gauge">${gaugeSVG({ value: b.value, mark: b.mark })}<small>針＝勝つ見込み　赤い印＝損益分岐点</small></div>`,
  chips: (b) => `<div class="fg-chips">${b.stacks.map((s) => `<span class="fg-stk">${chipStackSVG(chipBreakdown(s.amount, 6), 24)}<span>${esc(s.label)}<b>${fmt(s.amount)}</b></span></span>`).join('')}</div>`,
  seats: (b) => {
    const n = b.seats.length;
    const items = b.seats.map((s, i) => {
      const t = (Math.PI * 2 * i) / n + Math.PI / 2;
      const x = 50 + 42 * Math.cos(t);
      const y = 50 + 36 * Math.sin(t);
      return `<div class="fg-seat${s.btn ?? s.name === 'BTN' ? ' btn' : ''}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"><b>${esc(s.name)}</b>${s.note ? `<small>${esc(s.note)}</small>` : ''}</div>`;
    }).join('');
    const felt = b.felt ? b.felt.map(esc).join('<br>') : '先に行動 → 後に行動<br><small>（プリフロップ）</small>';
    return `<div class="fg-ring"><div class="fg-felt">${felt}</div>${items}</div>`;
  },
  note: (b) => `<div class="fg-big">${esc(b.text)}</div>`,
  // 1万回やり直す（第8章）：内訳の横棒・回数と平均の線・100回ずつの平均のヒストグラム
  repeatBars: (b) => `<div class="fg-rp"><b>${esc(b.label)}</b>${barHTML(b.parts, b.n)}<small>${esc(b.text)}</small></div>`,
  repeatLine: (b) => `<div class="fg-rpsvg">${lineSVG(b.line, b.exact)}<small>回数と平均（50回ごと）。点線＝期待値</small></div>`,
  repeatHist: (b) => `<div class="fg-rpsvg">${histSVG(b.groups, b.exact)}<small>${esc(b.caption)}。点線＝期待値</small></div>`,
};

export const figureHTML = (data) => `<div class="fig">${data.blocks.map((b) => BLOCK[b.kind](b)).join('')}</div>`;
