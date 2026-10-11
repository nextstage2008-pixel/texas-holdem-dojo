// 本番大会の対局（設計書 段階4-3）：あなたの卓の対局（game/session.js の session と同じ形）と、多卓の大会（engine/field.js）をつなぐ。
// session.main：{ coachMode, field（多卓の大会）, table（あなたの卓の番号）}。session.tournament は、あなたの卓を1卓の大会の形にしたもの。
// ハンドごとの乱数の元は「大会の種・ハンドの番号・卓の番号」（どの卓も）。途中で閉じても、同じハンドは同じカードと同じCPUの打ち方になる。
import { createRng } from '../engine/rng.js';
import { shuffle } from '../engine/cards.js';
import { createField, tableTournament, settleRound, rebalance, roundSeed, aliveAt, aliveTotal, MAIN } from '../engine/field.js';
import { startHand, finishHand } from '../engine/tournament.js';
import { applyAction } from '../engine/hand.js';
import { decideCpu } from '../coach/policy.js';
import { createCoachState } from '../coach/levels.js';
import { CAST, HERO_SEAT, act, cpuAct } from './session.js';
import { MAIN_PEOPLE } from './names.js';

// 決勝卓の席の引き直しに使う卓の番号（乱数の元）
const FINAL_DRAW = 99;

// 45人の顔ぶれ：0番があなた、1〜8番がいつもの8人、9〜44番が36人（どちらも人ごとに決まった打ち方と顔）。
// 36人の座る順だけを大会ごとに種で混ぜる（設計書 段階4-4 第5節）
export function mainPeople(rng, heroName = null) {
  const cast = CAST.slice(1);
  return [
    { id: 'hero', name: heroName ?? 'あなた', type: null, avatar: 'av_hero' },
    ...cast.map((c) => ({ id: c.id, name: c.name, type: c.type, avatar: c.avatar })),
    ...shuffle(MAIN_PEOPLE, rng).map((p) => ({ ...p })),
  ];
}

// あなたの卓を session に載せる（あなたが飛んだあとは、最後にいた卓のまま）
function withField(session, field) {
  const table = field.people[0].stack > 0 ? field.people[0].table : session.main.table;
  const tournament = tableTournament(field, table);
  return { ...session, tournament, types: tournament.players.map((p) => p.type ?? 'pro'), hand: null, trail: [], main: { ...session.main, field, table } };
}

function base(seed, coachMode, coach, decisions = []) {
  return {
    seed, rng: createRng(seed), decisions,
    coach: coach && coachMode === 'auto' ? structuredClone(coach) : createCoachState(coachMode), minLevel: 1,
    main: { coachMode, field: null, table: 0 },
  };
}

// 新しい本番大会。coachMode：'auto' か 1〜5、coach：続きから使う指南の状態（自動のときだけ）
export function createMainSession({ seed, coachMode = 'auto', coach = null, heroName = null }) {
  const rng = createRng(seed);
  const heroTable = Math.floor(rng() * MAIN.tables);
  return withField(base(seed, coachMode, coach, []), createField({ people: mainPeople(rng, heroName), heroTable, rng }));
}

// あなたの卓のハンドを配る（その前に mainSnapshot で保存する）
export function dealMain(session) {
  const { field, table } = session.main;
  const rng = createRng(roundSeed(session.seed, field.round, table));
  const { tournament, hand } = startHand(session.tournament, rng);
  return { ...session, rng, tournament, hand, trail: [] };
}

// CPUだけの卓 t で1ハンド打つ。onHand（通し試験用）：{ table, round, trail, hand } を渡す
function playCpuHand(field, t, seed, onHand) {
  const rng = createRng(roundSeed(seed, field.round, t));
  let { tournament, hand } = startHand(tableTournament(field, t), rng);
  const trail = [];
  while (hand.street !== 'complete') {
    const seat = hand.toAct;
    const action = decideCpu(hand, seat, tournament.players[seat].type ?? 'pro', rng);
    if (onHand) trail.push({ state: hand, seat, action });
    hand = applyAction(hand, action);
  }
  onHand?.({ table: t, round: field.round, trail, hand });
  return finishHand(tournament, hand);
}

