// 卓のゲームの進行（自由対局・章の指南つき対局・本番大会・最終試験）。CPUの行動に間を置き、あなたの番ではコーチの分析を出してボタンを待つ。
// opts：{ mode（'free'|'chapter'|'main'|'exam'）, heroName, coach（続きの指南の状態）,
//         resume（本番大会・最終試験の続き：mainSnapshot の形か null）,
//         onSave(snapshot)（本番大会・最終試験：ハンドを配る前・あなたが行動するたび・ハンドの結果の帯を出す前に呼ぶ。続きの保存に使う）,
//         onAbandon()（本番大会を「この大会を終わりにする」・最終試験を「この試験を終わりにする」でやめたとき）,
//         exam（最終試験：この受験の途中 { decisions（足してきた判断の列）, tournaments, places, master（受験の前から達人か）}）,
//         onExamEnd({ verdicts, place, results })（試験の大会が終わったとき。dojo/actions.js の finishExamTournament の結果を返す）,
//         onExamRestart()（不合格・達人の受け直しで、新しい受験を始めるとき。新しい受験の途中を返す）,
//         chapter（章の対局のとき：{ id, label, seal, hideTypes, note（始め方の説明か null）,
//                  setup()（大会を始めるたびに呼ぶ。{ players, hideTypes, stacks, places, startLevel }）}）,
//         onHand(session, coachMode, decisions, { result, verdicts })（1ハンドごと。保存に使う。decisions は続けた大会の分も含む判断の列、
//           result はそのハンドの結果（handResult。出せなければ null）、verdicts はそのハンドの判断）,
//         onTournament(event)（大会が終わった・やめて判定したとき。dojo/stats.js の eventOf の1件。自由対局をメニューからやめたときは呼ばない。
//           昇段したら { label, quality, step } を返す。終わりの札に「昇段しました」と出す）,
//         onEnd(info)（大会が終わった・やめたとき）, onExit()（メニューから戻る）,
//         sound（音の指揮役 ui/sound.js。なければ鳴らさない）, soundOn()（音を出すか）, onToggleSound()（卓の右上のボタン。切り替えたあとの入／切を返す）,
//         motion()（動きの設定 { factor（速さの係数）, reduce（動きを減らすか）}。ui/motion-settings.js の motionNow。なければふつうの速さ）}
import { mountShell, renderAll, fitStage } from './table-view.js';
import { mountPortraitShell, renderPortrait } from './table-portrait.js';
import { createAmountBar } from './amount-bar.js';
import { createCueTracker, handEndCues, championOf } from './sound-cues.js';
import { createMotion } from './motion.js';
import { motionPlan, timedCues, RESULT_HOLD_MS } from './motion-plan.js';
import { FAST_FACTOR } from './motion-settings.js';
import { createDial } from './dial.js';
import { buildView } from './view-model.js';
import { clampTo } from './presets.js';
import { fmt, esc } from './format.js';
import { resultBannerHTML } from './result-banner.js';
import { buildCoachView, buildReport } from './coach-view.js';
import {
  reportHTML, luckLineHTML, mainEndHTML, examStartHTML, examEndHTML, examLeaks, tatsujinHTML, promoteHTML,
} from './coach-panel.js';
import { createOverlayMemo } from './overlay.js';
import { gridCells, gridHTML } from './range-grid.js';
import { buildRepeatView, repeatHTML } from './repeat-view.js';
import { guarded } from './safe.js';
import { createClickGate } from './click-gate.js';
import {
  createSession, dealNext, cpuAct, act, closeHand, isHeroTurn, heroAlive, analyzeHero, heroAct, HERO_SEAT,
  shownTypeOf, coachForView, levelNow, handResult,
} from '../game/session.js';
import { coachShows } from '../coach/levels.js';
import { canRepeat, repeatAnalysis, repeatSeed } from '../coach/repeat.js';
import { prizeShare } from '../engine/tournament.js';
import { legalActions } from '../engine/hand.js';
import { tallyOf, judgeGame, continueGame, createCarry, createResultBook } from '../dojo/chapter-game.js';
import { GAME_RULE, chapterOf } from '../dojo/chapters.js';
import { eventOf } from '../dojo/stats.js';
import { localDate } from '../dojo/dates.js';
import {
  createMainSession, restoreMainSession, dealMain, closeMain, finishMain, mainSnapshot, moveTexts, mainOutcome, resumeLabel, resumeHand,
} from '../game/main-event.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 卓の部品は、始めたときの並べ方で選ぶ（設計書 段階5-1 第3節）。縦：縦の枠・縦の描き方・額の部品（目盛り・スライダー・−/＋）、PC：いまの枠・描き方・丸いダイヤル。
// 額の部品とダイヤルは同じ形（set・clear・value）
export function tablePartsFor(layout) {
  return layout === 'portrait'
    ? { mount: mountPortraitShell, render: renderPortrait, control: createAmountBar }
    : { mount: mountShell, render: renderAll, control: createDial };
}

