// 額の決め方（縦の並べ方。設計書 段階5-1 第4-4節）：目盛りのボタン4つ・横のスライダー（溝を押すとそこへ動く）・−/＋（1BB ずつ）。
// PC の丸いダイヤル（dial.js）と同じ形（set・clear・value）で卓の進行とやり取りする。目盛りと丸め方は presets.js（calc/sizes.js）と同じ。
import { clampTo } from './presets.js';

// 額 → スライダーの位置（0〜1）と、その逆
export const fractionOf = (value, { min, max }) => (max > min ? (value - min) / (max - min) : 1);
export const valueAt = (fraction, st) => clampTo(st.min + Math.min(1, Math.max(0, fraction)) * (st.max - st.min), st);
// −/＋：1BB ずつ（dir は 1 か -1）
export const stepBy = (st, dir) => clampTo(st.value + dir * st.bb, st);

// 額の部品の中身。st：{ min, max, value, bb, presets }（null なら空）
export function amountBarHTML(st) {
  if (!st) return '';
  const pct = (fractionOf(st.value, st) * 100).toFixed(2);
  const pre = st.presets.map((p) => `<button class="pb" data-to="${p.to}">${p.label}</button>`).join('');
  return `<div class="ab-pre">${pre}</div><div class="ab-row"><button class="ab-pm minus" aria-label="1BB 減らす">−</button>`
    + `<div class="ab-track"><i class="ab-fill" style="width:${pct}%"></i><i class="ab-knob" style="left:${pct}%"></i></div>`
    + '<button class="ab-pm plus" aria-label="1BB 増やす">＋</button></div>';
}

export function createAmountBar(root, { onChange }) {
  let state = null;
  let dragging = false;
  root.classList.add('ab');

  function draw() {
    root.classList.toggle('off', !state);
    root.innerHTML = amountBarHTML(state);
  }
  function setValue(v) {
    if (!state) return;
    state.value = clampTo(v, state);
    draw();
    onChange(state.value);
  }
  // 溝の上の指の位置から額を決める
  function fromPointer(e) {
    const tr = root.querySelector('.ab-track');
    if (!tr || !state) return;
    const r = tr.getBoundingClientRect();
    setValue(valueAt((e.clientX - r.left) / Math.max(1, r.width), state));
  }

  root.addEventListener('click', (e) => {
    if (!state) return;
    if (e.target.closest('.minus')) setValue(stepBy(state, -1));
    else if (e.target.closest('.plus')) setValue(stepBy(state, 1));
    else {
      const pb = e.target.closest('.pb');
      if (pb) setValue(Number(pb.dataset.to));
    }
  });
  root.addEventListener('pointerdown', (e) => {
    if (!state || !e.target.closest('.ab-track')) return;
    dragging = true;
    root.setPointerCapture?.(e.pointerId);
    fromPointer(e);
  });
  root.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
  const stop = () => { dragging = false; };
  root.addEventListener('pointerup', stop);
  root.addEventListener('pointercancel', stop);

  draw();
  return {
    set({ min, max, value, bb, presets }) {
      state = { min, max, value: clampTo(value, { min, max }), bb, presets };
      draw();
    },
    clear() { state = null; draw(); },
    value: () => (state ? state.value : null),
  };
}
