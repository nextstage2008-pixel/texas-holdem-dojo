// ハンドの結果の文（設計書 段階5-3 第4節・段階5-5 第2節）。画面に触れない（HTML の文字を返すだけ）。
import { fmt, esc } from './format.js';
import { cardHTML } from './cards.js';
import { HERO_SEAT } from '../game/session.js';

const NEXT = { hand: '次のハンドへ ▶', end: '結果へ ▶' };
const MANY = 4; // この人数から、人ごとは名前と額だけの小さな行にする
const whoOf = (w) => (w.seat === HERO_SEAT ? 'あなた' : `${esc(w.name)}さん`);

// 卓の真ん中の結果の札の中身（段階5-5・そのあとの手直し）。result：view-model の result（{ showdown, winners: [{ seat, name, amount, hand, detail, cards }] }）。
// 役を作った5枚の小さな札は、勝った人が1人のときだけ（2〜3人は卓の真ん中で幅が狭いので、名前・額・役の行だけ）。
// next：下のボタン 'hand'（次のハンドへ）・'end'（結果へ。大会がこのハンドで終わる）・null（出さない＝チュートリアル）
export function resultPanelHTML(result, { next = 'hand' } = {}) {
  if (!result) return '';
  const ws = result.winners;
  let body;
  if (!result.showdown) {
    const w = ws[0];
    body = `<div class="rs-why">ほかの全員が降りたので</div><div class="rs-who"><b>${whoOf(w)}が取りました</b><span class="rs-amt">+${fmt(w.amount)}</span></div><div class="rs-note">（札は見せません）</div>`;
  } else if (ws.length >= MANY) {
    const names = ws.map((w) => w.detail ?? w.hand);
    const same = names.every((x) => x === names[0]);
    body = `<div class="rs-why">${ws.length}人で分けました${same ? `　${esc(names[0])}` : ''}</div><div class="rs-grid">${ws.map((w) => `<div class="rs-who small"><b>${whoOf(w)}</b><span class="rs-amt">+${fmt(w.amount)}</span></div>`).join('')}</div>`;
  } else {
    const cards = (w) => (ws.length === 1 ? `<span class="rs-cards">${(w.cards ?? []).map((c) => cardHTML(c, 'sm')).join('')}</span>` : '');
    body = ws.map((w) => `<div class="rs-row"><div class="rs-who"><b>${whoOf(w)}の勝ち</b><span class="rs-amt">+${fmt(w.amount)}</span></div>`
      + `<div class="rs-hand"><span class="rs-name">${esc(w.detail ?? w.hand)}</span>${cards(w)}</div></div>`).join('');
  }
  return `<div class="rs-body">${body}</div>${next ? `<button class="mb main rs-next" data-next="1">${NEXT[next]}</button>` : ''}`;
}

// 勝った人の札の中身（席の近くに出す）：役の名前と勝った額。勝負にならなかったときは額だけ。sv：view-model の席
export const winLabelHTML = (sv) => (sv.handName ? `${esc(sv.handName)}<small>+${fmt(sv.won)}</small>` : `+${fmt(sv.won)}`);
