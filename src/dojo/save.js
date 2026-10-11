// 保存データ（設計書 段階3 第7節・段階4-2 第7節・段階4-3 第6節・段階4-4 第8節・2026-10-12 の道場は座学だけ）。形の点検・版の直し方・書き出しと読み込みの点検。保存先には触らない。
import { createCoachState } from '../coach/levels.js';
import { SITUATIONS } from '../coach/situations.js';
import { CHAPTERS, PLAYABLE, GRAD } from './chapters.js';
import { isDate } from './dates.js';
import { validateName } from './name.js';
import { rankOf } from './progress.js';
import { emptyStats, HAND_LIMIT, EVENT_LIMIT } from './stats.js';
import { DAN, MASTER } from './ranks.js';

export const APP_ID = 'yassy-games-holdem-dojo';
export const SAVE_VERSION = 5;
export const RESUME_KINDS = ['lecture', 'practice', 'test', 'review', 'grad'];

export function emptyChapter() {
  return {
    lecturePage: 0, lectureDone: false,
    practice: null, practiceDone: false, // practice：解いている途中の10問 { seed, index, correct }
    test: null, testBest: null, passedAt: null, // test：受けている途中の試験 { seed, answers（選んだ番号の列）}
  };
}

// 卒業試験：test（受けている途中 { seed, answers（選んだ番号の列）}）・best（最高点）・passedAt（最初に合格した日）
export const emptyGraduation = () => ({ test: null, best: null, passedAt: null });

export function emptyRecord(today) {
  return {
    app: APP_ID, ver: SAVE_VERSION, savedAt: null,
    profile: { name: null, createdAt: today },
    chapters: {}, // 章の id → emptyChapter() の形（手をつけた章だけ）
    reviews: [], // { type, seed, step（0＝1日後の回・1＝3日後・2＝7日後）, due（出す日）}
    resume: null, // { kind, chapter } 最後にしていたこと（卒業試験・復習は chapter: null）
    coach: createCoachState('auto'),
    practiceStats: { answered: 0, correct: 0 },
    settings: {},
    stats: emptyStats(), // 判断の累計・直近1,000ハンドの結果・直近100大会の成績（dojo/stats.js。版2から）
    mainGame: null, // 本番大会の続き（game/main-event.js の mainSnapshot の形。版3から）
    dan: { level: 0, at: null }, // 段位（dojo/ranks.js。0＝なし・1〜3＝初段〜三段・4＝達人）と取った日（版4から）
    graduation: emptyGraduation(), // 卒業試験（版5から）
    mainTitles: { wins: 0, cashes: 0 }, // 本番大会の優勝・入賞の回数（版5から。優勝10回で達人）
  };
}

// 版ごとの直し方：MIGRATIONS[n] は版 n の記録を版 n+1 に直す。
// 版1 → 2：統計を空から始める。第6章の押す・受ける問題の作り方が変わった（押す人は15BB以下）ので、
// 作りかけの第6章の練習・試験の組を消す（復習の予定は残す。出る問題は同じ型の新しい問題になる）
export const MIGRATIONS = {
  1: (r) => {
    const chapters = { ...r.chapters };
    if (chapters.ch6) chapters.ch6 = { ...chapters.ch6, practice: null, test: null };
    return { ...r, chapters, stats: emptyStats() };
  },
  // 版2 → 3：本番大会の続きはなし
  2: (r) => ({ ...r, mainGame: null }),
  // 版3 → 4：段位・試験・称号は空から。段位の判定に使う直近の判断も空から数える
  3: (r) => ({ ...r, dan: { level: 0, at: null }, exam: null, titles: { exams: 0, passes: 0, wins: 0, cashes: 0 }, stats: { ...r.stats, recent: [] } }),
  // 版4 → 5（道場は座学だけ。2026-10-12）：章の対局・以前の試験（exam）・その称号（titles）の欄を落とし、卒業試験と本番大会の称号を0から足す。
  // 段位（達人を含む）と章の合格はそのまま。対局の続きからは消す（続きからは章の次にすること＝章末試験へ）
  4: (r) => {
    const { pendingGame, exam, titles, ...rest } = r;
    const chapters = Object.fromEntries(Object.entries(r.chapters).map(([id, c]) => {
      const { gamePassed, gameBest, ...keep } = c;
      return [id, keep];
    }));
    return { ...rest, chapters, resume: r.resume?.kind === 'game' ? null : r.resume, graduation: emptyGraduation(), mainTitles: { wins: 0, cashes: 0 } };
  },
};

export function migrate(obj, migrations = MIGRATIONS, target = SAVE_VERSION) {
  let r = obj;
  while (r.ver < target) {
    const step = migrations[r.ver];
    if (!step) throw new Error(`版${r.ver}の直し方がない`);
    r = { ...step(r), ver: r.ver + 1 };
  }
  return r;
}

