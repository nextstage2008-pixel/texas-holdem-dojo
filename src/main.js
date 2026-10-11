// 入口：記録を読み、画面を切り替え、操作のたびに保存する。
import { fitStage } from './ui/table-view.js';
import { createTableGame } from './ui/table-game.js';
import { createStorage } from './ui/storage.js';
import { createClickGate } from './ui/click-gate.js';
import { browserStorageArea, downloadText, pickTextFile } from './ui/file-io.js';
import { splashHTML, titleHTML, buildTitleView, nameEntryHTML, VERSION_LINE } from './ui/screens/title.js';
import { dojoHTML, buildDojoView } from './ui/screens/dojo.js';
import { lectureHTML, buildLectureView } from './ui/screens/lecture.js';
import { quizHTML, testResultHTML, wrongList } from './ui/screens/quiz.js';
import { onKey } from './ui/keys.js';
import { settingsHTML, dialogHTML, importSummaryHTML } from './ui/screens/settings.js';
import { aboutHTML } from './ui/screens/about.js';
import { tutorialMenuHTML } from './ui/screens/tutorial-menu.js';
import { LESSONS, lessonOf } from './tutorial/lessons.js';
import { tutorialDone, withTutorialDone } from './ui/tutorial-record.js';
import { createTutorialGame, nextLessonOf } from './ui/tutorial-game.js';
import { statsHTML, buildStatsView } from './ui/screens/stats.js';
import { esc } from './ui/format.js';
import { loadRecord, serialize, exportFileName, inspectImport, emptyRecord } from './dojo/save.js';
import { localDate } from './dojo/dates.js';
import * as A from './dojo/actions.js';
import { validateName } from './dojo/name.js';
import { resumeTarget, currentChapter, chapterState, gradState } from './dojo/progress.js';
import { lectureOf } from './dojo/lectures/chapters.js';
import { practiceList, testList, gradeTest, graduationList } from './dojo/quiz.js';
import { cachedQuestion } from './dojo/questions/index.js';
import { dueToday } from './dojo/reviews.js';
import { PRACTICE_COUNT, GRAD } from './dojo/chapters.js';
import { resumeLabel } from './game/main-event.js';
import { nextStep } from './dojo/ranks.js';
import { createAudio, bindUnlock } from './ui/audio.js';
import { createSound } from './ui/sound.js';
import { soundSettings, withSound } from './dojo/sound-settings.js';
import { motionSettings, withMotion, motionNow } from './ui/motion-settings.js';
import { layoutFor, layoutInputs, watchLayout } from './ui/layout.js';
import { NUDGE_TEXT, afterTournament, afterExport, isSafariTab, requestPersist, HOME_HOWTO } from './ui/keep-record.js';

const stage = document.getElementById('stage');
const today = () => localDate(new Date());
const newSeed = () => (Date.now() + Math.floor(performance.now() * 1000)) % 2147483647;

// ---- 記録の読み込みと保存 ----
const storage = createStorage(browserStorageArea());
// スマホの記録の守り（設計書 段階5-1 第8節）：消されにくくする設定を頼む。iPhone の Safari のタブなら、タイトルにホーム画面に追加のすすめ
requestPersist(navigator.storage);
const SAFARI_TAB = isSafariTab({
  userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone: navigator.standalone === true,
  displayStandalone: !!window.matchMedia?.('(display-mode: standalone)').matches,
});
const COARSE = !!window.matchMedia?.('(pointer: coarse)').matches;
// 端末の「動きを減らす」（設定の「動きを減らす」がまだ選ばれていないときに従う。設計書 段階5-3 第5節）
const REDUCED = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// 公開版だけの窓口（src/pwa/register.js が置く）。新しい版が待ちに入ったら、タイトルの画面なら描き直して知らせる（設計書 段階5-2 第3-4節）
const PWA = window.__holdemPWA ?? null;
PWA?.onChange(() => { if (screen.name === 'title' && overlay === null) render(); });
const notices = [];
const SAVE_LOST = '記録を保存できなくなりました（ブラウザの保存領域がいっぱいか、保存が止められています）。このまま遊べますが、閉じるとここから先の記録は残りません。設定の「記録を書き出す」で、ここまでの記録をファイルに残せます。';
let rec;
{
  const { main, backup } = storage.read();
  const loaded = loadRecord(main, backup, today());
  rec = loaded.record;
  if (loaded.broken !== null) storage.keepBroken(loaded.broken, Date.now());
  if (loaded.keep) storage.disable();
  if (loaded.notice) notices.push(loaded.notice);
  else if (!storage.usable) notices.push('このブラウザでは記録を保存できません（プライベートモードなど）。遊ぶことはできますが、閉じると記録は残りません。');
}
function commit(next) {
  rec = next;
  save();
}
// 途中で保存できなくなったら、1回だけ知らせる（次に出せる画面で出す）
function save() {
  storage.write(serialize(rec, new Date().toISOString()));
  if (storage.takeFailure()) notices.push(SAVE_LOST);
}

