// 画面の並べ方（設計書 段階5-1 第3節）。画面に触れない：窓の幅・高さと、指で操作するか（coarse）を受け取って決める。
// 縦長の画面はスマホの並べ方（縦の舞台 393×852）、横長はいまの PC の並べ方（1300×880）。機種では決めない。
// スマホを横にしたとき（指で操作・横長・高さ ROTATE_MAX_H 未満）は、縦の並べ方のまま「縦にしてお使いください」を重ねる。
// 指で操作する画面で、画面の向き（orientation：'portrait'|'landscape'）と画面の短い辺（screenShort）がわかるときはそれで決める
// （Android でキーボードが出て窓の高さが縮んでも、横にしたとは見なさない）

export const STAGE = { pc: { w: 1300, h: 880 }, portrait: { w: 393, h: 852 } };
export const ROTATE_MAX_H = 500;

export function layoutFor({ width, height, coarse, orientation = null, screenShort = null }) {
  const byScreen = !!coarse && orientation !== null;
  // 横にしたスマホ：画面の向きが横（わからなければ窓が横長）で、窓も本当に横長で、画面の短い辺が小さい
  const landscape = byScreen ? orientation === 'landscape' : width > height;
  const phoneSideways = !!coarse && landscape && width > height && (byScreen && screenShort ? screenShort : height) < ROTATE_MAX_H;
  if (phoneSideways) return { layout: 'portrait', rotate: true };
  // 画面の向きが縦なら縦の並べ方（キーボードが出て窓が低くなっても PC の並べ方にしない）。ほかは窓の形で
  if (byScreen && orientation === 'portrait') return { layout: 'portrait', rotate: false };
  return { layout: width < height ? 'portrait' : 'pc', rotate: false };
}

// 入口が読むブラウザの値（win は window）。画面の向きと短い辺は window.screen から（main.js の画面の状態の変数 screen と取り違えない）
export function layoutInputs(win) {
  const scr = win.screen ?? {};
  const type = scr.orientation?.type;
  return {
    width: win.innerWidth, height: win.innerHeight, coarse: !!win.matchMedia?.('(pointer: coarse)').matches,
    orientation: type ? (type.startsWith('landscape') ? 'landscape' : 'portrait') : null,
    screenShort: Math.min(scr.width, scr.height) || null,
  };
}

// 舞台の縮め方：余白（切り欠き・下のバー）を引いた中に、縦横どちらかいっぱいに収める
export function stageScale(layout, { width, height }, inset = { top: 0, right: 0, bottom: 0, left: 0 }) {
  const s = STAGE[layout] ?? STAGE.pc;
  return Math.min((width - inset.left - inset.right) / s.w, (height - inset.top - inset.bottom) / s.h);
}
