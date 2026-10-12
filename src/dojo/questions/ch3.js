// 第3章の問題：自分の手は？（強い・中くらい・弱い・ドロー・何もない）／ベットする？
import { handClass } from '../../coach/features.js';
import { analyzeDecision } from '../../coach/analyze.js';
import { priorRange } from '../../coach/range.js';
import { evaluate, describe } from '../../engine/evaluator.js';
import { createRng } from '../../engine/rng.js';
import { headsUpSpot } from '../scene.js';
import { drawCards, pick, withChoices, retry, fmt } from './util.js';

export const CLASS_NAME = { strong: '強い', good: '中くらい', weak: '弱い', draw: 'ドロー', air: '何もない' };
// 解説の文の「〇〇手」（中くらいの手・ドローの手）
const handWord = (cls) => ({ good: '中くらいの手', draw: 'ドローの手' }[cls] ?? `${CLASS_NAME[cls]}手`);
const CLASS_WHY = {
  strong: '自分のカードを使ったスリーカード以上か、ツーペア（場にペアがないとき）は「強い」。',
  good: '自分のカードで作ったペアが、場の一番高いカードと同じか高い（トップペア・オーバーペア）なら「中くらい」。',
  weak: '場の一番高いカードより下のペアは「弱い」。',
  draw: 'あと1枚でフラッシュになる形か、ストレートになる数字が2つある形（両側が開いた形など）は「ドロー」。',
  air: 'ペアもドローもないなら「何もない」（場の札だけでできたペアと、真ん中が1つ抜けただけの形も含む）。',
};
const CLASS_CHOICES = ['強い', '中くらい', '弱い', 'ドロー', '何もない'];

export function handClassQ(rng) {
  const target = pick(rng, Object.keys(CLASS_NAME));
  return retry(rng, (r) => {
    const board = drawCards(r, 3);
    const hole = drawCards(r, 2, new Set(board));
    const cls = handClass(hole, board);
    if (cls !== target) return null;
    return {
      prompt: 'フロップです。あなたの手はどれ？',
      scene: { board, hole, others: [], pills: [`今の役：${describe(evaluate([...hole, ...board]))}`] },
      ...withChoices(r, CLASS_NAME[cls], [], { fixed: CLASS_CHOICES }),
      explain: [CLASS_WHY[cls]],
      calc: null,
    };
  }, 20000);
}

// ベットする？：2人・ターン・あなたが先に行動（チェックできる）。相手の手は「見えていないカードのどれでもありうる」。
// 正解はコーチの分析（期待値から推定の誤差を引いた値）で、ベットとチェックの差が MARGIN_BB 以上ある場面だけ出す。
const BET_CHOICES = ['ベット', 'チェック'];
const MARGIN_BB = 0.5;

export function betOrCheck(rng) {
  const wantBet = rng() < 0.5;
  return retry(rng, (r) => {
    const board = drawCards(r, 4);
    const used = new Set(board);
    const hero = drawCards(r, 2, used);
    hero.forEach((c) => used.add(c));
    const cls = handClass(hero, board);
    if (wantBet ? !['strong', 'good'].includes(cls) : !['weak', 'air'].includes(cls)) return null;
    const villain = drawCards(r, 2, used);
    const hand = headsUpSpot({ hero, villain, board, street: 'turn' });
    const dead = new Set([...hero, ...board]);
    const a = analyzeDecision({
      hand, seat: 1, trail: [], typeOf: () => 'pro', rng: createRng(1), ranges: [priorRange(dead)],
    });
    const check = a.options.find((o) => o.type === 'check');
    const bet = a.options.find((o) => o.type === 'raise');
    if (!bet) return null;
    const diff = (bet.low - check.low) / a.bb;
    if (wantBet ? diff < MARGIN_BB : diff > -MARGIN_BB) return null;
    const correct = diff > 0 ? 'ベット' : 'チェック';
    return {
      prompt: `ターンです。ポットは ${fmt(a.pot)}。あなたが先に行動します。ベットする？チェックする？`,
      scene: { board, hole: hero, others: [], pills: [`ポット ${fmt(a.pot)}`, '相手は1人（ここまで2人ともチェック）', `あなたの手：${CLASS_NAME[cls]}`] },
      ...withChoices(r, correct, [], { fixed: BET_CHOICES }),
      explain: [
        correct === 'ベット'
          ? `${handWord(cls)}は、弱い手の人からもコールしてもらえるので、ベットで取れる点を増やせる。`
          : `${handWord(cls)}でベットすると、それより弱い手の人は降り、強い手の人だけがコールしてきやすい。チェックで安く次のカードを見る。`,
        `同じ場面を何度もくり返して計算した平均の得（計算のぶれを考えて、少なめに見た値）：ベット ${fmt(bet.low)}点　チェック ${fmt(check.low)}点。`,
      ],
      calc: null,
    };
  }, 400);
}
