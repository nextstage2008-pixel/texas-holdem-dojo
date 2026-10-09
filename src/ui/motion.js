// 動きの層（設計書 段階5-3 第3-2・5・6節）。卓の上に薄い層を重ね、台本（motion-plan.js）どおりにカードとチップの写しを飛ばす。
// 位置は描いた部品の目印 data-mv から画面で読む（PC の卓と縦の卓で同じ部品）：
//   seat-<表示位置>（席。チップの出どころ・行き先）・stack-<表示位置>（名札の持ち点。縦の卓のあなたは席の絵がないので、これを席の代わりにする）・
//   cards-<表示位置>（その人の札）・bet-<表示位置>（賭けた額）・pot（ポット）・
//   board-<k>（場の札の k 枚目）・dealer（ディーラーの印＝山）・center（卓の中央。ポットがないときの行き先）。
// あなたはいつも席0なので、台本の席の番号と表示位置は同じ。
// 動きは Web Animations だけで作る（止める・続ける・飛ばすを、並べた動きにまとめて効かせる）。本物の札とチップは、写しが着くまで隠す
import { cardBackHTML } from './cards.js';

export const FADE_MS = 150; // 動きを減らすとき、行き先にふわっと出す長さ
const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const boxAt = ([x, y], w, h) => ({ x: x - w / 2, y: y - h / 2, w, h });
const CHIP = 20; // チップの写しの大きさ

