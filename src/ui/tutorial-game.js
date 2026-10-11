// 遊び方のチュートリアルの卓（設計書 段階5-4 第4・5-4・6節）。台本（tutorial/runner.js で当てた場面の並び）を、
// いつもの卓の描き方（PC・縦）・動きの層（5-3）・音で流し、場面ごとに吹き出しを出す。「次へ」か、光っているボタンで進む。
// 対局の進行（table-game.js）とは別の部品で、成績・段位・コーチの判定には何も残さない（最後まで終えたら onDone で終えた印だけ）。
// opts：{ lesson（tutorial/lessons.js の1つ）, heroName, nextLesson（次の目次か null）, sound, soundOn(), onToggleSound(), motion(),
//         onDone(id)（最後の場面を終えたとき）, onNext(id)（「次の〇〇へ」）, onExit()（目次へ）}
import { tablePartsFor, viewFor, NOT_TABLE, motionFactor } from './table-game.js';
import { fitStage } from './table-view.js';
import { buildView } from './view-model.js';
import { buildCoachView } from './coach-view.js';
import { resultPanelHTML } from './result-banner.js';
import { createMotion } from './motion.js';
import { motionPlan, timedCues } from './motion-plan.js';
import { createCueTracker, handEndCues } from './sound-cues.js';
import { targetSelectors, placeBubble, bubbleHTML, dimRects } from './tutorial-bubble.js';
import { guarded } from './safe.js';
import { esc } from './format.js';
import { compileLesson } from '../tutorial/runner.js';
import { coachForView, shownTypeOf, HERO_SEAT } from '../game/session.js';

export const TUT_GAP_MS = 350; // 相手の行動と行動の間（1つずつ見えるように。速さの係数を掛ける）
const RING_PAD = 6; // 金の枠を部品から離す長さ
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// あなたの番の段：レイズの場面は2段（はじめは台本の目盛りのボタンだけ、押したらレイズのボタン）。
// 返す値：{ allow（押せる手番のボタン。なければ null）, presetTo（押せる目盛りのボタンの額。なければ null）}
export function heroStage(beat, presetDone) {
  if (!beat || beat.wait !== 'hero') return { allow: null, presetTo: null };
  if (beat.preset && !presetDone) return { allow: null, presetTo: beat.preset.to };
  return { allow: beat.allow, presetTo: null };
}

// 手番のボタン：押せるのは台本のボタンだけ（光る）。allow が null（あなたの番でない・目盛りのボタンを待っている）ならどれも押せない
export const buttonStates = (acts, allow) => acts.map((act) => ({ act, enabled: allow !== null && act === allow, glow: allow !== null && act === allow }));

// 場面のあとの動き：前の形と次の形の組の並び。kind：'deal'（前のハンドなし）・'act'（行動）・'close'（ハンドを閉じた）
export function stepsOf(beat) {
  const out = [];
  let from = beat.session;
  for (const to of beat.after) {
    out.push({ from, to, kind: to.hand === null ? 'close' : from.hand === null ? 'deal' : 'act' });
    from = to;
  }
  return out;
}

// 次の目次（最後のあとは null）
export function nextLessonOf(lessons, id) {
  const i = lessons.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < lessons.length ? lessons[i + 1] : null;
}

