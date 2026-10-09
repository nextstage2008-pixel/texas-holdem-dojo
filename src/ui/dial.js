// 真鍮の円形ダイヤル。中央のチップに額とBB換算、外周の金の輪で範囲のどこかを示す。
import { fmt } from './format.js';
import { clampTo } from './presets.js';

const CX = 100, CY = 100, R = 86, A0 = 135, SWEEP = 270;

function pt(a) {
  const t = (a * Math.PI) / 180;
  return [CX + R * Math.cos(t), CY + R * Math.sin(t)];
}

export function arcPath(a1, a2) {
  const [x1, y1] = pt(a1);
  const [x2, y2] = pt(a2);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function createDial(root, { onChange }) {
  let ticks = '';
  for (let i = 0; i <= 10; i++) {
    const a = ((A0 + (SWEEP * i) / 10) * Math.PI) / 180;
    ticks += `<line x1="${(CX + 92 * Math.cos(a)).toFixed(1)}" y1="${(CY + 92 * Math.sin(a)).toFixed(1)}" x2="${(CX + 96 * Math.cos(a)).toFixed(1)}" y2="${(CY + 96 * Math.sin(a)).toFixed(1)}"/>`;
  }
  root.innerHTML = `
    <span class="pm minus">−</span><span class="pm plus">＋</span>
    <svg width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="brs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a5a1a"/><stop offset=".3" stop-color="#f6e3a1"/><stop offset=".55" stop-color="#a8792b"/><stop offset=".78" stop-color="#fff1c1"/><stop offset="1" stop-color="#8a6418"/></linearGradient>
        <radialGradient id="chipf" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#9a2a3a"/><stop offset="1" stop-color="#5a0f1c"/></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="97" fill="url(#brs)"/>
      <circle cx="100" cy="100" r="76" fill="#1a0f08"/>
      <path d="${arcPath(A0, A0 + SWEEP)}" fill="none" stroke="#3a2618" stroke-width="9" stroke-linecap="round"/>
      <path class="arc" fill="none" stroke="#fff3c9" stroke-width="9" stroke-linecap="round"/>
      <g stroke="#5a3f12" stroke-width="2">${ticks}</g>
      <circle cx="100" cy="100" r="68" fill="url(#chipf)"/>
      <circle cx="100" cy="100" r="68" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="10 17.7" opacity=".9"/>
      <circle cx="100" cy="100" r="50" fill="#fbf3dc" stroke="#d6b25a" stroke-width="2"/>
      <text class="lbl" x="100" y="88" text-anchor="middle" font-size="11" font-weight="700" fill="#7a5a1a">レイズ</text>
      <text class="dv" x="100" y="111" text-anchor="middle" font-family="Georgia" font-size="22" font-weight="700" fill="#2b2118">―</text>
      <text class="bbs" x="100" y="126" text-anchor="middle" font-size="9.5" fill="#8a7458"></text>
      <circle class="knob" r="9" fill="url(#brs)" stroke="#2a1a0f" stroke-width="1.5"/>
    </svg>
    <div class="presets"></div>`;
  const $ = (sel) => root.querySelector(sel);
  let state = null;

  function draw() {
    if (!state) {
      root.classList.add('off');
      const [x0, y0] = pt(A0); // 空のときもつまみは目盛りの始まりに置く（左上に浮かないように）
      $('.knob').setAttribute('cx', x0);
      $('.knob').setAttribute('cy', y0);
      $('.arc').setAttribute('d', '');
      $('.dv').textContent = '―';
      $('.bbs').textContent = '';
      $('.presets').innerHTML = '';
      return;
    }
    root.classList.remove('off');
    const { min, max, value, bb, label } = state;
    const f = max > min ? (value - min) / (max - min) : 1;
    const a = A0 + SWEEP * Math.max(0.001, f);
    $('.arc').setAttribute('d', arcPath(A0, a));
    const [kx, ky] = pt(a);
    $('.knob').setAttribute('cx', kx);
    $('.knob').setAttribute('cy', ky);
    $('.lbl').textContent = label;
    $('.dv').textContent = fmt(value);
    $('.bbs').textContent = `${(value / bb).toFixed(1)}BB${value >= max ? '・オールイン' : ''}`;
  }

  function setValue(v) {
    if (!state) return;
    // 実際に賭ける額（clampTo）にそろえて表示する。ボタンの額・ダイヤルの額・賭ける額を一致させる
    state.value = clampTo(v, state);
    draw();
    onChange(state.value);
  }

  root.addEventListener('click', (e) => {
    if (!state) return;
    if (e.target.closest('.minus')) setValue(state.value - state.bb);
    else if (e.target.closest('.plus')) setValue(state.value + state.bb);
    else {
      const pb = e.target.closest('.pb');
      if (pb) setValue(Number(pb.dataset.to));
    }
  });
  root.addEventListener('wheel', (e) => {
    if (!state) return;
    e.preventDefault();
    setValue(state.value + (e.deltaY < 0 ? state.bb : -state.bb));
  }, { passive: false });

  draw(); // 最初から空の状態で描いておく（つまみが左上に浮かないように）

  return {
    set({ min, max, value, bb, presets, label }) {
      state = { min, max, value: clampTo(value, { min, max }), bb, label };
      $('.presets').innerHTML = presets.map((p) => `<span class="pb" data-to="${p.to}">${p.label}</span>`).join('');
      draw();
    },
    clear() { state = null; draw(); },
    value: () => (state ? state.value : null),
  };
}
