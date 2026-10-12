// 第1章の問題：この席からこの手で参加する？（前の人は全員降りた）／組み合わせは何通り？（第4章の問題。2026-10-12 に第1章から移した）
import { CLASS_PCT } from '../../calc/chart.js';
import { OPEN_PCT } from '../../calc/position.js';
import { CLASS_COUNT, CLASS_COMBOS, COMBO_A, COMBO_B, classLabel, classFromLabel, liveCombos } from '../../calc/combos.js';
import { makeCard, RANK_CHARS } from '../../engine/cards.js';
import { pick, withChoices, pct, topPct, handName, cardsText } from './util.js';

export const SEAT_NOTE = {
  UTG: 'UTG（最初に行動する席）', 'UTG+1': 'UTG+1（2番目）', MP: 'MP（3番目）', LJ: 'LJ（4番目）',
  HJ: 'HJ（5番目）', CO: 'CO（ボタンの右隣）', BTN: 'BTN（ボタン・最後に行動する）', SB: 'SB（スモールブラインド）',
};
const OPEN_CHOICES = ['参加する（レイズ）', '降りる'];
// 境目からこれだけ離れた手だけを出す（境目に近い手は答えがはっきりしないので出さない）
const MARGIN = 0.04;

export function open(rng) {
  const pos = pick(rng, Object.keys(SEAT_NOTE));
  const cutoff = OPEN_PCT[pos];
  const wantIn = rng() < 0.5;
  // 参加する手は上位（cutoff−4%）まで、降りる手は境目のすぐ外から +25% までの「迷いやすい手」
  const pool = [];
  for (let id = 0; id < CLASS_COUNT; id++) {
    const p = CLASS_PCT[id];
    if (wantIn ? p <= cutoff - MARGIN : p >= cutoff + MARGIN && p <= cutoff + 0.25) pool.push(id);
  }
  const cls = pick(rng, pool);
  const combo = pick(rng, CLASS_COMBOS[cls]);
  const hole = [COMBO_A[combo], COMBO_B[combo]];
  const p = CLASS_PCT[cls];
  const correct = p <= cutoff ? OPEN_CHOICES[0] : OPEN_CHOICES[1];
  return {
    prompt: `前の人は全員降りました。${pos} のあなたは、この手で参加する？`,
    scene: { board: [], hole, others: [], pills: ['9人卓・持ち点100BB', `あなたの席：${SEAT_NOTE[pos]}`] },
    ...withChoices(rng, correct, [], { fixed: OPEN_CHOICES }),
    explain: [
      `${handName(classLabel(cls))}は、強い順で上位 ${topPct(p)}。`,
      `${pos} の参加の目安は上位 ${pct(cutoff)} まで（後ろの席ほど広い）→ ${correct === OPEN_CHOICES[0] ? '範囲の中なので参加（レイズ）' : '範囲の外なので降りる'}。`,
    ],
    calc: null,
  };
}

const rankIndex = (ch) => RANK_CHARS.indexOf(ch);
const nameOfRank = (ch) => (ch === 'T' ? '10' : ch);
// 答えは組み合わせの表（calc/combos.js）で数える
const countOf = (labels, dead = new Set()) => labels.map(classFromLabel).reduce((a, id) => a + liveCombos(id, dead).length, 0);

// variant：ペア（6）・同じマーク（4）・違うマーク（12）・両方（16）・見えているカードで減る（ペア・両方）
export function combos(rng) {
  const variant = pick(rng, ['pair', 'suited', 'offsuit', 'both', 'deadPair', 'deadBoth']);
  const hi = pick(rng, ['A', 'K', 'Q', 'J', 'T']);
  const lo = pick(rng, [...'KQJT98765'].filter((c) => rankIndex(c) < rankIndex(hi)));
  // 手の書き方（KK・KTs）と、ふだんの言葉（K のペア・同じマークの K と 10）を並べて言う（書き方は第4章の2ページ目で習う）
  const pairName = `${hi}${hi}`;
  const mixName = `${hi}${lo}`;
  const pairWord = `${pairName}（${nameOfRank(hi)} のペア）`;
  const mixWord = `${mixName}（${nameOfRank(hi)} と ${nameOfRank(lo)}・マークは問わない）`;
  const one = makeCard(rankIndex(hi), Math.floor(rng() * 4));
  const dead = new Set([one]);
  const V = {
    pair: { n: countOf([`${hi}${hi}`]), prompt: `${pairWord}の組み合わせは何通り？`, why: '同じ数字の4枚から2枚を選ぶ：4×3÷2＝6通り。' },
    suited: { n: countOf([`${hi}${lo}s`]), prompt: `${mixName}s（同じマークの ${nameOfRank(hi)} と ${nameOfRank(lo)}）は何通り？`, why: 'マークが4種類なので4通り（♠♠・♥♥・♦♦・♣♣）。' },
    offsuit: { n: countOf([`${hi}${lo}o`]), prompt: `${mixName}o（違うマークの ${nameOfRank(hi)} と ${nameOfRank(lo)}）は何通り？`, why: '4×4＝16通りから、同じマークの4通りを引いて12通り。' },
    both: { n: countOf([`${hi}${lo}s`, `${hi}${lo}o`]), prompt: `${mixWord}は何通り？`, why: '1枚目4通り×2枚目4通り＝16通り（同じマーク4＋違うマーク12）。' },
    deadPair: { n: countOf([`${hi}${hi}`], dead), prompt: `場に ${cardsText([one])} が見えています。相手が ${pairWord}を持つ組み合わせは何通り？`, why: `${pairName} は6通り。1枚見えているので、残りの3枚から2枚を選ぶ：3×2÷2＝3通り。`, board: [one] },
    deadBoth: { n: countOf([`${hi}${lo}s`, `${hi}${lo}o`], dead), prompt: `あなたが ${cardsText([one])} を持っています。相手が ${mixWord}を持つ組み合わせは何通り？`, why: `${mixName} は16通り。あなたが ${nameOfRank(hi)} を1枚持っているので、相手の ${nameOfRank(hi)} は残り3枚：3×4＝12通り。`, hole: [one] },
  }[variant];
  return {
    prompt: V.prompt,
    scene: { board: V.board ?? [], hole: V.hole ?? null, others: [], pills: ['組み合わせの数：ペア6・同じマーク4・違うマーク12'] },
    ...withChoices(rng, `${V.n}通り`, [1, 3, 4, 6, 8, 9, 12, 16].map((n) => `${n}通り`)),
    explain: [V.why],
    calc: null,
  };
}