const isInt = (x, lo = 0, hi = Infinity) => Number.isInteger(x) && x >= lo && x <= hi;
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const QUESTION_TYPES = new Set(CHAPTERS.flatMap((c) => c.types));
const isNum = (x, lo = -Infinity) => typeof x === 'number' && Number.isFinite(x) && x >= lo;

// 統計の形の点検。返す値：問題がなければ null、あれば理由の文
function checkStats(s) {
  if (!isObj(s) || !isObj(s.situations)) return 'stats';
  for (const k of SITUATIONS) {
    const c = s.situations[k];
    if (!(isObj(c) && isInt(c.n) && isInt(c.good, 0, c.n) && isNum(c.lossSum, 0) && isNum(c.lossSq, 0))) return `stats.situations.${k}`;
  }
  if (!Array.isArray(s.hands) || s.hands.length > HAND_LIMIT || !s.hands.every((h) => isObj(h) && isNum(h.r) && isNum(h.e))) return 'stats.hands';
  const kindOk = (k) => k === 'free' || k === 'main' || k === 'exam' || PLAYABLE.includes(k);
  const examOk = (e) => !('exam' in e) || e.exam === null || e.exam === 'pass' || e.exam === 'fail';
  if (!Array.isArray(s.events) || s.events.length > EVENT_LIMIT || !s.events.every((e) => isObj(e) && isDate(e.date) && kindOk(e.kind)
    && (e.place === null || isInt(e.place, 1)) && isInt(e.hands) && isInt(e.decisions) && isInt(e.good, 0, e.decisions)
    && isNum(e.lossSum, 0) && isNum(e.luck) && examOk(e))) return 'stats.events';
  if (!Array.isArray(s.recent) || s.recent.length > DAN.recent || !s.recent.every((x) => isObj(x) && (x.c === 0 || x.c === 1) && isNum(x.l, 0))) return 'stats.recent';
  return null;
}

// 指南の状態の点検（記録の coach と、ハンドの途中の続きの coach）
function checkCoach(k) {
  if (!(isObj(k) && (k.mode === 'auto' || isInt(k.mode, 1, 5)) && isObj(k.levels) && isObj(k.recent))) return 'coach';
  for (const s of SITUATIONS) {
    if (!isInt(k.levels[s], 1, 5) || !Array.isArray(k.recent[s])) return `coach.${s}`;
  }
  return null;
}

const ACTION_TYPES = ['fold', 'check', 'call', 'raise'];
// ハンドの途中の続き（mainSnapshot の hand）の点検
export function checkHand(h) {
  if (!isObj(h) || typeof h.check !== 'string') return 'hand';
  if (!Array.isArray(h.actions) || !h.actions.length || !h.actions.every((a) => isObj(a) && ACTION_TYPES.includes(a.type) && (a.type !== 'raise' || isInt(a.to, 1)))) return 'hand.actions';
  if (!Array.isArray(h.verdicts) || !h.verdicts.every((v) => isObj(v) && SITUATIONS.includes(v.situation) && isNum(v.loss, 0) && typeof v.correct === 'boolean'
    && isInt(v.handNo, 1) && isInt(v.level, 1, 5))) return 'hand.verdicts';
  return checkCoach(h.coach) && 'hand.coach';
}

const CPU_TYPES = ['tight', 'station', 'aggro', 'pro'];
const isIntOrNull = (x, lo, hi) => x === null || isInt(x, lo, hi);

