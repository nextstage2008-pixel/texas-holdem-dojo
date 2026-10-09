// 1ハンドの進行（TDAルール）。状態は書き換えず、行動のたびに新しい状態を返す。
import { evaluate } from './evaluator.js';
import { buildPots, awardPots } from './pots.js';

const STREETS = ['preflop', 'flop', 'turn', 'river'];

const live = (s) => s.inHand && !s.folded;      // まだ勝負に残っている
const canAct = (s) => live(s) && !s.allIn;      // まだ行動できる

// from の次（時計回り）から、条件を満たす最初の席。一周して見つからなければ null。
function findNext(st, from, pred) {
  const n = st.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (pred(st.seats[i], i)) return i;
  }
  return null;
}

function put(st, i, amount) {
  const s = st.seats[i];
  const a = Math.min(amount, s.stack);
  s.stack -= a;
  s.bet += a;
  s.committed += a;
  if (s.stack === 0) s.allIn = true;
  return a;
}

// まだ行動が要るか。額が足りない人は必ず要る。
// ただし、ほかに行動できる人がおらず、残っている相手の誰にも額で上回られていないなら要らない
// （例：BBがSBより少ない額でオールイン。SBが何を選んでも結果は変わらず、降りると損だけする）。
function needsAction(st, s) {
  if (!canAct(s)) return false;
  const others = st.seats.filter((o) => o !== s && live(o));
  const othersCanAct = others.some(canAct);
  if (!othersCanAct && others.every((o) => o.bet <= s.bet)) return false;
  if (s.bet < st.currentBet) return true;
  if (s.actedLevel !== null) return false;
  return othersCanAct;
}

function nextActor(st, from) {
  return findNext(st, from, (s) => needsAction(st, s));
}

// tour：大会の情報（賞金の割合 payouts。コーチとCPUが賞金の見込みを計算するのに使う。省くと null）
export function createHand({ stacks, button, sbSeat, bbSeat, blinds, deck, tour = null }) {
  const n = stacks.length;
  const st = {
    seats: stacks.map((stack) => ({
      stack, bet: 0, committed: 0, folded: false, allIn: false,
      inHand: stack > 0, hole: null, actedLevel: null,
    })),
    button, sbSeat, bbSeat, blinds,
    street: 'preflop', board: [], deck: deck.slice(),
    currentBet: 0, minRaise: blinds.bb,
    toAct: null, deadMoney: 0, log: [], result: null, tour,
  };
  // BB：ブラインドを先に払い、残りでアンティ（TDA）。アンティは死に金としてメインポットへ。
  const bbPaid = put(st, bbSeat, blinds.bb);
  st.log.push({ street: 'preflop', seat: bbSeat, type: 'bb', amount: bbPaid });
  const bb = st.seats[bbSeat];
  const ante = Math.min(blinds.ante, bb.stack);
  bb.stack -= ante;
  if (bb.stack === 0) bb.allIn = true;
  st.deadMoney = ante;
  if (ante > 0) st.log.push({ street: 'preflop', seat: bbSeat, type: 'ante', amount: ante });
  if (sbSeat !== null) {
    const sbPaid = put(st, sbSeat, blinds.sb);
    st.log.push({ street: 'preflop', seat: sbSeat, type: 'sb', amount: sbPaid });
  }
  // BBが満額に足りなくても、コールすべき額は満額のBB（TDA）
  st.currentBet = blinds.bb;
  st.minRaise = blinds.bb;
  // ボタンの左隣から1枚ずつ2周配る
  for (let round = 0; round < 2; round++) {
    for (let k = 1; k <= n; k++) {
      const i = (button + k) % n;
      const s = st.seats[i];
      if (!s.inHand) continue;
      if (s.hole === null) s.hole = [];
      s.hole.push(st.deck.shift());
    }
  }
  st.toAct = nextActor(st, bbSeat);
  if (st.toAct === null) return endStreet(st);
  return st;
}

export function legalActions(st) {
  const p = st.toAct;
  if (p === null) return null;
  const s = st.seats[p];
  const toCall = Math.max(0, Math.min(st.currentBet - s.bet, s.stack));
  const maxTo = s.bet + s.stack;
  const othersCanAct = st.seats.some((o, i) => i !== p && canAct(o));
  // 再レイズの権利は、まだ行動していないか、最後に合わせた額から1回分のレイズ以上増えたときだけ（TDA）。
  // 足りないオールインが重なって1回分に達した場合も、この差で自然に権利が戻る。
  const reopened = s.actedLevel === null || st.currentBet - s.actedLevel >= st.minRaise;
  let raise = null;
  if (reopened && othersCanAct && maxTo > st.currentBet) {
    const minTo = st.currentBet + st.minRaise;
    raise = { min: Math.min(minTo, maxTo), max: maxTo };
  }
  return { seat: p, toCall, canCheck: s.bet >= st.currentBet, raise };
}

