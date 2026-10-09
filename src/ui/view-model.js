// 画面に出す中身をまとめる（DOMを触らない純粋な関数）。
import { evaluate, describe } from '../engine/evaluator.js';
import { legalActions } from '../engine/hand.js';
import { rankOf, suitOf, RANK_CHARS } from '../engine/cards.js';
import { blindsFor, handsToNextLevel, levelIndex, aliveSeats } from '../engine/tournament.js';
import { fieldSummary } from '../engine/field.js';
import { HERO_SEAT } from '../game/session.js';
import { presetTargets, potTotal } from './presets.js';
import { fmt } from './format.js';
import { drawOuts } from '../calc/odds.js';
import { showdownLit } from './best-five.js';

const ACTION_LABEL = { fold: '降り', check: 'チェック', call: 'コール' };
const STREET_LABEL = { preflop: 'プリフロップ', flop: 'フロップ', turn: 'ターン', river: 'リバー' };

export function startingHandLabel(c1, c2) {
  let a = rankOf(c1);
  let b = rankOf(c2);
  if (b > a) [a, b] = [b, a];
  const name = RANK_CHARS[a] + RANK_CHARS[b];
  if (a === b) return `ポケットペア（${name}）`;
  return suitOf(c1) === suitOf(c2) ? `同じマーク（${name}s）` : `違うマーク（${name}o）`;
}

// 手元に出す手の状態。フロップ以降は役の名前に、ドローがあれば「・フラッシュドロー」などを足す
export function handTitle(hole, board) {
  if (board.length < 3) return startingHandLabel(hole[0], hole[1]);
  return [describe(evaluate([...hole, ...board])), ...drawOuts(hole, board).kinds].join('・');
}

function actionText(e) {
  if (e.type === 'raise') return e.allIn ? `オールイン ${fmt(e.to)}` : `${e.kind === 'bet' ? 'ベット' : 'レイズ'} ${fmt(e.to)}`;
  if (e.type === 'call') return e.allIn ? `オールイン（コール ${fmt(e.amount)}）` : `コール ${fmt(e.amount)}`;
  if (e.type === 'sb') return `SB ${fmt(e.amount)}`;
  if (e.type === 'bb') return `BB ${fmt(e.amount)}`;
  if (e.type === 'ante') return `アンティ ${fmt(e.amount)}`;
  return ACTION_LABEL[e.type] ?? e.type;
}

// この通りでの最後の行動（席の横のリボン用）
function lastAction(hand, seat) {
  for (let k = hand.log.length - 1; k >= 0; k--) {
    const e = hand.log[k];
    if (e.street !== hand.street) break;
    if (e.seat !== seat) continue;
    if (e.type === 'sb' || e.type === 'bb' || e.type === 'ante') return null;
    if (e.type === 'raise') return e.allIn ? 'オールイン' : `${e.kind === 'bet' ? 'ベット' : 'レイズ'} ${fmt(e.to)}`;
    if (e.type === 'call') return e.allIn ? 'オールイン' : 'コール';
    return ACTION_LABEL[e.type];
  }
  return null;
}

