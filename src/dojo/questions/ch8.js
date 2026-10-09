// 第8章の問題：本来の取り分は？／1万回やり直したら？／回数と幅（設計書 段階4-2 第6節）
import { pick, withChoices, retry, fmt, pct } from './util.js';

const pts = (x) => `${fmt(x)}点`;
const spts = (x) => (x >= 0 ? `+${fmt(x)}点` : `−${fmt(-x)}点`);
const bbw = (x) => `±${Number(x.toFixed(1))}BB`;

// 本来の取り分は？：オールインの時点の勝つ見込み×ポット
const SHARE_EQ = [0.18, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.82];
export function allinShare(rng) {
  return retry(rng, (r) => {
    const pot = 1000 * (4 + Math.floor(r() * 37)); // 4,000〜40,000
    const eq = pick(r, SHARE_EQ);
    const share = Math.round(pot * eq);
    const correct = pts(share);
    // よくある間違い：勝てばもらえる全部・半分ずつ・相手の取り分・見込みを1割ずらした値
    const wrongs = [pot, pot / 2, pot - share, share + pot / 10, share - pot / 10].filter((x) => x > 0 && x !== share).map((x) => pts(Math.round(x)));
    if (new Set(wrongs.filter((w) => w !== correct)).size < 3) return null;
    return {
      prompt: `ポット ${fmt(pot)} 点。オールインの時点で、あなたの勝つ見込みは ${Math.round(eq * 100)}%。本来の取り分は？`,
      scene: { board: [], hole: null, others: [], pills: [`ポット ${fmt(pot)}`, `勝つ見込み ${pct(eq)}`] },
      ...withChoices(r, correct, wrongs),
      explain: [
        'オールインのあとは、もう誰も判断しない。残りのカードを何回も配り直したときの平均の受け取りが、本来の取り分。',
        `実際は、勝てば ${pts(pot)}、負ければ 0点。本来の取り分との差が運。`,
      ],
      calc: `${fmt(pot)} × ${pct(eq)} ＝ ${correct}`,
    };
  });
}

// 1万回やり直したら？：勝つ見込み×取れる額−払う額（期待値が0に近い場面は出さない）
export const LONG_RUN_MIN = 300;
export function longRun(rng) {
  return retry(rng, (r) => {
    const eq = 0.05 * (4 + Math.floor(r() * 9)); // 20〜60%
    const pay = 500 * (2 + Math.floor(r() * 11)); // 1,000〜6,000
    const win = 1000 * (3 + Math.floor(r() * 18)); // 3,000〜20,000
    if (win <= pay * 1.5) return null;
    const ev = Math.round(eq * win - pay);
    if (Math.abs(ev) < LONG_RUN_MIN) return null;
    const correct = spts(ev);
    // よくある間違い：払う額を引き忘れる・負けた分を数え忘れる・払う額を2回引く・500点ずらした値
    const wrongs = [eq * win, eq * (win - pay), eq * (win - pay) - pay, ev + 500, ev - 500].map((x) => spts(Math.round(x)));
    if (new Set(wrongs.filter((w) => w !== correct)).size < 3) return null;
    const e = Math.round(eq * 100);
    return {
      prompt: `勝つ見込み ${e}% のコール。払う額 ${fmt(pay)} 点・勝てば取れる額 ${fmt(win)} 点（あなたの払う額を含む）。1万回やり直したら、1回あたりの平均は？`,
      scene: { board: [], hole: null, others: [], pills: [`勝つ見込み ${e}%`, `払う額 ${fmt(pay)}`, `取れる額 ${fmt(win)}`] },
      ...withChoices(r, correct, wrongs),
      explain: [
        `1回ごとの結果は、勝てば ${spts(win - pay)}、負ければ ${spts(-pay)} のどちらか。`,
        `1万回やり直すと、勝つのはほぼ ${e}%。1回あたりの平均は期待値（勝つ見込み×取れる額−払う額）に近づく。${ev > 0 ? `${100 - e}%は負けても、続ければ得をする判断。` : `${e}%は勝てても、続ければ損をする判断。`}`,
      ],
      calc: `${e}% × ${fmt(win)} − ${fmt(pay)} ＝ ${correct}`,
    };
  });
}

// 回数と幅：幅は√回数で狭くなる／95%の幅＝1.96×ばらつき÷√回数
const RATIOS = [[100, 400, 2], [100, 900, 3], [100, 1600, 4], [100, 10000, 10], [400, 100, 0.5], [25, 400, 4]];
export function sampleSize(rng) {
  const kind = rng() < 0.5 ? 'ratio' : 'ci';
  return retry(rng, (r) => {
    if (kind === 'ratio') {
      const [m, n, k] = pick(r, RATIOS); // 回数が m → n で、幅は 1/k 倍
      const w = k >= 1 ? k * (1 + Math.floor(r() * 6)) : 1 + Math.floor(r() * 8);
      const correct = bbw(w / k);
      const wrongs = [w / (k * k), w * k, w, w / k + (k >= 1 ? 1 : 2), w / (2 * k)].filter((x) => x > 0).map(bbw);
      if (new Set(wrongs.filter((x) => x !== correct)).size < 3) return null;
      return {
        prompt: `${m} 回の平均の幅が ±${w}BB。${n} 回なら？`,
        scene: { board: [], hole: null, others: [], pills: [`${m}回 ±${w}BB`, `${n}回 ？`] },
        ...withChoices(r, correct, wrongs),
        explain: [
          '平均の幅は、回数の平方根（√）に反比例する。回数を4倍にすると幅は半分、100倍にすると10分の1。',
          `回数は ${n / m} 倍なので、幅は ${k >= 1 ? `${k}分の1` : '2倍'}。`,
        ],
        calc: `±${w}BB × √(${m}÷${n}) ＝ ${correct}`,
      };
    }
    const sd = pick(r, [5, 8, 10, 12, 15, 20]);
    const n = pick(r, [25, 100, 400, 1600]);
    const half = (1.96 * sd) / Math.sqrt(n);
    const fix = (x) => `±${x.toFixed(1)}BB`;
    const correct = fix(half);
    const wrongs = [sd / Math.sqrt(n), (1.96 * sd) / n, 1.96 * sd, 2 * half, half / 2].filter((x) => x >= 0.05).map(fix);
    if (new Set(wrongs.filter((x) => x !== correct)).size < 3) return null;
    return {
      prompt: `1回あたりのばらつき（標準偏差）が ${sd}BB。${n} 回の平均の95%の幅は？`,
      scene: { board: [], hole: null, others: [], pills: [`ばらつき ${sd}BB`, `${n}回`] },
      ...withChoices(r, correct, wrongs),
      explain: [
        '平均の95%の幅＝1.96×ばらつき÷√回数。平均が本当の値（期待値）からこの幅より外れるのは、20回に1回ほど。',
        `√${n}＝${Math.sqrt(n)}。回数が増えるほど、幅は狭くなる。`,
      ],
      calc: `1.96 × ${sd} ÷ √${n} ＝ ${correct}`,
    };
  });
}
