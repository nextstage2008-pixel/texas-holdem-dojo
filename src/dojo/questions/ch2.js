// 第2章の問題：アウツは何枚？／損益分岐点は？／コールする？
import { drawOuts, outsChance, ruleOfThumb, breakeven as breakevenOf } from '../../calc/odds.js';
import { evalFast } from '../../engine/fast-eval.js';
import { rankOf } from '../../engine/cards.js';
import { drawCards, pick, withChoices, retry, pct, fmt } from './util.js';

const catOf = (s) => Math.floor(s / 16 ** 5);

// ドローの場面：5枚（手札2・フロップ3）のランクがすべて違い、今はハイカード。アウツはフラッシュかストレートになるカードだけ。
// 返す値：{ hole, board, outs（枚数）, flush（フラッシュになる枚数）, straight（ストレートになる枚数）}
export function drawScene(rng, accept, { street = 'flop' } = {}) {
  return retry(rng, (r) => {
    const n = street === 'flop' ? 3 : 4;
    const cards = drawCards(r, 2 + n);
    if (new Set(cards.map(rankOf)).size !== cards.length) return null;
    const hole = cards.slice(0, 2);
    const board = cards.slice(2);
    if (catOf(evalFast(cards)) !== 0) return null;
    const { outs } = drawOuts(hole, board);
    let flush = 0;
    let straight = 0;
    for (const c of outs) {
      const cat = catOf(evalFast([...cards, c]));
      if (cat === 5 || cat === 8) flush++;
      if (cat === 4 || cat === 8) straight++;
    }
    const scene = { hole, board, outs: outs.length, flush, straight };
    return accept(scene) ? scene : null;
  }, 20000);
}

const outsWhy = (d) => {
  const parts = [];
  if (d.flush) parts.push(`フラッシュになるカード ${d.flush}枚`);
  if (d.straight) parts.push(`ストレートになるカード ${d.straight}枚`);
  const both = d.flush + d.straight - d.outs;
  return `${parts.join('、')}${both > 0 ? `（両方に入る${both}枚は1回だけ数える）` : ''} → 合わせて ${d.outs}枚。`;
};

const VARIANTS = {
  flush: (d) => d.flush === 9 && d.straight === 0,
  oesd: (d) => d.straight === 8 && d.flush === 0,
  gut: (d) => d.straight === 4 && d.flush === 0,
  combo: (d) => d.flush === 9 && d.straight >= 4,
};

export function outs(rng) {
  const variant = pick(rng, Object.keys(VARIANTS));
  const d = drawScene(rng, VARIANTS[variant]);
  return {
    prompt: 'フロップです。次のカードで役が完成するカード（アウツ）は何枚？',
    scene: { board: d.board, hole: d.hole, others: [], pills: ['アウツ＝来ればストレート以上になるカード'] },
    ...withChoices(rng, `${d.outs}枚`, [4, 6, 8, 9, 12, 15].map((n) => `${n}枚`)),
    explain: [outsWhy(d)],
    calc: `あと2枚めくれる：${d.outs}×4 ≒ ${pct(ruleOfThumb(d.outs, 'flop'))}（正確には ${(outsChance(d.outs, 'flop') * 100).toFixed(2)}%）`,
  };
}

// 損益分岐点＝払う額 ÷（ポット＋相手のベット＋払う額）
const FRACTIONS = [[1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [1, 1]];

export function breakeven(rng) {
  return retry(rng, (r) => {
    const pot = 1000 + 500 * Math.floor(r() * 11); // 1,000〜6,000
    const [a, b] = pick(r, FRACTIONS);
    const bet = Math.round((pot * a) / b / 100) * 100;
    const x = breakevenOf(bet, pot + bet);
    const correct = pct(x);
    // よくある間違い：相手のベット÷ポット、自分のコールを足し忘れる、ベット÷（ポット＋ベット×3）
    const wrongs = [bet / pot, bet / (pot + bet), bet / (pot + 3 * bet), x + 0.1, x - 0.07].filter((v) => v > 0 && v < 1).map(pct);
    if (new Set(wrongs.filter((w) => w !== correct)).size < 3) return null;
    return {
      prompt: `ポット ${fmt(pot)} に、相手が ${fmt(bet)} ベット。コールするのに必要な勝つ見込み（損益分岐点）は？`,
      scene: { board: [], hole: null, others: [], pills: [`ポット ${fmt(pot)}`, `相手のベット ${fmt(bet)}`, `あなたのコール ${fmt(bet)}`] },
      ...withChoices(r, correct, wrongs),
      explain: ['払う額を、勝てば手に入る全部の額で割る。', '全部の額＝もとのポット＋相手のベット＋自分のコール。'],
      calc: `${fmt(bet)} ÷（${fmt(pot)}＋${fmt(bet)}＋${fmt(bet)}）＝ ${(x * 100).toFixed(1)}%`,
    };
  });
}

// コールする？：フロップで相手がオールイン（残り2枚を必ず見られる）か、ターンで相手がベット（残り1枚）
const CALL_CHOICES = ['コール', '降りる'];
const GAP = 0.04; // 勝つ見込みと損益分岐点の差がこれより小さい場面は出さない

export function drawCall(rng) {
  const street = pick(rng, ['flop', 'turn']);
  const variant = pick(rng, ['flush', 'oesd', 'gut', 'combo']);
  const d = drawScene(rng, VARIANTS[variant], { street });
  return retry(rng, (r) => {
    const pot = 1000 + 500 * Math.floor(r() * 9);
    const [a, b] = pick(r, FRACTIONS);
    const bet = Math.round((pot * a) / b / 100) * 100;
    const need = breakevenOf(bet, pot + bet);
    const chance = outsChance(d.outs, street);
    if (Math.abs(chance - need) < GAP) return null;
    const correct = chance > need ? 'コール' : '降りる';
    const rule = street === 'flop' ? 4 : 2;
    return {
      prompt: street === 'flop'
        ? `フロップで相手がオールイン（${fmt(bet)}）。ポットは ${fmt(pot)}。ドローが完成すれば勝ちとして、コールする？`
        : `ターンで相手が ${fmt(bet)} ベット。ポットは ${fmt(pot)}。ドローが完成すれば勝ちとして、コールする？`,
      scene: { board: d.board, hole: d.hole, others: [], pills: [`ポット ${fmt(pot)}`, `相手 ${street === 'flop' ? 'オールイン' : 'ベット'} ${fmt(bet)}`] },
      ...withChoices(r, correct, [], { fixed: CALL_CHOICES }),
      explain: [
        `アウツ ${d.outs}枚。${street === 'flop' ? '残り2枚' : '残り1枚'}で完成する見込みは約 ${pct(ruleOfThumb(d.outs, street))}（アウツ×${rule}）、正確には ${pct(chance)}。`,
        `損益分岐点は ${pct(need)}。勝つ見込みが${chance > need ? '上なのでコール' : '下なので降りる'}。`,
      ],
      calc: `${fmt(bet)} ÷（${fmt(pot)}＋${fmt(bet)}＋${fmt(bet)}）＝ ${pct(need)}`,
    };
  });
}