// 相手の手の表（13×13）の中身：あなたの番の分析に相手の推定があるときだけ。players：大会の顔ぶれ
export function gridOf(a, players) {
  if (!a || !(a.mode === 'ev' || (a.mode === 'allin' && a.main !== null))) return null;
  return { cells: gridCells(a.ranges[a.main]), title: `${players[a.opps[a.main]].name}の手（推定・13×13）` };
}
const IDLE = { phase: 'idle', analysis: null, verdict: null, handLog: [], review: [], error: null };

// 結果の帯を出しておく長さ：勝負になったハンドはいつも3秒（早回しでも）、ほかは速さの係数を掛ける（設計書 段階5-3 第4-1・5節）
export const resultHoldMs = (result, f) => (result?.showdown ? RESULT_HOLD_MS : Math.round(RESULT_HOLD_MS * f));
// 動きの速さの係数：⏩ を押している間と、あなたが降りたあとは「とても速い」。ほかは設定の速さ（cfg：motionNow の結果。読めなければふつう）
export const motionFactor = (fast, cfg) => (fast ? Math.min(FAST_FACTOR, cfg?.factor ?? 1) : cfg?.factor ?? 1);
// 描く形：あなたの番を待っているときだけ手番のボタンを出す（台本が流れている間は押せない形。流し終えて番が始まってから押せる）
export const viewFor = (view, waiting) => (waiting ? view : { ...view, controls: null });
// 卓を押したことにしない所：ボタン・右上の丸いボタン・メニューなどの札・手元・コーチの欄（PC）・コーチの板と上の段（縦）
export const NOT_TABLE = 'button, .rb, .overlay, .pane, .cp, .pt-sheet, .pt-dim, .pt-strip, .pt-top';
const MODES = [1, 2, 3, 4, 5].map((n) => `<button class="mb" data-start="${n}">段階${n}</button>`).join('');

