// 縦の卓の場所と大きさ（設計書 段階5-1 第4節）。画面に触れない：table-portrait.js がこの値で置き、テストが重ならないことを計算で確かめる。
// 位置はすべて縦の舞台（393×852）の左上からのピクセル。席・印の位置の表は、卓の場所（PT.table）の左上からの値。

export const PT = {
  w: 393, h: 852,
  top: { y: 6, h: 58 }, // 上の段（☰・帯・🔊・⏩）
  table: { y: 70, h: 482 }, // 卓の場所
  strip: { y: 556, h: 48 }, // コーチの帯
  pane: { y: 608, h: 244 }, // 手元（手札・額・行動のボタン）
  face: 60,
  plate: { w: 72, h: 36, lift: 6 }, // 名札（顔に6ピクセルかかる）
  board: { cy: 202, w: 46, h: 64, gap: 3 }, // 場の札（縦は卓の場所の約42%）
  pot: { cy: 280, w: 120, h: 22 }, // ポットの額（約58%）
  banner: { cy: 329, w: 236, h: 66 }, // ハンドの結果の帯（最大の幅と、3行までの高さ）。場の札と下の段の席の間（段階5-3。勝った人の札を真ん中の席の横に置くため、ポットの場所から下げた）
  win: { w: 128, h: 40 }, // 勝負に勝った人の札（役の名前と勝った額の2行。長い役の名前は小さめの字で、この大きさに収める）
  me: { cx: 222, cy: 458, w: 88, h: 36 }, // あなたの持ち点の名札（卓の一番下＝手元のすぐ上。左下の「やめて判定する」を避けて少し右。段階5-3）
  shown: { w: 40, h: 56, shift: 18, lift: 6 }, // 勝負で見せた札（顔の上に扇。2枚目を18ずらす）
  mark: { w: 116, h: 18 }, // 賭けた額と行動の札（「レイズ 1,300」など）
  dealer: 22,
  stop: { x: 6, y: 434, w: 170, h: 44 }, // 章の対局の「やめて判定する」（卓の左下）
};

// 席の位置（表示位置1〜8。PC と同じ順：左下・左中・左上・上の左・上の右・右上・右中・右下）。席の中心
export const PT_SEATS = [null, [37, 386], [37, 272], [37, 158], [136, 52], [257, 52], [356, 158], [356, 272], [356, 386]];
// 賭けた額と行動の札の中心（表示位置0＝あなたは卓の下の中央）
export const PT_MARKS = [[196.5, 410], [134, 372], [134, 248], [134, 150], [136, 112], [257, 112], [259, 150], [259, 248], [259, 372]];
// 勝負に勝った人の札の中心（表示位置0＝あなたは手元の上）。場の札・結果の帯・席・見せた札と重ならない所（段階5-3）
export const PT_WINS = [[196.5, 396], [137, 386], [137, 272], [137, 150], [137, 122], [256, 122], [256, 150], [256, 272], [256, 386]];
// ディーラーの印の中心
export const PT_DEALERS = [[110, 410], [88, 398], [88, 290], [64, 100], [76, 40], [317, 40], [329, 100], [305, 290], [305, 398]];

const box = (name, cx, cy, w, h) => ({ name, x: cx - w / 2, y: cy - h / 2, w, h });
const CX = 393 / 2;

// 席（顔と名札）。返す値は席全体の箱に、顔（face）と名札（plate）の箱を付けたもの
export function seatBox(disp) {
  const [x, y] = PT_SEATS[disp];
  const h = PT.face + PT.plate.h - PT.plate.lift;
  const b = box(`席${disp}`, x, PT.table.y + y, PT.plate.w, h);
  b.face = { name: `席${disp}の顔`, x: x - PT.face / 2, y: b.y, w: PT.face, h: PT.face };
  b.plate = { name: `席${disp}の名札`, x: x - PT.plate.w / 2, y: b.y + PT.face - PT.plate.lift, w: PT.plate.w, h: PT.plate.h };
  return b;
}

// 見せた札の扇（顔の上。上は顔の上から lift だけ出す）
export function shownBox(disp) {
  const s = seatBox(disp);
  const w = PT.shown.w + PT.shown.shift;
  return { name: `席${disp}の札`, x: PT_SEATS[disp][0] - w / 2, y: s.face.y - PT.shown.lift, w, h: PT.shown.h };
}

export const boardBox = () => box('場の札', CX, PT.table.y + PT.board.cy, PT.board.w * 5 + PT.board.gap * 4, PT.board.h);
export const potBox = () => box('ポット', CX, PT.table.y + PT.pot.cy, PT.pot.w, PT.pot.h);
export const bannerBox = () => box('結果の帯', CX, PT.table.y + PT.banner.cy, PT.banner.w, PT.banner.h);
// 賭けた額と行動の札は1枚の札に出す（「レイズ 1,300」「コール 500」「チェック」）
export const betBox = (disp) => box(`席${disp}の額`, PT_MARKS[disp][0], PT.table.y + PT_MARKS[disp][1], PT.mark.w, PT.mark.h);
export const dealerBox = (disp) => box(`席${disp}のD`, PT_DEALERS[disp][0], PT.table.y + PT_DEALERS[disp][1], PT.dealer, PT.dealer);
export const winBox = (disp) => box(`席${disp}の勝ち`, PT_WINS[disp][0], PT.table.y + PT_WINS[disp][1], PT.win.w, PT.win.h);
export const meBox = () => box('あなたの名札', PT.me.cx, PT.table.y + PT.me.cy, PT.me.w, PT.me.h);
export const stopBox = () => ({ name: 'やめて判定する', x: PT.stop.x, y: PT.table.y + PT.stop.y, w: PT.stop.w, h: PT.stop.h });

export const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const inside = (a, o) => a.x >= o.x && a.y >= o.y && a.x + a.w <= o.x + o.w && a.y + a.h <= o.y + o.h;
