// 卓の画面（縦の並べ方。設計書 段階5-1 第4節）。PC の table-view.js と同じ表示用データ（view-model）と ui を受け取って DOM に反映するだけ。
// mountPortraitShell は、卓の進行（table-game.js）が使う PC と同じ名前の部品を返す（menu・stop・speed・mute・band・hudBody・info・board・
// layer・heroCards・handInfo・buttons・dial・overlay・tabs・coachLv・coach・side）。縦だけの部品：strip（コーチの帯）・sheet（下から出る板）・dim（板の外）。
// 位置と大きさは portrait-geometry.js（重ならないことはテストで確かめる）。
import { cardHTML, cardBackHTML } from './cards.js';
import { fmt, esc } from './format.js';
import { coachParts, coachStripHTML, examCoachHTML, examStripHTML, SHEET_TABS } from './coach-panel.js';
import { dialStart } from './presets.js';
import { initialOf, sideHTML } from './table-view.js';
import { gridBodyHTML } from './range-grid.js';
import { PT, PT_SEATS, PT_MARKS, PT_DEALERS } from './portrait-geometry.js';

const avatarSrc = (name) => `assets/avatars/${name}.webp`;
const SEAT_H = PT.face + PT.plate.h - PT.plate.lift;

// 縦の並べ方では、PC の左上の札（章の印・あなたの名前）は出さない（上の段の帯に大会の名前、あなたは手元）
export function mountPortraitShell(stage) {
  const tabs = SHEET_TABS.map((t) => `<button class="tab" data-tab="${t.key}">${t.label}</button>`).join('');
  stage.innerHTML = `<div class="pt-room">
  <div class="pt-top"><button class="rb" data-ref="menu" aria-label="メニュー（やめて戻る）">☰</button><div class="pt-band"><div class="a" data-ref="band"></div><div class="b" data-ref="hudBody"></div><div class="c" data-ref="info"></div></div><button class="rb" data-ref="mute" aria-label="音（入／切）">🔊</button><button class="rb" data-ref="speed" aria-label="早送り">⏩</button></div>
  <div class="pt-table">
    <div class="pt-rail"><div class="pt-felt"><div class="flogo">やっしーGAMES<small>TEXAS HOLD'EM DOJO</small></div></div></div>
    <div class="fboard" data-ref="board"></div>
    <div data-ref="layer"></div>
    <button class="stopbtn" data-ref="stop" hidden></button>
  </div>
  <div class="pt-strip" data-ref="strip"></div>
  <div class="pane"><div class="hero" data-ref="heroCards"></div><div class="hand2" data-ref="handInfo"></div><div class="pt-amount" data-ref="dial"></div><div class="btnrow" data-ref="buttons"></div></div>
  <div class="pt-dim" data-ref="dim" hidden></div>
  <div class="pt-sheet" data-ref="sheet" hidden>
    <button class="pt-grip" data-sheet="close" aria-label="コーチの板を閉じる"></button>
    <div class="pt-sheet-h"><span class="tabs" data-ref="tabs">${tabs}</span><span class="lv" data-ref="coachLv"></span></div>
    <div class="pt-sheet-b"><div class="cp-b" data-ref="coach"></div><div class="cp-b" data-ref="side"></div></div>
  </div>
  <div class="overlay" data-ref="overlay"></div>
</div>`;
  const refs = {};
  for (const el of stage.querySelectorAll('[data-ref]')) refs[el.dataset.ref] = el;
  // 下から出る板：「コーチ ▲」で開き、つまみ・「コーチ ▼」・板の外（上の段）で閉じる。板は自分からは開かない。開いている間も手元のボタンは押せる
  const setSheet = (open) => {
    refs.sheet.hidden = !open;
    refs.dim.hidden = !open;
    const pull = refs.strip.querySelector('.cs-pull');
    if (pull) { pull.textContent = open ? 'コーチ ▼' : 'コーチ ▲'; pull.dataset.sheet = open ? 'close' : 'open'; }
  };
  refs.strip.addEventListener('click', (e) => { if (e.target.closest('[data-sheet]')) setSheet(refs.sheet.hidden); });
  refs.sheet.addEventListener('click', (e) => { if (e.target.closest('[data-sheet="close"]')) setSheet(false); });
  refs.dim.addEventListener('click', () => setSheet(false));
  return refs;
}

