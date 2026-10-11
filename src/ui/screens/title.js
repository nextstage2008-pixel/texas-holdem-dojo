// 起動演出・タイトル・名前の入力（確定見本 mock-title-v14.html）。表示用データを受け取ってHTMLを返すだけ。
import { LOGO_DEFS, palmSVG, logotypeSVG } from './logo.js';
import { cardHTML } from '../cards.js';
import { chipStackSVG } from '../chips.js';
import { esc } from '../format.js';
import { parseCards } from '../../engine/cards.js';
import { CAST } from '../../game/session.js';
import { rankOf, resumeTarget, currentChapter, chapterState } from '../../dojo/progress.js';
import { chapterLabel, chapterOf, PLAYABLE } from '../../dojo/chapters.js';
import { MASTER } from '../../dojo/ranks.js';
import { dueToday } from '../../dojo/reviews.js';
import { NAME_MAX } from '../../dojo/name.js';
import { resumeLabel } from '../../game/main-event.js';
import { HOME_NOTE } from '../keep-record.js';
import { BUILD, versionText } from '../build-info.js';

export const BRAND = 'やっしーGAMES';
export const VERSION_LINE = `${BRAND}　テキサスホールデム道場　${versionText(BUILD)}`;

export const splashHTML = () => `${LOGO_DEFS}<div class="scr splash" data-go="skip">
  ${palmSVG('slogo')}<div class="sname">${BRAND}</div><div class="line"></div><div class="pr">PRESENTS</div>
</div>`;

// 記録からタイトルに出す中身を作る。env.safariNote：iPhone の Safari のタブで開いている（ホーム画面に追加のすすめを出す）
export function buildTitleView(rec, today, env = {}) {
  const rank = rankOf(rec);
  const cur = currentChapter(rec);
  const st = chapterState(rec, cur);
  const done = Object.values(st.steps ?? {}).filter((s) => s.done).length;
  const resume = resumeTarget(rec, today);
  const { answered, correct } = rec.practiceStats;
  // 名前の下の行：達人なら達人、卒業したら卒業の日、全章に合格したら卒業試験の案内、それまではいまの章
  const grad = rec.graduation.passedAt;
  const t = rec.mainTitles;
  const chapter = rank.dan >= MASTER ? `達人　本番大会の優勝 ${t.wins}回・入賞 ${t.cashes}回`
    : grad ? `卒業（${grad}）`
      : rank.passed === PLAYABLE.length ? '全9章に合格・卒業試験を受けられます'
        : `${chapterLabel(cur)}「${chapterOf(cur).title}」`;
  return {
    name: rec.profile.name ?? '',
    rank: rank.label,
    chapter,
    accuracy: answered ? Math.round((correct / answered) * 100) : null,
    progress: done / (Object.keys(st.steps ?? {}).length || 3), // 章の段は3つ（講義・練習問題・章末試験）
    resume: resume ? { label: resume.fresh ? 'はじめる' : '続きから', sub: resume.fresh ? '序章の講義から' : resume.label } : { label: '道場で学ぶ', sub: '卒業しました' },
    reviews: dueToday(rec.reviews, today).length,
    main: rec.mainGame ? resumeLabel(rec.mainGame.field) : null, // 本番大会の続き
    safariNote: !!env.safariNote,
    update: !!env.update, // 新しい版が待っている（公開版だけ。設計書 段階5-2 第3-4節）
  };
}

const FAN = parseCards('Ts Js Qs Ks As');
// チュートリアルの入口（PC はメニューの「続きから／はじめる」のすぐ下、縦は「はじめる」のすぐ上。はじめての人が最初に目に入る所）
const TUT_LABEL = '🔰 チュートリアル';
const TUT_SUB = 'はじめての人はここから・画面の見方と1ハンドの進め方';
const STACKS = [
  { left: '13%', top: 150, chips: [5000, 5000, 5000, 1000, 1000] },
  { left: '21%', top: 156, chips: [500, 500, 500] },
  { left: '80%', top: 154, chips: [25000, 25000, 1000, 1000, 1000, 1000] },
];

// layout：並べ方（'portrait' なら縦の案A。設計書 段階5-1 第5節）
export function titleHTML(v, layout = 'pc') {
  if (layout === 'portrait') return titlePortraitHTML(v);
  const fan = FAN.map((c, i) => `<div class="tcard" style="--r:${(i - 2) * 12}deg;animation-delay:${0.3 + i * 0.12}s">${cardHTML(c)}</div>`).join('');
  const stacks = STACKS.map((s) => `<div class="cstack" style="left:${s.left};top:${s.top}px">${chipStackSVG(s.chips, 22)}</div>`).join('');
  const cast = CAST.slice(1).map((p, i) => `<span class="cv" style="animation-delay:${0.9 + i * 0.08}s"><img src="assets/avatars/${p.avatar}.webp" alt=""></span>`).join('');
  const review = v.reviews ? `<em class="badge-r">復習 ${v.reviews}問</em>` : '';
  return `${LOGO_DEFS}<div class="scr ts">
  <div class="ts-grid">
    <div class="ts-left">
      ${palmSVG('tlogo')}
      <div class="brand">${BRAND}</div>
      ${logotypeSVG('lgA')}
      <div class="fan">${fan}${stacks}</div>
      <div class="cast"><div class="cast-lab">今日の対戦相手</div><div class="cast-row">${cast}</div></div>
    </div>
    <div class="menu">
      <div class="who">
        <div class="hav"><img src="assets/avatars/av_hero.webp" alt=""><span class="medal">${esc(v.rank)}</span></div>
        <div><b>${esc(v.name)} さん</b><small>${esc(v.chapter)}${v.accuracy === null ? '' : `　正答率 ${v.accuracy}%`}</small><div class="prog"><i style="width:${Math.round(v.progress * 100)}%"></i></div></div>
      </div>
      <button class="mb p" data-go="resume"><span>${v.resume.label}</span><small>${esc(v.resume.sub)}</small></button>
      <button class="mb s tut" data-go="tutorial"><span>${TUT_LABEL}</span><small>${TUT_SUB}</small></button>
      <button class="mb s" data-go="dojo"><span>道場で学ぶ ${review}</span><small>章を選ぶ・講義・練習問題</small></button>
      <button class="mb s" data-go="free"><span>自由対局</span><small>9人卓・指南の段階を選べる</small></button>
      <button class="mb s" data-go="main"><span>本番大会</span><small>${v.main ? `続きあり（${esc(v.main)}）` : '45人・9人×5卓・上位6人入賞'}</small></button>
      <div class="mrow"><button class="mb s" data-go="stats"><span>成績と統計</span></button><button class="mb s" data-go="settings"><span>設定</span><small>名前の変更など</small></button></div>
    </div>
  </div>
  ${v.safariNote ? `<button class="ts-hint ts-note" data-go="home-howto">${HOME_NOTE}</button>` : '<div class="ts-hint">記録は自動で保存されます。別の端末へ移すときは「設定」から書き出せます</div>'}
  <div class="ver">${VERSION_LINE}</div>${v.update ? UPDATE_PC : ''}
</div>`;
}

