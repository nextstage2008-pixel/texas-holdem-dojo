// 立体のカジノチップ。側面のエッジスポット・表面の白い模様の輪・金の細線・額面入りの象牙色の中心・光沢と影。
const DEN = {
  100: { c: '#24242b', s: '#f4efe2', t: '#24242b', l: '100' },
  500: { c: '#6c2ea3', s: '#f4efe2', t: '#4a1a72', l: '500' },
  1000: { c: '#e6b422', s: '#22222a', t: '#6b4206', l: '1K' },
  5000: { c: '#c6232f', s: '#f4efe2', t: '#8a121b', l: '5K' },
  25000: { c: '#2160c4', s: '#f4efe2', t: '#143e7d', l: '25K' },
};

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((x) => Math.max(0, Math.min(255, Math.round(f < 0 ? x * (1 + f) : x + (255 - x) * f))));
  return `rgb(${ch.join(',')})`;
}
const elen = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

let uid = 0;

export function chipStackSVG(list, rx = 16) {
  if (list.length === 0) return '';
  const ry = rx * 0.5, t = rx * 0.26, pad = 4;
  const W = rx * 2 + pad * 2;
  const H = ry * 2 + t * list.length + t + pad * 2 + ry * 0.6;
  const cx = W / 2, base = H - pad - ry - t - ry * 0.3;
  const id = `cg${uid++}`;
  let s = `<svg width="${W.toFixed(1)}" height="${H.toFixed(1)}" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" style="overflow:visible">`;
  s += `<defs><radialGradient id="${id}" cx=".3" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="${id}e" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient></defs>`;
  s += `<ellipse cx="${cx + rx * 0.12}" cy="${base + t + ry * 0.15}" rx="${rx * 1.08}" ry="${ry * 1.05}" fill="rgba(20,10,0,.45)" style="filter:blur(2.5px)"/>`;
  list.forEach((den, i) => {
    const D = DEN[den];
    const y = base - i * t;
    const x = cx + (i % 3 === 1 ? 0.7 : i % 3 === 2 ? -0.5 : 0);
    const top = i === list.length - 1;
    const seg = elen(rx, ry) / 2 / 9;
    const band = `M${x - rx},${y} A${rx},${ry} 0 0 0 ${x + rx},${y} L${x + rx},${y + t} A${rx},${ry} 0 0 1 ${x - rx},${y + t} Z`;
    s += `<path d="${band}" fill="${shade(D.c, -0.18)}"/>`;
    s += `<path d="M${x - rx},${y + t / 2} A${rx},${ry} 0 0 0 ${x + rx},${y + t / 2}" fill="none" stroke="${D.s}" stroke-width="${t * 0.62}" stroke-dasharray="${seg.toFixed(2)} ${seg.toFixed(2)}" stroke-dashoffset="${(seg * 0.5).toFixed(2)}"/>`;
    s += `<path d="${band}" fill="url(#${id}e)"/>`;
    s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${D.c}" stroke="${shade(D.c, -0.35)}" stroke-width=".6"/>`;
    if (top) {
      const r2 = rx * 0.84, q2 = ry * 0.84, sp = elen(r2, q2) / 16;
      s += `<ellipse cx="${x}" cy="${y}" rx="${r2}" ry="${q2}" fill="none" stroke="${D.s}" stroke-width="${rx * 0.17}" stroke-dasharray="${sp.toFixed(2)} ${sp.toFixed(2)}"/>`;
      s += `<ellipse cx="${x}" cy="${y}" rx="${rx * 0.66}" ry="${ry * 0.66}" fill="none" stroke="#f0d488" stroke-width="${Math.max(0.8, rx * 0.035)}"/>`;
      s += `<ellipse cx="${x}" cy="${y}" rx="${rx * 0.56}" ry="${ry * 0.56}" fill="#f8f1df" stroke="${shade(D.c, -0.2)}" stroke-width="${Math.max(0.6, rx * 0.03)}"/>`;
      s += `<text x="0" y="0" transform="translate(${x},${y + rx * 0.1}) scale(1,0.5)" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${rx * 0.42}" fill="${D.t}">${D.l}</text>`;
    }
    s += `<ellipse cx="${x - rx * 0.15}" cy="${y - ry * 0.15}" rx="${rx * 0.85}" ry="${ry * 0.8}" fill="url(#${id})"/>`;
  });
  return `${s}</svg>`;
}
