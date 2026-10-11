// 記録を進める操作。どれも記録を書き換えず、新しい記録を返す（保存は画面の側がする）。
import { emptyChapter } from './save.js';
import { PRACTICE_COUNT, PLAYABLE } from './chapters.js';
import { chapterState, rankOf, gradState } from './progress.js';
import { addMistake, answerReview } from './reviews.js';
import { validateName } from './name.js';
import { addDecisions, addHand, addTournament, eventOf } from './stats.js';
import { addRecent, judgeDan, MASTER, MASTER_WINS, DAN_LABEL } from './ranks.js';

function withChapter(rec, id, fn) {
  if (!PLAYABLE.includes(id)) throw new Error(`遊べない章: ${id}`);
  return { ...rec, chapters: { ...rec.chapters, [id]: fn({ ...(rec.chapters[id] ?? emptyChapter()) }) } };
}

function mustOpen(rec, id, step) {
  const st = chapterState(rec, id);
  if (!st.open || !st.steps[step].open) throw new Error(`${id} の ${step} はまだ開いていない`);
}

export function setName(rec, raw) {
  const v = validateName(raw);
  if (!v.ok) throw new Error(v.error);
  return { ...rec, profile: { ...rec.profile, name: v.name } };
}

// 講義のページをめくった（page は 0 から）。最後のページを開いたら読み終えた扱い
export function turnLecture(rec, id, page, pageCount) {
  mustOpen(rec, id, 'lecture');
  const p = Math.max(0, Math.min(page, pageCount - 1));
  const next = withChapter(rec, id, (c) => ({ ...c, lecturePage: p, lectureDone: c.lectureDone || p === pageCount - 1 }));
  return { ...next, resume: { kind: 'lecture', chapter: id } };
}

export function startPractice(rec, id, seed) {
  mustOpen(rec, id, 'practice');
  const next = withChapter(rec, id, (c) => ({ ...c, practice: { seed, index: 0, correct: 0 } }));
  return { ...next, resume: { kind: 'practice', chapter: id } };
}

// 練習で1問答えた。q：{ type, seed }。10問目を答えたら解き終えた扱い
export function answerPractice(rec, id, q, correct, today) {
  const cur = rec.chapters[id]?.practice;
  if (!cur) throw new Error('練習を始めていない');
  const index = cur.index + 1;
  const done = index >= PRACTICE_COUNT;
  let next = withChapter(rec, id, (c) => ({
    ...c, practice: done ? null : { ...cur, index, correct: cur.correct + (correct ? 1 : 0) }, practiceDone: c.practiceDone || done,
  }));
  next = {
    ...next,
    practiceStats: { answered: rec.practiceStats.answered + 1, correct: rec.practiceStats.correct + (correct ? 1 : 0) },
    reviews: correct ? rec.reviews : addMistake(rec.reviews, q, today),
    resume: { kind: 'practice', chapter: id },
  };
  return next;
}

export function startTest(rec, id, seed) {
  mustOpen(rec, id, 'test');
  const next = withChapter(rec, id, (c) => ({ ...c, test: { seed, answers: [] } }));
  return { ...next, resume: { kind: 'test', chapter: id } };
}

export function answerTest(rec, id, choice) {
  const cur = rec.chapters[id]?.test;
  if (!cur) throw new Error('試験を始めていない');
  return withChapter(rec, id, (c) => ({ ...c, test: { ...cur, answers: [...cur.answers, choice] } }));
}

// 試験を終えた。graded：quiz.js の gradeTest の結果。返す値：{ record, firstPass, rankBefore, rankAfter, opened（新しく開いた章か null）}
export function finishTest(rec, id, graded, today) {
  const before = rankOf(rec);
  const wasPassed = !!rec.chapters[id]?.passedAt;
  let reviews = rec.reviews;
  for (const r of graded.results) if (!r.correct) reviews = addMistake(reviews, r, today);
  let next = withChapter(rec, id, (c) => ({
    ...c, test: null, testBest: Math.max(c.testBest ?? 0, graded.score), passedAt: c.passedAt ?? (graded.passed ? today : null),
  }));
  next = { ...next, reviews, resume: null };
  const firstPass = graded.passed && !wasPassed;
  const k = PLAYABLE.indexOf(id);
  const opened = firstPass && k + 1 < PLAYABLE.length ? PLAYABLE[k + 1] : null;
  return { record: next, firstPass, rankBefore: before, rankAfter: rankOf(next), opened };
}

