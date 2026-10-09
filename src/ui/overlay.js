// 卓の上の札の重なり（設計書 段階4-3 第8節）：メニューの確認の札を「続ける」で閉じたら、その前に出ていた札（第5・6章の
// 「次の大会へ」の札など）に戻す。keep：確認の札を出す前の札（{ html, kind } か null）、back：戻す札（1回だけ。なければ null）
export function createOverlayMemo() {
  let saved = null;
  return {
    keep(state) { saved = state; },
    back() {
      const s = saved;
      saved = null;
      return s;
    },
  };
}
