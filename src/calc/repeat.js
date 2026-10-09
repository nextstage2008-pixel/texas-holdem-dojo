// 1万回やり直す（設計書 段階4-2 第4節）。結果の表（確率と点）から1回ずつ結果を引き、
// 内訳・平均・回数と平均の線・100回ずつの組の平均と、その真ん中の95組の範囲を出す。
export const REPEAT_N = 10000;
export const REPEAT_STEP = 50;   // 回数と平均の線の点の間隔
export const REPEAT_GROUP = 100; // 1組の回数

// outcomes：[{ p（確率。合計1）, v（点） }]、rng：引くのに使う乱数
// 返す値：{ n, counts（結果ごとの回数）, mean（引いた平均）, exact（本当の平均＝期待値）, sd（1回あたりのばらつき）,
//          line（50回ごとの、そこまでの平均）, groups（100回ずつの組の平均）, range95（組の平均の真ん中の95%の範囲 [下, 上]） }
export function repeatOutcomes(outcomes, rng, n = REPEAT_N) {
  const cum = [];
  let acc = 0;
  for (const o of outcomes) cum.push((acc += o.p));
  let last = outcomes.length - 1;
  while (last > 0 && !(outcomes[last].p > 0)) last--; // 端数で外れたときに選ぶ結果（確率0の結果は選ばない）
  const counts = new Array(outcomes.length).fill(0);
  const line = [];
  const groups = [];
  let sum = 0;
  let gsum = 0;
  for (let t = 1; t <= n; t++) {
    const u = rng();
    let k = 0;
    while (k < last && u >= cum[k]) k++;
    counts[k]++;
    sum += outcomes[k].v;
    gsum += outcomes[k].v;
    if (t % REPEAT_STEP === 0) line.push(sum / t);
    if (t % REPEAT_GROUP === 0) { groups.push(gsum / REPEAT_GROUP); gsum = 0; }
  }
  const exact = outcomes.reduce((a, o) => a + o.p * o.v, 0);
  const sd = Math.sqrt(outcomes.reduce((a, o) => a + o.p * (o.v - exact) ** 2, 0));
  const sorted = groups.slice().sort((a, b) => a - b);
  const lo = Math.floor(sorted.length * 0.025);
  const hi = lo + Math.ceil(sorted.length * 0.95) - 1;
  return { n, counts, mean: sum / n, exact, sd, line, groups, range95: sorted.length ? [sorted[lo], sorted[hi]] : [0, 0] };
}
