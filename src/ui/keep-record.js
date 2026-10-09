// スマホの記録の守り（設計書 段階5-1 第8節）。画面にも保存先にも触れない（ブラウザの値は入口が渡す）。
// 1. 記録を消されにくくする設定（navigator.storage.persist）を起動のたびに頼む
// 2. iPhone の Safari のタブで開いているときは、タイトルの下に「ホーム画面に追加して遊ぶと、記録が消えません」（押すとやり方の札）
// 3. 書き出しのすすめ：指で操作する画面では、最後に書き出してから大会を10回打ったら1回だけ知らせる。
//    数は記録の settings.exportNudge に持つ。保存の版は4のまま（読むたびに nudgeOf で直す）

export const NUDGE_AFTER = 10;
export const NUDGE_TEXT = '記録を書き出しておきましょう（設定の「記録を書き出す」）';
export const HOME_NOTE = 'ホーム画面に追加して遊ぶと、記録が消えません';
export const HOME_HOWTO = {
  title: 'ホーム画面に追加して遊ぶ',
  body: `<p>Safari のタブで遊ぶと、Safari を7日使ったのに一度もこのゲームを開かなかった場合に、記録が消えることがあります。ホーム画面に追加したものは、この決まりの外です。</p>
<ol><li>画面の下（iPad は上）の共有のボタン（□に↑）を押す</li><li>「ホーム画面に追加」を押す</li><li>ホーム画面のアイコンから開いて遊ぶ</li></ol>
<p>ホーム画面のほうは記録の置き場所が別になります。Safari で遊んだ記録を移すには、Safari で「記録を書き出す」→ ホーム画面のほうで「記録を読み込む」（どちらも設定にあります）。PC など別の端末や、住所の違う所で遊んだ記録も、同じように移せます。</p>`,
};

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// 記録の settings から、書き出しのすすめの数を読む（ない・おかしい値は直す）
export function nudgeOf(settings) {
  const n = isObj(settings) && isObj(settings.exportNudge) ? settings.exportNudge : {};
  const since = typeof n.since === 'number' && Number.isFinite(n.since) && n.since > 0 ? Math.floor(n.since) : 0;
  return { since, shown: n.shown === true };
}
const withNudge = (rec, n) => ({ ...rec, settings: { ...rec.settings, exportNudge: n } });

// 大会が1回終わった。coarse：指で操作する画面か。返す値：{ record, nudge（いま知らせるか）}
export function afterTournament(rec, { coarse }) {
  if (!coarse) return { record: rec, nudge: false };
  const n = nudgeOf(rec.settings);
  const since = n.since + 1;
  const nudge = since >= NUDGE_AFTER && !n.shown;
  return { record: withNudge(rec, { since, shown: n.shown || nudge }), nudge };
}

// 記録を書き出した：数を0に戻す
export const afterExport = (rec) => withNudge(rec, { since: 0, shown: false });

// iPhone・iPad の Safari のタブか（ホーム画面から開いたものは除く）。
// env：{ userAgent, maxTouchPoints, standalone（navigator.standalone）, displayStandalone（display-mode: standalone）}
export function isSafariTab({ userAgent = '', maxTouchPoints = 0, standalone = false, displayStandalone = false } = {}) {
  const ios = /iP(hone|od|ad)/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const safari = /Safari/.test(userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS|GSA)\//.test(userAgent);
  return ios && safari && !standalone && !displayStandalone;
}

// 記録を消されにくくする設定を頼む。storage：navigator.storage。返す値：認められたか（使えない・失敗は null）
export async function requestPersist(storage) {
  try {
    if (!storage || typeof storage.persist !== 'function') return null;
    return await storage.persist();
  } catch {
    return null;
  }
}
