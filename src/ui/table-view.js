// 卓の画面を描く。表示用データ（view-model）を受け取り、DOMに反映するだけ。
import { cardHTML, cardBackHTML } from './cards.js';
import { chipStackSVG } from './chips.js';
import { chipBreakdown, fmt, esc } from './format.js';
import { coachHTML } from './coach-panel.js';
import { dialStart } from './presets.js';
import { stageScale } from './layout.js';
import { winLabelHTML } from './result-banner.js';

// 表示位置0（あなた）から時計回り。x は部屋の幅に対する%、y は px（確定見本と同じ座標）
const SEAT_POS = [[50, 462], [24, 448], [9, 372], [12, 258], [33, 186], [67, 186], [88, 258], [91, 372], [76, 448]];
const CENTER = [50, 330];
// 勝負に勝った人の札の置き場所（表示位置ごとの中心。x は部屋の幅に対する%、y は px）。見せた札・名札・場の札・結果の帯を隠さない所
// （設計書 段階5-3 第4-1節）：上の段の席（3〜6）は顔の上（王冠も避ける）、あなたと下の段の席（1・8）は名札の下、横の席（2・7）は中央寄り。
// 席の周りが詰まっていて、上の段の席から中央へ寄せると見せた札と場の札に、席1・8 はBB などの印と結果の帯に、あなたは顔に重なるため
export const PC_WINS = [[50, 541], [24, 527], [24.6, 352], [12, 165], [33, 96], [67, 96], [88, 165], [75.4, 352], [76, 527]];
const toward = ([x, y], k) => [x + (CENTER[0] - x) * k, y + (CENTER[1] - y) * k];
const avatarSrc = (name) => `assets/avatars/${name}.webp`;
// 顔のない人（本番大会の36人）は、名前の頭文字の丸い札
export const initialOf = (name) => Array.from(name ?? '')[0] ?? '？';
// 勝負の光らせ方：lit（役に使ったかの並び）があれば、使った札に lit・使わない札に dim
export const litClass = (size, lit, k) => [size, lit ? (lit[k] ? 'lit' : 'dim') : ''].filter(Boolean).join(' ');
const faceHTML = (avatar, name) => (avatar ? `<img src="${avatarSrc(avatar)}" alt="${esc(name)}">` : `<div class="initial">${esc(initialOf(name))}</div>`);

// labels：{ mark（盾の文字：「自由」や章の印）, name（あなたの名前）, sub（「自由対局」や章の名前）}
export function mountShell(stage, labels = { mark: '自由', name: 'あなた', sub: '自由対局' }) {
  stage.innerHTML = `
  <div class="s7">
    <div class="room">
      <div class="wains"></div><div class="floor"></div>
      <div class="curtain l"></div><div class="curtain r"></div>
      <div class="cone"></div>
      <div class="lamp"><div class="cord"></div><div class="shade"></div><div class="bulb"></div></div>
      <div class="rb" style="left:14px" data-ref="menu" title="メニュー（やめて戻る）">☰</div>
      <div class="shield"><div class="sh">${esc(labels.mark)}</div><small><b>${esc(labels.name)}</b>${esc(labels.sub)}</small></div>
      <div class="hud-c"><div class="band" data-ref="band"></div><div class="body" data-ref="hudBody"></div></div>
      <div class="info" data-ref="info"></div>
      <div class="rb" style="right:14px" data-ref="speed" title="早送り">⏩</div>
      <div class="rb" style="right:64px" data-ref="mute" title="音（入／切）">🔊</div>
      <div class="scene"><div class="plane"><div class="rail"><div class="wood"><div class="felt">
        <div class="flogo">やっしーGAMES<small>TEXAS HOLD'EM DOJO</small></div>
        <div class="fboard" data-ref="board" data-mv="center"></div>
      </div></div></div></div></div>
      <div data-ref="layer"></div>
      <div class="rs-panel" data-ref="result" hidden></div>
      <div class="pane"><div class="pane-in">
        <div class="hero" data-ref="heroCards" data-mv="cards-0"></div>
        <div class="mid"><div class="hand2" data-ref="handInfo"></div><div class="btnrow" data-ref="buttons"></div></div>
        <div class="dial off" data-ref="dial"></div>
      </div></div>
      <div class="overlay" data-ref="overlay"></div>
    </div>
    <div class="cp">
      <div class="cp-h"><span class="tabs" data-ref="tabs"><button class="tab" data-tab="coach">コーチ</button><button class="tab" data-tab="side">大会の状況</button></span><span class="lv" data-ref="coachLv"></span></div>
      <div class="cp-b" data-ref="coach"></div>
      <div class="cp-b" data-ref="side"></div>
    </div>
  </div>`;
  const refs = {};
  for (const el of stage.querySelectorAll('[data-ref]')) refs[el.dataset.ref] = el;
  return refs;
}

