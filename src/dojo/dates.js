// 暦の日付（'YYYY-MM-DD' の文字列）の計算。時刻やタイムゾーンに左右されないよう、日付だけを UTC の暦で数える。
// 「今日」は画面の側が端末の暦から作って渡す（この層は時計を読まない）。
const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDate(s) {
  const m = typeof s === 'string' && PATTERN.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toUtc(s) {
  if (!isDate(s)) throw new Error(`日付の形が不正: ${s}`);
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

const pad = (n) => String(n).padStart(2, '0');
const fromUtc = (t) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const addDays = (s, n) => fromUtc(toUtc(s) + n * 86400000);
// a が b より前なら負、同じなら 0、後なら正（日数の差）
export const daysBetween = (a, b) => Math.round((toUtc(b) - toUtc(a)) / 86400000);

// 端末の暦の年月日（画面の側だけで使う）
export const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
