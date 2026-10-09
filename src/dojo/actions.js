// 記録を進める操作。どれも記録を書き換えず、新しい記録を返す（保存は画面の側がする）。
import { emptyChapter } from './save.js';
import { PRACTICE_COUNT, PLAYABLE } from './chapters.js';
import { chapterState, rankOf } from './progress.js';
import { addMistake, answerReview } from './reviews.js';
import { judgeGame } from './chapter-game.js';
import { validateName } from './name.js';
import { addDecisions, addHand, addTournament, eventOf } from './stats.js';
import { addRecent, judgeDan, MASTER, DAN_LABEL } from './ranks.js';
import { canTakeExam, newAttempt, addExamTournament, titlesAfter } from './exam.js';

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

// 復習で1問答えた
export function answerReviewQuestion(rec, q, correct, today) {
  return { ...rec, reviews: answerReview(rec.reviews, q, correct, today), resume: { kind: 'review', chapter: null } };
}

// 対局の途中経過（1ハンドごと）。tally：chapter-game.js の tallyOf の結果
export function recordGameHand(rec, id, tally, coach) {
  return { ...rec, pendingGame: { chapter: id, ...tally }, coach, resume: { kind: 'game', chapter: id } };
}

// 対局を終えた。返す値：{ record, passed, accuracy, enough }
export function finishGame(rec, id, tally, coach = rec.coach) {
  const j = judgeGame(tally);
  const next = withChapter(rec, id, (c) => ({
    ...c, gamePassed: c.gamePassed || j.passed, gameBest: j.enough ? Math.max(c.gameBest ?? 0, j.accuracy) : c.gameBest,
  }));
  return { record: { ...next, pendingGame: null, coach }, ...j };
}

// 起動時：途中で閉じた対局があれば判定する。返す値：{ record, settled（{ chapter, passed, accuracy, enough } か null）}
export function settlePendingGame(rec) {
  const g = rec.pendingGame;
  if (!g) return { record: rec, settled: null };
  const { chapter, ...tally } = g;
  const r = finishGame(rec, chapter, tally);
  return { record: r.record, settled: { chapter, passed: r.passed, accuracy: r.accuracy, enough: r.enough } };
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

// 大会が終わった（成績が1件残る）：記録して段位を判定する。返す値：{ record, promoted（ranks.js の judgeDan と同じ）}
export function endTournament(rec, event, today) {
  return judgeDan(recordTournament(rec, event), today);
}

// 最終試験（設計書 段階4-4 第4節）。受験を始める（途中があればそのまま）・試験の続きの大会を残す・やめる（なかったことにする）
export function startExam(rec) {
  if (!canTakeExam(rec)) throw new Error('最終試験は三段から受けられる');
  return rec.exam ? rec : { ...rec, exam: newAttempt() };
}
export const saveExamGame = (rec, snapshot) => ({ ...rec, exam: { ...(rec.exam ?? newAttempt()), game: snapshot } });
export const abandonExam = (rec) => ({ ...rec, exam: null });

// 試験の大会が終わった。verdicts：その大会の判断、place：順位、results：その大会のハンドの結果。
// 大会の成績に種類「最終試験」で1件残し、受験に判断を足す。100回に届いたら合否を決め、合格なら達人。称号を数える。
// 返す値：{ record, result（'continue'・'pass'・'fail'）, tally（exam.js の tallyExam）, promoted（達人か段位が上がったら { from, to, label }）}
export function finishExamTournament(rec, { verdicts, place, results, today }) {
  const r = addExamTournament(rec.exam ?? newAttempt(), verdicts, place);
  const judged = r.result !== 'continue';
  const event = eventOf({ date: today, kind: 'exam', place, results, verdicts, exam: judged ? r.result : null });
  let next = { ...recordTournament(rec, event), exam: judged ? null : r.attempt };
  let promoted = null;
  if (judged) {
    const master = rec.dan.level >= MASTER;
    next = { ...next, titles: titlesAfter(rec.titles, { result: r.result, places: r.places, master }) };
    if (r.result === 'pass' && !master) {
      next = { ...next, dan: { level: MASTER, at: today } };
      promoted = { from: rec.dan.level, to: MASTER, label: DAN_LABEL[MASTER] };
    }
  }
  const dan = judgeDan(next, today);
  return { record: dan.record, result: r.result, tally: r.tally, promoted: promoted ?? dan.promoted };
}

// 本番大会の続き（game/main-event.js の mainSnapshot の形）を残す・消す（設計書 段階4-3 第6節）
export const saveMain = (rec, snapshot) => ({ ...rec, mainGame: snapshot });
export const clearMain = (rec) => ({ ...rec, mainGame: null });
export const goReview = (rec) => ({ ...rec, resume: { kind: 'review', chapter: null } });