// 舞台を画面に合わせて縮める。並べ方（縦／PC）は stage.dataset.layout、余白（切り欠き・下のバー）は #viewport の padding から
export function fitStage(stage) {
  const vp = stage.parentElement;
  const cs = getComputedStyle(vp);
  const inset = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
  const s = stageScale(stage.dataset.layout === 'portrait' ? 'portrait' : 'pc', { width: vp.clientWidth, height: vp.clientHeight }, inset);
  stage.style.transform = `scale(${s})`;
}

export function seatHTML(sv) {
  const [x, y] = SEAT_POS[sv.disp];
  // 右側の席はリボンを左に出す（カーテンや画面の端で切れないように）
  const cls = ['seat', x > 50 && 'rside', sv.isActor && 'actor', sv.folded && 'folded', sv.out && 'out', sv.won > 0 && 'win'].filter(Boolean).join(' ');
  const name = esc(sv.name);
  const sub = sv.out ? (sv.place ? `${sv.place}位` : '敗退') : sv.folded ? `${name}・降り` : name;
  return `<div class="${cls}" style="left:${x}%;top:${y}px">
    <div class="frame" data-mv="seat-${sv.disp}">${faceHTML(sv.avatar, sv.name)}</div>
    <div class="plate" data-mv="stack-${sv.disp}"><b>${sv.out ? '―' : fmt(sv.stack)}</b>${sub}</div>
    ${sv.badge ? `<span class="badge">${sv.badge}</span>` : ''}
    ${sv.action && !sv.folded ? `<span class="act">${sv.action}</span>` : ''}
    ${sv.handName && !(sv.won > 0) ? `<span class="hn">${sv.handName}</span>` : ''}
  </div>`;
}

