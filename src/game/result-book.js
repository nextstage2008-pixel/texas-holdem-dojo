// ハンドの結果（game/session.js の handResult）の帳簿（段階4-2）。自由対局・本番大会で使う。
// all()：この大会の分（大会の終わりの成績表の「運と実力」）、close()：今の大会の分を返す（大会の成績の1件に使う）。
// 1大会に1回だけ返し、2回目は null（同じ大会を二重に残さない）。start(keep)：大会を始めるとき（keep なら all を残す）
export function createResultBook() {
  let all = [];
  let tour = [];
  let closed = false;
  return {
    start: (keep) => { if (!keep) all = []; tour = []; closed = false; },
    add: (r) => { all = [...all, r]; tour = [...tour, r]; },
    all: () => all,
    close: () => {
      if (closed) return null;
      closed = true;
      return tour;
    },
  };
}