export function createTutorialGame(stage, opts) {
  const parts = tablePartsFor(stage.dataset.layout);
  const portrait = stage.dataset.layout === 'portrait';
  const refs = parts.mount(stage, { mark: '入門', name: opts.heroName ?? 'あなた', sub: 'チュートリアル' });
  const dial = parts.control(refs.dial, { onChange: () => {} });
  const ui = {
    dial, fast: false, result: null, tab: 'coach', freshDial: false, coachView: null, band: `チュートリアル　${opts.lesson.title}`, notices: [], flash: null, exam: null, grid: null,
  };
  let runId = 0;
  let manualFast = false;
  let compiled = null;
  let index = 0;
  let waiting = null; // 'next'（次へを待つ）・'hero'（光っているボタンを待つ）・null（動いている）
  let shown = null; // いま描いている { session, beat }
  let presetDone = false; // レイズの場面で、目盛りのボタンを押したか

  const motionCfg = () => { try { return opts.motion?.() ?? null; } catch (e) { console.error(e); return null; } };
  const motion = createMotion(stage, { reduce: () => !!motionCfg()?.reduce });
  const factor = () => motionFactor(manualFast, motionCfg());
  const tracker = createCueTracker();
  const cue = (list) => { try { opts.sound?.emit(list, { fast: manualFast, paused: () => refs.overlay.classList.contains('show') }); } catch (e) { console.error(e); } };
  const muteIcon = () => { refs.mute.textContent = opts.soundOn?.() === false ? '🔇' : '🔊'; };
  const layer = document.createElement('div');
  layer.className = 'tut-layer';
  stage.appendChild(layer);

  // 卓を描く。beat があればその場面（あなたの番ならコーチの分析と、押せるボタン）。
  // fresh：場面の最初の描画（額の所を目盛りの最初の額から始める）。描き直し（⏩・タブ・目盛りを押した）は今の額を保つ
  function draw(session, beat = null, { fresh = false } = {}) {
    if (motion.busy()) motion.skip();
    shown = { session, beat };
    const view = buildView(session);
    const hero = !!beat && beat.wait === 'hero';
    const { allow, presetTo } = heroStage(beat, presetDone);
    ui.fast = manualFast;
    // ハンドの終わりは手元の結果の札（段階5-5）。チュートリアルでは「次のハンドへ」を出さず、吹き出しの「次へ」で進む
    ui.result = session.hand && session.hand.street === 'complete' ? resultPanelHTML(view.result, { next: null }) : null;
    ui.coachView = buildCoachView({
      phase: beat && beat.analysis ? 'before' : 'idle', analysis: beat ? beat.analysis : null, verdict: null, review: [], handLog: [], error: null,
      coach: coachForView(session), players: session.tournament.players, typeOf: shownTypeOf(session),
    });
    ui.freshDial = fresh && hero;
    parts.render(refs, viewFor(view, hero), ui);
    ui.freshDial = false;
    const btns = [...refs.buttons.querySelectorAll('[data-act]')];
    buttonStates(btns.map((b) => b.dataset.act), allow).forEach((st, k) => {
      if (hero) btns[k].disabled = !st.enabled;
      btns[k].classList.toggle('tut-allow', st.glow);
    });
    // 額の所：光っている目盛りのボタンのほかは押せない（下の聞き役が止める）
    refs.dial.classList.add('tut-lock');
    for (const pb of refs.dial.querySelectorAll('.pb')) pb.classList.toggle('tut-allow', presetTo !== null && Number(pb.dataset.to) === presetTo);
  }

  // 指す部品の箱（舞台の座標。いくつかあれば囲む。席は名札まで含めた席の箱）
  function targetBox(point) {
    const s = stage.getBoundingClientRect();
    const k = stage.offsetWidth ? s.width / stage.offsetWidth : 1;
    const boxes = targetSelectors(point, portrait ? 'portrait' : 'pc')
      .map((sel) => stage.querySelector(sel)).filter(Boolean)
      .map((el) => (/^seat-/.test(point) ? el.closest('.seat') ?? el : el))
      .map((el) => { const r = el.getBoundingClientRect(); return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k }; })
      .filter((b) => b.w > 0 || b.h > 0);
    if (!boxes.length) return null;
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
  }

  // 吹き出しと金の枠を置く
  function place(beat, i) {
    layer.innerHTML = '';
    if (!beat) return;
    const t = beat.point ? targetBox(beat.point) : null;
    const ring = t && { x: t.x - RING_PAD, y: t.y - RING_PAD, w: t.w + RING_PAD * 2, h: t.h + RING_PAD * 2 };
    const stageBox = { x: 0, y: 0, w: stage.offsetWidth, h: stage.offsetHeight };
    for (const r of dimRects(ring, stageBox)) {
      const d = document.createElement('div');
      d.className = 'tut-dim';
      Object.assign(d.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
      layer.appendChild(d);
    }
    if (ring) {
      const el = document.createElement('div');
      el.className = 'tut-ring';
      Object.assign(el.style, { left: `${ring.x}px`, top: `${ring.y}px`, width: `${ring.w}px`, height: `${ring.h}px` });
      layer.appendChild(el);
    }
    const holder = document.createElement('div');
    holder.innerHTML = bubbleHTML({ say: beat.say, wait: beat.wait, index: i, total: compiled.beats.length });
    const bubble = holder.firstElementChild;
    layer.appendChild(bubble);
    const p = placeBubble(ring, stageBox, { w: bubble.offsetWidth, h: bubble.offsetHeight });
    Object.assign(bubble.style, { left: `${p.x}px`, top: `${p.y}px` });
  }

  // 場面で開くタブ（大会の状況）。縦は下から出る板も開く
  function setTab(tab) {
    ui.tab = tab ?? 'coach';
    if (portrait) { refs.sheet.hidden = !tab; refs.dim.hidden = !tab; }
  }

  function show(i) {
    index = i;
    presetDone = false;
    const beat = compiled.beats[i];
    setTab(beat.tab);
    draw(beat.session, beat, { fresh: true });
    waiting = beat.wait;
    place(beat, i);
  }

  // 1つの動き：位置を読む → 音 → 描く → 台本を流して待つ（5-3 の卓の進行と同じ順）
  async function transition({ from, to, kind }) {
    if (kind === 'close') { draw(to); return; }
    let plan = null;
    let before = {};
    try {
      plan = motionPlan(kind === 'deal' ? null : from.hand, to.hand, { factor: factor(), heroSeat: HERO_SEAT });
      before = motion.measure();
    } catch (e) {
      console.error(e);
      plan = null;
    }
    const whoOf = (seat) => to.tournament.players[seat]?.id ?? null;
    let cues = kind === 'deal' ? tracker.deal(to.hand) : tracker.step(to.hand, { whoOf });
    if (to.hand.street === 'complete') { try { cues = [...cues, ...handEndCues(to.hand, { whoOf, heroSeat: HERO_SEAT })]; } catch (e) { console.error(e); } }
    try { cue(plan ? timedCues(cues, plan.steps, HERO_SEAT) : cues); } catch (e) { console.error(e); }
    draw(to);
    if (plan) { try { await motion.play(plan, before); } catch (e) { console.error(e); } }
  }

  // 「次へ」か光っているボタンのあと：台本の動きを1つずつ流して、次の場面へ
  async function proceed(myRun) {
    const beat = compiled.beats[index];
    waiting = null;
    layer.innerHTML = '';
    for (const st of stepsOf(beat)) {
      if (myRun !== runId) return;
      await transition(st);
      if (myRun !== runId) return;
      if (st.kind === 'act') await sleep(Math.round(TUT_GAP_MS * factor()));
    }
    if (myRun !== runId) return;
    if (index + 1 < compiled.beats.length) show(index + 1);
    else finish();
  }

  function showOverlay(html) {
    refs.overlay.innerHTML = `<div class="ov-card">${html}</div>`;
    refs.overlay.dataset.kind = 'menu';
    refs.overlay.classList.add('show');
    motion.pause(); // 札が出ている間は動きを止めて待つ
  }
  function hideOverlay() {
    refs.overlay.classList.remove('show');
    refs.overlay.innerHTML = '';
    motion.resume();
  }

  function finish() {
    runId++;
    try { opts.onDone?.(opts.lesson.id); } catch (e) { console.error(e); }
    const next = opts.nextLesson;
    showOverlay(`<h3>「${esc(opts.lesson.title)}」はおしまいです</h3><p>目次に「済」の印を付けました。分からない所は、いつでも目次から見直せます。</p>
      ${next ? `<button class="mb main" data-tnext="1">次の「${esc(next.title)}」へ</button>` : ''}<button class="mb" data-texit="1">目次へ</button>`);
  }

  function showError(e) {
    console.error(e);
    runId++;
    waiting = null;
    layer.innerHTML = '';
    motion.skip();
    showOverlay(`<h1>問題が起きました</h1><p>チュートリアルを止めました。<br><small>${esc(String(e?.message ?? e))}</small></p><button class="mb" data-texit="1">目次へ</button>`);
  }
  const run = (fn) => guarded(() => fn(runId), showError);

  layer.addEventListener('click', (e) => {
    if (e.target.closest('[data-tut="next"]') && waiting === 'next') run(proceed);
  });
  refs.buttons.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || waiting !== 'hero' || b.dataset.act !== heroStage(compiled.beats[index], presetDone).allow) return;
    run(proceed);
  });
  // 額の所：押せるのは光っている目盛りのボタンだけ。ほかの目盛り・−/＋・溝・ホイールは、額の部品（dial.js・amount-bar.js）に届く前に止める。
  // 押したら額はその目盛りの額になり（額の部品が変える）、レイズのボタンが光る。そのあとは額を変えられない
  const presetHit = (e) => {
    const to = waiting === 'hero' ? heroStage(compiled.beats[index], presetDone).presetTo : null;
    return e.type === 'click' && to !== null && Number(e.target.closest?.('.pb')?.dataset.to) === to;
  };
  for (const type of ['click', 'pointerdown', 'wheel']) {
    refs.dial.addEventListener(type, (e) => {
      if (presetHit(e)) return;
      e.stopPropagation();
      if (type === 'wheel') e.preventDefault();
    }, { capture: true, passive: false });
  }
  refs.dial.addEventListener('click', (e) => {
    if (!presetHit(e)) return;
    presetDone = true;
    draw(shown.session, shown.beat);
  });
  // 卓を押したら、動いているものを最後まで飛ばす（5-3 と同じ）
  stage.firstElementChild?.addEventListener('click', (e) => {
    if (e.target.closest?.(NOT_TABLE)) return;
    if (motion.busy()) motion.skip();
  });
  refs.speed.addEventListener('click', () => { manualFast = !manualFast; if (shown) draw(shown.session, shown.beat); });
  muteIcon();
  refs.mute.addEventListener('click', () => {
    try { opts.onToggleSound?.(); } catch (e) { console.error(e); }
    muteIcon();
  });
  refs.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b && shown) { ui.tab = b.dataset.tab; draw(shown.session, shown.beat); }
  });
  refs.menu.addEventListener('click', () => {
    if (refs.overlay.classList.contains('show')) return;
    showOverlay('<h3>チュートリアルをやめますか？</h3><p>目次へ戻ります（終えた印は付きません）。</p><button class="mb" data-texit="1">やめる</button><button class="mb main" data-tback="1">続ける</button>');
  });
  refs.overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-tback]')) hideOverlay();
    if (e.target.closest('[data-texit]')) { runId++; opts.onExit(); }
    if (e.target.closest('[data-tnext]') && opts.nextLesson) { runId++; opts.onNext?.(opts.nextLesson.id); }
  });
  fitStage(stage);

  try {
    compiled = compileLesson(opts.lesson, { heroName: opts.heroName });
    show(0);
  } catch (e) {
    showError(e);
  }

  return {
    // 画面を離れるとき：進行を止める
    stop() { runId++; motion.skip(); },
    // 窓の大きさが変わった・画面を回したとき（main.js）：動きを最後まで飛ばし、吹き出しを置き直す
    skipMotion() {
      motion.skip();
      if (waiting) place(compiled.beats[index], index);
    },
  };
}