export function createTableGame(stage, opts) {
  const chapter = opts.mode === 'chapter' ? opts.chapter : null;
  const exam = opts.mode === 'exam';
  const main = opts.mode === 'main' || exam; // 最終試験も本番大会と同じ多卓の大会の流れ
  const parts = tablePartsFor(stage.dataset.layout);
  const portrait = parts.mount === mountPortraitShell;
  const refs = parts.mount(stage, {
    mark: chapter ? chapter.seal : exam ? '試験' : main ? '本番' : '自由', name: opts.heroName,
    sub: chapter ? chapter.label : exam ? '最終試験' : main ? '本番大会' : '自由対局',
  });
  const dial = parts.control(refs.dial, { onChange: () => draw() });
  const ui = {
    dial, fast: false, banner: null, tab: 'coach', freshDial: false, coachView: null,
    band: chapter ? `${chapter.label}　指南つき対局・早回し` : exam ? '最終試験' : main ? '本番大会' : '自由対局　9人・上位3人入賞',
    notices: [], flash: null, // 本番大会の卓の移動のお知らせ（欄の下・卓の上の帯）
    exam: null, grid: null, // 描くたびに入れる：最終試験の受験の数・縦の板の手の表
  };
  const memo = createOverlayMemo(); // メニューの確認の札の前に出ていた札
  const gate = createClickGate(250); // 手番のボタンが出た直後の二度押しを無視する
  let session = null;
  let coachMode = 'auto';
  let manualFast = false;
  let waitingHero = false;
  let runId = 0;
  let ended = false;
  let coach = { ...IDLE };
  // 第5・6章：判断20回に届く前に終わった大会の判断（次の大会に足していく）
  const book = createCarry();
  const allDecisions = () => book.all(session ? session.decisions : []);
  // ハンドの結果（運と実力）と、大会の成績を1大会に1回だけ残すための帳簿
  const results = createResultBook();
  // 大会の成績を残す。昇段したら昇段の中身（promoteHTML に渡す形）を返す
  function recordTour(place) {
    const tour = results.close();
    if (!tour || !session) return null;
    return opts.onTournament?.(eventOf({ date: localDate(new Date()), kind: chapter ? chapter.id : main ? 'main' : 'free', place, results: tour, verdicts: session.decisions })) ?? null;
  }
  // 最終試験：この受験で前の大会までに足してきた判断・終えた大会の数・その順位（設計書 段階4-4 第4節）
  let attempt = { decisions: [], tournaments: 0, places: [], master: false, ...(opts.exam ?? {}) };
  const attemptDecisions = () => [...attempt.decisions, ...(session ? session.decisions : [])];

  const heroOut = () => session.hand && session.hand.seats[HERO_SEAT].folded;
  const speed = () => manualFast || heroOut();

  // 音（設計書 段階4-5 第4節）：あなたの卓のハンドの形が変わるたびに、前との違いを鳴らす。早回しの間は鳴らさない。
  // 音のどこが失敗しても、卓の進行は止めない
  const tracker = createCueTracker();
  const whoOf = (seat) => session.tournament.players[seat]?.id ?? null;
  // メニューなどの札が出ている間は鳴らさない（札の裏で卓が進んでも音を出さない。設計書 段階4-5 第4-3節）
  // 時間をおいて鳴らす音も、鳴らす時に札が出ていれば鳴らさない（段階5-3：音の時刻を動きにそろえたので、配る音などが遅れて鳴る）
  const cue = (list) => { try { opts.sound?.emit(list, { fast: speed(), paused: () => refs.overlay.classList.contains('show') }); } catch (e) { console.error(e); } };
  // 配ったときの音（卓に着いた人の掛け声も先読みする）
  function dealCues() {
    try { opts.sound?.prefetch(session.tournament.players.filter((_, i) => session.hand.seats[i]?.inHand).map((p) => p.id)); } catch (e) { console.error(e); }
    return tracker.deal(session.hand);
  }
  // ハンドが終わったら：ポットを取る音と一言を、最後の行動の音に足す（ポットを流す動きの時刻にそろう。設計書 段階5-3 第3-4節）
  function withEnd(list) {
    if (session.hand.street !== 'complete') return list;
    try {
      const championSeat = championOf(session.hand, { lastTable: !main || session.main.field.final });
      return [...list, ...handEndCues(session.hand, { whoOf, heroSeat: HERO_SEAT, championSeat })];
    } catch (e) {
      console.error(e);
      return list;
    }
  }
  const stepCues = () => withEnd(tracker.step(session.hand, { whoOf }));

  // 動き（設計書 段階5-3 第3・5・6節）：形が変わるたびに、前の形との違いを台本にして卓の上で流す。どこが失敗しても、卓の進行は止めない
  const motionCfg = () => { try { return opts.motion?.() ?? null; } catch (e) { console.error(e); return null; } };
  const motion = createMotion(stage, { reduce: () => !!motionCfg()?.reduce });
  const factor = () => motionFactor(speed(), motionCfg());
  // 描き直す前の位置を読み、音の時刻を台本にそろえて鳴らし、描いて、台本を流し終わるまで待つ。
  // prev：前のハンドの形（配ったときは null）、cues：音の並び、f：速さの係数
  async function show(prev, cues, f = factor()) {
    let plan = null;
    let before = {};
    let timed = cues;
    try {
      plan = motionPlan(prev, session.hand, { factor: f, heroSeat: HERO_SEAT });
      timed = timedCues(cues, plan.steps, HERO_SEAT);
      before = motion.measure();
    } catch (e) {
      console.error(e);
      plan = null;
    }
    cue(timed);
    draw();
    if (!plan) return;
    try { await motion.play(plan, before); } catch (e) { console.error(e); }
  }
  // 結果の帯を出しておく。その前でも、卓を押せば次へ
  let wake = null;
  const holdResult = (ms) => new Promise((resolve) => {
    const done = () => { clearTimeout(timer); wake = null; resolve(); };
    const timer = setTimeout(done, ms);
    wake = done;
  });
  const muteIcon = () => { refs.mute.textContent = opts.soundOn?.() === false ? '🔇' : '🔊'; };

  // 卓の上の帯（数秒で消える）
  let flashId = 0;
  function flash(text) {
    ui.flash = text;
    const id = ++flashId;
    setTimeout(() => { if (flashId === id) { ui.flash = null; draw(); } }, 3000);
  }

  function draw() {
    if (!session) return;
    if (motion.busy()) motion.skip(); // 動いている途中に描き直すときは、動きを最後まで飛ばしてから（位置がずれたまま動かさない）
    ui.fast = speed();
    if (main) ui.band = `${exam ? '最終試験' : '本番大会'}　${session.main.field.final ? '決勝卓' : `卓${session.main.table + 1}`}`;
    try {
      ui.coachView = buildCoachView({
        ...coach, coach: coachForView(session), players: session.tournament.players, typeOf: shownTypeOf(session),
      });
    } catch (e) {
      // コーチ欄の表示に失敗しても、卓は描き続ける（段階2の繰越）
      console.error(e);
      ui.coachView = buildCoachView({ ...IDLE, coach: coachForView(session), players: session.tournament.players, typeOf: shownTypeOf(session), error: 'コーチ欄を表示できませんでした' });
    }
    // 試験中は指南なし：コーチ欄は受験の判断の数だけ
    ui.exam = exam ? { decisions: attemptDecisions().length, tournaments: attempt.tournaments } : null;
    // 縦の並べ方の板の「手の表」のタブ
    ui.grid = portrait ? gridOf(coach.analysis, session.tournament.players) : null;
    parts.render(refs, viewFor(buildView(session), waitingHero), ui);
    const n = allDecisions().length;
    refs.stop.hidden = !chapter || ended || n < GAME_RULE.minDecisions;
    refs.stop.textContent = `やめて判定する（判断${n}回）`;
  }

  function showOverlay(html, kind = 'menu') {
    refs.overlay.innerHTML = kind === 'grid' || kind === 'repeat' ? html : `<div class="ov-card">${html}</div>`;
    refs.overlay.dataset.kind = kind;
    refs.overlay.classList.add('show');
    gate.arm(performance.now()); // 札が出た直後のクリック・ダブルクリックの2回目で、札のボタンを押さない
    motion.pause(); // 札が出ている間は、動きを止めて待つ（設計書 段階5-3 第6節）
  }
  function hideOverlay() {
    refs.overlay.classList.remove('show');
    refs.overlay.innerHTML = '';
    motion.resume();
  }
  const currentOverlay = () => (refs.overlay.classList.contains('show') ? { html: refs.overlay.innerHTML, kind: refs.overlay.dataset.kind } : null);

  function showError(e) {
    console.error(e);
    runId++;
    waitingHero = false;
    motion.skip();
    // 第5・6章は、繰り越した判断を残したまま次の大会を始める（段階4-2 第8節）
    const keep = chapter && chapterOf(chapter.id).keepGoing;
    // 本番大会・最終試験は、最後の保存から続けられる（タイトルの「本番大会」・道場の「最終試験」から）
    const again = main ? '' : keep ? '<button class="mb" data-start="next">次の大会から続ける</button>' : '<button class="mb" data-start="again">もう一度始める</button>';
    const where = exam ? '続きは、道場の「最終試験」から始められます。' : main ? '続きは、タイトルの「本番大会」から始められます。' : '';
    showOverlay(`<h1>問題が起きました</h1><p>ゲームの進行中にエラーが出たため止めました。${where}<br><small>${esc(String(e?.message ?? e))}</small></p>${again}<button class="mb" data-exit="1">戻る</button>`);
  }

  // 非同期の進行は必ずこれを通す（例外で画面が黙って止まらないように）
  const run = (fn) => guarded(() => fn(runId), showError);

  // あなたの手番の始まり：コーチの分析を出し、ダイヤルを新しい判断の額にする
  function startHeroTurn() {
    waitingHero = true;
    gate.arm(performance.now());
    ui.freshDial = true;
    try {
      const analysis = analyzeHero(session);
      coach = { ...coach, phase: 'before', analysis, verdict: null, error: null };
      if (coachShows(levelNow(session, analysis.situation), 'before') !== 'none') ui.tab = 'coach';
    } catch (e) {
      console.error(e);
      coach = { ...coach, phase: 'idle', analysis: null, verdict: null, error: 'コーチの計算に失敗しました（この判断は採点しません）' };
    }
    draw();
  }

  async function play(myRun) {
    while (myRun === runId) {
      if (main) {
        // 本番大会・最終試験：配る前に続きを保存する（あなたが行動するたびにも保存し、閉じた所から続ける）
        opts.onSave?.(mainSnapshot(session, results.all()));
        session = dealMain(session);
      } else session = dealNext(session);
      // 前のハンドの採点は次の配りに持ち越さない（段階4の振り返りは残す。段階2の繰越）
      coach = { ...coach, phase: coach.phase === 'review' ? 'review' : 'idle', analysis: null, verdict: null, handLog: [] };
      ui.banner = null;
      await show(null, withEnd(dealCues()));
      while (session.hand.street !== 'complete') {
        if (myRun !== runId) return;
        if (isHeroTurn(session)) {
          startHeroTurn();
          return; // ボタンが押されたら heroAction から再開する
        }
        await sleep(speed() ? 100 : 700);
        if (myRun !== runId) return;
        const prev = session.hand;
        session = cpuAct(session);
        await show(prev, stepCues());
      }
      await finishHandAndMaybeEnd(myRun);
      if (myRun !== runId || ended) return;
    }
  }

  // 終わったときの札。reason：'bust'（敗退）・'win'（優勝）・'stop'（やめて判定）
  // outcome：本番大会・最終試験の結果（mainOutcome）、done：closeMainHand で済ませた記録（{ promoted, examEnd }）
  function endGame(reason, outcome = null, done = {}) {
    ended = true;
    runId++;
    waitingHero = false;
    coach = { ...coach, phase: 'idle', analysis: null, verdict: null };
    draw();
    if (exam) {
      showExamEnd(outcome, done.examEnd);
      return;
    }
    const report = reportHTML(buildReport(allDecisions(), session.coach)) + luckLineHTML(results.all());
    if (main) {
      showOverlay(`${mainEndHTML(outcome, report)}${promoteHTML(done.promoted)}<button class="mb" data-start="again">もう一度</button><button class="mb" data-exit="1">タイトルへ</button>`);
      return;
    }
    const me = session.tournament.players[HERO_SEAT];
    const promoted = recordTour(reason === 'stop' ? null : me.place);
    if (chapter) {
      const tally = tallyOf(allDecisions());
      const j = judgeGame(tally);
      opts.onEnd({ kind: 'chapter', tally, judge: j, coach: session.coach });
      const head = reason === 'stop' ? 'やめて判定しました' : me.place === 1 ? '優勝！' : `${me.place}位で終わりました`;
      const verdict = j.passed
        ? `<h1 class="pass">合格</h1><p>判断${tally.decisions}回・正答率 ${Math.round(j.accuracy * 100)}%。章末試験に進めます。</p>`
        : `<h1>もう一歩</h1><p>判断${tally.decisions}回・正答率 ${Math.round(j.accuracy * 100)}%（合格は判断${GAME_RULE.minDecisions}回以上で${Math.round(GAME_RULE.passAccuracy * 100)}%以上）。</p>`;
      showOverlay(`<h3>${head}</h3>${verdict}<h3>判断の成績</h3>${report}${promoteHTML(promoted)}<button class="mb" data-exit="1">道場へ戻る</button><button class="mb" data-start="again">もう一度</button>`);
      return;
    }
    opts.onEnd({ kind: 'free', coach: session.coach, coachMode });
    const share = prizeShare(session.tournament, me.place);
    const title = me.place === 1 ? '優勝！' : share > 0 ? `${me.place}位入賞` : `${me.place}位で敗退`;
    const detail = share > 0 ? `賞金の${Math.round(share * 100)}%を獲得しました` : '入賞は3位までです。もう一度挑戦しましょう';
    showOverlay(`<h1>${title}</h1><p>${detail}（${session.tournament.handNumber}ハンド）</p><h3>判断の成績</h3>${report}${promoteHTML(promoted)}<button class="mb" data-start="again">もう一度</button><button class="mb" data-exit="1">タイトルへ</button>`);
  }

  // 試験の大会の終わりの札。r：onExamEnd の結果 { result, tally, promoted }
  function showExamEnd(outcome, r) {
    const all = attemptDecisions();
    const report = reportHTML(buildReport(all, session.coach), { noCoach: true }) + luckLineHTML(results.all());
    const places = [...attempt.places, outcome.place];
    const counted = r.result === 'pass' || (r.result === 'fail' && attempt.master);
    const titles = counted ? { wins: places.filter((p) => p === 1).length, cashes: places.filter((p) => p <= 6).length } : null;
    const leaks = r.result === 'fail' ? examLeaks(all) : [];
    const dan = r.promoted && r.promoted.to < 4 ? promoteHTML(r.promoted) : '';
    showOverlay(`${examEndHTML(outcome, { result: r.result, tally: r.tally, report, titles, leaks, master: attempt.master })}${dan}`);
    // 次の試験の大会に足していく（100回に届かなかったとき）
    if (r.result === 'continue') attempt = { ...attempt, decisions: all.map(({ situation, loss, correct }) => ({ situation, loss, correct })), tournaments: attempt.tournaments + 1, places };
  }

  // 本番大会のハンドの終わり：ほかの卓のハンドを打って卓を動かし、ハンドの記録と続きの保存（大会が終わったら大会の記録）まで済ませる。
  // 結果の帯を出す前に呼ぶ（帯の間に閉じても、このハンドを配り直さない）。卓の表示は帯が消えるまで変えない。
  // 返す値：{ session（まとめたあとの対局）, texts（あなたの卓に関わる移動のお知らせ）, outcome（大会が終わったら mainOutcome、続くなら null）}
  function closeMainHand(result, verdicts) {
    const before = session.main.table;
    const closed = closeMain(session);
    const f = closed.session.main.field;
    const texts = moveTexts(closed.moves, f, before);
    if (result) results.add(result);
    opts.onHand?.(closed.session, coachMode, allDecisions(), { result, verdicts });
    if (!f.finished && f.people[0].stack > 0) {
      opts.onSave?.(mainSnapshot(closed.session, results.all()));
      return { session: closed.session, texts, outcome: null };
    }
    // あなたが飛んだら、残りを最後まで回して優勝者を出す（終わりの札の文にだけ使い、卓の表示は飛んだときのまま）
    const done = f.finished ? f : finishMain(closed.session).main.field;
    const outcome = mainOutcome(done, f.round);
    ended = true;
    if (exam) {
      // 最終試験：大会の成績と受験の判断を記録し、100回を超えていれば合否を決める（dojo/actions.js の finishExamTournament）
      const examEnd = opts.onExamEnd({ verdicts: closed.session.decisions, place: outcome.place, results: results.close() ?? [] });
      return { session: closed.session, texts, outcome, examEnd };
    }
    const promoted = recordTour(outcome.place);
    opts.onEnd({ kind: 'main', coach: closed.session.coach, coachMode, place: outcome.place });
    return { session: closed.session, texts, outcome, promoted };
  }

  async function finishHandAndMaybeEnd(myRun) {
    // 最後の台本を待っている間に卓をやめていたら、何もしない（記録・続きの保存・大会の成績を書き戻さない）
    if (myRun !== runId) return;
    const view = buildView(session);
    ui.banner = resultBannerHTML(view.result); // 音（ポットを取る音・一言）は、最後の行動の音といっしょに鳴らした
    // 段階4の場面の判断は、ハンドが終わってからまとめて振り返る
    const review = coach.handLog.filter((d) => coachShows(d.level, 'handEnd') === 'review');
    if (review.length) {
      coach = { ...coach, phase: 'review', review, analysis: null, verdict: null };
      ui.tab = 'coach';
    }
    // ハンドの結果は closeHand の前に出す（ハンドの初めの持ち点を使う）。失敗しても対局は続ける
    let result = null;
    try {
      result = handResult(session);
    } catch (e) {
      console.error(e);
    }
    const handNo = session.tournament.handNumber + 1;
    const verdicts = session.decisions.filter((d) => d.handNo === handNo);
    const closed = main ? closeMainHand(result, verdicts) : null;
    draw();
    await holdResult(resultHoldMs(view.result, factor()));
    if (myRun !== runId) return;
    ui.banner = null;
    if (main) {
      session = closed.session;
      if (closed.texts.length) {
        ui.notices = closed.texts;
        flash(closed.texts[0]);
      }
      if (closed.outcome) endGame(closed.outcome.place === 1 ? 'win' : 'bust', closed.outcome, closed);
      return;
    }
    session = closeHand(session);
    if (result) results.add(result);
    opts.onHand?.(session, coachMode, allDecisions(), { result, verdicts });
    const me = session.tournament.players[HERO_SEAT];
    if (!session.tournament.finished && me.stack > 0) return;
    if (chapter && continueGame(chapter.id, tallyOf(allDecisions()))) offerNext(me);
    else endGame(me.place === 1 ? 'win' : 'bust');
  }

  // 第5・6章：判断20回に届く前に大会が終わった。同じ形の次の大会を続ける（判断の数は足していく）
  function offerNext(me) {
    runId++;
    waitingHero = false;
    coach = { ...coach, phase: 'idle', analysis: null, verdict: null };
    draw();
    const promoted = recordTour(me.place);
    const head = me.place === 1 ? '優勝！' : `${me.place}位で終わりました`;
    showOverlay(`<h3>${head}</h3><p>ここまで判断${allDecisions().length}回。判断${GAME_RULE.minDecisions}回に届くまで、同じ形の次の大会を続けます（判断の数は足していきます）。</p>${promoteHTML(promoted)}
      <button class="mb main" data-start="next">次の大会へ</button><button class="mb" data-quit="1">やめて判定する</button>`);
  }

  async function resumeAfterHero(myRun) {
    while (session.hand.street !== 'complete') {
      if (myRun !== runId) return;
      if (isHeroTurn(session)) { startHeroTurn(); return; }
      await sleep(speed() ? 100 : 700);
      if (myRun !== runId) return;
      const prev = session.hand;
      session = cpuAct(session);
      await show(prev, stepCues());
    }
    await finishHandAndMaybeEnd(myRun);
    if (myRun !== runId || ended || session.tournament.finished || !heroAlive(session)) return;
    await play(myRun);
  }

  function heroAction(type) {
    if (!waitingHero || !isHeroTurn(session)) return; // 手番でないときの二度押しなどは無視
    const legal = legalActions(session.hand);
    let action = { type };
    if (type === 'raise') {
      if (!legal.raise) return;
      action = { type: 'raise', to: clampTo(dial.value() ?? legal.raise.min, legal.raise) };
    }
    waitingHero = false;
    const f = factor(); // あなたの行動は、行動する前の速さで動かす（降りたら、その次の動きから早回し）
    const prev = session.hand;
    let graded = null;
    if (coach.analysis) {
      try {
        graded = heroAct(session, action, coach.analysis);
      } catch (e) {
        console.error(e);
        coach = { ...coach, error: '採点に失敗しました（この判断は記録しません）' };
      }
    }
    if (graded) {
      session = graded.session;
      const v = graded.verdict;
      coach = { ...coach, phase: 'after', verdict: v, handLog: [...coach.handLog, v] };
      if (coachShows(v.level, 'after', v.grade) !== 'none' || v.change) ui.tab = 'coach';
    } else {
      session = act(session, action);
      coach = { ...coach, phase: 'idle', analysis: null };
    }
    // 本番大会・最終試験：行動するたびに続きを保存する（閉じても、閉じた所から続く。設計書 段階4-4 第6節）
    if (main) opts.onSave?.(mainSnapshot(session, results.all()));
    run(async (myRun) => {
      await show(prev, stepCues(), f);
      if (myRun === runId) await resumeAfterHero(myRun);
    });
  }

  function showGrid() {
    const g = gridOf(coach.analysis, session.tournament.players);
    if (g) showOverlay(gridHTML(g.cells, esc(g.title)), 'grid');
  }

  // 1万回やり直す：いまの判断（行動のあとは、あなたの選んだ手に印）。乱数の元は大会の種・ハンドの番号・判断の番号から
  let repeatCtx = null;
  const drawRepeat = (focus) => showOverlay(repeatHTML(buildRepeatView(repeatCtx.analysis, repeatCtx.rows, focus)), 'repeat');
  function showRepeat() {
    const a = coach.analysis;
    if (!a || !canRepeat(a)) return;
    const after = coach.phase === 'after';
    const k = after ? session.decisions.length - 1 : session.decisions.length;
    repeatCtx = { analysis: a, rows: repeatAnalysis(a, repeatSeed(session.seed, session.tournament.handNumber, k), after ? coach.verdict.action : null) };
    drawRepeat(null);
  }

  // mode：'auto'・1〜5（自由対局の指南）／'chapter'（章の対局を始める）／'again'（もう一度）／'next'（第5・6章の次の大会）
  // 本番大会を始める：'auto'・1〜5（指南の段階を選ぶ）／'again'（もう一度）／'resume'（続きから）
  // 最終試験：'exam'（受験の大会を始める）／'exam-next'（100回に届くまで次の大会）／'exam-again'（新しい受験）／'resume'（続きから）
  function startMain(mode) {
    if (!exam && mode !== 'again' && mode !== 'resume') coachMode = mode === 'auto' ? 'auto' : Number(mode);
    if (mode === 'exam-again') attempt = { decisions: [], tournaments: 0, places: [], master: attempt.master, ...(opts.onExamRestart?.() ?? {}) };
    runId++;
    ended = false;
    hideOverlay();
    results.start(false);
    coach = { ...IDLE };
    waitingHero = false;
    ui.notices = [];
    ui.flash = null;
    if (mode === 'resume') {
      session = restoreMainSession(opts.resume, { coach: opts.coach });
      coachMode = opts.resume.coachMode;
      for (const r of opts.resume.results) results.add(r);
      if (opts.resume.hand) {
        // ハンドの途中で閉じた：閉じたときの場面までたどり直す。合わなければ、そのハンドは初めから
        const back = resumeHand(session, opts.resume.hand);
        if (back) {
          session = back;
          tracker.reset(session.hand); // たどり直した行動は鳴らさない（設計書 段階4-5 第4-3節）
          coach = { ...coach, handLog: session.decisions.filter((d) => d.handNo === session.tournament.handNumber + 1) };
          flash('前に閉じたところから続けます');
          run(resumeAfterHero);
          return;
        }
        flash('前のハンドは初めからやり直します（続きの場面が合わなかったため）');
      }
    } else {
      session = createMainSession({ seed: Date.now() % 2147483647, coachMode, coach: coachMode === 'auto' ? (session?.coach ?? opts.coach) : null, heroName: opts.heroName, exam });
    }
    run(play);
  }

  function start(mode) {
    if (main) { startMain(mode); return; }
    if (mode !== 'again' && mode !== 'next' && !chapter) coachMode = mode === 'auto' ? 'auto' : Number(mode);
    // 次の大会へ：終わった大会の判断を繰り越してから、新しい大会を作る。ほかは数え直す
    if (mode === 'next' && session) book.carry(session.decisions);
    else book.reset();
    results.start(mode === 'next');
    runId++;
    ended = false;
    hideOverlay();
    const st = chapter ? chapter.setup() : null; // 章の対局は、始めるたびに顔ぶれと始め方を作り直す
    session = createSession({
      seed: Date.now() % 2147483647,
      coachMode: chapter ? 'auto' : coachMode,
      coach: chapter || coachMode === 'auto' ? (session?.coach ?? opts.coach) : null,
      heroName: opts.heroName,
      players: st?.players,
      hideTypes: st?.hideTypes ?? false,
      stacks: st?.stacks ?? null,
      places: st?.places ?? null,
      startLevel: st?.startLevel ?? 0,
      handsPerLevel: chapter ? GAME_RULE.handsPerLevel : 8,
      minLevel: chapter ? GAME_RULE.minCoachLevel : 1,
    });
    coach = { ...IDLE };
    waitingHero = false;
    run(play);
  }

  function confirmExit() {
    if (ended) { opts.onExit(); return; }
    memo.keep(currentOverlay()); // 「続ける」で、いま出ている札（「次の大会へ」の札など）に戻す
    if (exam) {
      showOverlay(`<h3>最終試験をやめますか？</h3><p>中断すると、道場の「最終試験」から続きを始められます（閉じた所から続きます）。終わりにすると、この受験はなかったことになります（合否に数えません）。</p>
        <button class="mb main" data-suspend="1">中断する（あとで続ける）</button><button class="mb" data-abandon="1">この試験を終わりにする</button><button class="mb" data-back="1">続ける</button>`);
      return;
    }
    if (main) {
      showOverlay(`<h3>本番大会をやめますか？</h3><p>中断すると、タイトルの「本番大会」から続きを始められます（閉じた所から続きます）。終わりにした大会は、大会の成績に残りません。</p>
        <button class="mb main" data-suspend="1">中断する（あとで続ける）</button><button class="mb" data-abandon="1">この大会を終わりにする</button><button class="mb" data-back="1">続ける</button>`);
      return;
    }
    const n = allDecisions().length;
    const note = chapter ? `ここまでの判断${n}回で判定します（判断${GAME_RULE.minDecisions}回に届いていなければ不合格）。` : 'この大会は記録されません。';
    showOverlay(`<h3>対局をやめますか？</h3><p>${note}</p><button class="mb" data-quit="1">やめる</button><button class="mb" data-back="1">続ける</button>`);
  }

  refs.buttons.addEventListener('click', (e) => {
    if (!gate.accept(performance.now(), e.detail)) return;
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) heroAction(b.dataset.act);
  });
  refs.speed.addEventListener('click', () => { manualFast = !manualFast; draw(); });
  // 卓の右上の 🔊／🔇：音を出す・出さないを切り替える（設定にも残る）
  muteIcon();
  refs.mute.addEventListener('click', () => {
    try { opts.onToggleSound?.(); } catch (e) { console.error(e); }
    muteIcon();
  });
  refs.menu.addEventListener('click', confirmExit);
  refs.stop.addEventListener('click', () => endGame('stop'));
  refs.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) { ui.tab = b.dataset.tab; draw(); }
  });
  refs.coach.addEventListener('click', (e) => {
    if (e.target.closest('[data-grid]')) showGrid();
    if (e.target.closest('[data-repeat]')) showRepeat();
  });
  // 卓を押したら：動いているものを最後まで飛ばす。結果の帯が出ているときは、待たずに次のハンドへ（設計書 段階5-3 第5節）
  stage.firstElementChild?.addEventListener('click', (e) => {
    if (e.target.closest?.(NOT_TABLE)) return;
    if (motion.busy()) motion.skip();
    else wake?.();
  });
  refs.overlay.addEventListener('click', (e) => {
    if (!gate.accept(performance.now(), e.detail)) return;
    const s = e.target.closest('[data-start]');
    if (s) start(s.dataset.start);
    if (e.target.closest('[data-close]')) hideOverlay();
    if (e.target.closest('[data-master]')) showOverlay(tatsujinHTML(opts.heroName));
    if (e.target.closest('[data-back]')) {
      const prev = memo.back();
      if (prev) {
        refs.overlay.innerHTML = prev.html;
        refs.overlay.dataset.kind = prev.kind;
        refs.overlay.classList.add('show');
        gate.arm(performance.now());
      } else hideOverlay();
    }
    if (e.target.closest('[data-suspend]')) { runId++; ended = true; opts.onExit(); }
    if (e.target.closest('[data-abandon]')) { runId++; ended = true; opts.onAbandon?.(); opts.onExit(); }
    const rp = e.target.closest('[data-rp]');
    if (rp && repeatCtx) drawRepeat(Number(rp.dataset.rp));
    if (e.target.closest('[data-exit]')) opts.onExit();
    if (e.target.closest('[data-quit]')) {
      if (chapter && session) endGame('stop');
      else { runId++; opts.onExit(); }
    }
  });
  fitStage(stage);

  if (main && opts.resume) {
    showOverlay(`<h1>${exam ? '最終試験' : '本番大会'}の続き</h1><p>${esc(resumeLabel(opts.resume.field))}から続けます（閉じた所から続きます）。</p>
      <button class="mb main" data-start="resume">続きから</button><button class="mb" data-exit="1">${exam ? '道場へ戻る' : 'タイトルへ'}</button>`);
  } else if (exam) {
    showOverlay(examStartHTML({ decisions: attempt.decisions.length, tournaments: attempt.tournaments }));
  } else if (main) {
    showOverlay(`<h1>本番大会</h1><p>45人・9人×5卓・上位6人入賞・開始20,000点（10ハンドごとにブラインドが上がる）</p>
<p>指南（コーチ）の段階を選んで始めます。途中で閉じても、タイトルの「本番大会」から続きを始められます</p>
<div class="modes"><button class="mb main" data-start="auto">自動で始める（おすすめ）</button>${MODES}</div>
<p><small>1：行動の前に最善手と理由　2：考えるきっかけ→行動の後に正誤　3：間違えた時だけ指摘<br>4：ハンドの後に振り返り　5：大会の後に成績だけ　自動：場面ごとに上達に合わせて段階を進めます</small></p>
<button class="mb" data-exit="1">タイトルへ</button>`);
  } else if (chapter) {
    showOverlay(`<h1>${esc(chapter.label)}　指南つき対局</h1><p>9人のトーナメント・早回し（${GAME_RULE.handsPerLevel}ハンドごとにブラインドが上がる）<br>
      判断${GAME_RULE.minDecisions}回以上で正答率${Math.round(GAME_RULE.passAccuracy * 100)}%以上なら合格。判断${GAME_RULE.minDecisions}回を超えたら、いつでも「やめて判定する」で終われます。</p>
      ${chapter.note ? `<p>${esc(chapter.note)}<br>判断${GAME_RULE.minDecisions}回に届く前に大会が終わったら、同じ形の次の大会を続けます。</p>` : ''}
      ${chapter.hideTypes ? '<p>この章では相手のタイプを伏せます（コーチ欄は「？」）。</p>' : ''}
      <button class="mb main" data-start="chapter">始める</button><button class="mb" data-exit="1">戻る</button>`);
  } else {
    showOverlay(`<h1>自由対局</h1><p>9人のトーナメント・上位3人入賞・開始20,000点</p>
<p>指南（コーチ）の段階を選んで始めます</p>
<div class="modes"><button class="mb main" data-start="auto">自動で始める（おすすめ）</button>${MODES}</div>
<p><small>1：行動の前に最善手と理由　2：考えるきっかけ→行動の後に正誤　3：間違えた時だけ指摘<br>4：ハンドの後に振り返り　5：大会の後に成績だけ　自動：場面ごとに上達に合わせて段階を進めます</small></p>
<button class="mb" data-exit="1">タイトルへ</button>`);
  }

  return {
    // 画面を離れるとき：進行を止める
    stop() { runId++; ended = true; motion.skip(); },
    skipMotion: () => motion.skip(), // 窓の大きさが変わった・画面を回したとき（main.js）
    session: () => session,
  };
}
