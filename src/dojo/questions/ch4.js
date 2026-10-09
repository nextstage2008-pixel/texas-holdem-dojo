// 第4章の問題：相手のありうる手は何通り残る？（場とあなたの手で見えているカードを除く）
import { classFromLabel, liveCombos, CLASS_COMBOS } from '../../calc/combos.js';
import { makeCard, RANK_CHARS } from '../../engine/cards.js';
import { drawCards, pick, withChoices, retry, cardsText } from './util.js';

// 相手の手の候補（「AK」はマークを問わない＝AKs＋AKo）
const RANGES = [
  ['AA', 'KK', 'AK'], ['AA', 'KK', 'QQ', 'AK'], ['KK', 'QQ', 'AK'], ['AA', 'AK', 'AQ'],
  ['JJ', 'TT', 'AK'], ['AA', 'KK', 'QQ', 'JJ'], ['QQ', 'JJ', 'AQ'], ['AK', 'AQ', 'KQ'],
];
const expand = (label) => (label.length === 2 && label[0] !== label[1] ? [`${label}s`, `${label}o`] : [label]);
const shown = (label) => label.replaceAll('T', '10');

export function rangeCount(rng) {
  const range = pick(rng, RANGES);
  return retry(rng, (r) => {
    // 候補の手に含まれるランクのカードを1〜2枚、場に出す（見えているカードで組合せが減る形にする）
    const ranks = [...new Set(range.join('').split(''))];
    const hits = [];
    const k = 1 + Math.floor(r() * 2);
    while (hits.length < k) {
      const c = makeCard(RANK_CHARS.indexOf(pick(r, ranks)), Math.floor(r() * 4));
      if (!hits.includes(c)) hits.push(c);
    }
    const board = [...hits, ...drawCards(r, 3 - hits.length, new Set(hits))];
    const dead = new Set(board);
    const rows = range.map((label) => {
      const full = expand(label).reduce((a, x) => a + CLASS_COMBOS[classFromLabel(x)].length, 0);
      const live = expand(label).reduce((a, x) => a + liveCombos(classFromLabel(x), dead).length, 0);
      return { label, full, live };
    });
    const total = rows.reduce((a, x) => a + x.live, 0);
    const fullTotal = rows.reduce((a, x) => a + x.full, 0);
    if (total === fullTotal) return null;
    const wrongs = [fullTotal, total - 3, total + 3, total - 6, total + 4, total - 2].filter((n) => n > 0).map((n) => `${n}通り`);
    return {
      prompt: `相手の手は ${range.map(shown).join('・')} のどれか（AK などはマークを問わない）。場のカードを見て、ありうる組合せは何通り？`,
      scene: { board, hole: null, others: [], pills: [`相手の手の候補：${range.map(shown).join('・')}`] },
      ...withChoices(r, `${total}通り`, wrongs),
      explain: [
        ...rows.map((x) => `${shown(x.label)}：${x.full}通り${x.live !== x.full ? ` → 見えているカードを除いて ${x.live}通り` : ''}`),
        `合わせて ${total}通り（場：${cardsText(board)}）。`,
      ],
      calc: null,
    };
  });
}