// ---- 音（設計書 段階4-5）----
// 鳴らす部品と指揮役は1つだけ作り、卓と設定画面で使う。最初に画面に触れたときに準備して、効果音を読み込む。
// 声の一覧（manifest.json）は起動してから読む。読めなければ声だけ鳴らさない（効果音とゲームはそのまま）
const audio = createAudio({ onUnlock: () => sound.warm() });
const sound = createSound({ audio, settings: () => soundSettings(rec.settings) });
let voiceCredits = []; // 設定画面の下に出す声のキャラ
bindUnlock(window, audio);
// スマホの守り（設計書 段階5-1 第7節）：表に戻ったら再開し、裏に回ったら止める
document.addEventListener('visibilitychange', () => (document.hidden ? audio.suspend() : audio.revive()));
sound.apply();
window.__sound = sound.stats; // 画面の通しで、鳴らした回数・鳴らせなかった回数を確かめる
fetch('assets/voice/manifest.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((m) => {
    if (!m) return;
    sound.load(m);
    voiceCredits = Array.isArray(m.credits) ? m.credits : [];
    if (screen.name === 'settings') render();
  })
  .catch(() => {});
// 音の設定を変えて保存する（設定画面・卓の右上のボタン）
function setSound(patch) {
  commit(withSound(rec, patch));
  sound.apply();
}

// ---- 画面の切り替え ----
let screen = { name: 'splash' };
let overlay = null; // 名前の入力や確認の札（画面の上に重ねる）
let table = null;
let pendingImport = null;
let splashTimer = null;
// 画面が変わった直後のクリックと、ダブルクリックの2回目を無視する（試験で1回の操作が2問ぶんの答えにならないように）
const gate = createClickGate(250);

function show(next) {
  if (table) { table.stop(); table = null; }
  overlay = null;
  screen = next;
  if (next.name === 'title') PWA?.check();
  render();
}

function dialog(title, body, buttons = [{ go: 'dlg-close', label: 'とじる', primary: true }]) {
  overlay = dialogHTML({ title, body, buttons });
  render();
}

// 並べ方（設計書 段階5-1 第3節）：縦長の画面はスマホの並べ方、横長は PC の並べ方。スマホを横にしたら「縦にしてお使いください」を重ねる。
// 卓は、始めたときの並べ方を終わるまで使う（遊んでいる途中で窓の形が変わっても描き直さない）。返す値：並べ方が変わったか
function applyLayout() {
  const l = layoutFor(layoutInputs(window, document.getElementById('viewport')));
  document.body.classList.toggle('rotate', l.rotate);
  if (screen.name === 'table') return false;
  const changed = stage.dataset.layout !== l.layout;
  stage.dataset.layout = l.layout;
  stage.classList.toggle('pt', l.layout === 'portrait');
  return changed;
}

function render() {
  if (screen.name === 'table') return; // 卓は table-game が描く
  applyLayout();
  const s = screen;
  let html = '';
  if (s.name === 'splash') html = splashHTML();
  if (s.name === 'title') html = titleHTML(buildTitleView(rec, today(), { safariNote: SAFARI_TAB, update: !!PWA?.hasUpdate() }), stage.dataset.layout);
  if (s.name === 'dojo') html = dojoHTML(buildDojoView(rec, s.selected ?? null, today()));
  if (s.name === 'lecture') html = lectureHTML(buildLectureView(s.ch, s.page));
  if (s.name === 'quiz') html = quizHTML({ mode: s.mode, chapterId: s.ch, index: s.index, total: s.list.length, correct: s.correct, q: s.q, chosen: s.chosen });
  if (s.name === 'result') html = testResultHTML(s.view);
  if (s.name === 'settings') {
    html = settingsHTML({
      name: rec.profile.name ?? '', usable: storage.usable, sound: soundSettings(rec.settings), credits: voiceCredits,
      motion: { ...motionSettings(rec.settings), reduce: motionNow(rec.settings, REDUCED).reduce },
    });
  }
  if (s.name === 'about') html = aboutHTML({ credits: voiceCredits, version: VERSION_LINE });
  if (s.name === 'tutorial') html = tutorialMenuHTML({ lessons: LESSONS, done: tutorialDone(rec.settings) });
  if (s.name === 'stats') html = statsHTML(buildStatsView(rec, s.tab ?? 'quality'));
  stage.innerHTML = html + (overlay ?? '');
  gate.arm(performance.now());
  fitStage(stage);
  const input = stage.querySelector('[data-ref="nameInput"]');
  if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
}

