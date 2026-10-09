// 場面の分け方（指南の段階と成績は場面ごとに持つ。設計書 第5-3・6-2節）。
//   バブル：入賞まであと1人（残り人数＝入賞人数＋1）
//   オールイン判断：持ち点15BB以下、またはコールするとオールインになる
//   参加判断：プリフロップ／ドロー：フロップ以降でドローを持つ／ベット判断：それ以外
import { legalActions } from '../engine/hand.js';
import { handClass } from './features.js';

export const SITUATION_LABEL = { entry: '参加判断', draw: 'ドロー', bet: 'ベット判断', allin: 'オールイン判断', bubble: 'バブル' };
export const SITUATIONS = Object.keys(SITUATION_LABEL);

export function situationOf(hand, seat, { alive, paid }) {
  if (alive === paid + 1) return 'bubble';
  const s = hand.seats[seat];
  const legal = legalActions(hand);
  if ((s.stack + s.bet) / hand.blinds.bb <= 15 || legal.toCall >= s.stack) return 'allin';
  if (hand.street === 'preflop') return 'entry';
  return handClass(s.hole, hand.board) === 'draw' ? 'draw' : 'bet';
}