// 本番大会の続き（mainSnapshot の形）の点検。返す値：問題がなければ null、あれば理由の文。
// 試験の大会の続き（exam: true）はもうないので通さない（古い続きの exam: false は通す）
export function checkMainGame(m) {
  if (!isObj(m) || !isInt(m.seed) || !(m.coachMode === 'auto' || isInt(m.coachMode, 1, 5))) return 'mainGame';
  if (m.exam !== undefined && m.exam !== false) return 'mainGame.exam';
  if (m.hand !== undefined && m.hand !== null && checkHand(m.hand)) return 'mainGame.hand';
  if (!Array.isArray(m.verdicts) || !m.verdicts.every((v) => isObj(v) && SITUATIONS.includes(v.situation) && isNum(v.loss, 0) && typeof v.correct === 'boolean')) return 'mainGame.verdicts';
  if (!Array.isArray(m.results) || !m.results.every((h) => isObj(h) && isNum(h.r) && isNum(h.e))) return 'mainGame.results';
  const f = m.field;
  if (!(isObj(f) && isInt(f.round) && f.finished === false && typeof f.final === 'boolean' && isInt(f.startStack, 1) && isInt(f.handsPerLevel, 1)
    && Array.isArray(f.payouts) && f.payouts.every((x) => isNum(x, 0)) && Array.isArray(f.people) && Array.isArray(f.tables))) return 'mainGame.field';
  const n = f.people.length;
  const tn = f.tables.length;
  const sn = f.tables[0]?.seats?.length;
  if (n !== 45 || tn !== 5 || sn !== 9) return 'mainGame.field';
  for (const p of f.people) {
    if (!(isObj(p) && typeof p.id === 'string' && typeof p.name === 'string' && p.name && (p.type === null || CPU_TYPES.includes(p.type))
      && (p.avatar === null || typeof p.avatar === 'string') && isInt(p.stack) && isIntOrNull(p.place, 1, n) && isIntOrNull(p.table, 0, tn - 1) && isIntOrNull(p.seat, 0, sn - 1))) return 'mainGame.people';
    if ((p.stack > 0) !== (p.place === null) || (p.stack > 0) !== (p.table !== null)) return 'mainGame.people';
  }
  if (f.people[0].id !== 'hero') return 'mainGame.people';
  const seated = new Set();
  for (const [ti, t] of f.tables.entries()) {
    if (!(isObj(t) && Array.isArray(t.seats) && t.seats.length === sn && typeof t.broken === 'boolean' && isInt(t.firstButton, 0, sn - 1))) return 'mainGame.tables';
    if (t.positions !== null && !(isObj(t.positions) && isInt(t.positions.button, 0, sn - 1) && isInt(t.positions.sbPos, 0, sn - 1)
      && isIntOrNull(t.positions.sbSeat, 0, sn - 1) && isInt(t.positions.bbSeat, 0, sn - 1))) return 'mainGame.tables';
    for (const [s, p] of t.seats.entries()) {
      if (p === null) continue;
      if (!isInt(p, 0, n - 1) || seated.has(p) || f.people[p].table !== ti || f.people[p].seat !== s) return 'mainGame.tables';
      seated.add(p);
    }
  }
  if (seated.size !== f.people.filter((p) => p.stack > 0).length) return 'mainGame.tables';
  return null;
}

// 形の点検。返す値：問題がなければ null、あれば理由の文
export function checkRecord(r) {
  if (!isObj(r)) return '記録ではない';
  if (r.app !== APP_ID) return 'このゲームの記録ではない';
  if (r.ver !== SAVE_VERSION) return `版が違う（${r.ver}）`;
  if (!isObj(r.profile)) return 'profile';
  if (r.profile.name !== null && !validateName(r.profile.name).ok) return 'profile.name';
  if (!isObj(r.chapters)) return 'chapters';
  for (const [id, c] of Object.entries(r.chapters)) {
    if (!PLAYABLE.includes(id)) return `chapters.${id}`;
    if (!isObj(c) || !isInt(c.lecturePage) || typeof c.lectureDone !== 'boolean' || typeof c.practiceDone !== 'boolean') return `chapters.${id}`;
    if (c.practice !== null && !(isObj(c.practice) && isInt(c.practice.seed) && isInt(c.practice.index) && isInt(c.practice.correct))) return `chapters.${id}.practice`;
    if (c.test !== null && !(isObj(c.test) && isInt(c.test.seed) && Array.isArray(c.test.answers) && c.test.answers.every((a) => isInt(a)))) return `chapters.${id}.test`;
    if (c.testBest !== null && !isInt(c.testBest)) return `chapters.${id}.testBest`;
    if (c.passedAt !== null && !isDate(c.passedAt)) return `chapters.${id}.passedAt`;
  }
  if (!Array.isArray(r.reviews) || !r.reviews.every((v) => isObj(v) && QUESTION_TYPES.has(v.type) && isInt(v.seed) && isInt(v.step, 0, 2) && isDate(v.due))) return 'reviews';
  const noChapter = (k) => k === 'review' || k === 'grad';
  if (r.resume !== null && !(isObj(r.resume) && RESUME_KINDS.includes(r.resume.kind) && (noChapter(r.resume.kind) ? r.resume.chapter === null : PLAYABLE.includes(r.resume.chapter)))) return 'resume';
  const coachBad = checkCoach(r.coach);
  if (coachBad) return coachBad;
  if (!(isObj(r.practiceStats) && isInt(r.practiceStats.answered) && isInt(r.practiceStats.correct, 0, r.practiceStats.answered))) return 'practiceStats';
  if (!isObj(r.settings)) return 'settings';
  if (r.mainGame !== null && checkMainGame(r.mainGame)) return 'mainGame';
  const d = r.dan;
  if (!(isObj(d) && isInt(d.level, 0, MASTER) && (d.level === 0 ? d.at === null : isDate(d.at)))) return 'dan';
  const g = r.graduation;
  if (!(isObj(g) && (g.test === null || (isObj(g.test) && isInt(g.test.seed) && Array.isArray(g.test.answers) && g.test.answers.length <= GRAD.count && g.test.answers.every((a) => isInt(a))))
    && (g.best === null || isInt(g.best, 0, GRAD.count)) && (g.passedAt === null || isDate(g.passedAt)))) return 'graduation';
  const t = r.mainTitles;
  if (!(isObj(t) && isInt(t.cashes) && isInt(t.wins, 0, t.cashes))) return 'mainTitles';
  return checkStats(r.stats);
}