function afterSplash() {
  clearTimeout(splashTimer);
  if (screen.name !== 'splash') return;
  show({ name: 'title' });
  if (!rec.profile.name) { overlay = nameEntryHTML({ mode: 'first' }); render(); return; }
  nextNotice();
}

function nextNotice() {
  const n = notices.shift();
  if (n) dialog('お知らせ', `<p>${esc(n)}</p>`, [{ go: 'notice-ok', label: 'わかりました', primary: true }]);
}

// たまった知らせを、遊びの邪魔にならないときに出す（卓・起動演出・ほかの札が出ている間は待つ）
function flushNotices() {
  if (overlay === null && notices.length && screen.name !== 'table' && screen.name !== 'splash') nextNotice();
}

// ---- 道場の手順 ----
const questionAt = (list, i) => cachedQuestion(list[i]);

function goStep(ch, kind) {
  const st = chapterState(rec, ch);
  if (!st.open || !st.steps[kind]?.open) { show({ name: 'dojo', selected: ch }); return; }
  const c = rec.chapters[ch];
  if (kind === 'lecture') {
    const count = lectureOf(ch).length;
    const page = c?.lectureDone ? 0 : c?.lecturePage ?? 0;
    commit(A.turnLecture(rec, ch, page, count));
    show({ name: 'lecture', ch, page });
  } else if (kind === 'practice') {
    if (!c?.practice) commit(A.startPractice(rec, ch, newSeed()));
    const p = rec.chapters[ch].practice;
    const list = practiceList(ch, p.seed);
    show({ name: 'quiz', mode: 'practice', ch, list, index: p.index, correct: p.correct, chosen: null, q: questionAt(list, p.index) });
  } else if (kind === 'test') {
    if (!c?.test) commit(A.startTest(rec, ch, newSeed()));
    const t = rec.chapters[ch].test;
    const list = testList(ch, t.seed);
    show({ name: 'quiz', mode: 'test', ch, list, index: t.answers.length, correct: 0, chosen: null, q: questionAt(list, t.answers.length) });
  }
}

// 卒業試験（2026-10-12）：全9章の合格で開く。途中があれば続きから
function goGrad() {
  if (!gradState(rec).open) { show({ name: 'dojo', selected: 'grad' }); return; }
  if (!rec.graduation.test) commit(A.startGraduation(rec, newSeed()));
  const t = rec.graduation.test;
  const list = graduationList(t.seed);
  show({ name: 'quiz', mode: 'grad', ch: null, list, index: t.answers.length, correct: 0, chosen: null, q: questionAt(list, t.answers.length) });
}

function finishGrad(s) {
  const questions = s.list.map(cachedQuestion);
  const graded = gradeTest(questions, rec.graduation.test.answers, GRAD.pass);
  const r = A.finishGraduation(rec, graded, today());
  commit(r.record);
  show({ name: 'result', view: { grad: true, score: graded.score, passed: graded.passed, firstPass: r.firstPass, wrong: wrongList(questions, graded.results) } });
}

function startReview() {
  const list = dueToday(rec.reviews, today()).map(({ type, seed }) => ({ type, seed }));
  if (!list.length) { dialog('今日の復習', '<p>今日の復習はありません。</p>'); return; }
  commit(A.goReview(rec));
  show({ name: 'quiz', mode: 'review', ch: null, list, index: 0, correct: 0, chosen: null, q: questionAt(list, 0) });
}

