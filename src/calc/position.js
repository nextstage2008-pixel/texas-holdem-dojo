// 席の呼び名（UTG〜BTN・SB・BB）と、参加表の参加率。
// プリフロップの行動順で、ブラインド以外の人を後ろから BTN・CO・HJ・LJ・MP・UTG+1・UTG と呼ぶ（デッドボタンでも崩れない）。
// HU は2人のときのボタン（SBを兼ねる）の参加率。設計書に値がないので、2人戦で一般的な約8割にする。
export const OPEN_PCT = { UTG: 0.11, 'UTG+1': 0.12, MP: 0.14, LJ: 0.16, HJ: 0.19, CO: 0.26, BTN: 0.40, SB: 0.33, HU: 0.8 };
const FROM_BACK = ['BTN', 'CO', 'HJ', 'LJ', 'MP', 'UTG+1', 'UTG'];

export const isHeadsUp = (hand) => hand.seats.filter((s) => s.inHand).length === 2;

export function positionOf(hand, seat) {
  const n = hand.seats.length;
  const inHand = hand.seats.map((s) => s.inHand);
  if (isHeadsUp(hand)) return seat === hand.bbSeat ? 'BB' : 'BTN'; // 2人ではボタン（SB）がプリフロップで先に行動する
  if (seat === hand.bbSeat) return 'BB';
  if (seat === hand.sbSeat) return 'SB';
  const order = [];
  for (let k = 1; k <= n; k++) {
    const i = (hand.bbSeat + k) % n;
    if (inHand[i] && i !== hand.sbSeat && i !== hand.bbSeat) order.push(i);
  }
  return FROM_BACK[order.length - 1 - order.indexOf(seat)];
}

// この席の参加率（2人のときのボタンは HU）
export const openCutoff = (hand, pos) => (isHeadsUp(hand) && pos === 'BTN' ? OPEN_PCT.HU : OPEN_PCT[pos]);
