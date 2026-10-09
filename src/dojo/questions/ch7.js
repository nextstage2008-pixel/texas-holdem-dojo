// 第7章の問題：この人はどのタイプ？（参加率・レイズ率から）／この人にはどう攻める？
// 参加率・レイズ率の目安は CPU の打ち方（coach/policy.js）の目安と同じ（全体設計 第3-3節。policy のテストで±3%以内を確かめている）。
import { TYPES } from '../../coach/policy.js';
import { pick, withChoices } from './util.js';

export const TYPE_STATS = {
  tight: { vpip: 12, pfr: 6, why: '参加が少なく、レイズも少ない' },
  station: { vpip: 45, pfr: 8, why: '参加がとても多いのに、レイズはほとんどしない' },
  aggro: { vpip: 40, pfr: 30, why: '参加が多く、そのほとんどがレイズ' },
  pro: { vpip: 22, pfr: 18, why: '参加はほどほどで、参加するときはレイズが多い' },
};
const KEYS = Object.keys(TYPE_STATS);
export const typeName = (k) => TYPES[k].name;

export function typeGuess(rng) {
  const k = pick(rng, KEYS);
  const s = TYPE_STATS[k];
  const vpip = s.vpip + Math.round((rng() - 0.5) * 6);
  const pfr = Math.min(vpip - 1, s.pfr + Math.round((rng() - 0.5) * 4));
  const hands = 100 + 20 * Math.floor(rng() * 11);
  return {
    prompt: `この人を${hands}ハンド見ました。参加率 ${vpip}%・レイズ率 ${pfr}%。どのタイプ？`,
    scene: { board: [], hole: null, others: [], pills: [`参加率 ${vpip}%`, `レイズ率 ${pfr}%`, `${hands}ハンド`] },
    ...withChoices(rng, typeName(k), [], { fixed: KEYS.map(typeName) }),
    explain: [
      `${s.why} → ${typeName(k)}。`,
      `目安：${KEYS.map((x) => `${typeName(x)} ${TYPE_STATS[x].vpip}%・${TYPE_STATS[x].pfr}%`).join('／')}（参加率・レイズ率）`,
    ],
    calc: null,
  };
}

export const COUNTER = {
  tight: 'ブラインドをよく盗み、レイズされたら強い手を警戒して降りる',
  station: 'はったりは控え、強い手で大きめに賭けて取る',
  aggro: '強い手で待ち構え、相手のレイズにはコールややり返しで応じる',
  pro: '基本どおりに打ち、無理な勝負を避ける',
};
const COUNTER_WHY = {
  tight: '堅い人は強い手でしか参加しないので、降りやすい場面（ブラインド）は攻め、相手が強気なら素直に引く。',
  station: 'コールしすぎる人ははったりに降りてくれないが、弱い手でもついてくるので、強い手で大きく取る。',
  aggro: '荒い人は弱い手でもレイズするので、強い手で待てば相手の賭けで大きく取れる。',
  pro: '上級者には決まった弱点が少ないので、基本どおりに打つのが一番。',
};

export function counter(rng) {
  const k = pick(rng, KEYS);
  const s = TYPE_STATS[k];
  return {
    prompt: `相手は「${typeName(k)}」（参加率 約${s.vpip}%・レイズ率 約${s.pfr}%）。どう攻める？`,
    scene: { board: [], hole: null, others: [], pills: [`${typeName(k)}`, `参加率 約${s.vpip}%`, `レイズ率 約${s.pfr}%`] },
    ...withChoices(rng, COUNTER[k], KEYS.filter((x) => x !== k).map((x) => COUNTER[x])),
    explain: [COUNTER_WHY[k]],
    calc: null,
  };
}
