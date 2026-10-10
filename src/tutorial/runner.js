// 遊び方のチュートリアルの台本を、本物のエンジンに当てる（設計書 段階5-4 第5-2節）。画面に触れない。
// 台本（tutorial/lessons.js）の場面：
//   say（説明の文。{印} に本物の値を入れる：pot・bb・sb・ante・stackBB・call・eq・be・best・to）・point（指す部品の名前か null）・
//   hero（あなたに押してもらう行動 'fold'|'check'|'call'|'raise'。あるときは、その場面であなたの番を待つ）・to（レイズの額。省くとコーチの勧める額。
//   額の所の目盛りのボタンのどれかと同じ額にする。画面では、その目盛りのボタンを押してからレイズを押してもらう）・
//   then（そのあとに起きることの並び：{ deal: { holes: { 席: '2枚' }, board: '5枚' } }・{ cpu: [相手の行動…] }・{ close: true }）・
//   tab（その場面で開くタブ 'side' など。画面が使う）
// 相手の行動：'fold'|'check'|'call'|'allin'|{ raise: 額 }。相手は CPU に決めさせず、台本の行動を当てる
import { HERO_SEAT, createSession, act, closeHand, analyzeHero, isHeroTurn } from '../game/session.js';
import { createHand, legalActions } from '../engine/hand.js';
import { nextPositions, blindsFor, aliveSeats } from '../engine/tournament.js';
import { newDeck, parseCards } from '../engine/cards.js';
import { bestAction, bestLabel, gaugeData } from '../coach/explain.js';
import { describe, evaluate } from '../engine/evaluator.js';
import { presetTargets } from '../calc/sizes.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (x) => `${Math.round(x * 100)}%`;
const cardsOf = (x) => (typeof x === 'string' ? parseCards(x) : x);

// ポットの額（全員が置いた額＋アンティ）
export const potOf = (h) => h.seats.reduce((t, s) => t + s.committed, 0) + h.deadMoney;

// レイズの額に合う、額の所の目盛りのボタン（画面の目盛りと同じ calc/sizes.js）。返す値：{ label, to } か null
export const presetFor = (hand, to) => presetTargets(hand, HERO_SEAT).find((p) => p.to === to) ?? null;

// 山（52枚）：ボタンの左から2周で、決めた席に決めた2枚（決めていない席は残りの札から順に）。
// 場の札は1枚ずつ捨てて 3・1・1枚（決めていない分は残りの札から）。stacks：持ち点（0の席には配らない）
export function deckFor({ stacks, button, holes = {}, board = [] }) {
  const n = stacks.length;
  const order = [];
  for (let j = 1; j <= n; j++) {
    const seat = (button + j) % n;
    if (stacks[seat] > 0) order.push(seat);
  }
  const fixed = Object.fromEntries(Object.entries(holes).map(([seat, cs]) => [seat, cardsOf(cs)]));
  const shown = cardsOf(board);
  const used = new Set([...Object.values(fixed).flat(), ...shown]);
  const rest = newDeck().filter((c) => !used.has(c));
  let r = 0;
  const next = () => rest[r++];
  const hole = Object.fromEntries(order.map((seat) => [seat, fixed[seat] ?? [next(), next()]]));
  const deck = [];
  for (let k = 0; k < 2; k++) for (const seat of order) deck.push(hole[seat][k]);
  const b = [...shown];
  while (b.length < 5) b.push(next());
  deck.push(next(), b[0], b[1], b[2], next(), b[3], next(), b[4]);
  while (r < rest.length) deck.push(next());
  return deck;
}

// はじめの形：いつもの9人（席0はあなた）。setup：{ button（はじめのボタンの席）, stacks, handsPerLevel, startLevel, seed }。
// 指南は段階1（行動の前に最善手と理由を出す）。ハンドはまだない
export function startSession(setup = {}, { heroName = null } = {}) {
  const base = createSession({
    seed: setup.seed ?? 1, coachMode: 1, heroName, handsPerLevel: setup.handsPerLevel ?? 8, stacks: setup.stacks ?? null, startLevel: setup.startLevel ?? 0,
  });
  return { ...base, tournament: { ...base.tournament, firstButton: setup.button ?? 0 } };
}

// 台本の札でハンドを配る（tournament.js の startHand と同じ順。山だけ台本のもの）
function dealHand(s, spec) {
  if (s.hand && s.hand.street !== 'complete') throw new Error('台本のずれ：前のハンドが終わっていない');
  if (s.hand) throw new Error('台本のずれ：前のハンドを閉じていない');
  const t = s.tournament;
  const pos = nextPositions(t);
  const stacks = t.players.map((p) => p.stack);
  const hand = createHand({
    stacks, button: pos.button, sbSeat: pos.sbSeat, bbSeat: pos.bbSeat, blinds: blindsFor(t),
    deck: deckFor({ stacks, button: pos.button, holes: spec.holes, board: spec.board }),
    tour: { payouts: t.payouts, alive: aliveSeats(t).length },
  });
  return { ...s, tournament: { ...t, positions: pos }, hand, trail: [] };
}