// pills：勝った人の札を出すか（結果の札が出ている間は出さない。卓の真ん中で重なるため）
function layerHTML(view, { pills = true } = {}) {
  let html = '';
  for (const sv of view.seats) {
    if (sv.empty) continue;
    if (sv.disp !== 0 && sv.cards !== 'none') {
      // 名札に重ならないよう、席から卓の中央側へ横にずらして置く
      const [sx, sy] = SEAT_POS[sv.disp];
      const [cx, cy] = [sx + (sx < 50 ? 8 : -8), sy + 28];
      html += sv.cards === 'up'
        ? `<div class="ups" data-mv="cards-${sv.disp}" style="left:${cx}%;top:${cy}px">${sv.hole.map((c, k) => cardHTML(c, litClass('sm', sv.lit, k))).join('')}</div>`
        : `<div class="backs" data-mv="cards-${sv.disp}" style="left:${cx}%;top:${cy}px">${cardBackHTML()}${cardBackHTML()}</div>`;
    }
    if (sv.bet > 0) {
      const [bx, by] = toward(SEAT_POS[sv.disp], 0.45);
      html += `<div class="cstack" data-mv="bet-${sv.disp}" style="left:${bx}%;top:${by + 12}px">${chipStackSVG(chipBreakdown(sv.bet, 8), 15)}</div>`;
      html += `<div class="amt" style="left:${bx + 5}%;top:${by}px">${fmt(sv.bet)}</div>`;
    }
    html += seatHTML(sv);
    // 勝負に勝った人の札：役の名前と勝った額（設計書 段階5-3 第4-1節。置き場所は PC_WINS）
    if (pills && sv.won > 0 && sv.handName) {
      const [px, py] = PC_WINS[sv.disp];
      html += `<div class="winpill" style="left:${px}%;top:${py}px">${winLabelHTML(sv)}</div>`;
    }
  }
  if (view.buttonDisp !== null) {
    // ディーラーボタンは名札の外側（卓の縁寄り）に置き、伏せ札やチップと重ねない
    const [sx, sy] = SEAT_POS[view.buttonDisp];
    html += `<div class="dealer" data-mv="dealer" style="left:${sx + (sx < 50 ? -7 : 7)}%;top:${sy + 32}px">D</div>`;
  }
  // ポットは場のカードのすぐ下（フェルトのロゴの上）。場のカードやあなたの賭けのチップと重ならない
  if (view.collected > 0) {
    html += `<div class="cstack" style="left:43%;top:362px">${chipStackSVG(chipBreakdown(view.collected, 10), 20)}</div>`;
  }
  if (view.pot > 0) html += `<div class="amt" data-mv="pot" style="left:54%;top:348px">ポット ${fmt(view.pot)}</div>`;
  return html;
}

// 場の札（k 枚目に位置の目印 board-k）。PC の卓と縦の卓で同じ
export function boardHTML(board, lit = null) {
  let html = board.map((c, k) => cardHTML(c, litClass('', lit, k)).replace('<div class="', `<div data-mv="board-${k}" class="`)).join('');
  for (let k = board.length; k < 5; k++) html += '<div class="slot"></div>';
  return html;
}

function hudHTML(h) {
  return `<span>レベル<b>${h.level}</b></span><span>ブラインド<b>${fmt(h.sb)}/${fmt(h.bb)}</b></span><span>アンティ<b>${fmt(h.ante)}</b></span><span>次まで<b>${h.nextIn}</b>ハンド</span>`;
}

// 本番大会の「大会」と「卓」の欄（設計書 段階4-3 第5節・見本の案A）。notices：卓の移動のお知らせ（欄の下に1行ずつ）
function fieldHTML(f, notices) {
  const prize = f.toPrize > 0 ? `あと${f.toPrize}人` : '入賞圏内';
  const kv = `<div class="fkv"><span>残り</span><b>${f.alive} / ${f.total}人</b><span>あなたの順位</span><b>${f.rank ? `${f.rank}位` : '―'}</b>`
    + `<span>平均</span><b>${fmt(f.avg)}（${Number(f.avgBB.toFixed(1))}BB）</b><span>入賞まで</span><b>${prize}</b></div>`;
  const live = f.counts.filter((c) => c !== null).length;
  const tables = f.final ? '<div class="sec">決 勝 卓</div>'
    : `<div class="sec">卓（${live}卓）</div><div class="tb5">${f.counts.map((c, i) => (c === null ? `<div class="gone">卓${i + 1}<br>―</div>`
      : `<div${i === f.table ? ' class="here"' : ''}>卓${i + 1}<br>${c}人</div>`)).join('')}</div>`;
  return `<div class="sec">大 会</div>${kv}${tables}${notices.map((t) => `<div class="fnote">${esc(t)}</div>`).join('')}`;
}

