// 最終試験（設計書 段階4-4 第4節）：三段から受けられる。1回の受験で判断が100回に届くまで試験の大会を続け、
// 100回を超えた大会の終わりに、その受験の判断を全部まとめて合否を決める（正答率82%以上・平均損失0.40BB以下で合格＝達人）。
// 称号：合格した受験の大会と、達人になってから受けた試験の大会で、6位以内なら入賞・1位なら優勝の回数を増やす。
// どの操作も受け取ったものを書き換えず、新しいものを返す。
export const EXAM = { minDecisions: 100, accuracy: 0.82, loss: 0.4, paid: 6, needDan: 3 };

export const canTakeExam = (rec) => rec.dan.level >= EXAM.needDan;

// 受験の途中：decisions（足してきた判断：場面・損失・正答）, tournaments（終えた試験の大会の数）, places（その順位）, game（続きの大会か null）
export const newAttempt = () => ({ decisions: [], tournaments: 0, places: [], game: null });

export function tallyExam(decisions) {
  const n = decisions.length;
  if (!n) return { n: 0, good: 0, accuracy: null, loss: null, passed: false };
  const good = decisions.filter((d) => d.correct).length;
  const accuracy = good / n;
  const loss = decisions.reduce((a, d) => a + d.loss, 0) / n;
  return { n, good, accuracy, loss, passed: n >= EXAM.minDecisions && accuracy >= EXAM.accuracy - 1e-9 && loss <= EXAM.loss + 1e-9 };
}

// 試験の大会が1つ終わった。verdicts：その大会の判断、place：その大会のあなたの順位。
// 返す値：100回に届かなければ { result: 'continue', attempt, tally }、届いたら { result: 'pass'|'fail', attempt: null, places, tally }
export function addExamTournament(attempt, verdicts, place) {
  const decisions = [...attempt.decisions, ...verdicts.map(({ situation, loss, correct }) => ({ situation, loss, correct }))];
  const places = [...attempt.places, place];
  const tally = tallyExam(decisions);
  if (decisions.length < EXAM.minDecisions) {
    return { result: 'continue', attempt: { decisions, tournaments: attempt.tournaments + 1, places, game: null }, tally };
  }
  return { result: tally.passed ? 'pass' : 'fail', attempt: null, places, tally };
}

export const emptyTitles = () => ({ exams: 0, passes: 0, wins: 0, cashes: 0 });

// 合否が出た受験を称号の回数に足す。master：その受験の前から達人か
export function titlesAfter(titles, { result, places, master }) {
  const count = result === 'pass' || master;
  return {
    exams: titles.exams + 1,
    passes: titles.passes + (result === 'pass' ? 1 : 0),
    wins: titles.wins + (count ? places.filter((p) => p === 1).length : 0),
    cashes: titles.cashes + (count ? places.filter((p) => p <= EXAM.paid).length : 0),
  };
}