export function buildView(session) {
  const t = session.tournament;
  const h = session.hand;
  const n = t.seatCount;
  const complete = h?.street === 'complete';
  // 勝負になったハンドの光らせ方（役を作った5枚。設計書 段階5-3 第4-1節）。ほかは null
  const lit = complete ? showdownLit(h) : null;

  const seats = t.players.map((p, i) => {
    const hs = h?.seats[i];
    const inHand = !!hs?.inHand;
    const live = inHand && !hs.folded;
    let cards = 'none';
    if (live) cards = i === HERO_SEAT || (complete && h.result.showdown) ? 'up' : 'back';
    return {
      seat: i,
      disp: (i - HERO_SEAT + n) % n,
      empty: !!p.empty, // 多卓の大会の空いた席（描かない）
      name: p.name,
      avatar: p.avatar,
      stack: hs ? hs.stack : p.stack,
      out: h ? !inHand : p.stack === 0,
      folded: inHand && hs.folded,
      allIn: live && hs.allIn,
      badge: h ? (i === h.bbSeat ? 'BB' : i === h.sbSeat ? 'SB' : i === h.button ? 'BTN' : null) : null,
      isActor: h ? h.toAct === i : false,
      bet: hs ? hs.bet : 0,
      action: h && !complete ? lastAction(h, i) : null,
      cards,
      hole: cards === 'up' ? hs.hole : null,
      lit: cards === 'up' && lit ? (lit.hole[i] ?? [false, false]) : null, // 見せた札ごとに、役に使ったか（使わない札は暗くする）
      handName: complete && h.result.showdown && live ? describe(h.result.scores[i]) : null,
      won: complete ? h.result.won[i] : 0,
      place: p.place,
    };
  });

  const lv = h ? h.blinds : blindsFor(t);
  // 本番大会（多卓の大会）では、残り・入賞・平均は大会全体の数字
  const fs = session.main ? fieldSummary(session.main.field) : null;
  const alive = fs ? fs.alive : h ? h.seats.filter((s) => s.inHand).length : aliveSeats(t).length;
  // 平均：全員の持ち点の合計（大会の間は変わらない）÷ 残り人数。第5・6章のように開始の持ち点が人ごとに違っても合う
  const chips = t.players.reduce((a, p) => a + p.stack, 0);
  const hud = {
    level: levelIndex(t) + 1, sb: lv.sb, bb: lv.bb, ante: lv.ante,
    nextIn: handsToNextLevel(t), alive, total: fs ? fs.total : n, paid: fs ? fs.paid : t.payouts.length,
    avg: fs ? fs.avg : Math.round(chips / Math.max(alive, 1)), handNo: t.handNumber + 1,
  };

  // 終わったハンドのポットは勝った人へ流れたので出さない（設計書 段階5-3 第4-1節）
  const pot = h && !complete ? potTotal(h) : 0;
  const collected = h && !complete ? pot - h.seats.reduce((a, s) => a + s.bet, 0) : 0;

  const me = h?.seats[HERO_SEAT];
  let hero = null;
  if (me?.hole) {
    const title = me.folded ? startingHandLabel(me.hole[0], me.hole[1]) : handTitle(me.hole, h.board);
    hero = { hole: me.hole, title, folded: me.folded, lit: lit && !me.folded ? (lit.hole[HERO_SEAT] ?? [false, false]) : null };
  }

  let controls = null;
  if (h && h.toAct === HERO_SEAT) {
    const legal = legalActions(h);
    controls = {
      toCall: legal.toCall, canCheck: legal.canCheck, raise: legal.raise,
      isBet: h.currentBet === 0, presets: presetTargets(h, HERO_SEAT),
      stack: me.stack, bb: h.blinds.bb, allInCall: legal.toCall > 0 && legal.toCall >= me.stack,
    };
  }

  let result = null;
  if (complete) {
    result = {
      showdown: h.result.showdown,
      winners: h.result.winners.map((i) => ({
        seat: i, name: t.players[i].name, amount: h.result.won[i],
        hand: h.result.showdown ? describe(h.result.scores[i]) : null,
      })),
    };
  }

  const logLines = [];
  if (h) {
    let street = null;
    for (const e of h.log) {
      if (e.street !== street) { street = e.street; logLines.push(`― ${STREET_LABEL[street]} ―`); }
      logLines.push(`${t.players[e.seat].name}：${actionText(e)}`);
    }
  }

  const standings = t.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.empty)
    .map(({ p, i }) => ({ name: p.name, avatar: p.avatar, stack: seats[i].stack, place: p.place, isHero: i === HERO_SEAT }))
    .sort((a, b) => (a.place ?? 0) - (b.place ?? 0) || b.stack - a.stack);

  const buttonDisp = h ? (h.button - HERO_SEAT + n) % n : null;
  // 大会の状況のタブ（本番大会だけ）：大会全体の数字と卓の人数
  const field = fs && { ...fs, avgBB: fs.avg / lv.bb };
  return {
    seats, board: h ? h.board : [], boardLit: lit ? lit.board : null, button: h ? h.button : null, buttonDisp, pot, collected, hud, hero, controls, result, logLines, standings, field,
  };
}
