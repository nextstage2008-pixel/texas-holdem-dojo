// 9人1卓の大会。ボタンの動きは TDA のデッドボタン方式。
import { BLIND_LEVELS } from './blinds.js';
import { newDeck, shuffle } from './cards.js';
import { createHand } from './hand.js';

// 大会の途中から始めるとき（第5・6章の対局）：stacks＝人ごとの開始の持ち点、places＝始める前に飛んだ人の順位（残る人は null）、
// startLevel＝始めのブラインドのレベル（0＝100/200）
export function createTournament({
  players, startStack = 20000, stacks = null, places = null, startLevel = 0, handsPerLevel = 8, payouts = [0.5, 0.3, 0.2], firstButton = 0,
}) {
  const start = stacks ?? players.map(() => startStack);
  const placeOf = places ?? players.map(() => null);
  if (start.length !== players.length || placeOf.length !== players.length) throw new Error('持ち点・順位の数が人数と合わない');
  const alive = start.filter((x) => x > 0).length;
  const taken = placeOf.filter((x) => x !== null);
  if (alive < 2) throw new Error('2人未満では大会を始められない');
  if (start.some((x, i) => (x > 0) === (placeOf[i] !== null))) throw new Error('飛んだ人だけに順位を付ける');
  if (new Set(taken).size !== taken.length || taken.some((x) => !Number.isInteger(x) || x <= alive || x > players.length)) {
    throw new Error('始める前に飛んだ人の順位が不正');
  }
  return {
    seatCount: players.length,
    players: players.map((p, i) => ({ ...p, stack: start[i], place: placeOf[i] })),
    startStack, handsPerLevel, payouts, startLevel,
    handNumber: 0,
    positions: null,
    firstButton,
    finished: false,
  };
}

const isAlive = (t, i) => t.players[i].stack > 0;
export const aliveSeats = (t) => t.players.map((_, i) => i).filter((i) => isAlive(t, i));

function nextAlive(t, from) {
  for (let k = 1; k <= t.seatCount; k++) {
    const i = (from + k) % t.seatCount;
    if (isAlive(t, i)) return i;
  }
  return null;
}

export const levelIndex = (t) => Math.min(t.startLevel + Math.floor(t.handNumber / t.handsPerLevel), BLIND_LEVELS.length - 1);
export const blindsFor = (t) => BLIND_LEVELS[levelIndex(t)];
export const handsToNextLevel = (t) => t.handsPerLevel - (t.handNumber % t.handsPerLevel);

// BBは必ず次の人に進む。SBは前回のBBの席（飛んでいればSBなし）、ボタンは前回のSBの席（空席でもよい）。
export function nextPositions(t) {
  const alive = aliveSeats(t);
  if (alive.length < 2) throw new Error('2人未満ではハンドを始められない');
  if (t.positions === null) {
    const button = isAlive(t, t.firstButton) ? t.firstButton : nextAlive(t, t.firstButton);
    if (alive.length === 2) return { button, sbPos: button, sbSeat: button, bbSeat: nextAlive(t, button) };
    const sb = nextAlive(t, button);
    return { button, sbPos: sb, sbSeat: sb, bbSeat: nextAlive(t, sb) };
  }
  const prev = t.positions;
  const bbSeat = nextAlive(t, prev.bbSeat);
  if (alive.length === 2) {
    const other = alive.find((i) => i !== bbSeat);
    return { button: other, sbPos: other, sbSeat: other, bbSeat };
  }
  const sbPos = prev.bbSeat;
  return { button: prev.sbPos, sbPos, sbSeat: isAlive(t, sbPos) ? sbPos : null, bbSeat };
}

export function startHand(t, rng) {
  const pos = nextPositions(t);
  const hand = createHand({
    stacks: t.players.map((p) => p.stack),
    button: pos.button, sbSeat: pos.sbSeat, bbSeat: pos.bbSeat,
    blinds: blindsFor(t),
    deck: shuffle(newDeck(), rng),
    // 大会全体の残り人数（多卓の大会では aliveTotal。1卓の大会は卓の残り人数）。賞金で計算するか・バブルかの判定に使う
    tour: { payouts: t.payouts, alive: t.aliveTotal ?? aliveSeats(t).length },
  });
  return { tournament: { ...t, positions: pos }, hand };
}

export function finishHand(t, hand) {
  if (hand.street !== 'complete') throw new Error('ハンドが終わっていない');
  const before = t.players.map((p) => p.stack);
  const players = t.players.map((p, i) => ({ ...p, stack: hand.seats[i].stack }));
  const busted = players.map((_, i) => i).filter((i) => before[i] > 0 && players[i].stack === 0);
  const remaining = players.filter((p) => p.stack > 0).length;
  // 同じハンドで飛んだ人は、開始時の持ち点が多い人ほど上。同じなら席順。
  busted.sort((a, b) => before[b] - before[a] || a - b);
  busted.forEach((i, k) => { players[i].place = remaining + 1 + k; });
  let finished = false;
  if (remaining === 1) {
    players[players.findIndex((p) => p.stack > 0)].place = 1;
    finished = true;
  }
  return { ...t, players, handNumber: t.handNumber + 1, finished };
}

export const prizeShare = (t, place) => t.payouts[place - 1] ?? 0;
