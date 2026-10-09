// 多卓の大会（設計書 段階4-3 第3節）：45人の卓と席・ハンドの終わりのまとめ（飛んだ人の順位）・卓を崩す・人数をそろえる・決勝卓。
// CPU にも画面にも触らない（ほかの卓のハンドを打つのは game/main-event.js）。大会の様子は、そのまま JSON にできる形で持つ。
//   people[i]：{ id, name, type, avatar, stack, place, table, seat }（0番があなた）
//   tables[t]：{ seats（席ごとの people の番号か null）, positions（前のハンドのボタンとブラインド）, firstButton, broken }
// あなたのいる卓では、あなたはいつも席0にいる（卓に入るときに席の番号を回す。時計回りの並びは変わらない）。
import { shuffle } from './cards.js';
import { nextPositions } from './tournament.js';

export const MAIN = { tables: 5, seats: 9, startStack: 20000, handsPerLevel: 10, payouts: [0.34, 0.22, 0.15, 0.11, 0.1, 0.08] };
// 卓の空いた席（1卓の大会の形では、持ち点0の人として扱う）
export const EMPTY_SEAT = Object.freeze({ id: null, name: '', type: null, avatar: null, stack: 0, place: null, empty: true });

// ハンドごとの乱数の元：大会の種・ハンドの番号（終わったハンドの数）・卓の番号
export const roundSeed = (seed, round, table) => (Math.imul(Math.imul(seed ^ 0x51ed, 0x9e3779b1) + round, 0x85ebca6b) + Math.imul(table + 1, 0x27d4eb2f)) >>> 0;

export const aliveTotal = (field) => field.people.filter((p) => p.stack > 0).length;
export const aliveAt = (field, t) => field.tables[t].seats.filter((p) => p !== null && field.people[p].stack > 0).length;

// 席の番号を回す：席 k を席0にする。ボタンとブラインドの位置（席の番号）も同じだけ回す
export function rotateTable(table, k) {
  const n = table.seats.length;
  const r = (s) => (s === null ? null : (s - k + n) % n);
  const positions = table.positions && {
    button: r(table.positions.button), sbPos: r(table.positions.sbPos), sbSeat: r(table.positions.sbSeat), bbSeat: r(table.positions.bbSeat),
  };
  return { ...table, seats: table.seats.map((_, j) => table.seats[(j + k) % n]), positions, firstButton: r(table.firstButton) };
}

// 人の卓と席を、卓の席の並びに合わせ直す
export function reseat(field) {
  const people = field.people.map((p) => ({ ...p, table: null, seat: null }));
  field.tables.forEach((t, ti) => t.seats.forEach((p, s) => { if (p !== null) { people[p].table = ti; people[p].seat = s; } }));
  return { ...field, people };
}

// people：45人 [{ id, name, type, avatar }]（0番があなた、1〜8番はあなたの卓に座る人）、heroTable：あなたの卓（0〜4）、rng：席決め
// あなたの卓：あなた（席0）と1〜8番を席1〜8に混ぜて座らせる。ほかの卓：9番以降を混ぜて9人ずつ。ボタンの最初の席は卓ごとに乱数で
export function createField({
  people, heroTable, rng, tables = MAIN.tables, seats = MAIN.seats, startStack = MAIN.startStack, handsPerLevel = MAIN.handsPerLevel, payouts = MAIN.payouts,
}) {
  if (people.length !== tables * seats) throw new Error(`人数が卓の席の数と合わない: ${people.length}`);
  const mates = shuffle(Array.from({ length: seats - 1 }, (_, i) => i + 1), rng);
  const others = shuffle(Array.from({ length: people.length - seats }, (_, i) => i + seats), rng);
  const list = [];
  for (let t = 0; t < tables; t++) {
    const s = t === heroTable ? [0, ...mates] : others.splice(0, seats);
    list.push({ seats: s, positions: null, firstButton: Math.floor(rng() * seats), broken: false });
  }
  return reseat({
    round: 0, finished: false, final: false, startStack, handsPerLevel, payouts,
    people: people.map((p) => ({ id: p.id, name: p.name, type: p.type, avatar: p.avatar ?? null, stack: startStack, place: null, table: null, seat: null })),
    tables: list,
  });
}