// 相手の行動を1つ当てる
function cpuStep(s, a) {
  if (!s.hand || s.hand.toAct === null || s.hand.toAct === HERO_SEAT) throw new Error(`台本のずれ：相手の番ではない（${JSON.stringify(a)}）`);
  const legal = legalActions(s.hand);
  const action = a === 'allin' ? (legal.raise ? { type: 'raise', to: legal.raise.max } : { type: 'call' })
    : typeof a === 'string' ? { type: a } : { type: 'raise', to: a.raise };
  try {
    return act(s, action);
  } catch (e) {
    throw new Error(`台本のずれ：できない行動（席${s.hand.toAct}・${JSON.stringify(a)}：${e.message}）`);
  }
}

// そのあとに起きること1つ → 形の並び（相手の行動は1つずつ）
function applyThen(s, tr) {
  if (tr.deal) return [dealHand(s, tr.deal)];
  if (tr.cpu) {
    const out = [];
    let cur = s;
    for (const a of tr.cpu) { cur = cpuStep(cur, a); out.push(cur); }
    return out;
  }
  if (tr.close) {
    if (!s.hand || s.hand.street !== 'complete') throw new Error('台本のずれ：ハンドが終わっていないのに閉じる');
    return [closeHand(s)];
  }
  throw new Error(`台本のずれ：知らない出来事 ${JSON.stringify(tr)}`);
}

// 説明の文の {印} に、その場面の本物の値を入れる。analysis：あなたの番のコーチの分析（なければ null）、action：あなたの行動。分からない印はそのまま。
// preset：レイズの額に合う目盛りのボタンの名前（'2.5倍'・'ポット' など）。席ごとの印：stackN（席 N の持ち点）・wonN（終わったハンドで席 N が取った額）・potN（終わったハンドの N 番目のポット。1＝メインポット）、made（あなたのいまの役）
export function fillText(text, session, analysis, action) {
  const h = session.hand;
  const bl = h ? h.blinds : blindsFor(session.tournament);
  const stack = h ? h.seats[HERO_SEAT].stack : session.tournament.players[HERO_SEAT].stack;
  const vals = { bb: fmt(bl.bb), sb: fmt(bl.sb), ante: fmt(bl.ante), stackBB: String(Math.round(stack / bl.bb)) };
  if (h) vals.pot = fmt(potOf(h));
  if (h && h.toAct === HERO_SEAT) vals.call = fmt(legalActions(h).toCall);
  if (analysis) {
    const g = gaugeData(analysis);
    Object.assign(vals, { eq: pct(g.value), be: pct(g.mark), best: bestLabel(analysis) });
  }
  if (action && action.to) vals.to = fmt(action.to);
  const pre = h && action && action.type === 'raise' ? presetFor(h, action.to) : null;
  if (pre) vals.preset = pre.label;
  if (h && h.board.length >= 3 && h.seats[HERO_SEAT].hole) vals.made = describe(evaluate([...h.seats[HERO_SEAT].hole, ...h.board]));
  const players = session.tournament.players;
  players.forEach((p, i) => { vals[`stack${i}`] = fmt(h ? h.seats[i].stack : p.stack); });
  if (h && h.result) {
    h.result.won.forEach((w, i) => { vals[`won${i}`] = fmt(w); });
    h.result.pots.forEach((pot, k) => { vals[`pot${k + 1}`] = fmt(pot.amount); });
  }
  return text.replace(/\{(\w+)\}/g, (m, k) => vals[k] ?? m);
}

// 台本を最後まで当てる。返す値：{ beats, final }。beat（場面）：{ say（印を入れた文）, point, wait（'next'＝次へ・'hero'＝あなたの番）, allow（押せるボタン）,
//   preset（レイズの場面で、先に押してもらう目盛りのボタン { label, to }。ほかは null）,
//   action（あなたの行動）, analysis（コーチの分析）, best（コーチの最善手の種類）, session（場面で見せる形）, after（そのあとの形の並び。1つずつ動かす）, tab }
export function compileLesson(lesson, { heroName = null } = {}) {
  let s = startSession(lesson.setup, { heroName });
  const beats = [];
  for (const st of lesson.steps) {
    const shown = s;
    const after = [];
    let analysis = null;
    let best = null;
    let action = null;
    let preset = null;
    if (st.hero) {
      if (!s.hand || !isHeroTurn(s)) throw new Error(`台本のずれ：あなたの番ではない（「${st.say.slice(0, 24)}」）`);
      analysis = analyzeHero(s);
      const b = bestAction(analysis);
      best = b.type;
      action = st.hero === 'raise' ? { type: 'raise', to: st.to ?? b.to ?? analysis.chart?.openTo } : { type: st.hero };
      if (action.type === 'raise') {
        preset = presetFor(s.hand, action.to);
        if (!preset) throw new Error(`台本のずれ：額 ${action.to} が目盛りにない（「${st.say.slice(0, 24)}」）`);
      }
      try {
        s = act(s, action);
      } catch (e) {
        throw new Error(`台本のずれ：あなたができない行動（${JSON.stringify(action)}：${e.message}）`);
      }
      after.push(s);
    }
    for (const tr of st.then ?? []) for (const next of applyThen(s, tr)) { s = next; after.push(s); }
    beats.push({
      say: fillText(st.say, shown, analysis, action), point: st.point ?? null, wait: st.hero ? 'hero' : 'next', allow: st.hero ?? null, preset,
      action, analysis, best, session: shown, after, tab: st.tab ?? null,
    });
  }
  return { beats, final: s };
}