// まとめて卓を動かす（ハンドの終わり）
function settle(field, played, seed) {
  const settled = settleRound(field, played);
  const { field: next, moves } = rebalance(settled.field, createRng(roundSeed(seed, field.round, FINAL_DRAW)));
  return { field: next, moves, busted: settled.busted };
}

const otherTables = (field, skip) => field.tables.map((_, i) => i).filter((i) => i !== skip && !field.tables[i].broken && aliveAt(field, i) >= 2);

// あなたの卓のハンドが終わったあと（handResult のあと）：ほかの卓のハンドを打ち、飛んだ人の順位を付け、卓を動かす。
// 返す値：{ session（あなたの卓を新しい様子にしたもの）, moves（engine/field.js の rebalance の moves）, busted }
export function closeMain(session) {
  const { field, table } = session.main;
  const played = [{ table, tournament: finishHand(session.tournament, session.hand) }];
  for (const i of otherTables(field, table)) played.push({ table: i, tournament: playCpuHand(field, i, session.seed) });
  const { field: next, moves, busted } = settle(field, played, session.seed);
  return { session: withField(session, next), moves, busted };
}

// 全部の卓をCPUで打って、大会を最後まで回す（あなたが飛んだあと・テスト・通し試験）。あなたの席は上級者として打つ。
// onHand：ハンドごと、onRound：ハンドの終わりのまとめのあと（{ field, moves }）
export function runToEnd(field, seed, { onHand, onRound, maxRounds = 3000 } = {}) {
  let f = field;
  while (!f.finished) {
    if (f.round > maxRounds) throw new Error(`大会が${maxRounds}ハンドで終わらない`);
    const played = otherTables(f, -1).map((i) => ({ table: i, tournament: playCpuHand(f, i, seed, onHand) }));
    const r = settle(f, played, seed);
    onRound?.(r);
    f = r.field;
  }
  return f;
}

// あなたが飛んだあと：残りを最後まで回す
export const finishMain = (session) => withField(session, runToEnd(session.main.field, session.seed));

// テストと通し試験用：新しい本番大会を、あなたの席も上級者のCPUで打たせて最後まで回す。返す値：終わった多卓の大会
export const playMainToEnd = (seed, opts = {}) => runToEnd(createMainSession({ seed }).main.field, seed, opts);

// ハンドの途中の場面の確かめ（たどり直した場面が、保存したときと同じか）
export const handCheck = (hand) => JSON.stringify([hand.street, hand.toAct, hand.board, hand.seats.map((s) => [s.stack, s.bet, s.folded])]);

// 続きの大会として保存する形（設計書 段階4-3 第6節・段階4-4 第6節）。results：この大会のハンドの結果（運と実力）。
// hand：ハンドの途中であなたがもう行動していれば { actions（このハンドのあなたの行動の列）, verdicts（済んだ判断）, coach（指南の状態）, check }、
// そうでなければ null。済んだ判断は hand に入れ、大会の判断（verdicts）には入れない（読み戻したとき二重に数えない）
export function mainSnapshot(session, results = []) {
  const h = session.hand;
  const actions = h && h.street !== 'complete' ? session.trail.filter((st) => st.seat === HERO_SEAT).map((st) => st.action) : [];
  const handNo = session.tournament.handNumber + 1;
  const current = actions.length ? session.decisions.filter((d) => d.handNo === handNo) : [];
  return {
    seed: session.seed, coachMode: session.main.coachMode, field: session.main.field,
    verdicts: session.decisions.filter((d) => !current.includes(d)).map(({ situation, loss, correct }) => ({ situation, loss, correct })),
    results: results.map(({ r, e }) => ({ r, e })),
    hand: actions.length ? { actions, verdicts: current, coach: session.coach, check: handCheck(h) } : null,
  };
}