// 新しい版の知らせ（タイトルの画面だけ。押すと切り替えて読み直す）
const UPDATE_TEXT = '新しい版があります（押すと更新）';
const UPDATE_PC = `<button class="ts-update" data-go="sw-update">${UPDATE_TEXT}</button>`;

// 縦のタイトル（案A「ロゴが主役」）：上にロゴと札の扇・チップ、細い名札、横長の「🔰 チュートリアル」、大きな「はじめる」、四角いボタン2×2、左下に小さく「⚙ 設定」。
// 「今日の対戦相手」の顔の列は出さない
const TP_STACKS = [{ left: '40px', chips: [1000, 1000, 500, 500, 100] }, { right: '40px', chips: [5000, 5000, 1000, 500] }];
function titlePortraitHTML(v) {
  const fan = FAN.map((c, i) => `<div class="tcard" style="--r:${(i - 2) * 12}deg;animation-delay:${0.3 + i * 0.12}s">${cardHTML(c)}</div>`).join('');
  const stacks = TP_STACKS.map((s) => `<div class="cstack" style="${s.left ? `left:${s.left}` : `right:${s.right}`}">${chipStackSVG(s.chips, 26)}</div>`).join('');
  const review = v.reviews ? `<em class="badge-r">復習 ${v.reviews}問</em>` : '';
  const tile = (go, label, sub, extra = '') => `<button class="tp-tile" data-go="${go}"><b>${label}</b><small>${esc(sub)}</small>${extra}</button>`;
  return `${LOGO_DEFS}<div class="scr ts tp${v.safariNote ? ' noted' : ''}">
  ${v.update ? `<button class="tp-update" data-go="sw-update">${UPDATE_TEXT}</button>` : ''}<div class="tp-head">${palmSVG('tlogo')}<div class="brand">${BRAND}</div>${logotypeSVG('lgA')}</div>${v.safariNote ? `<button class="tp-note" data-go="home-howto">${HOME_NOTE}</button>` : ''}
  <div class="tp-fan">${fan}${stacks}</div>
  <div class="tp-who"><img src="assets/avatars/av_hero.webp" alt=""><div><b>${esc(v.name)} さん</b><small>${esc(v.chapter)}${v.accuracy === null ? '' : `　正答率 ${v.accuracy}%`}</small><div class="prog"><i style="width:${Math.round(v.progress * 100)}%"></i></div></div><span class="medal">${esc(v.rank)}</span></div>
  <button class="tp-tut" data-go="tutorial"><b>${TUT_LABEL}</b><small>${TUT_SUB}</small></button>
  <button class="tp-go" data-go="resume"><span>${v.resume.label}</span><small>${esc(v.resume.sub)}</small></button>
  <div class="tp-tiles">${tile('dojo', '📖 道場で学ぶ', '章を選ぶ・講義・練習問題', review)}${tile('free', '🃏 自由対局', '9人卓・指南の段階を選べる')}${tile('main', '🏆 本番大会', v.main ? `続きあり（${v.main}）` : '45人・上位6人入賞')}${tile('stats', '📊 成績と統計', '判断の質・運と実力')}</div>
  <div class="tp-foot"><button class="tp-set" data-go="settings">⚙ 設定</button><span class="ver">${VERSION_LINE}</span></div>
</div>`;
}

// 名前の入力。mode：first（初めて起動したとき）・change（設定から）
export function nameEntryHTML({ mode, value = '', error = null }) {
  const first = mode === 'first';
  return `<div class="ov-dim"><div class="nm-card">
    <h3>${first ? 'ようこそ、道場へ' : '名前の変更'}</h3>
    <p>${first ? 'あなたの名前を教えてください。<br>卓の席や成績表に表示されます。' : '新しい名前を入れてください。'}</p>
    <input class="nm-in" data-ref="nameInput" value="${esc(value)}" placeholder="例：たろう" autocomplete="off">
    <div class="nm-err">${error ? esc(error) : ''}</div>
    <div class="nm-cnt">${NAME_MAX}文字まで（ひらがな・カタカナ・漢字・英数字）</div>
    <div class="nm-btns">${first ? '' : '<button class="mb s" data-go="name-cancel">やめる</button>'}<button class="mb p" data-go="name-ok">${first ? 'はじめる' : '変える'}</button></div>
  </div></div>`;
}
