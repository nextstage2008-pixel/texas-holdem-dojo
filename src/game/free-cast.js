// 自由対局の顔ぶれ（設計書 段階5-5 第3節）。画面に触れず、乱数は外から渡す（純粋性テストの対象）。
// 44人（いつもの8人と本番大会の36人）から8人：4つのタイプから1人ずつ → 残りの4人はタイプを問わず → 席の順もランダム
import { CAST } from './session.js';
import { MAIN_PEOPLE } from './names.js';
import { createRng } from '../engine/rng.js';

const TYPES = [['station', 'コールしすぎる人'], ['tight', '堅い人'], ['pro', '上級者'], ['aggro', '荒い人']];
export const FREE_POOL = [...CAST.slice(1), ...MAIN_PEOPLE];

// rng：0以上1未満を返す関数、pool：選ぶ元。返す値：9人（席0はあなた＝CAST[0]、席1〜8は選んだ8人を席の順に）。
// どれかのタイプの人がいなければ止める（freeCastFor が受け止めて、いつもの8人にする）
export function pickFreeCast(rng, pool = FREE_POOL) {
  const left = [...pool];
  const take = (list) => {
    const p = list[Math.floor(rng() * list.length)];
    left.splice(left.indexOf(p), 1);
    return p;
  };
  const picked = TYPES.map(([type, label]) => {
    const of = left.filter((p) => p.type === type);
    if (!of.length) throw new Error(`自由対局の顔ぶれ：${label}（${type}）の人がいない`);
    return take(of);
  });
  while (picked.length < 8) picked.push(take(left));
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return [CAST[0], ...picked];
}

// 大会の種から顔ぶれを作る（対局の乱数とは別の流れ）。選べなければ null（卓はいつもの8人で始める。設計書 第6節）
export function freeCastFor(seed, pool = FREE_POOL) {
  try {
    return pickFreeCast(createRng((seed * 7919 + 17) % 2147483647), pool);
  } catch (e) {
    console.error(e);
    return null;
  }
}