// 保存した形から、次のハンドを配る前の対局に戻す。coach：記録の指南の状態（自動のときだけ使う）
export const restoreMainSession = (snap, { coach = null } = {}) => withField(base(snap.seed, snap.coachMode, coach, snap.verdicts.map((v) => ({ ...v }))), snap.field);

// ハンドの途中で閉じた続き（mainSnapshot の hand）：restoreMainSession で戻した対局でそのハンドを配り直し、CPUの行動と保存したあなたの行動を
// 順にたどり直して、閉じたときの場面にする。済んだ判断と指南の状態は保存したものを使う（採点し直さない）。
// 場面が保存したときと合わなければ null（そのハンドは初めからにする）
export function resumeHand(session, saved) {
  let s = dealMain(session);
  let k = 0;
  try {
    while (k < saved.actions.length) {
      if (s.hand.street === 'complete') return null;
      s = s.hand.toAct === HERO_SEAT ? act(s, saved.actions[k++]) : cpuAct(s);
    }
  } catch {
    return null;
  }
  if (handCheck(s.hand) !== saved.check) return null;
  return { ...s, decisions: [...s.decisions, ...saved.verdicts.map((v) => ({ ...v }))], coach: structuredClone(saved.coach) };
}

// 卓の移動のお知らせの文。moves：rebalance の moves、field：動いたあとの大会、before：動く前のあなたの卓の番号
export function moveTexts(moves, field, before) {
  const name = (p) => `${field.people[p].name}さん`;
  const no = (t) => `卓${t + 1}`;
  const here = field.people[0].stack > 0 ? field.people[0].table : null;
  if (here === null) return [];
  const out = [];
  const final = moves.find((m) => m.kind === 'final');
  if (final) return [`決勝卓です（残り${field.tables[final.table].seats.filter((p) => p !== null).length}人）`];
  const me = moves.find((m) => m.person === 0);
  if (me) out.push(me.kind === 'break' ? `${no(me.from)}を崩して、あなたは${no(me.to)}に移りました` : `あなたは${no(me.to)}に移りました（人数をそろえるため）`);
  const broke = [...new Set(moves.filter((m) => m.kind === 'break' && m.to === here && m.person !== 0).map((m) => m.from))];
  for (const t of broke) out.push(`${no(t)}を崩して、${moves.filter((m) => m.kind === 'break' && m.from === t && m.to === here && m.person !== 0).map((m) => name(m.person)).join('・')}がこの卓に来ました`);
  for (const m of moves.filter((x) => x.kind === 'balance' && x.person !== 0)) {
    if (m.to === here) out.push(`${no(m.from)}から ${name(m.person)}がこの卓に来ました`);
    else if (m.from === before && !me) out.push(`${name(m.person)}が${no(m.to)}に移りました`);
  }
  return out;
}

// 終わった大会の結果（終わりの札）：{ place（あなたの順位）, share（賞金の割合。入賞でなければ0）, winner（優勝者の名前）,
//   hands（大会全体のハンド数）, heroHands（あなたが打ったハンド数）, total }
export function mainOutcome(field, heroHands = field.round) {
  const place = field.people[0].place;
  return {
    place, share: field.payouts[place - 1] ?? 0, winner: field.people.find((p) => p.place === 1)?.name ?? null,
    hands: field.round, heroHands, total: field.people.length,
  };
}

// 続きの大会の札の文：「卓3・残り23人・78ハンド目」（決勝卓なら「決勝卓」）
export function resumeLabel(field) {
  const where = field.final ? '決勝卓' : `卓${field.people[0].table + 1}`;
  return `${where}・残り${aliveTotal(field)}人・${field.round + 1}ハンド目`;
}