export function applyAction(state, action) {
  const legal = legalActions(state);
  if (!legal) throw new Error('行動できる人がいない');
  const st = structuredClone(state);
  const p = st.toAct;
  const s = st.seats[p];
  const entry = { street: st.street, seat: p, type: action.type };
  switch (action.type) {
    case 'fold':
      s.folded = true;
      break;
    case 'check':
      if (!legal.canCheck) throw new Error('チェックできない（賭けが出ている）');
      break;
    case 'call':
      if (legal.toCall <= 0) throw new Error('コールする額がない');
      entry.amount = put(st, p, legal.toCall);
      entry.allIn = s.allIn;
      break;
    case 'raise': {
      const r = legal.raise;
      if (!r) throw new Error('レイズできない');
      const to = action.to;
      if (!Number.isInteger(to) || to > r.max || (to < r.min && to !== r.max)) {
        throw new Error(`レイズ額が不正: ${to}（${r.min}〜${r.max}）`);
      }
      entry.kind = st.currentBet === 0 ? 'bet' : 'raise';
      put(st, p, to - s.bet);
      // 1回分（直前のフルレイズの増分）以上のレイズなら、それが次の最小の増分になる。
      // 足りないオールインは最小の増分を変えない。
      const increment = to - st.currentBet;
      if (increment >= st.minRaise) st.minRaise = increment;
      st.currentBet = to;
      entry.to = to;
      entry.allIn = s.allIn;
      break;
    }
    default:
      throw new Error(`知らない行動: ${action.type}`);
  }
  s.actedLevel = st.currentBet; // この人が最後に合わせた（または付けた）額
  st.log.push(entry);
  return proceed(st, p);
}

function proceed(st, p) {
  if (st.seats.filter(live).length === 1) return finish(st);
  const next = nextActor(st, p);
  if (next !== null) { st.toAct = next; return st; }
  return endStreet(st);
}

// 通りを締めて次へ進む。行動できる人が2人未満なら、リバーまで配って勝負する。
function endStreet(st) {
  for (const s of st.seats) { s.bet = 0; s.actedLevel = null; }
  st.currentBet = 0;
  st.minRaise = st.blinds.bb;
  const idx = STREETS.indexOf(st.street);
  if (idx === STREETS.length - 1) return finish(st);
  st.street = STREETS[idx + 1];
  st.deck.shift(); // バーン
  const count = st.street === 'flop' ? 3 : 1;
  for (let k = 0; k < count; k++) st.board.push(st.deck.shift());
  const first = nextActor(st, st.button);
  if (first === null) return endStreet(st);
  st.toAct = first;
  return st;
}

// ハンドを終える：コールされなかった分を返し、ポットを分けて配る。
function finish(st) {
  st.toAct = null;
  for (const s of st.seats) s.bet = 0;
  // 誰にもコールされなかった分は本人に返す
  const order = st.seats.map((_, i) => i).sort((a, b) => st.seats[b].committed - st.seats[a].committed);
  const [top, second] = order;
  const diff = st.seats[top].committed - (second === undefined ? 0 : st.seats[second].committed);
  if (diff > 0) {
    st.seats[top].committed -= diff;
    st.seats[top].stack += diff;
  }
  const committed = st.seats.map((s) => s.committed);
  const folded = st.seats.map((s) => !live(s));
  const pots = buildPots(committed, folded, st.deadMoney);
  const liveSeats = st.seats.map((_, i) => i).filter((i) => live(st.seats[i]));
  const scores = st.seats.map(() => null);
  const showdown = liveSeats.length > 1;
  if (showdown) {
    for (const i of liveSeats) scores[i] = evaluate([...st.seats[i].hole, ...st.board]);
  } else {
    scores[liveSeats[0]] = 0;
  }
  const won = awardPots(pots, scores, st.button, st.seats.length);
  won.forEach((w, i) => { st.seats[i].stack += w; });
  st.street = 'complete';
  st.result = {
    pots, won, scores, showdown,
    winners: won.map((w, i) => (w > 0 ? i : -1)).filter((i) => i >= 0),
  };
  return st;
}