// stage：舞台（#stage。拡大縮小の変形がかかっている）。reduce()：動きを減らすか
export function createMotion(stage, { reduce = () => false } = {}) {
  let layer = null;
  let anims = [];
  let paused = false; // メニューなどの札が出ている間（その間に始めた動きも止めておく）
  let own = null; // いま並べている台本の動き（台本ごとに、自分の動きだけを待って片付ける）
  const ensureLayer = () => {
    if (!layer || !stage.contains(layer)) {
      layer = document.createElement('div');
      layer.className = 'mv-layer';
      stage.appendChild(layer);
    }
    return layer;
  };
  const scale = () => (stage.offsetWidth ? stage.getBoundingClientRect().width / stage.offsetWidth : 1) || 1;

  // 目印のある部品の位置（舞台の左上からのピクセル）。{ 目印: { x, y, w, h, el } }
  function measure() {
    const s = stage.getBoundingClientRect();
    const k = scale();
    const out = {};
    for (const el of stage.querySelectorAll('[data-mv]')) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      out[el.dataset.mv] = { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k, el };
    }
    return out;
  }

  const track = (a) => {
    anims.push(a);
    own?.push(a);
    if (paused) { try { a.pause(); } catch { /* 止められない動き */ } }
    return a;
  };
  // 写し：at に from（点）を出て、ms で to（箱）に着く。着くまで見えず、着いたら消える（本物がそこに出る）。hold：着いてから見せておく長さ
  function fly(html, cls, from, to, at, ms, { fade = false, hold = 0 } = {}) {
    const g = document.createElement('div');
    g.className = `mv-ghost ${cls}`;
    g.innerHTML = html;
    Object.assign(g.style, { left: `${to.x}px`, top: `${to.y}px`, width: `${to.w}px`, height: `${to.h}px` });
    ensureLayer().appendChild(g);
    const [cx, cy] = mid(to);
    track(g.animate([{ transform: `translate(${from[0] - cx}px, ${from[1] - cy}px)`, opacity: 1 }, { transform: 'translate(0px, 0px)', opacity: fade ? 0 : 1 }],
      { delay: at, duration: Math.max(ms, 1), easing: 'cubic-bezier(.2,.7,.3,1)' }));
    if (hold > 0) track(g.animate([{ opacity: 1 }, { opacity: 1 }], { delay: at + ms, duration: hold }));
    return g;
  }
  // 伏せた札を、その場に until まで見せておく（勝負で見せる前・場の札を返す前）
  function holdBacks(box, n, until) {
    if (until <= 0) return;
    const g = document.createElement('div');
    g.className = 'mv-ghost backs2';
    g.innerHTML = cardBackHTML().repeat(n);
    Object.assign(g.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
    ensureLayer().appendChild(g);
    track(g.animate([{ opacity: 1 }, { opacity: 1 }], { duration: until }));
  }
  // 本物を until まで隠す（動きを減らすときは、着く前にふわっと出す）
  function arrive(el, until) {
    if (!el || until <= 0) return;
    if (reduce()) track(el.animate([{ opacity: 0 }, { opacity: 1 }], { delay: Math.max(0, until - FADE_MS), duration: FADE_MS, fill: 'backwards' }));
    else track(el.animate([{ visibility: 'hidden' }, { visibility: 'hidden' }], { duration: until }));
  }
  // 本物を返す：at から ms で、横に縮めた形から開く（それまでは見えない）。動きを減らすときはふわっと出す
  function flipIn(el, at, ms) {
    if (!el) return;
    if (reduce()) track(el.animate([{ opacity: 0 }, { opacity: 1 }], { delay: at, duration: Math.min(Math.max(ms, 1), FADE_MS), fill: 'backwards' }));
    else track(el.animate([{ scale: '0 1' }, { scale: '1 1' }], { delay: at, duration: Math.max(ms, 1), fill: 'backwards' }));
  }
  // 名札の中身を until まで前のまま（描き直した新しい名札に、前の中身を出しておく。勝ってチップが流れ着いたら増える）
  function holdPlate(el, html, until) {
    if (!el || html == null || until <= 0 || el.innerHTML === html) return;
    const cur = el.innerHTML;
    el.innerHTML = html;
    const put = () => { el.innerHTML = cur; };
    track(stage.animate([{}, {}], { duration: until })).finished.then(put, put);
  }
  // 舞台に印 cls を付け、until に外す（光らせる前・勝った人の札を出す前）
  function markUntil(cls, until) {
    stage.classList.add(cls);
    const off = () => stage.classList.remove(cls);
    track(stage.animate([{}, {}], { duration: Math.max(until, 1) })).finished.then(off, off);
  }

  // 台本を流す（描き直したあとに呼ぶ）。before：描き直す前に measure() で読んだ位置。全部が終わったら解決する
  async function play(plan, before = {}) {
    if (!plan || !plan.steps.length) return;
    const mine = [];
    own = mine;
    try {
      lay(plan, before);
    } finally {
      own = null;
    }
    await Promise.allSettled(mine.map((a) => a.finished));
    anims = anims.filter((a) => !mine.includes(a));
    if (!anims.length && layer) layer.innerHTML = ''; // 写しを片付ける（ほかの台本が流れていなければ。終わった写しは見えない）
  }

  // 台本の動きを並べる（並べるだけで、待たない）
  function lay(plan, before) {
    const after = measure();
    const red = reduce();
    const now = (id) => after[id] ?? null;
    const was = (id) => before[id] ?? after[id] ?? null;
    const seatNow = (seat) => now(`seat-${seat}`) ?? now(`stack-${seat}`);
    const seatWas = (seat) => was(`seat-${seat}`) ?? was(`stack-${seat}`);
    const potBox = after.pot ?? before.pot ?? after.center ?? before.center ?? null;
    const deck = mid(after.dealer ?? before.dealer ?? after.center ?? { x: 0, y: 0, w: 0, h: 0 });
    const steps = plan.steps;
    const light = steps.find((s) => s.kind === 'light');
    if (light) markUntil('mv-pre-light', light.at);
    // 勝った人の札は、最後の人へ流れ着いてから出す（分け合いは1人ずつ順に流す）
    const award = steps.filter((s) => s.kind === 'award').at(-1);
    if (award) markUntil('mv-pre-win', award.at + award.ms);
    const flipHero = steps.find((s) => s.kind === 'flipHero');
    // 配る：その人の札は、2枚目が届くまで隠す（あなたの手札は表に返すまで）
    const lastDeal = {};
    for (const s of steps) if (s.kind === 'deal') lastDeal[s.seat] = Math.max(lastDeal[s.seat] ?? 0, s.at + s.ms);
    for (const [seat, end] of Object.entries(lastDeal)) if (!(Number(seat) === 0 && flipHero)) arrive(now(`cards-${seat}`)?.el, end);
    for (const s of steps) {
      try {
        if (s.kind === 'bet' || s.kind === 'ante') {
          const from = seatWas(s.seat);
          // 回りを終わらせた行動では、描き直した絵に賭けた額の所がもうない（ポットに集まった）：前に賭けていた所か、ポットへ
          const mark = s.kind === 'bet' ? now(`bet-${s.seat}`) : null;
          const to = s.kind === 'bet' ? mark ?? before[`bet-${s.seat}`] ?? potBox : potBox;
          if (!from || !to) continue;
          if (mark) arrive(mark.el, s.at + s.ms);
          if (!red) fly('<i class="mv-chip"></i>', 'chip', mid(from), boxAt(mid(to), CHIP, CHIP), s.at, s.ms);
        } else if (s.kind === 'deal') {
          const to = now(`cards-${s.seat}`);
          if (!to || red) continue;
          const h = Math.min(to.h, 90);
          const w = Math.round(h * 0.7);
          const box = { x: s.round ? to.x + to.w - w : to.x, y: to.y + (to.h - h) / 2, w, h };
          fly(cardBackHTML(), 'card', deck, box, s.at, s.ms, { hold: s.seat === 0 && flipHero ? Math.max(0, flipHero.at - s.at - s.ms) : 0 });
        } else if (s.kind === 'flipHero') {
          flipIn(now('cards-0')?.el, s.at, s.ms);
        } else if (s.kind === 'fold') {
          const src = before[`cards-${s.seat}`];
          if (!src || red) continue;
          fly(cardBackHTML().repeat(2), 'backs2', mid(src), boxAt(potBox ? mid(potBox) : mid(src), 30, 21), s.at, s.ms, { fade: true });
        } else if (s.kind === 'collect') {
          if (potBox?.el && after.pot) arrive(after.pot.el, s.at + s.ms);
          if (red) continue;
          for (const seat of s.seats) {
            const src = before[`bet-${seat}`];
            if (src && potBox) fly('<i class="mv-chip"></i>', 'chip', mid(src), boxAt(mid(potBox), CHIP, CHIP), s.at, s.ms);
          }
        } else if (s.kind === 'place') {
          const to = now(`board-${s.k}`);
          if (!to || red) continue;
          const flip = steps.find((x) => x.kind === 'flip' && x.k === s.k);
          fly(cardBackHTML(), 'card', deck, to, s.at, s.ms, { hold: flip ? Math.max(0, flip.at - s.at - s.ms) : 0 });
        } else if (s.kind === 'flip') {
          flipIn(now(`board-${s.k}`)?.el, s.at, s.ms);
        } else if (s.kind === 'reveal') {
          const to = now(`cards-${s.seat}`);
          if (!to) continue;
          if (!red) holdBacks(to, 2, s.at);
          flipIn(to.el, s.at, s.ms);
        } else if (s.kind === 'award') {
          for (const seat of s.seats) holdPlate(now(`stack-${seat}`)?.el, before[`stack-${seat}`]?.el?.innerHTML, s.at + s.ms);
          if (red || !potBox) continue;
          for (const seat of s.seats) {
            const to = seatNow(seat);
            if (to) fly('<i class="mv-chip"></i>', 'chip', mid(was('pot') ?? potBox), boxAt(mid(to), CHIP, CHIP), s.at, s.ms, { fade: true });
          }
        }
      } catch (e) {
        console.error(e); // 1つの動きが失敗しても、ほかの動きと卓の進行は止めない
      }
    }
  }

  const each = (fn) => { for (const a of anims) { try { fn(a); } catch { /* 終わった動き */ } } };
  return {
    measure,
    play,
    skip: () => each((a) => a.finish()), // いま動いているものを全部最後まで（卓を押したとき・窓の形が変わったとき）
    // メニューなどの札が出ている間。止めるのは終わっていない動きだけ、続けるのは止めた動きだけ
    // （終わった動きを止めて動かすと、最初から再生し直してしまう：Web Animations の決まり）
    pause: () => { paused = true; each((a) => { if (a.playState !== 'finished') a.pause(); }); },
    resume: () => { paused = false; each((a) => { if (a.playState === 'paused') a.play(); }); },
    busy: () => anims.length > 0,
  };
}