function choose(i) {
  const s = screen;
  if (s.chosen !== null) return;
  const item = s.list[s.index];
  const ok = i === s.q.answer;
  if (s.mode === 'practice') commit(A.answerPractice(rec, s.ch, item, ok, today()));
  if (s.mode === 'review') commit(A.answerReviewQuestion(rec, item, ok, today()));
  if (s.mode === 'test') {
    commit(A.answerTest(rec, s.ch, i));
    if (s.index + 1 < s.list.length) {
      screen = { ...s, index: s.index + 1, q: questionAt(s.list, s.index + 1) };
      render();
      return;
    }
    finishTest(s);
    return;
  }
  if (s.mode === 'grad') {
    commit(A.answerGraduation(rec, i));
    if (s.index + 1 < s.list.length) {
      screen = { ...s, index: s.index + 1, q: questionAt(s.list, s.index + 1) };
      render();
      return;
    }
    finishGrad(s);
    return;
  }
  screen = { ...s, chosen: i, correct: s.correct + (ok ? 1 : 0) };
  render();
}

function nextQuestion() {
  const s = screen;
  if (s.index + 1 < s.list.length) {
    screen = { ...s, index: s.index + 1, chosen: null, q: questionAt(s.list, s.index + 1) };
    render();
    return;
  }
  if (s.mode === 'practice') {
    show({ name: 'dojo', selected: s.ch });
    dialog('練習問題を解き終えました', `<p>${PRACTICE_COUNT}問中 ${s.correct}問正解。</p><p>章末試験を受けられます。間違えた問題は「今日の復習」に出ます。</p>`);
  } else {
    show({ name: 'dojo' });
    dialog('今日の復習', `<p>${s.list.length}問中 ${s.correct}問正解。今日の復習は終わりです。</p>`);
  }
}

function finishTest(s) {
  const questions = s.list.map(cachedQuestion);
  const graded = gradeTest(questions, rec.chapters[s.ch].test.answers);
  const r = A.finishTest(rec, s.ch, graded, today());
  commit(r.record);
  const wrong = wrongList(questions, graded.results);
  show({
    name: 'result',
    view: { chapterId: s.ch, score: graded.score, passed: graded.passed, firstPass: r.firstPass, rankBefore: r.rankBefore.label, rankAfter: r.rankAfter.label, opened: r.opened, wrong },
  });
}

// ---- 卓 ----
// 大会が終わった（成績が1件残る）：記録して段位を判定する。昇段したら終わりの札に出す中身を返す（設計書 段階4-4 第3節）
function tourEnd(event) {
  const r = A.endTournament(rec, event, today());
  commit(r.record);
  countTournament();
  return r.promoted ? { ...r.promoted, ...nextStep(r.record) } : null;
}

// 書き出しのすすめ（設計書 段階5-1 第8節）：指で操作する画面で、最後に書き出してから大会を10回打ったら1回だけ知らせる（卓を出たときに出る）
function countTournament() {
  const r = afterTournament(rec, { coarse: COARSE });
  commit(r.record);
  if (r.nudge) notices.push(NUDGE_TEXT);
}

// 卓に渡す音と動きの部品（設計書 段階4-5・段階5-3）。右上のボタンは「音を出す」を入れ替える
const soundOpts = () => ({
  sound,
  soundOn: () => soundSettings(rec.settings).on,
  onToggleSound: () => setSound({ on: !soundSettings(rec.settings).on }),
  motion: () => motionNow(rec.settings, REDUCED),
});

// 遊び方のチュートリアル（設計書 段階5-4）：目次の1つを卓で流す。最後まで終えたら終えた印を記録に残す
function startTutorial(id) {
  const lesson = lessonOf(id);
  if (!lesson) return;
  if (table) { table.stop(); table = null; }
  screen = { name: 'table', ch: null };
  overlay = null;
  table = createTutorialGame(stage, {
    ...soundOpts(),
    lesson, heroName: rec.profile.name ?? 'あなた', nextLesson: nextLessonOf(LESSONS, id),
    onDone: (id) => commit(withTutorialDone(rec, id)),
    onNext: (next) => startTutorial(next),
    onExit: () => show({ name: 'tutorial' }),
  });
}

