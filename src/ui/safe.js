// ゲームの進行中の例外で画面が黙って止まらないように、例外を受け止めて知らせる。
export async function guarded(fn, onError) {
  try {
    return await fn();
  } catch (e) {
    onError(e);
    return undefined;
  }
}
