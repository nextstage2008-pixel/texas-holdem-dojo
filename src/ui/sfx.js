// 効果音の表（設計書 段階4-5 第6-2節）。ファイルは scripts/fetch-sfx.mjs で配布元から取って assets/sfx/ に置く。
// offset：鳴らし始めの位置（秒。前の無音を飛ばす）、gain：素材ごとの大きさの違いをそろえる倍率（峰が -8dB ほどになるよう測った。3倍まで）。
// 同じ音に2つ以上あるときは順に使う。
export const SFX_DIR = 'assets/sfx/';
export const MAX_GAIN = 3;
export const SFX = {
  shuffle: [{ file: 'shuffle.mp3', offset: 0.03, gain: 2.7 }],
  deal: [{ file: 'deal1.mp3', offset: 0.22, gain: 1 }, { file: 'deal2.mp3', offset: 0.12, gain: 1.5 }],
  flip: [{ file: 'flip.mp3', offset: 0.16, gain: 1.4 }],
  chip: [{ file: 'chip1.mp3', offset: 0.04, gain: 1.9 }, { file: 'chip2.mp3', offset: 0.02, gain: 1 }, { file: 'chip3.mp3', offset: 0.03, gain: 1.7 }],
  chipAllin: [{ file: 'chip-allin.mp3', offset: 0.04, gain: 1 }],
  collect: [{ file: 'collect.mp3', offset: 0.04, gain: 1 }],
  knock: [{ file: 'knock.mp3', offset: 0, gain: 2.7 }],
};
// 効果音の出どころ（設定画面の下と assets/CREDITS.md に書く）
export const SFX_CREDITS = [
  { name: 'Tスタ', url: 'https://tnosite.com/' },
  { name: '効果音ラボ', url: 'https://soundeffect-lab.info/' },
];
