// ブランドのロゴマーク（ヤシの木）と、ゲーム名のロゴ文字（案A・金の立体文字）。確定見本 mock-title-v14.html と同じ図形。
// ロゴ文字の書体は assets/fonts/ の Dela Gothic One（ロゴの文字だけに絞ったもの。styles の @font-face 'DelaLogo'）。

// 画面に1回だけ置く定義（グラデーションとヤシの木の図形）
export const LOGO_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<radialGradient id="bg-sun" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#ffe08a"/><stop offset=".6" stop-color="#ffb347"/><stop offset="1" stop-color="#f07a2a"/></radialGradient>
<linearGradient id="bg-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ccf73"/><stop offset="1" stop-color="#1c7a44"/></linearGradient>
<linearGradient id="bg-trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5a32"/><stop offset=".5" stop-color="#c08850"/><stop offset="1" stop-color="#7a4a26"/></linearGradient>
<linearGradient id="t-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8d6"/><stop offset=".34" stop-color="#f7d77a"/><stop offset=".52" stop-color="#c8902e"/><stop offset=".7" stop-color="#f2c95c"/><stop offset="1" stop-color="#9a6a1e"/></linearGradient>
<linearGradient id="t-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9483a"/><stop offset="1" stop-color="#9e2a20"/></linearGradient>
<linearGradient id="t-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="t-clip"><text x="240" y="150" text-anchor="middle" font-family="DelaLogo" font-size="76">ホールデム</text></clipPath>
<symbol id="m-palm" viewBox="0 0 200 200">
<circle cx="100" cy="92" r="72" fill="url(#bg-sun)"/>
<path d="M40 172 Q100 150 160 172 Q100 186 40 172 Z" fill="#f3d9a4"/>
<path d="M95 168 C97 140 98 118 100 96 L106 96 C106 118 107 140 111 168 Z" fill="url(#bg-trunk)"/>
<g stroke="#6a3f1e" stroke-width="1.4" opacity=".55"><path d="M96 152 L110 150"/><path d="M97 138 L109 136"/><path d="M98 124 L108 122"/><path d="M99 110 L107 109"/></g>
<path d="M102 98 C86 76 62 62 34 62 C52 70 66 84 74 104 C80 92 90 90 102 98 Z" fill="url(#bg-leaf)"/>
<path d="M104 98 C118 76 142 62 170 62 C152 70 138 84 130 104 C124 92 114 90 104 98 Z" fill="url(#bg-leaf)"/>
<path d="M102 96 C92 74 86 52 92 30 C96 48 104 64 112 76 C106 80 104 88 102 96 Z" fill="url(#bg-leaf)" opacity=".92"/>
<path d="M104 96 C108 74 120 58 138 46 C128 62 122 76 120 92 C114 90 108 92 104 96 Z" fill="url(#bg-leaf)" opacity=".85"/>
<circle cx="98" cy="102" r="5" fill="#7a4a26"/><circle cx="108" cy="103" r="5" fill="#8a5a32"/>
</symbol></defs></svg>`;

export const palmSVG = (cls) => `<svg class="${cls}" viewBox="0 0 200 200" aria-label="やっしーGAMES"><use href="#m-palm"/></svg>`;

// ゲーム名のロゴ文字：こげ茶の帯に「テキサス」、金の立体文字「ホールデム」（光が流れる）、朱の札の「道場」
export const logotypeSVG = (cls) => `<svg class="${cls}" viewBox="0 8 480 236" aria-label="テキサスホールデム道場">
<path d="M150 14 H330 L318 33 L330 52 H150 L162 33 Z" fill="#5a2f17" stroke="#d6b25a" stroke-width="1.5"/>
<text x="245" y="43" text-anchor="middle" font-family="DelaLogo" font-size="23" letter-spacing="9" fill="#f6dc8a">テキサス</text>
<g font-family="DelaLogo" font-size="76" text-anchor="middle">
<text x="240" y="150" fill="#2a1608" stroke="#2a1608" stroke-width="16" stroke-linejoin="round" transform="translate(0 7)">ホールデム</text>
<text x="240" y="150" fill="#2a1608" stroke="#2a1608" stroke-width="16" stroke-linejoin="round">ホールデム</text>
<text x="240" y="150" fill="none" stroke="#fbe7a6" stroke-width="5" stroke-linejoin="round">ホールデム</text>
<text x="240" y="150" fill="url(#t-gold)">ホールデム</text>
</g>
<rect x="-200" y="60" width="70" height="110" fill="url(#t-sweep)" clip-path="url(#t-clip)" transform="skewX(-18)"><animate attributeName="x" values="-120;640;640" keyTimes="0;.35;1" dur="5s" begin="4s" repeatCount="indefinite"/></rect>
<g transform="translate(240 205)">
<rect x="-70" y="-28" width="140" height="56" rx="8" fill="url(#t-red)" stroke="#2a1608" stroke-width="4"/>
<rect x="-64" y="-22" width="128" height="44" rx="5" fill="none" stroke="#f6dc8a" stroke-width="1.6"/>
<text x="5" y="14" text-anchor="middle" font-family="DelaLogo" font-size="36" letter-spacing="10" fill="#fff6dc">道場</text>
<path d="M-150 0 H-84 M84 0 H150" stroke="#8a5a1a" stroke-width="2"/>
<path d="M-90 0 l6 -6 6 6 -6 6z M90 0 l-6 -6 -6 6 6 6z" fill="#8a5a1a"/>
</g></svg>`;
