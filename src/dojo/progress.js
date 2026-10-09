// 記録から読み取る進み具合（設計書 段階3 第3節）：章の開き方・手順の開き方・次にすること・段位・続きから。
import { CHAPTERS, PLAYABLE, previousPlayable, chapterLabel, PRACTICE_COUNT } from './chapters.js';
import { dueToday } from './reviews.js';
import { DAN_LABEL } from './ranks.js';

const chapterRec = (rec, id) => rec.chapters[id] ?? null;
export const isPassed = (rec, id) => !!chapterRec(rec, id)?.passedAt;

// 段位：章末試験に合格した章の数だけ10級から上がる（全9章で1級）。初段〜三段・達人は dojo/ranks.js・exam.js で決めた rec.dan（段階4-4）
export function rankOf(rec) {
  const passed = PLAYABLE.filter((id) => isPassed(rec, id)).length;
  const kyu = Math.max(1, 10 - passed);
  const dan = rec.dan?.level ?? 0;
  return { passed, kyu, dan, label: dan ? DAN_LABEL[dan] : `${kyu}級` };
}

// 章が開く条件：前の章に合格した、またはその章の記録がある（手をつけた章は、あとから前に章が増えても閉じない。
// 段階3では第4章の次が第7章だったので、第7章を始めていた記録は第5・6章に合格していなくても続けられる）
export function isOpen(rec, id) {
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c?.playable) return false;
  const prev = previousPlayable(id);
  return prev === null || isPassed(rec, prev) || !!chapterRec(rec, id);
}

// 章ごとの状態。steps：講義・練習・対局・試験それぞれの { open, done, note }、next：次にすること
export function chapterState(rec, id) {
  const meta = CHAPTERS.find((x) => x.id === id);
  if (!meta) throw new Error(`知らない章: ${id}`);
  if (!meta.playable) return { id, meta, status: 'soon', open: false, steps: null, next: null };
  const open = isOpen(rec, id);
  const c = chapterRec(rec, id);
  const passed = isPassed(rec, id);
  const lectureDone = !!c?.lectureDone;
  const practiceDone = !!c?.practiceDone;
  const gamePassed = !!c?.gamePassed;
  const steps = {
    lecture: { open, done: lectureDone, note: lectureDone ? '読んだ' : c?.lecturePage ? `${c.lecturePage + 1}ページ目から` : '' },
    practice: { open: open && lectureDone, done: practiceDone, note: c?.practice ? `${c.practice.index} / ${PRACTICE_COUNT}` : practiceDone ? '解いた' : '' },
    game: { open: open && practiceDone, done: gamePassed, note: gamePassed ? `合格（最高 ${Math.round((c.gameBest ?? 0) * 100)}%）` : c?.gameBest != null ? `最高 ${Math.round(c.gameBest * 100)}%` : '' },
    test: { open: open && gamePassed, done: passed, note: c?.test ? `${c.test.answers.length} / 20` : c?.testBest != null ? `最高 ${c.testBest}点` : '' },
  };
  let next = null;
  if (open) {
    if (!lectureDone) next = { kind: 'lecture', label: c?.lecturePage ? `講義の続き（${c.lecturePage + 1}ページ目から）` : '講義を読む' };
    else if (c?.practice) next = { kind: 'practice', label: `練習問題の続き（${c.practice.index + 1}問目から）` };
    else if (!practiceDone) next = { kind: 'practice', label: '練習問題を解く' };
    else if (!gamePassed) next = { kind: 'game', label: '指南つき対局に挑戦' };
    else if (c?.test) next = { kind: 'test', label: `章末試験の続き（${c.test.answers.length + 1}問目から）` };
    else if (!passed) next = { kind: 'test', label: '章末試験を受ける' };
    else next = { kind: 'practice', label: 'もう一度練習する' };
  }
  const status = !open ? 'locked' : passed ? 'passed' : c ? 'doing' : 'new';
  return { id, meta, status, open, steps, next };
}

// 続きから：最後にしていたことが途中ならその続き。終わっていればその章の次にすること（合格した章なら次の章）。
// 何もしていなければ序章の講義。today を渡したときは、今日の復習がなければ復習へは行かない
export function resumeTarget(rec, today = null) {
  const r = rec.resume;
  if (r?.kind === 'review' && (today === null || dueToday(rec.reviews, today).length > 0)) {
    return { kind: 'review', chapter: null, label: '今日の復習' };
  }
  if (r && r.kind !== 'review' && isOpen(rec, r.chapter)) {
    const st = chapterState(rec, r.chapter);
    const c = rec.chapters[r.chapter];
    const inProgress = { lecture: !c?.lectureDone, practice: !!c?.practice, game: !c?.gamePassed, test: !!c?.test }[r.kind];
    if (inProgress && st.steps[r.kind]?.open) {
      const step = { lecture: '講義', practice: '練習問題', game: '指南つき対局', test: '章末試験' }[r.kind];
      return { kind: r.kind, chapter: r.chapter, label: `${chapterLabel(r.chapter)}・${step}` };
    }
    if (st.status !== 'passed') return { kind: st.next.kind, chapter: r.chapter, label: `${chapterLabel(r.chapter)}・${st.next.label}` };
  }
  const first = PLAYABLE.find((id) => isOpen(rec, id) && !isPassed(rec, id));
  if (!first) return null;
  const st = chapterState(rec, first);
  return { kind: st.next.kind, chapter: first, label: `${chapterLabel(first)}・${st.next.label}`, fresh: !Object.keys(rec.chapters).length };
}

// いまの章（タイトルの札に出す）：合格していない最初の開いた章。全部合格なら最後の章
export function currentChapter(rec) {
  return PLAYABLE.find((id) => isOpen(rec, id) && !isPassed(rec, id)) ?? PLAYABLE[PLAYABLE.length - 1];
}
