// ICM（Malmuth-Harville）：持ち点を「賞金の見込み」（賞金総額に対する割合）に直す（設計書 段階4-1 第3-2節）。
// 1位になる確率＝持ち点の割合。2位以下は、上の順位が決まった残りの人で同じ計算をくり返す。
// 持ち点0の人は飛んだ人として数えない（見込み0）。残っている人は1位から順に入賞の枠を分け合う。
export const ICM_MAX_PLAYERS = 10;

// 人ごとの順位の見込み：probs[i][k]＝i が k＋1 位になる見込み（k は places 位まで）
export function placeProbs(stacks, places) {
  const n = stacks.length;
  const alive = stacks.filter((x) => x > 0).length;
  if (alive > ICM_MAX_PLAYERS) throw new Error(`ICMは${ICM_MAX_PLAYERS}人までしか計算しない（${alive}人）`);
  const out = stacks.map(() => new Float64Array(places));
  const total = stacks.reduce((a, x) => a + Math.max(0, x), 0);
  const depth = Math.min(places, alive);
  const rec = (used, left, place, prob) => {
    for (let i = 0; i < n; i++) {
      if (used & (1 << i) || !(stacks[i] > 0)) continue;
      const p = (prob * stacks[i]) / left;
      out[i][place] += p;
      if (place + 1 < depth) rec(used | (1 << i), left - stacks[i], place + 1, p);
    }
  };
  if (depth > 0) rec(0, total, 0, 1);
  return out;
}

// stacks：持ち点の列、payouts：1位からの賞金の割合。返す値：人ごとの賞金の見込み（Float64Array）
export function icmShares(stacks, payouts) {
  const probs = placeProbs(stacks, payouts.length);
  return Float64Array.from(probs, (row) => row.reduce((a, p, k) => a + p * payouts[k], 0));
}

// 結果の持ち点 → 人ごとの賞金の見込み。このハンドで飛んだ人（start では持ち点があり、fin で0）は、
// 飛んだ順位の賞金をもらう（同じハンドで2人以上飛んだら、ハンドの初めの持ち点が多い人ほど上）。
export function prizeShares(fin, start, payouts) {
  const out = icmShares(fin, payouts);
  const alive = fin.filter((x) => x > 0).length;
  const busted = fin.map((_, i) => i).filter((i) => !(fin[i] > 0) && start[i] > 0);
  busted.sort((a, b) => start[b] - start[a] || a - b);
  busted.forEach((i, k) => { out[i] = payouts[alive + k] ?? 0; });
  return out;
}
