// プレイヤーの名前の点検。1〜8文字（前後の空白は除く。数え方は見た目の1文字＝書記素ずつで、家族の絵文字・肌の色つきの絵文字・国旗も1文字）。
// 制御文字と、記号の < > & " ' ` \ は使えない。
export const NAME_MAX = 8;
const FORBIDDEN = new Set(['<', '>', '&', '"', "'", '`', '\\']);
// 制御文字（C0・DEL・C1）と、行・段落の区切り（U+2028・U+2029）
const isControl = (cp) => cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f) || cp === 0x2028 || cp === 0x2029;

// 見た目の1文字（書記素）の列。Intl.Segmenter のない環境では符号ごと
const SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
export const graphemes = (s) => (SEGMENTER ? Array.from(SEGMENTER.segment(s), (x) => x.segment) : Array.from(s));

export function validateName(raw) {
  const name = String(raw ?? '').trim();
  const chars = Array.from(name); // 符号ごと（使えない文字の点検に使う）
  const count = graphemes(name).length;
  if (count === 0) return { ok: false, name, error: '名前を入れてください' };
  if (count > NAME_MAX) return { ok: false, name, error: `名前は${NAME_MAX}文字までです` };
  if (chars.some((ch) => isControl(ch.codePointAt(0)))) return { ok: false, name, error: '使えない文字が入っています' };
  if (chars.some((ch) => FORBIDDEN.has(ch))) return { ok: false, name, error: '記号の < > & " \' ` \\ は使えません' };
  return { ok: true, name, error: null };
}