// 卓 t を、1卓の大会（engine/tournament.js）の形にする。ハンド番号は大会のハンド数（どの卓も同じ）、aliveTotal は大会全体の残り人数
export function tableTournament(field, t) {
  const table = field.tables[t];
  return {
    seatCount: table.seats.length,
    players: table.seats.map((p) => (p === null ? { ...EMPTY_SEAT } : { ...field.people[p] })),
    startStack: field.startStack, handsPerLevel: field.handsPerLevel, payouts: field.payouts, startLevel: 0,
    handNumber: field.round, positions: table.positions, firstButton: table.firstButton, finished: field.finished,
    aliveTotal: aliveTotal(field),
  };
}

// 大会の状況の数字（画面の「大会の状況」）。who：誰から見た数字か（0＝あなた）
export function fieldSummary(field, who = 0) {
  const alive = aliveTotal(field);
  const me = field.people[who];
  const chips = field.people.reduce((a, p) => a + p.stack, 0);
  const rank = me.stack > 0 ? 1 + field.people.filter((p) => p.stack > me.stack).length : null;
  return {
    alive, total: field.people.length, paid: field.payouts.length, avg: Math.round(chips / Math.max(alive, 1)), rank,
    toPrize: Math.max(0, alive - field.payouts.length), counts: field.tables.map((t, i) => (t.broken ? null : aliveAt(field, i))),
    table: me.table, final: field.final, place: me.place,
  };
}

// ハンドの終わりのまとめ。played：このハンドを打った卓 [{ table, tournament（engine/tournament.js の finishHand のあと）}]。
// 持ち点とボタンの位置を大会に戻し、飛んだ人に大会全体の順位を付けて席から外す（同じハンドで飛んだ人は、初めの持ち点が
// 多い人ほど上。同じなら卓の番号・席の番号の小さい人が上）。残り1人になったら優勝（1位）で大会は終わり。
// 返す値：{ field, busted（このハンドで飛んだ人の番号）}
export function settleRound(field, played) {
  const people = field.people.map((p) => ({ ...p }));
  const tables = field.tables.map((t) => ({ ...t, seats: t.seats.slice() }));
  const out = [];
  for (const { table: ti, tournament } of played) {
    tables[ti].positions = tournament.positions;
    tables[ti].seats.forEach((p, s) => {
      if (p === null) return;
      const before = people[p].stack;
      people[p].stack = tournament.players[s].stack;
      if (before > 0 && people[p].stack === 0) out.push({ p, before, table: ti, seat: s });
    });
  }
  for (const b of out) tables[b.table].seats[b.seat] = null;
  const alive = people.filter((p) => p.stack > 0).length;
  out.sort((a, b) => b.before - a.before || a.table - b.table || a.seat - b.seat);
  out.forEach((b, k) => { people[b.p].place = alive + 1 + k; });
  let finished = field.finished;
  if (alive === 1) {
    people[people.findIndex((p) => p.stack > 0)].place = 1;
    finished = true;
  }
  return { field: reseat({ ...field, people, tables, round: field.round + 1, finished }), busted: out.map((b) => b.p) };
}