// 本番大会（設計書 段階4-3）。resume：続きの大会（mainSnapshot の形）か null
function startMain(resume) {
  screen = { name: 'table', ch: null };
  overlay = null;
  table = createTableGame(stage, {
    ...soundOpts(),
    mode: 'main', heroName: rec.profile.name ?? 'あなた', coach: rec.coach, resume,
    onSave: (snapshot) => commit(A.saveMain(rec, snapshot)),
    onHand: (session, mode, _decisions, info) => commit(A.recordHand(mode === 'auto' ? A.setCoach(rec, session.coach) : rec, info.verdicts, info.result)),
    onTournament: tourEnd,
    onEnd: (info) => commit(A.clearMain(info.coachMode === 'auto' ? A.setCoach(rec, info.coach) : rec)),
    onAbandon: () => commit(A.clearMain(rec)),
    onExit: () => { show({ name: 'title' }); flushNotices(); },
  });
}

function startFreePlay() {
  screen = { name: 'table', ch: null };
  overlay = null;
  table = createTableGame(stage, {
    ...soundOpts(),
    mode: 'free', heroName: rec.profile.name ?? 'あなた', coach: rec.coach,
    // 指南の段階を固定した自由対局も、判断とハンドは統計に数える（指南の状態は自動のときだけ残す）
    onHand: (session, mode, _decisions, info) => commit(A.recordHand(mode === 'auto' ? A.setCoach(rec, session.coach) : rec, info.verdicts, info.result)),
    onTournament: tourEnd,
    onEnd: (info) => { if (info.coachMode === 'auto') commit(A.setCoach(rec, info.coach)); },
    onExit: () => { show({ name: 'title' }); flushNotices(); },
  });
}

// ---- 名前・記録の書き出しと読み込み ----
function submitName() {
  const input = stage.querySelector('[data-ref="nameInput"]');
  const mode = rec.profile.name ? 'change' : 'first';
  const v = validateName(input?.value);
  if (!v.ok) { overlay = nameEntryHTML({ mode, value: input?.value ?? '', error: v.error }); render(); return; }
  commit(A.setName(rec, v.name));
  overlay = null;
  render();
  if (mode === 'first') nextNotice();
}

async function importRecord() {
  const text = await pickTextFile();
  if (text === null) return;
  const ins = inspectImport(text);
  if (!ins.ok) { dialog('読み込めません', `<p>${esc(ins.error)}</p>`); return; }
  pendingImport = ins.record;
  dialog('記録を読み込む', importSummaryHTML(ins.summary), [{ go: 'import-ok', label: '置き換える', primary: true }, { go: 'dlg-close', label: 'やめる' }]);
}

