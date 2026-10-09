// 序章の問題：どちらが勝ち？（キッカー・引き分けを含む）／7枚で一番強い役は？
import { evaluate, describe, categoryOf, CATEGORY, CATEGORY_NAMES } from '../../engine/evaluator.js';
import { drawCards, pick, withChoices, retry } from './util.js';

const WINNER_CHOICES = ['Aの勝ち', 'Bの勝ち', '引き分け'];

// variant：役の違いで決まる（rank）・同じ役でカードの高さで決まる（kicker）・引き分け（tie）
export function winner(rng) {
  const variant = pick(rng, ['rank', 'rank', 'kicker', 'kicker', 'tie']);
  return retry(rng, (r) => {
    const board = drawCards(r, 5);
    const used = new Set(board);
    const a = drawCards(r, 2, used);
    a.forEach((c) => used.add(c));
    const b = drawCards(r, 2, used);
    const sa = evaluate([...a, ...board]);
    const sb = evaluate([...b, ...board]);
    const sameCat = categoryOf(sa) === categoryOf(sb);
    if (variant === 'tie' && sa !== sb) return null;
    if (variant === 'kicker' && !(sameCat && sa !== sb)) return null;
    if (variant === 'rank' && sameCat) return null;
    const correct = sa > sb ? 'Aの勝ち' : sb > sa ? 'Bの勝ち' : '引き分け';
    const why = sa === sb
      ? '使う5枚の強さがまったく同じなので引き分け（ポットを半分ずつ分ける）。'
      : sameCat ? '同じ役なので、役を作るカードの高さ、次に残りのカード（キッカー）の高さで比べる。'
        : '役の強さが違うので、強い役の勝ち。';
    return {
      prompt: '場の5枚と、AとBの手札2枚ずつ。勝つのはどちら？',
      scene: { board, hole: null, others: [{ label: 'A', cards: a }, { label: 'B', cards: b }], pills: ['自分の2枚と場の5枚から、一番強い5枚を選ぶ'] },
      ...withChoices(r, correct, [], { fixed: WINNER_CHOICES }),
      explain: [`A：${describe(sa)}　B：${describe(sb)}`, why],
      calc: null,
    };
  });
}

// 出す役（ハイカード〜フルハウス）を先に決めて、その役になる7枚を探す
const TARGETS = [CATEGORY.HIGH_CARD, CATEGORY.PAIR, CATEGORY.TWO_PAIR, CATEGORY.TRIPS, CATEGORY.STRAIGHT, CATEGORY.FLUSH, CATEGORY.FULL_HOUSE];

export function bestHand(rng) {
  const target = pick(rng, TARGETS);
  return retry(rng, (r) => {
    const board = drawCards(r, 5);
    const hole = drawCards(r, 2, new Set(board));
    const s = evaluate([...hole, ...board]);
    if (categoryOf(s) !== target) return null;
    const name = CATEGORY_NAMES[target];
    // 間違いの選択肢は、強さの近い役から3つ
    const near = [1, 2, 3, 4, 5, 6, 7, 0].filter((k) => k !== target)
      .sort((x, y) => Math.abs(x - target) - Math.abs(y - target) || x - y).slice(0, 3).map((k) => CATEGORY_NAMES[k]);
    return {
      prompt: 'あなたの2枚と場の5枚。一番強い役は？',
      scene: { board, hole, others: [], pills: ['7枚のうち5枚を選んで役を作る'] },
      ...withChoices(r, name, near),
      explain: [`一番強い5枚で「${describe(s)}」。`, '役の強さ：ハイカード＜ワンペア＜ツーペア＜スリーカード＜ストレート＜フラッシュ＜フルハウス＜フォーカード＜ストレートフラッシュ'],
      calc: null,
    };
  }, 20000);
}