// 席（顔と名札）。降りた人は顔に「降り」、まだ札を持っている人は顔の右下に伏せた札
function seatHTML(sv) {
  const [x, y] = PT_SEATS[sv.disp];
  const cls = ['seat', x > PT.w / 2 && 'rside', sv.isActor && 'actor', sv.folded && 'folded', sv.out && 'out', sv.won > 0 && 'win'].filter(Boolean).join(' ');
  const face = sv.avatar ? `<img src="${avatarSrc(sv.avatar)}" alt="${esc(sv.name)}">` : `<div class="initial">${esc(initialOf(sv.name))}</div>`;
  const extra = sv.folded ? '<span class="fd">降り</span>' : sv.cards === 'back' ? `<span class="bks">${cardBackHTML()}${cardBackHTML()}</span>` : '';
  const sub = sv.out ? (sv.place ? `${sv.place}位` : '敗退') : esc(sv.name);
  return `<div class="${cls}" style="left:${x}px;top:${y}px">
    <div class="frame">${face}${extra}</div>
    <div class="plate"><b>${sv.out ? '―' : fmt(sv.stack)}</b>${sub}</div>
    ${sv.badge ? `<span class="badge">${sv.badge}</span>` : ''}
  </div>`;
}

// 賭けた額と行動の札（1枚）：「レイズ 1,300」「コール 500」「オールイン 19,750」「チェック」。ブラインドなど行動のない額は額だけ
function markText(sv) {
  const amt = sv.bet > 0 ? fmt(sv.bet) : '';
  const act = sv.folded ? null : sv.action;
  if (!act) return amt;
  if (/^(レイズ|ベット) /.test(act)) return act; // 額つき
  return amt ? `${act} ${amt}` : act;
}

export function ptLayerHTML(view, ui) {
  let html = '';
  for (const sv of view.seats) {
    if (sv.empty) continue;
    const text = markText(sv);
    if (text) html += `<div class="pmark" style="left:${PT_MARKS[sv.disp][0]}px;top:${PT_MARKS[sv.disp][1]}px">${text}</div>`;
    if (sv.disp === 0) continue; // あなたは手元に出す
    html += seatHTML(sv);
    // 勝負で見せた札：顔の上に2枚の扇（上は顔の上から lift だけ出す）
    if (sv.cards === 'up') {
      const [x, y] = PT_SEATS[sv.disp];
      html += `<div class="shown${sv.won > 0 ? ' win' : ''}" style="left:${x}px;top:${y - SEAT_H / 2 - PT.shown.lift}px">${sv.hole.map((c) => cardHTML(c)).join('')}</div>`;
    }
  }
  if (view.buttonDisp !== null) html += `<div class="dealer" style="left:${PT_DEALERS[view.buttonDisp][0]}px;top:${PT_DEALERS[view.buttonDisp][1]}px">D</div>`;
  // ポットの額と結果の帯は同じ場所（結果の帯が出ている間はポットを出さない）
  if (ui.banner) html += `<div class="banner">${ui.banner}</div>`;
  else if (view.pot > 0) html += `<div class="pt-pot">ポット ${fmt(view.pot)}</div>`;
  if (ui.flash) html += `<div class="flash">${esc(ui.flash)}</div>`; // 卓の移動のお知らせ（数秒）
  return html;
}

function boardHTML(board) {
  let html = board.map((c) => cardHTML(c)).join('');
  for (let k = board.length; k < 5; k++) html += '<div class="slot"></div>';
  return html;
}

// 行動のボタン（一番下に3つ）。value：選んでいる額。チェックできるときの「降りる」と、番でないときは押せない形
export function ptButtonsHTML(c, value) {
  if (!c) return '<button class="b3 fold" disabled>降りる</button><button class="b3 call" disabled>コール</button><button class="b3 raise" disabled>レイズ</button>';
  const fold = c.canCheck ? '<button class="b3 fold" disabled>降りる</button>' : '<button class="b3 fold" data-act="fold">降りる</button>';
  const call = c.canCheck
    ? '<button class="b3 call" data-act="check">チェック</button>'
    : `<button class="b3 call" data-act="call">${c.allInCall ? 'オールイン' : 'コール'}<small>${fmt(c.toCall)}</small></button>`;
  const name = value >= c.raise?.max ? 'オールイン' : c.isBet ? 'ベット' : 'レイズ';
  const raise = c.raise
    ? `<button class="b3 raise" data-act="raise">${name}<small>${fmt(value)}</small></button>`
    : '<button class="b3 raise" disabled>レイズ<small>―</small></button>';
  return fold + call + raise;
}