// 卒業試験（2026-10-12）：始める・1問答える・終える。間違えた問題は章末試験と同じく復習へ。合格した日は最初の日のまま、最高点は下がらない
export function startGraduation(rec, seed) {
  if (!gradState(rec).open) throw new Error('卒業試験はまだ開いていない');
  return { ...rec, graduation: { ...rec.graduation, test: { seed, answers: [] } }, resume: { kind: 'grad', chapter: null } };
}

export function answerGraduation(rec, choice) {
  const cur = rec.graduation.test;
  if (!cur) throw new Error('卒業試験を始めていない');
  return { ...rec, graduation: { ...rec.graduation, test: { ...cur, answers: [...cur.answers, choice] } } };
}

// graded：quiz.js の gradeTest の結果。返す値：{ record, firstPass }
export function finishGraduation(rec, graded, today) {
  const g = rec.graduation;
  let reviews = rec.reviews;
  for (const r of graded.results) if (!r.correct) reviews = addMistake(reviews, r, today);
  const graduation = { test: null, best: Math.max(g.best ?? 0, graded.score), passedAt: g.passedAt ?? (graded.passed ? today : null) };
  return { record: { ...rec, graduation, reviews, resume: null }, firstPass: graded.passed && !g.passedAt };
}

// 復習で1問答えた
export function answerReviewQuestion(rec, q, correct, today) {
  return { ...rec, reviews: answerReview(rec.reviews, q, correct, today), resume: { kind: 'review', chapter: null } };
}

export const setCoach = (rec, coach) => ({ ...rec, coach });

// ハンドごとの記録（設計書 段階4-2 第3節）：そのハンドで採点した判断（verdict の列）と、ハンドの結果（handResult の r・e）を統計に足す。
// ハンドの結果を出せなかったとき（result＝null）は、判断だけを足す。答えを見ずにした判断は段位の直近300回にも足す（段階4-4 第3節）
export function recordHand(rec, verdicts, result) {
  const stats = { ...addDecisions(rec.stats, verdicts), recent: addRecent(rec.stats.recent, verdicts) };
  return { ...rec, stats: result ? addHand(stats, result) : stats };
}
// 大会の記録：stats.js の eventOf で作った1件を足す
export const recordTournament = (rec, event) => ({ ...rec, stats: addTournament(rec.stats, event) });

// 大会が終わった（成績が1件残る）：記録して、本番大会なら優勝（1位）と入賞（6位以内）を数え、段位を判定する。
// 本番大会の優勝が10回に届いたら達人（初段〜三段の昇段より優先。すでに達人なら知らせない）。
// 返す値：{ record, promoted（ranks.js の judgeDan と同じ。達人なら { from, to: 4, label: '達人', wins }）}
const MAIN_PAID = 6;
export function endTournament(rec, event, today) {
  let next = recordTournament(rec, event);
  if (event.kind === 'main' && event.place !== null) {
    const t = next.mainTitles;
    next = { ...next, mainTitles: { wins: t.wins + (event.place === 1 ? 1 : 0), cashes: t.cashes + (event.place <= MAIN_PAID ? 1 : 0) } };
    if (next.mainTitles.wins >= MASTER_WINS && next.dan.level < MASTER) {
      return { record: { ...next, dan: { level: MASTER, at: today } }, promoted: { from: rec.dan.level, to: MASTER, label: DAN_LABEL[MASTER], wins: next.mainTitles.wins } };
    }
  }
  return judgeDan(next, today);
}

// 本番大会の続き（game/main-event.js の mainSnapshot の形）を残す・消す（設計書 段階4-3 第6節）
export const saveMain = (rec, snapshot) => ({ ...rec, mainGame: snapshot });
export const clearMain = (rec) => ({ ...rec, mainGame: null });
export const goReview = (rec) => ({ ...rec, resume: { kind: 'review', chapter: null } });