export const MAIN_DROPPED = '本番大会の続きが壊れていたので、続きの大会だけを消しました';

// ハンドの途中の続きが壊れていたら、そのハンドの初めからにする（hand だけを消す）
const cleanHand = (g) => (isObj(g) && g.hand !== undefined && g.hand !== null && checkHand(g.hand) ? { ...g, hand: null } : g);

// 文字列から記録を読む。返す値：{ ok, record, error（画面に出す文）, newer（新しい版の記録か）, notice（知らせる文か null）}
// 本番大会の続きだけが壊れていたときは、記録全体は読み、続きの大会だけを消して知らせる
export function parseRecord(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, record: null, error: 'JSONの形ではありません', newer: false, notice: null };
  }
  if (!isObj(obj) || obj.app !== APP_ID) return { ok: false, record: null, error: 'このゲームの記録ではありません', newer: false, notice: null };
  if (!isInt(obj.ver, 1)) return { ok: false, record: null, error: '記録の版がわかりません', newer: false, notice: null };
  if (obj.ver > SAVE_VERSION) return { ok: false, record: null, error: '新しい版で作られた記録です（ゲームを新しくしてから読み込んでください）', newer: true, notice: null };
  let record;
  try {
    record = migrate(obj);
  } catch (e) {
    return { ok: false, record: null, error: `記録を今の形に直せません（${e.message}）`, newer: false, notice: null };
  }
  const notices = [];
  if (isObj(record) && record.mainGame != null) {
    record = { ...record, mainGame: cleanHand(record.mainGame) };
    if (checkMainGame(record.mainGame)) {
      record = { ...record, mainGame: null };
      notices.push(MAIN_DROPPED);
    }
  }
  const notice = notices.length ? notices.join('。') : null;
  const bad = checkRecord(record);
  if (bad) return { ok: false, record: null, error: `記録の中身が壊れています（${bad}）`, newer: false, notice: null };
  return { ok: true, record, error: null, newer: false, notice };
}

// 起動時の読み込み：本体 → 控え → 最初から。返す値：{ record, source（'main'|'backup'|'new'）, notice（知らせる文か null）, broken（退避する壊れた文字列か null）}
export function loadRecord(mainText, backupText, today) {
  if (mainText === null && backupText === null) return { record: emptyRecord(today), source: 'new', notice: null, broken: null };
  const main = mainText === null ? null : parseRecord(mainText);
  if (main?.ok) return { record: main.record, source: 'main', notice: main.notice, broken: null };
  // 本体が新しい版で作られた記録なら、古い控えには戻さない（戻して保存すると、新しい版の本体を上書きしてしまう）
  const backup = backupText === null || main?.newer ? null : parseRecord(backupText);
  if (backup?.ok) {
    return { record: backup.record, source: 'backup', notice: '記録が壊れていたので、ひとつ前の控えから戻しました', broken: mainText };
  }
  if (main?.newer || backup?.newer) {
    return { record: emptyRecord(today), source: 'new', notice: '新しい版で作られた記録があるため読み込めません。ゲームを新しくしてください（記録は消していません）', broken: null, keep: true };
  }
  return { record: emptyRecord(today), source: 'new', notice: '記録が壊れていて控えからも戻せなかったため、最初から始めます（壊れた記録は別の名前で残しました）', broken: mainText ?? backupText };
}

export const serialize = (record, nowIso) => JSON.stringify({ ...record, savedAt: nowIso });

// 書き出すファイルの名前（ファイル名に使えない文字は _ に置き換える）
export function exportFileName(record, today) {
  const name = (record.profile.name ?? 'プレイヤー').replace(/[\\/:*?"<>|]/g, '_');
  return `やっしーGAMES_${name}_${today}.json`;
}

// 読み込むファイルの点検と、確認に見せる中身の要約
export function inspectImport(text) {
  const r = parseRecord(text);
  if (!r.ok) return { ok: false, error: `このファイルは読み込めません（${r.error}）`, record: null, summary: null };
  const rank = rankOf(r.record);
  return {
    ok: true, error: null, record: r.record,
    summary: { name: r.record.profile.name ?? '（名前なし）', rank: rank.label, passed: rank.passed, savedAt: r.record.savedAt },
  };
}
