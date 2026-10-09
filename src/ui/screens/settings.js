// 設定・確認の札（成績と統計は screens/stats.js）。
import { esc, localStamp } from '../format.js';
import { DEFAULT_SOUND, HERO_VOICES, CHATTER, NO_VOICE } from '../../dojo/sound-settings.js';
import { SFX_CREDITS } from '../sfx.js';

// 入／切のボタン（押すと main.js の操作 snd が k を切り替える。v があればその値にする）
const tg = (k, on, label, v = null) => `<button class="tg${on ? ' on' : ''}" data-go="snd" data-k="${k}"${v === null ? '' : ` data-v="${v}"`}>${label}</button>`;
const sw = (k, on) => tg(k, on, on ? '入' : '切');
const range = (k, value) => `<div class="snd-ctl"><input type="range" min="0" max="100" step="10" value="${value}" data-snd="${k}" aria-label="${k === 'voiceVol' ? '声の大きさ' : '効果音の大きさ'}"><b>${value}</b></div>`;

// 音の欄（設計書 段階4-5 第5-1節）。s：音の設定（soundSettings の形）、credits：使っている声のキャラ（manifest.json の credits）
function soundHTML(s, credits) {
  const voices = [...HERO_VOICES, { key: NO_VOICE, label: '声なし' }]
    .map((v) => `<option value="${v.key}"${v.key === s.heroVoice ? ' selected' : ''}>${esc(v.label)}</option>`).join('');
  const voiceCredit = credits.length ? `音声：${credits.map((n) => `VOICEVOX:${esc(n)}`).join('、')}<br>` : '';
  return `<div class="det snd"><h5>音</h5>
      <div class="snd-grid">
        <span>音を出す</span><div class="snd-ctl">${sw('on', s.on)}</div>
        <span>声</span><div class="snd-ctl">${sw('voice', s.voice)}</div>
        <span>効果音</span><div class="snd-ctl">${sw('sfx', s.sfx)}</div>
        <span>声の大きさ</span>${range('voiceVol', s.voiceVol)}
        <span>効果音の大きさ</span>${range('sfxVol', s.sfxVol)}
        <span>一言の量</span><div class="snd-ctl">${CHATTER.map((c) => tg('chatter', c.key === s.chatter, c.label, c.key)).join('')}</div>
        <span>あなたの声</span><div class="snd-ctl"><select data-snd="heroVoice" aria-label="あなたの声">${voices}</select><button class="nb" data-go="snd-preview"${s.heroVoice === NO_VOICE ? ' disabled' : ''}>試しに聞く</button></div>
        <span>iPhone のマナーモードでも鳴らす</span><div class="snd-ctl">${sw('silentPlay', s.silentPlay)}</div>
      </div>
      <p class="credit">${voiceCredit}効果音：${SFX_CREDITS.map((c) => esc(c.name)).join('・')}</p>
    </div>`;
}

// v：{ name, usable（保存できるか）, sound（音の設定。省くと初めの値）, credits（使っている声のキャラ。省くと出さない）}
export function settingsHTML(v) {
  return `<div class="scr st-s">
  <div class="sbar"><button class="back" data-go="title">◀ タイトル</button><h4>設 定</h4><span class="sp"></span></div>
  <div class="st-body two">
    <div class="st-col">
      <div class="det"><h5>名前</h5><div class="st-row"><b class="st-name">${esc(v.name)}</b><button class="nb" data-go="rename">名前を変える</button></div></div>
      <div class="det"><h5>記録</h5>
        <p>${v.usable ? '記録はこの端末のブラウザに自動で保存しています。' : '<b class="warn">今は記録を保存できない状態です（プライベートモードなど）。</b>'}</p>
        <p>別のパソコンへ移すときや、公開版に引っ越すときは、書き出したファイルを読み込みます。</p>
        <div class="st-btns"><button class="nb p" data-go="export">記録を書き出す</button><button class="nb" data-go="import">記録を読み込む</button><button class="nb danger" data-go="reset">記録を消して最初から</button></div>
      </div>
      <div class="det"><h5>このゲームについて</h5><p>お金を賭けないこと・記録・素材の出どころ・権利</p><div class="st-btns"><button class="nb" data-go="about">このゲームについて</button></div></div>
    </div>
    ${soundHTML(v.sound ?? DEFAULT_SOUND, v.credits ?? [])}
  </div>
</div>`;
}

// 確認の札（読み込み・消去・お知らせ）。buttons：[{ go, label, primary, danger }]
export function dialogHTML({ title, body, buttons }) {
  const bs = buttons.map((b) => `<button class="mb ${b.primary ? 'p' : 's'}${b.danger ? ' danger' : ''}" data-go="${b.go}">${esc(b.label)}</button>`).join('');
  return `<div class="ov-dim"><div class="nm-card dlg"><h3>${esc(title)}</h3><div class="dlg-b">${body}</div><div class="nm-btns">${bs}</div></div></div>`;
}

// 読み込む記録の要約（inspectImport の summary）
export const importSummaryHTML = (s) => `<table class="fg-tb"><tr><th>名前</th><td>${esc(s.name)}</td></tr><tr><th>段位</th><td>${esc(s.rank)}（合格した章 ${s.passed}）</td></tr><tr><th>保存した日時</th><td>${esc(localStamp(s.savedAt))}</td></tr></table><p>今の記録と置き換えますか？（今の記録は控えに残します）</p>`;
