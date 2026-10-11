// 遊び方のチュートリアルの吹き出し（設計書 段階5-4 第4節）。指す部品の名前 → 卓の部品、吹き出しの置き場所の計算、吹き出しの中身。
// 置き場所の計算と中身は画面に触れない（tutorial-game.js が位置を読んで渡し、描く）
import { esc } from './format.js';

// 指す部品の名前（tutorial/lessons.js の POINTS と 'seat-1'〜'seat-8'）→ 並べ方ごとのセレクタ。いくつかあるときは、それらを囲む
const both = (...sels) => ({ pc: sels, portrait: sels });
export const TARGETS = {
  'hero-cards': both('[data-mv="cards-0"]'),
  'hero-plate': both('[data-mv="stack-0"]'),
  dealer: both('[data-mv="dealer"]'),
  board: both('[data-mv="center"]'),
  pot: both('[data-mv="pot"]'),
  hud: { pc: ['.hud-c', '.info'], portrait: ['.pt-band'] }, // PC の残り人数は帯の右下の欄
  coach: { pc: ['.cp'], portrait: ['.pt-strip'] },
  buttons: both('[data-ref="buttons"]'),
  controls: both('[data-ref="buttons"]', '[data-ref="dial"]'),
  result: both('[data-ref="result"]'), // 卓の真ん中の結果の札（段階5-5・そのあとの手直し）
  corner: both('[data-ref="menu"]', '[data-ref="mute"]', '[data-ref="speed"]'),
  side: both('[data-ref="side"]'),
};

// 名前と並べ方（'pc'|'portrait'）→ セレクタの並び。席（seat-N）は顔の枠（描くときは名札まで含めた席の箱を囲む）。知らない名前は []
export function targetSelectors(name, layout) {
  const seat = /^seat-([1-8])$/.exec(name ?? '');
  if (seat) return [`[data-mv="seat-${seat[1]}"]`];
  const t = TARGETS[name];
  return t ? t[layout === 'portrait' ? 'portrait' : 'pc'] : [];
}

// 吹き出しの置き場所：部品の下に入ればその下、入らなければ上、上下どちらも入らなければ右か左。部品と重ならず、舞台の中に収める。
// target：部品の箱 { x, y, w, h }（舞台の座標。なければ null＝舞台の真ん中）、stage：舞台の箱、size：吹き出しの大きさ { w, h }。
// 返す値：{ side（'below'|'above'|'right'|'left'|'center'）, x, y }
export function placeBubble(target, stage, size, { gap = 12, margin = 8 } = {}) {
  const clampX = (x) => Math.min(Math.max(x, stage.x + margin), stage.x + stage.w - margin - size.w);
  const clampY = (y) => Math.min(Math.max(y, stage.y + margin), stage.y + stage.h - margin - size.h);
  if (!target) return { side: 'center', x: stage.x + (stage.w - size.w) / 2, y: stage.y + (stage.h - size.h) / 2 };
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const below = target.y + target.h + gap;
  const above = target.y - gap - size.h;
  if (below + size.h <= stage.y + stage.h - margin) return { side: 'below', x: clampX(cx - size.w / 2), y: below };
  if (above >= stage.y + margin) return { side: 'above', x: clampX(cx - size.w / 2), y: above };
  const right = target.x + target.w + gap;
  const left = target.x - gap - size.w;
  if (right + size.w <= stage.x + stage.w - margin) return { side: 'right', x: right, y: clampY(cy - size.h / 2) };
  if (left >= stage.x + margin) return { side: 'left', x: left, y: clampY(cy - size.h / 2) };
  // どこにも入らない（部品が舞台のほとんどを占める）：下と上の広いほうに、舞台の中へ寄せる
  const roomBelow = stage.y + stage.h - (target.y + target.h);
  const roomAbove = target.y - stage.y;
  return roomBelow >= roomAbove ? { side: 'below', x: clampX(cx - size.w / 2), y: clampY(below) } : { side: 'above', x: clampX(cx - size.w / 2), y: clampY(above) };
}

// まわりを暗くする板：枠の上・下・左・右の4枚（舞台のうち枠の外を隙間なく覆う。暗くする範囲を計算で確かめられるように、影ではなく板で）。
// ring：枠の箱（なければ暗くしない）、stage：舞台の箱。返す値：板の箱の並び
export function dimRects(ring, stage) {
  if (!ring) return [];
  const x0 = Math.max(stage.x, ring.x);
  const y0 = Math.max(stage.y, ring.y);
  const x1 = Math.min(stage.x + stage.w, ring.x + ring.w);
  const y1 = Math.min(stage.y + stage.h, ring.y + ring.h);
  const midH = Math.max(0, y1 - y0);
  return [
    { x: stage.x, y: stage.y, w: stage.w, h: Math.max(0, y0 - stage.y) },
    { x: stage.x, y: y1, w: stage.w, h: Math.max(0, stage.y + stage.h - y1) },
    { x: stage.x, y: y0, w: Math.max(0, x0 - stage.x), h: midH },
    { x: x1, y: y0, w: Math.max(0, stage.x + stage.w - x1), h: midH },
  ];
}

// 吹き出しの中身。v：{ say（説明の文）, wait（'next'|'hero'）, index（何番目の場面か。0から）, total（場面の数）}
export function bubbleHTML(v) {
  const last = v.index === v.total - 1;
  const foot = v.wait === 'next'
    ? `<button class="mb p tut-next" data-tut="next">${last ? 'おわる' : '次へ'}</button>`
    : '<span class="tut-hint">光っているボタンを押してください</span>';
  return `<div class="tut-bubble"><p class="tut-say">${esc(v.say)}</p><div class="tut-foot"><span class="tut-step">${v.index + 1} / ${v.total}</span>${foot}</div></div>`;
}
