// キーの扱い（段階4-2 第8節）。e：keydown の出来事、screenName：いまの画面。返す値：'skip'（起動演出を飛ばす）・'submit'（名前を送る）・null
// 変換を確定する Enter（isComposing、Safari では keyCode 229）では名前を送らない。
export function keyAction(e, screenName) {
  if (screenName === 'splash') return 'skip';
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229 || e.repeat) return null;
  return e.target?.matches?.('[data-ref="nameInput"]') ? 'submit' : null;
}

// keydown を受けて動かす。起動演出を飛ばしたキーは既定の動きを止める（すぐ開く名前の欄に、その文字が入らないように）
export function onKey(e, screenName, { skip, submit }) {
  const k = keyAction(e, screenName);
  if (k === 'skip') {
    e.preventDefault();
    skip();
  }
  if (k === 'submit') submit();
}