// ---- 操作 ----
const turnTo = (p) => { commit(A.turnLecture(rec, screen.ch, p, lectureOf(screen.ch).length)); screen = { ...screen, page: p }; render(); };
const ACTIONS = {
  skip: afterSplash,
  'notice-ok': () => { overlay = null; render(); nextNotice(); },
  'dlg-close': () => { overlay = null; pendingImport = null; render(); },
  'name-ok': submitName,
  'name-cancel': () => { overlay = null; render(); },
  resume: () => {
    const t = resumeTarget(rec, today());
    if (!t) show({ name: 'dojo' });
    else if (t.kind === 'review') startReview();
    else if (t.kind === 'grad') goGrad();
    else goStep(t.chapter, t.kind);
  },
  dojo: () => show({ name: 'dojo' }),
  title: () => show({ name: 'title' }),
  tutorial: () => show({ name: 'tutorial' }),
  'tut-start': (el) => startTutorial(el.dataset.lesson),
  free: startFreePlay,
  main: () => {
    if (!rec.mainGame) { startMain(null); return; }
    dialog('本番大会', `<p>途中の大会があります（${esc(resumeLabel(rec.mainGame.field))}）。</p>`, [
      { go: 'main-resume', label: '続きから', primary: true }, { go: 'main-new', label: '新しく始める' }, { go: 'dlg-close', label: 'やめる' },
    ]);
  },
  'main-resume': () => startMain(rec.mainGame),
  'main-new': () => dialog('新しく始める', '<p>前の大会を終わりにして、新しく始めますか？（前の大会は大会の成績に残りません）</p>', [
    { go: 'main-new-ok', label: '終わりにして始める', danger: true }, { go: 'dlg-close', label: 'やめる', primary: true },
  ]),
  'main-new-ok': () => { commit(A.clearMain(rec)); startMain(null); },
  stats: () => show({ name: 'stats' }),
  'stats-tab': (el) => { screen = { ...screen, tab: el.dataset.tab }; render(); },
  'stats-review': (el) => show({ name: 'dojo', selected: el.dataset.ch }),
  settings: () => show({ name: 'settings' }),
  about: () => show({ name: 'about' }),
  // 音の入／切と一言の量（data-k の項目を、data-v があればその値に、なければ入／切を入れ替える）
  snd: (el) => {
    const k = el.dataset.k;
    setSound({ [k]: el.dataset.v ?? !soundSettings(rec.settings)[k] });
    render();
  },
  'snd-preview': () => sound.preview(soundSettings(rec.settings).heroVoice),
  // 動きの速さと「動きを減らす」（data-v があればその値に、なければ今の入／切を入れ替える）
  mv: (el) => {
    const k = el.dataset.k;
    commit(withMotion(rec, { [k]: el.dataset.v ?? !motionNow(rec.settings, REDUCED)[k] }));
    render();
  },
  pick: (el) => show({ name: 'dojo', selected: el.dataset.ch }),
  step: (el) => goStep(screen.selected ?? currentChapter(rec), el.dataset.step),
  review: startReview,
  grad: goGrad,
  'lec-prev': () => turnTo(screen.page - 1),
  'lec-next': () => turnTo(screen.page + 1),
  'lec-done': () => goStep(screen.ch, 'practice'),
  choose: (el) => choose(Number(el.dataset.i)),
  next: nextQuestion,
  quit: () => dialog('やめますか？', '<p>ここまでの答えは保存されています。続きはあとからできます。</p>', [{ go: 'quit-ok', label: 'やめる', primary: true }, { go: 'dlg-close', label: '続ける' }]),
  'quit-ok': () => show({ name: 'dojo', selected: screen.mode === 'grad' ? 'grad' : screen.ch ?? undefined }),
  retest: () => (screen.view.grad ? goGrad() : goStep(screen.view.chapterId, 'test')),
  'open-next': (el) => show({ name: 'dojo', selected: el.dataset.ch }),
  rename: () => { overlay = nameEntryHTML({ mode: 'change', value: rec.profile.name ?? '' }); render(); },
  export: () => { downloadText(exportFileName(rec, today()), serialize(rec, new Date().toISOString())); commit(afterExport(rec)); },
  'home-howto': () => dialog(HOME_HOWTO.title, HOME_HOWTO.body),
  'sw-update': () => PWA?.apply(),
  import: importRecord,
  'import-ok': () => { if (pendingImport) commit(pendingImport); pendingImport = null; show({ name: 'title' }); },
  reset: () => dialog('記録を消して最初から', '<p>名前・段位・章の進み・復習の予定がすべて消えます。</p>', [{ go: 'reset-2', label: '消す', danger: true }, { go: 'dlg-close', label: 'やめる', primary: true }]),
  'reset-2': () => dialog('本当に消しますか？', '<p>消した記録は元に戻せません（書き出したファイルがあれば読み込めます）。</p>', [{ go: 'reset-ok', label: '本当に消す', danger: true }, { go: 'dlg-close', label: 'やめる', primary: true }]),
  'reset-ok': () => { storage.clear(); commit(emptyRecord(today())); show({ name: 'splash' }); splashTimer = setTimeout(afterSplash, 3400); },
};

// 設定画面の大きさのつまみと、あなたの声の選び直し
stage.addEventListener('change', (e) => {
  const el = e.target.closest?.('[data-snd]');
  if (!el || screen.name !== 'settings') return;
  const k = el.dataset.snd;
  setSound({ [k]: k === 'heroVoice' ? el.value : Number(el.value) });
  render();
});
stage.addEventListener('click', (e) => {
  if (screen.name === 'table') return;
  if (!gate.accept(performance.now(), e.detail)) return;
  const el = e.target.closest('[data-go]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.go];
  if (fn) fn(el);
  flushNotices();
});
// 起動演出はどのキーでも飛ばす。名前の欄の Enter で送る（変換中の Enter は送らない）
window.addEventListener('keydown', (e) => onKey(e, screen.name, { skip: afterSplash, submit: submitName }));
// 窓の大きさ・画面の大きさ・画面の向きが変わったら：卓の動きは最後まで飛ばしてから、並べ方と「縦にしてお使いください」を決め直して描き直す
// （設計書 段階5-3 第6節・段階5-5 第4節）
watchLayout(window, document.getElementById('viewport'), () => {
  table?.skipMotion();
  if (applyLayout()) render();
  fitStage(stage);
});

render();
splashTimer = setTimeout(afterSplash, 3400);
