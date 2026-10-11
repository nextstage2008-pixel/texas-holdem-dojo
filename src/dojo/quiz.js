// 出題の組み立て。練習10問・試験20問を、その章の型を均等に混ぜて「型と種」の列で返す（問題そのものは makeQuestion で作る）。
import { chapterOf, PRACTICE_COUNT, TEST_COUNT, TEST_PASS, PLAYABLE, GRAD } from './chapters.js';
import { createRng } from '../engine/rng.js';
import { shuffled } from './questions/util.js';

export function questionList(chapterId, seed, count) {
  const { types } = chapterOf(chapterId);
  if (!types.length) throw new Error(`問題のない章: ${chapterId}`);
  const rng = createRng(seed >>> 0);
  const order = shuffled(rng, Array.from({ length: count }, (_, i) => types[i % types.length]));
  return order.map((type) => ({ type, seed: Math.floor(rng() * 2147483647) }));
}

export const practiceList = (chapterId, seed) => questionList(chapterId, seed, PRACTICE_COUNT);
export const testList = (chapterId, seed) => questionList(chapterId, seed, TEST_COUNT);

// 卒業試験の出題（2026-10-12）：9章から3問ずつ（各章の中は型を均等に）、残りは9章から重ならない章を選んで1問ずつ。並びはランダム
export function graduationList(seed) {
  const rng = createRng(seed >>> 0);
  const per = PLAYABLE.flatMap((id) => {
    const types = shuffled(rng, chapterOf(id).types);
    return Array.from({ length: GRAD.perChapter }, (_, i) => types[i % types.length]);
  });
  const extra = shuffled(rng, PLAYABLE).slice(0, GRAD.count - per.length).map((id) => {
    const types = chapterOf(id).types;
    return types[Math.floor(rng() * types.length)];
  });
  return shuffled(rng, [...per, ...extra]).map((type) => ({ type, seed: Math.floor(rng() * 2147483647) }));
}

// 試験の採点。answers：選んだ番号の列、questions：makeQuestion の結果の列、pass：合格の数（章末試験は16・卒業試験は24）
export function gradeTest(questions, answers, pass = TEST_PASS) {
  if (questions.length !== answers.length) throw new Error('答えの数が合わない');
  const results = questions.map((q, i) => ({ type: q.type, seed: q.seed, correct: answers[i] === q.answer, chosen: answers[i] }));
  const score = results.filter((x) => x.correct).length;
  return { score, passed: score >= pass, results };
}
