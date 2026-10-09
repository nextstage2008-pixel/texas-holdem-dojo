// 相手の手の表（13×13）。推定した重みを升目ごとにまとめ、濃いほど「よくある」。軸の文字と凡例つき。
import { CLASS_COUNT, CLASS_COMBOS, classLabel } from '../calc/combos.js';

const AXIS = 'AKQJT98765432';

// 升目ごとの値（1通りあたりの重みを、一番多い升目＝1にそろえる）
export function gridCells(weights) {
  const per = [];
  for (let id = 0; id < CLASS_COUNT; id++) {
    const list = CLASS_COMBOS[id];
    per.push(list.reduce((a, i) => a + weights[i], 0) / list.length);
  }
  const max = Math.max(...per);
  return per.map((x, id) => ({ id, label: classLabel(id), v: max > 0 ? x / max : 0 }));
}

// 表と凡例（縦の並べ方の板の「手の表」のタブにも出す）
export function gridBodyHTML(cells) {
  let head = '<tr><th></th>';
  for (const c of AXIS) head += `<th>${c === 'T' ? '10' : c}</th>`;
  head += '</tr>';
  let body = '';
  for (let r = 0; r < 13; r++) {
    body += `<tr><th>${AXIS[r] === 'T' ? '10' : AXIS[r]}</th>`;
    for (let c = 0; c < 13; c++) {
      const cell = cells[r * 13 + c];
      const kind = r === c ? 'pair' : r < c ? 'suited' : 'off';
      body += `<td class="${kind}" style="--v:${cell.v.toFixed(3)}" title="${cell.label}">${cell.label}</td>`;
    }
    body += '</tr>';
  }
  return `<table class="rgrid">${head}${body}</table>
  <div class="legend"><span><i class="lg0"></i>ほぼない</span><span><i class="lg5"></i>ときどき</span><span><i class="lg1"></i>よくある</span>
    <span class="kinds">右上＝同じマーク（s）・左下＝違うマーク（o）・斜め＝ペア</span></div>`;
}

export function gridHTML(cells, title) {
  return `<div class="grid-card">
  <h2>${title}</h2>
  ${gridBodyHTML(cells)}
  <button class="mb" data-close>閉じる</button>
</div>`;
}