// 卓を崩す・人数をそろえる・決勝卓（ハンドの終わり、settleRound のあと）。rng：決勝卓の席とボタンの引き直し。
// 返す値：{ field, moves：[{ kind: 'break'|'balance', person, from, to } | { kind: 'final', table }] }
//   決勝卓：残り9人（卓の席の数）以下で、まだ決勝卓でないとき。あなたが残っていればあなたの卓、いなければ番号の一番小さい卓に集める
//   崩す：残りが「9×（卓の数−1）」以下なら、一番少ない卓（同じなら、あなたのいない卓・番号の大きい卓）を崩し、その人を
//         人数の少ない卓（同じなら番号の小さい卓）から順に、空いた席（番号の小さい順）に座らせる。足りなければくり返す
//   そろえる：卓の人数の差が2人以上なら、一番多い卓（同じなら番号の大きい卓）の「次にBBになる人」を一番少ない卓へ移す
export function rebalance(field, rng) {
  if (field.finished || field.final) return { field, moves: [] };
  const seats = field.tables[0].seats.length;
  const tables = field.tables.map((t) => ({ ...t, seats: t.seats.slice() }));
  const stackOf = (p) => field.people[p].stack;
  const count = (t) => tables[t].seats.filter((p) => p !== null && stackOf(p) > 0).length;
  const active = () => tables.map((_, i) => i).filter((i) => !tables[i].broken && count(i) > 0);
  const heroAt = (t) => tables[t].seats.includes(0);
  const alive = field.people.filter((p) => p.stack > 0).length;
  const moves = [];
  // 卓 to の番号の一番小さい空いた席に座らせる。あなたなら、その席を席0に回す
  const sit = (p, to) => {
    const s = tables[to].seats.indexOf(null);
    tables[to].seats[s] = p;
    if (p === 0) tables[to] = rotateTable(tables[to], s);
  };
  const done = () => ({ field: reseat({ ...field, tables }), moves });

  if (alive <= seats) {
    const live = active();
    const at = live.find((i) => heroAt(i)) ?? live[0];
    const who = shuffle(live.flatMap((i) => tables[i].seats.filter((p) => p !== null && stackOf(p) > 0)), rng);
    const order = shuffle(Array.from({ length: seats }, (_, i) => i), rng);
    tables.forEach((t, i) => { t.seats = t.seats.map(() => null); t.positions = null; t.broken = i !== at; });
    who.forEach((p, k) => { tables[at].seats[order[k]] = p; });
    const filled = tables[at].seats.map((p, s) => (p === null ? -1 : s)).filter((s) => s >= 0);
    tables[at].firstButton = filled[Math.floor(rng() * filled.length)];
    if (who.includes(0)) tables[at] = rotateTable(tables[at], tables[at].seats.indexOf(0));
    moves.push({ kind: 'final', table: at });
    return { field: reseat({ ...field, tables, final: true }), moves };
  }

  let live = active();
  while (live.length >= 2 && alive <= seats * (live.length - 1)) {
    const victim = live.reduce((v, i) => {
      if (v === null) return i;
      const d = count(i) - count(v);
      if (d !== 0) return d < 0 ? i : v;
      if (heroAt(i) !== heroAt(v)) return heroAt(v) ? i : v;
      return i > v ? i : v;
    }, null);
    const movers = tables[victim].seats.filter((p) => p !== null && stackOf(p) > 0);
    tables[victim].seats = tables[victim].seats.map(() => null);
    tables[victim].broken = true;
    tables[victim].positions = null;
    for (const p of movers) {
      const to = active().filter((i) => tables[i].seats.includes(null)).reduce((b, i) => (b === null || count(i) < count(b) ? i : b), null);
      sit(p, to);
      moves.push({ kind: 'break', person: p, from: victim, to });
    }
    live = active();
  }

  for (;;) {
    live = active();
    const from = live.reduce((b, i) => (b === null || count(i) >= count(b) ? i : b), null);
    const to = live.reduce((b, i) => (b === null || count(i) < count(b) ? i : b), null);
    if (count(from) - count(to) < 2) break;
    const t = tableTournament({ ...field, tables }, from);
    const s = nextPositions(t).bbSeat;
    const p = tables[from].seats[s];
    tables[from].seats[s] = null;
    sit(p, to);
    moves.push({ kind: 'balance', person: p, from, to });
  }
  return done();
}
