export const fmt = (n) => Math.round(n).toLocaleString('en-US');
// 保存した日時（ISOの文字列）を、端末の時刻で「2026-10-08 07:30」にする。読めなければ「―」
const pad2 = (n) => String(n).padStart(2, '0');
export function localStamp(iso) {
  const d = new Date(iso ?? NaN);
  if (Number.isNaN(d.getTime())) return '―';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// 画面に文字として出す（名前などをHTMLとして解釈させない）
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const DENOMS = [25000, 5000, 1000, 500, 100];

// 額を額面に分ける（大きい額面から＝下から積む順）。山が高くなりすぎないよう最大 maxChips 枚。
export function chipBreakdown(amount, maxChips = 10) {
  const out = [];
  let rest = amount;
  for (const d of DENOMS) {
    while (rest >= d && out.length < maxChips) {
      out.push(d);
      rest -= d;
    }
  }
  return out;
}