export function sideHTML(view, notices = []) {
  const rows = view.standings.map((p) => `<div class="stand${p.isHero ? ' me' : ''}${p.place && p.place > 1 ? ' out' : ''}">
      ${p.avatar ? `<img src="${avatarSrc(p.avatar)}" alt="">` : `<i class="ini">${esc(initialOf(p.name))}</i>`}<span>${esc(p.name)}</span><b>${p.place ? `${p.place}位` : fmt(p.stack)}</b></div>`).join('');
  const log = view.logLines.map((l) => (l.startsWith('―') ? `<div class="street">${esc(l)}</div>` : `<div>${esc(l)}</div>`)).join('');
  const head = view.field ? `${fieldHTML(view.field, notices)}<div class="sec">こ の 卓</div>` : '<div class="sec">持 ち 点</div>';
  return `${head}${rows}<div class="sec">こ の ハ ン ド</div><div class="log">${log}</div>`;
}

function buttonsHTML(c, raiseTo) {
  if (!c) return '<span class="wait">相手の行動を待っています…</span>';
  const fold = c.canCheck ? '' : '<button class="b3 fold" data-act="fold">降りる</button>';
  const call = c.canCheck
    ? '<button class="b3 call" data-act="check">チェック</button>'
    : `<button class="b3 call" data-act="call">${c.allInCall ? 'オールイン' : 'コール'}<small>${fmt(c.toCall)}</small></button>`;
  const raise = c.raise
    ? `<button class="b3 raise" data-act="raise">${c.isBet ? 'ベット' : 'レイズ'}<small>${fmt(raiseTo)}</small></button>`
    : '<button class="b3 raise" disabled>レイズ<small>―</small></button>';
  return fold + call + raise;
}

export function renderAll(refs, view, ui) {
  refs.band.textContent = ui.band ?? '自由対局　9人・上位3人入賞';
  refs.hudBody.innerHTML = hudHTML(view.hud);
  refs.info.innerHTML = `残り <b>${view.hud.alive}</b> / ${view.hud.total}人　入賞 <b>${view.hud.paid}</b>位まで<br>平均 <b>${fmt(view.hud.avg)}</b>　ハンド #${view.hud.handNo}`;
  refs.speed.classList.toggle('on', ui.fast);
  refs.board.innerHTML = boardHTML(view.board, view.boardLit);
  refs.layer.innerHTML = layerHTML(view, { pills: !ui.result }) + (ui.flash ? `<div class="flash">${esc(ui.flash)}</div>` : ''); // 卓の移動のお知らせ（数秒）
  refs.side.innerHTML = sideHTML(view, ui.notices ?? []);
  // 右の欄：コーチと大会の状況をタブで切り替える
  refs.coach.innerHTML = coachHTML(ui.coachView);
  refs.coachLv.textContent = ui.coachView.level ? `指南 段階${ui.coachView.level}` : '';
  refs.coach.hidden = ui.tab !== 'coach';
  refs.side.hidden = ui.tab !== 'side';
  for (const b of refs.tabs.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === ui.tab);
  if (view.hero) {
    refs.heroCards.className = `hero${view.hero.folded ? ' folded' : ''}`;
    refs.heroCards.innerHTML = view.hero.hole.map((c, k) => cardHTML(c, litClass('xl', view.hero.lit, k))).join('');
    refs.handInfo.innerHTML = `<b>${view.hero.folded ? '降りました' : view.hero.title}</b>${view.controls ? 'あなたの番です' : ''}`;
  } else {
    refs.heroCards.innerHTML = '';
    refs.handInfo.innerHTML = '';
  }
  const c = view.controls;
  if (c && c.raise) {
    const value = dialStart(c, ui.dial.value(), ui.freshDial);
    ui.freshDial = false;
    ui.dial.set({ min: c.raise.min, max: c.raise.max, value, bb: c.bb, presets: c.presets, label: c.isBet ? 'ベット' : 'レイズ' });
  } else {
    ui.dial.clear();
  }
  refs.buttons.innerHTML = buttonsHTML(c, ui.dial.value());
  // ハンドの結果の札（卓の真ん中・場の札の下。設計書 段階5-5 第2節・そのあとの手直し）
  refs.result.innerHTML = ui.result ?? '';
  refs.result.hidden = !ui.result;
}