// 手札の横：手の説明・「あなたの番です」・選んでいる額（大きな字と BB の倍数）
export function ptHandInfoHTML(view, value) {
  if (!view.hero) return '';
  const c = view.controls;
  // 長い手の説明（ドローが2つ。16字から）は小さめの字にして2行に収める（額の行を目盛りのボタンに隠さない）
  const title = view.hero.folded ? '降りました' : view.hero.title;
  const head = `<b${Array.from(title).length > 15 ? ' class="long"' : ''}>${title}</b><small>${c ? 'あなたの番です' : '相手の行動を待っています'}</small>`;
  if (!c || !c.raise || value === null) return head;
  return `${head}<div class="pt-amt">${fmt(value)}<small>${c.isBet ? 'ベット' : 'レイズ'}の額（${Number((value / c.bb).toFixed(1))}BB）</small></div>`;
}

// 板のタブ：ui.tab が「coach」（卓の進行が「コーチを出す」にした）なら、前に見ていたコーチのタブ（初めは助言）
export function sheetTabOf(ui) {
  if (ui.tab === 'side') return 'side';
  if (ui.tab !== 'coach') ui.coachTab = ui.tab;
  return ui.coachTab ?? 'advice';
}

// 板の中身（大会のタブは sideHTML）。ui.grid：相手の手の表 { cells, title }（あなたの番の分析にあるとき）、ui.exam：最終試験の数
export function ptSheetHTML(tab, ui) {
  if (ui.exam) return tab === 'advice' ? examCoachHTML(ui.exam) : '<div class="idle">試験中は指南なし</div>';
  if (tab === 'grid') return ui.grid ? `<div class="sec">${esc(ui.grid.title)}</div>${gridBodyHTML(ui.grid.cells)}` : '<div class="idle">相手の手の表は、相手が参加している場面で、あなたの番に出ます</div>';
  const html = coachParts(ui.coachView)[tab];
  return html || '<div class="idle">相手の手の推定は、相手が参加している場面で、あなたの番に出ます</div>';
}

export function renderPortrait(refs, view, ui) {
  const h = view.hud;
  refs.band.textContent = ui.band ?? '自由対局　9人・上位3人入賞';
  refs.hudBody.textContent = `レベル${h.level}　${fmt(h.sb)}/${fmt(h.bb)}　アンティ${fmt(h.ante)}`;
  refs.info.textContent = `残り ${h.alive}/${h.total}人・平均 ${fmt(h.avg)}・ハンド #${h.handNo}`;
  refs.speed.classList.toggle('on', ui.fast);
  refs.board.innerHTML = boardHTML(view.board);
  refs.layer.innerHTML = ptLayerHTML(view, ui);
  // コーチの帯と板
  const open = !refs.sheet.hidden;
  refs.strip.innerHTML = ui.exam ? examStripHTML(ui.exam, { open }) : coachStripHTML(ui.coachView, { open });
  const tab = sheetTabOf(ui);
  refs.coach.innerHTML = tab === 'side' ? '' : ptSheetHTML(tab, ui);
  refs.side.innerHTML = tab === 'side' ? sideHTML(view, ui.notices ?? []) : '';
  refs.coach.hidden = tab === 'side';
  refs.side.hidden = tab !== 'side';
  for (const b of refs.tabs.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
  refs.coachLv.textContent = ui.exam ? '指南なし' : ui.coachView.level ? `指南 段階${ui.coachView.level}` : '';
  // 手元
  const c = view.controls;
  if (c && c.raise) {
    const value = dialStart(c, ui.dial.value(), ui.freshDial);
    ui.freshDial = false;
    ui.dial.set({ min: c.raise.min, max: c.raise.max, value, bb: c.bb, presets: c.presets, label: c.isBet ? 'ベット' : 'レイズ' });
  } else {
    ui.dial.clear();
  }
  if (view.hero) {
    refs.heroCards.className = `hero${view.hero.folded ? ' folded' : ''}`;
    refs.heroCards.innerHTML = view.hero.hole.map((x) => cardHTML(x)).join('');
  } else {
    refs.heroCards.innerHTML = '';
  }
  refs.handInfo.innerHTML = ptHandInfoHTML(view, ui.dial.value());
  refs.buttons.innerHTML = ptButtonsHTML(c, ui.dial.value());
}
