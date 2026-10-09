// 相手の手の一覧（カード一覧）。推定した相手の手を種類に分け、種類ごとに「よくある度」と1対1の勝つ見込みを出す。
import { COMBO_COUNT, COMBO_A, COMBO_B, COMBO_CLASS } from '../calc/combos.js';
import { groupEquity } from '../calc/equity.js';
import { handClass } from './features.js';

// プリフロップの種類（升目 id から）
const PRE_GROUPS = ['高いペア（TT以上）', '低いペア（22〜99）', 'Aと絵札など（両方T以上）', 'Aを含む手', 'その他'];
function preGroup(cls) {
  const row = Math.floor(cls / 13);
  const col = cls % 13;
  if (row === col) return row <= 4 ? 0 : 1; // 行 0=A … 4=T
  const hiIdx = Math.min(row, col);
  const loIdx = Math.max(row, col);
  if (loIdx <= 4) return 2;
  if (hiIdx === 0) return 3;
  return 4;
}
const POST_NAMES = { strong: 'ツーペア以上の強い手', good: 'トップペア・オーバーペア', weak: 'それより下のペア', draw: 'ドロー（あと1枚で完成）', air: '何もない（はったり）' };
const POST_ORDER = ['strong', 'good', 'weak', 'draw', 'air'];

export function tagOf(eq) {
  if (eq >= 0.6) return { tag: 'good', text: '有利' };
  if (eq >= 0.45) return { tag: 'even', text: '五分' };
  if (eq >= 0.35) return { tag: 'mid', text: 'やや不利' };
  return { tag: 'bad', text: '不利' };
}

export function oppView(analysis, k) {
  const { model, board } = analysis;
  const w = analysis.ranges[k];
  const groupOf = new Uint8Array(COMBO_COUNT);
  const names = board.length === 0 ? PRE_GROUPS : POST_ORDER.map((c) => POST_NAMES[c]);
  const hc = [0, 0];
  for (let i = 0; i < COMBO_COUNT; i++) {
    if (!(w[i] > 0)) continue;
    if (board.length === 0) groupOf[i] = preGroup(COMBO_CLASS[i]);
    else {
      hc[0] = COMBO_A[i];
      hc[1] = COMBO_B[i];
      groupOf[i] = POST_ORDER.indexOf(handClass(hc, board));
    }
  }
  const eqs = groupEquity(model, k, groupOf, names.length);
  // 例のカード：そのグループで一番重い組合せ
  const example = names.map(() => -1);
  for (let i = 0; i < COMBO_COUNT; i++) {
    if (!(w[i] > 0)) continue;
    const g = groupOf[i];
    if (example[g] < 0 || w[i] > w[example[g]]) example[g] = i;
  }
  const items = names
    .map((name, g) => ({ name, share: eqs[g].share, eq: eqs[g].eq, cards: example[g] >= 0 ? [COMBO_A[example[g]], COMBO_B[example[g]]] : null }))
    .filter((it) => it.share >= 0.01 && it.eq !== null)
    .sort((a, b) => b.share - a.share)
    .map((it) => ({ ...it, often: Math.max(1, Math.round(it.share * 10)), ...tagOf(it.eq) }));
  const combos = w.reduce((a, x) => a + (x > 0 ? 1 : 0), 0);
  const total = w.reduce((a, x) => a + x, 0);
  const effective = total > 0 ? Math.round((total * total) / w.reduce((a, x) => a + x * x, 0)) : 0;
  return { items, combos, effective };
}
