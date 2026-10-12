// 卓で体験（チュートリアルのレッスン）の終えた印（設計書 段階5-4 第5-3節・2026-10-12 道場の段に）。画面にも保存先にも触れない。
// 記録の settings.tutorial に { done: [レッスンの id…] } で残す。形は変えない（読むたびにこの直し方を通す）
import { LESSONS } from '../tutorial/lessons.js';

const IDS = LESSONS.map((l) => l.id);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// 終えたレッスンの id（レッスンの順）。ない・おかしい値は「どれも未」
export function tutorialDone(settings) {
  const t = isObj(settings) && isObj(settings.tutorial) ? settings.tutorial : {};
  const done = Array.isArray(t.done) ? t.done : [];
  return IDS.filter((id) => done.includes(id));
}

// レッスンの1つを終えた印を足した新しい記録（知らない id は足さない）
export function withTutorialDone(rec, id) {
  if (!IDS.includes(id)) return rec;
  const done = tutorialDone(rec.settings);
  if (done.includes(id)) return rec;
  return { ...rec, settings: { ...rec.settings, tutorial: { done: IDS.filter((x) => x === id || done.includes(x)) } } };
}
