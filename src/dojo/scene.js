// 問題用の場面づくり：手札と場のカードを指定して、エンジンのハンドを作る。
// 配る順（engine/hand.js）：ボタンの左隣から1枚ずつ2周 → バーン → フロップ3枚 → バーン → ターン → バーン → リバー。
import { createHand, applyAction } from '../engine/hand.js';
import { newDeck } from '../engine/cards.js';

export function arrangeDeck({ n, button, holes, board = [] }) {
  const used = new Set([...holes.flat(), ...board]);
  const filler = newDeck().filter((c) => !used.has(c));
  const deck = [];
  for (let round = 0; round < 2; round++) {
    for (let k = 1; k <= n; k++) deck.push(holes[(button + k) % n][round]);
  }
  const take = () => filler.shift();
  const b = board.slice();
  const next = () => (b.length ? b.shift() : take());
  deck.push(take(), next(), next(), next(), take(), next(), take(), next());
  return [...deck, ...filler];
}

// 2人の場面：席0＝相手（ボタン＝SB）、席1＝あなた（BB）。プリフロップは相手がコール・あなたがチェック、
// フロップ・ターンは2人ともチェック（street で止める）。あなたが最初に行動する番で返す。
export function headsUpSpot({ hero, villain, board, street, stack = 20000, blinds = { sb: 100, bb: 200, ante: 200 } }) {
  let h = createHand({
    stacks: [stack, stack], button: 0, sbSeat: 0, bbSeat: 1, blinds,
    deck: arrangeDeck({ n: 2, button: 0, holes: [villain, hero], board }),
  });
  h = applyAction(h, { type: 'call' });
  h = applyAction(h, { type: 'check' });
  const order = ['flop', 'turn', 'river'];
  for (const s of order) {
    if (h.street === street) break;
    h = applyAction(h, { type: 'check' });
    h = applyAction(h, { type: 'check' });
  }
  if (h.street !== street || h.toAct !== 1) throw new Error('場面を作れなかった');
  return h;
}

// 押す・受けるの場面（第5・6章の問題と講義の図）：ボタンは席0（SB 1・BB 2）。stacksBB：席ごとの持ち点（BB）。
// ブラインド100/200・BBアンティ200で配り、席 pusher の番まで全員降りた手を返す。tour を渡すと賞金の割合を持つ
export const PUSH_BLINDS = { sb: 100, bb: 200, ante: 200 };
export const SEATS9 = { UTG: 3, 'UTG+1': 4, MP: 5, LJ: 6, HJ: 7, CO: 8, BTN: 0, SB: 1, BB: 2 };
export const SEATS4 = { CO: 3, BTN: 0, SB: 1, BB: 2 };
export const seatName = (map, seat) => Object.keys(map).find((k) => map[k] === seat);

export function foldedToHand({ stacksBB, pusher, tour = null }) {
  let h = createHand({
    stacks: stacksBB.map((x) => Math.round(x * PUSH_BLINDS.bb)), button: 0, sbSeat: 1, bbSeat: 2,
    blinds: PUSH_BLINDS, deck: newDeck(), tour,
  });
  while (h.toAct !== pusher) {
    if (h.toAct === null || h.toAct === h.bbSeat) throw new Error('押す人の番まで進めない');
    h = applyAction(h, { type: 'fold' });
  }
  return h;
}
