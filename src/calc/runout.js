// オールインで勝負が決まったハンドの「本来の取り分」（設計書 段階4-2 第3-2節）。
// 最後の行動の時点の場のカード（board）と、勝負に残った人の手札を固定し、残りのカードを引き直して、
// エンジンのポットの分け方（サイドポット・端数チップ）で配ったときの、人ごとの平均の受け取りを出す。
// 残り1〜2枚は全通り、3枚以上（フロップの前のオールイン）は種つきのランダム試行。
import { buildPots, awardPots } from '../engine/pots.js';
import { evalFast } from '../engine/fast-eval.js';

export const RUNOUT_SAMPLES = 5000;

// final：終わったハンド（street＝'complete'）、board：最後の行動の時点の場、rng：試行に使う乱数
// 返す値：人ごとの平均の受け取り（Float64Array。降りた人は0）
export function expectedWon(final, board, rng, samples = RUNOUT_SAMPLES) {
  const n = final.seats.length;
  const live = final.seats.map((s) => s.inHand && !s.folded);
  const pots = buildPots(final.seats.map((s) => s.committed), live.map((x) => !x), final.deadMoney);
  const seats = live.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  const used = new Uint8Array(52);
  for (const c of board) used[c] = 1;
  for (const i of seats) for (const c of final.seats[i].hole) used[c] = 1;
  const rest = [];
  for (let c = 0; c < 52; c++) if (!used[c]) rest.push(c);
  const need = 5 - board.length;
  const sum = new Float64Array(n);
  const scores = new Array(n).fill(null);
  const cards = seats.map((i) => [...final.seats[i].hole, ...board, ...new Array(need).fill(0)]);
  let count = 0;
  const deal = (extra) => {
    seats.forEach((i, k) => {
      for (let j = 0; j < need; j++) cards[k][2 + board.length + j] = extra[j];
      scores[i] = evalFast(cards[k]);
    });
    const won = awardPots(pots, scores, final.button, n);
    for (let i = 0; i < n; i++) sum[i] += won[i];
    count++;
  };
  if (need === 0) deal([]);
  else if (need === 1) for (const a of rest) deal([a]);
  else if (need === 2) {
    for (let a = 0; a < rest.length; a++) for (let b = a + 1; b < rest.length; b++) deal([rest[a], rest[b]]);
  } else {
    const pick = rest.slice();
    const extra = new Array(need);
    for (let t = 0; t < samples; t++) {
      // 残りの山から need 枚を選ぶ（前から順に入れ替える）
      for (let j = 0; j < need; j++) {
        const x = j + Math.floor(rng() * (pick.length - j));
        const tmp = pick[j]; pick[j] = pick[x]; pick[x] = tmp;
        extra[j] = pick[j];
      }
      deal(extra);
    }
  }
  return sum.map((x) => x / count);
}
