// ハンドの結果の文（設計書 段階5-3 第4節）。画面に触れない（HTML の文字を返すだけ）。
import { fmt, esc } from './format.js';
import { HERO_SEAT } from '../game/session.js';

// 結果の帯。result：view-model の result（{ showdown, winners: [{ seat, name, amount, hand }] }）。
// 勝負：人ごとに「名前　役　+額」。勝負にならなかった：「ほかの全員が降りたので　〇〇さんが取りました　+額（札は見せません）」
export function resultBannerHTML(result) {
  if (!result) return '';
  if (!result.showdown) {
    const w = result.winners[0];
    const who = w.seat === HERO_SEAT ? 'あなた' : `${esc(w.name)}さん`;
    return `<div class="bn-why">ほかの全員が降りたので</div><div class="bn-row"><b>${who}</b>が取りました　<span class="bn-amt">+${fmt(w.amount)}</span></div><small>（札は見せません）</small>`;
  }
  return result.winners.map((w) => `<div class="bn-row"><b>${esc(w.name)}</b>　${esc(w.hand)}　<span class="bn-amt">+${fmt(w.amount)}</span></div>`).join('');
}

// 勝った人の札の中身（席の近くに出す）：役の名前と勝った額。勝負にならなかったときは額だけ。sv：view-model の席
export const winLabelHTML = (sv) => (sv.handName ? `${esc(sv.handName)}<small>+${fmt(sv.won)}</small>` : `+${fmt(sv.won)}`);
