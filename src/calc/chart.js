// 参加表（16BB以上）。169種類を「上位25%の手を相手にしたときの勝率」で並べ、席ごとの参加率で切る。
// 「上位25%」自体が並び順で決まるので、ランダムな手を相手にした勝率で並べてから、並べ直しを繰り返して決める。
import { CLASS_COUNT, classSize, COMBO_COUNT } from './combos.js';
import { classVsClass } from './preflop.js';

function scoresVs(opp) {
  const total = opp.reduce((a, w, j) => a + w * classSize(j), 0);
  const score = new Float64Array(CLASS_COUNT);
  for (let i = 0; i < CLASS_COUNT; i++) {
    let s = 0;
    for (let j = 0; j < CLASS_COUNT; j++) if (opp[j]) s += opp[j] * classSize(j) * classVsClass(i, j);
    score[i] = s / total;
  }
  return score;
}
const orderOf = (score) => Array.from({ length: CLASS_COUNT }, (_, i) => i).sort((a, b) => score[b] - score[a] || a - b);

function topShare(order, share) {
  const w = new Array(CLASS_COUNT).fill(0);
  let acc = 0;
  for (const id of order) {
    if (acc >= share * COMBO_COUNT) break;
    w[id] = 1;
    acc += classSize(id);
  }
  return w;
}

let score = scoresVs(new Array(CLASS_COUNT).fill(1));
for (let k = 0; k < 6; k++) score = scoresVs(topShare(orderOf(score), 0.25));

// 各升目の「上位25%の手に対する勝率」
export const TOP25_EQ = score;
// 強い順の升目 id
export const CHART_ORDER = orderOf(score);
// 各升目の「上位何%」（その手の組合せの真ん中の位置。0〜1）
export const CLASS_PCT = new Float64Array(CLASS_COUNT);
{
  let acc = 0;
  for (const id of CHART_ORDER) {
    CLASS_PCT[id] = (acc + classSize(id) / 2) / COMBO_COUNT;
    acc += classSize(id);
  }
}

// 参加ライン（上位 cutoff の境目の手）の、上位25%の手に対する勝率
export function lineEq(cutoff) {
  const id = CHART_ORDER.find((i) => CLASS_PCT[i] >= cutoff) ?? CHART_ORDER[CLASS_COUNT - 1];
  return TOP25_EQ[id];
}
