// 段位（設計書 段階4-4 第3節）：初段〜三段は、答えを見ずにした判断（指南の段階2以上）の直近300回の正答率と平均損失で決める。
// 基準は上級者のCPUを物差しにした値（2026-10-08 先生が決定）。一度取った段位は下がらない。達人は本番大会で通算10回優勝したら（2026-10-12。dojo/actions.js の endTournament）。
// 段位の数：0＝なし（級だけ）・1＝初段・2＝二段・3＝三段・4＝達人。どの操作も記録を書き換えず、新しい記録を返す。
import { PLAYABLE } from './chapters.js';

export const DAN = {
  recent: 300, minLevel: 2,
  steps: [
    { level: 1, label: '初段', accuracy: 0.7, loss: 0.6 },
    { level: 2, label: '二段', accuracy: 0.76, loss: 0.5 },
    { level: 3, label: '三段', accuracy: 0.82, loss: 0.4 },
  ],
};
export const MASTER = 4;
// 達人になる本番大会の優勝の回数（指南の段階は問わない。初段〜三段は要らない）
export const MASTER_WINS = 10;
export const DAN_LABEL = [null, '初段', '二段', '三段', '達人'];

const round2 = (x) => Math.round(x * 100) / 100 || 0;

// 段位に数える判断か（verdict の level＝その判断の指南の段階）
export const countable = (v) => v.level >= DAN.minLevel;

// 数えた判断の直近300回（{ c：正答なら1, l：損失（BB・0.01単位） }）に、採点した判断の列を足す
export function addRecent(recent, verdicts) {
  const add = verdicts.filter(countable).map((v) => ({ c: v.correct ? 1 : 0, l: round2(v.loss) }));
  return [...recent, ...add].slice(-DAN.recent);
}

// 直近の判断の正答率と平均損失（0回なら null）
export function recentQuality(recent) {
  const n = recent.length;
  if (!n) return { n: 0, accuracy: null, loss: null };
  return { n, accuracy: recent.reduce((a, x) => a + x.c, 0) / n, loss: recent.reduce((a, x) => a + x.l, 0) / n };
}

// 直近の数字が満たす一番上の段（300回たまるまでは0）。比べるときは丸めの誤差を見ない
export function danEarned(q) {
  if (q.n < DAN.recent) return 0;
  let level = 0;
  for (const s of DAN.steps) if (q.accuracy >= s.accuracy - 1e-9 && q.loss <= s.loss + 1e-9) level = s.level;
  return level;
}

const allPassed = (rec) => PLAYABLE.every((id) => !!rec.chapters[id]?.passedAt);

// 大会の成績が1件残るたびに呼ぶ。返す値：{ record, promoted（上がったら { from, to, label }、上がらなければ null）}
export function judgeDan(rec, today) {
  const from = rec.dan.level;
  if (from >= MASTER || !allPassed(rec)) return { record: rec, promoted: null };
  const to = danEarned(recentQuality(rec.stats.recent));
  if (to <= from) return { record: rec, promoted: null };
  return { record: { ...rec, dan: { level: to, at: today } }, promoted: { from, to, label: DAN_LABEL[to] } };
}

// 成績画面の段位の欄：次の段（三段・達人なら null）と、いまの直近の数字
export function nextStep(rec) {
  const quality = recentQuality(rec.stats.recent ?? []);
  return { step: DAN.steps.find((s) => s.level === rec.dan.level + 1) ?? null, quality };
}
