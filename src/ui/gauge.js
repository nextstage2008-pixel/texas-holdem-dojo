// 勝つ見込みの計器（高級計器）。金の縁・黒い文字盤・目盛り。損益分岐点まで赤、そこから先が緑。
// 針が勝つ見込みを指し、損益分岐点に赤い印、下の窓に数字。value・mark は 0〜1。
const CX = 120;
const CY = 120;

// 0（左端）〜1（右端）を、半円の上の点にする
export function pointAt(v, r) {
  const t = Math.PI * (1 - v);
  return [+(CX + r * Math.cos(t)).toFixed(2), +(CY - r * Math.sin(t)).toFixed(2)];
}

// v1 から v2 までの弧（半円の内側の色の帯）
export function arcD(v1, v2, r = 78) {
  const [x1, y1] = pointAt(v1, r);
  const [x2, y2] = pointAt(v2, r);
  return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
}

// 針の角度（真上が0度、左が −90度、右が +90度）
export const needleAngle = (v) => +(-90 + 180 * Math.min(1, Math.max(0, v))).toFixed(1);

export function gaugeSVG({ value, mark }) {
  const v = Math.min(1, Math.max(0, value));
  const m = Math.min(1, Math.max(0, mark));
  let ticks = '';
  for (let k = 0; k <= 10; k++) {
    const [x1, y1] = pointAt(k / 10, 64);
    const [x2, y2] = pointAt(k / 10, k % 5 === 0 ? 75 : 71);
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${k % 5 === 0 ? ' stroke-width="2.4"' : ''}/>`;
  }
  const [mx, my] = pointAt(m, 102.5);
  const red = m > 0.001 ? `<path d="${arcD(0, m)}" fill="none" stroke="#d9473f" stroke-width="9"/>` : '';
  const green = m < 0.999 ? `<path d="${arcD(m, 1)}" fill="none" stroke="#2fb06a" stroke-width="9"/>` : '';
  return `<svg class="gauge" width="230" height="166" viewBox="0 0 240 172">
  <defs>
    <linearGradient id="gz-bz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a5a1a"/><stop offset=".25" stop-color="#f6e3a1"/><stop offset=".5" stop-color="#a8792b"/><stop offset=".72" stop-color="#fff1c1"/><stop offset="1" stop-color="#8a6418"/></linearGradient>
    <radialGradient id="gz-fc" cx=".5" cy=".9" r=".9"><stop offset="0" stop-color="#3a2a1c"/><stop offset="1" stop-color="#0d0805"/></radialGradient>
    <linearGradient id="gz-nd" x1="0" x2="1"><stop offset="0" stop-color="#8a1a14"/><stop offset=".5" stop-color="#ff5a4a"/><stop offset="1" stop-color="#8a1a14"/></linearGradient>
    <radialGradient id="gz-cap" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff6cf"/><stop offset=".55" stop-color="#d6a93a"/><stop offset="1" stop-color="#6b4a12"/></radialGradient>
  </defs>
  <path d="M14 120 A106 106 0 0 1 226 120 Z" fill="url(#gz-bz)"/>
  <path d="M24 120 A96 96 0 0 1 216 120 Z" fill="#1a0f08"/>
  <path d="M28 120 A92 92 0 0 1 212 120 Z" fill="url(#gz-fc)"/>
  ${red}${green}
  <g stroke="#f3e6c8" stroke-width="1.6">${ticks}</g>
  <g font-family="Georgia" font-size="10" fill="#cdb27a" text-anchor="middle"><text x="66" y="117">0</text><text x="120" y="68">50</text><text x="174" y="117">100</text></g>
  <rect x="10" y="118" width="220" height="9" rx="3" fill="url(#gz-bz)"/>
  <circle class="mark" cx="${mx}" cy="${my}" r="5" fill="#d9473f" stroke="#fff6cf" stroke-width="1.5"/>
  <g class="needle" transform="rotate(${needleAngle(v)} 120 120)"><polygon points="116.5,120 120,50 123.5,120" fill="url(#gz-nd)"/><polygon points="118,120 122,120 120,134" fill="#5a120d"/></g>
  <circle cx="120" cy="120" r="10" fill="url(#gz-cap)" stroke="#3a2606" stroke-width="1"/>
  <rect x="70" y="134" width="100" height="34" rx="7" fill="url(#gz-bz)"/><rect x="73" y="137" width="94" height="28" rx="5" fill="#0d0805"/>
  <text class="win" x="120" y="158" text-anchor="middle" font-family="Georgia" font-size="21" font-weight="700" fill="#ffe9a6">${Math.round(v * 100)}%</text>
</svg>`;
}
