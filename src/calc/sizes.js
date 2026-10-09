// ポットの額と、レイズ額の目盛り（2.5倍・3倍・ポット・オールイン など）。画面とコーチの両方で使う。
import { legalActions } from '../engine/hand.js';

export const potTotal = (hand) => hand.seats.reduce((a, s) => a + s.committed, 0) + hand.deadMoney;

// 100点単位に丸めて、合法な範囲に収める。最大以上はオールイン（端数のままの最大額）、
// 最小以下は最小額（端数のままの最小額）。2回かけても同じ値になるので、表示額と実際の額がずれない。
export function clampTo(to, raise) {
  if (to >= raise.max) return raise.max;
  if (to <= raise.min) return raise.min;
  const v = Math.round(to / 100) * 100;
  return Math.min(Math.max(v, raise.min), raise.max);
}

export function presetTargets(hand, seat) {
  const legal = legalActions(hand);
  if (!legal || legal.seat !== seat || !legal.raise) return [];
  const pot = potTotal(hand);
  const r = legal.raise;
  const list = hand.currentBet === 0
    ? [['½ポット', pot / 2], ['⅔ポット', (pot * 2) / 3], ['ポット', pot], ['オールイン', r.max]]
    : [['2.5倍', hand.currentBet * 2.5], ['3倍', hand.currentBet * 3], ['ポット', hand.currentBet + pot + legal.toCall], ['オールイン', r.max]];
  return list.map(([label, to]) => ({ label, to: clampTo(to, r) }));
}
