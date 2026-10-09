// 「このゲームについて」（設計書 段階5-2 第5-1節）。設定の画面から開く1枚の画面。
// お金を賭けないこと・記録はどこにも送らないこと・素材の出どころ・権利。どこにもリンクを載せない（実在のカジノなどへ誘導しない）
import { esc } from '../format.js';

// v：{ credits（使っている声のキャラ。manifest.json の credits）, version（版の表示。title.js の VERSION_LINE）}
export function aboutHTML(v) {
  const voices = v.credits.length ? v.credits.map((n) => `VOICEVOX:${esc(n)}`).join('、') : 'VOICEVOX';
  return `<div class="scr about-s">
  <div class="sbar"><button class="back" data-go="settings">◀ 設定</button><h4>このゲームについて</h4><span class="sp"></span></div>
  <div class="st-body about">
    <div class="det"><h5>お金を賭けません</h5><p>チップは点数です。換金や景品はありません。実在のカジノや、お金を賭けるポーカーとは関係がなく、勧めもしません。</p></div>
    <div class="det"><h5>記録</h5><p>記録はこの端末のブラウザの中だけに置き、どこにも送りません。別の端末へ移すときは、設定の「記録を書き出す」と「記録を読み込む」を使います。</p></div>
    <div class="det"><h5>素材</h5>
      <dl class="about-cr"><dt>声</dt><dd>${voices}</dd><dt>効果音</dt><dd>Tスタ・効果音ラボ</dd>
        <dt>書体</dt><dd>Dela Gothic One（SIL Open Font License 1.1。許諾書 assets/fonts/OFL.txt を同梱）</dd><dt>顔の絵</dt><dd>Gemini で作成（やっしーGAMES のオリジナル）</dd></dl>
      <p class="small">声と効果音のファイルは、プログラムのライセンスの対象外です。VOICEVOX と各キャラ・各配布元の利用規約に従います。素材として取り出して使わないでください。</p>
    </div>
    <div class="det"><h5>権利</h5><p>© やっしーGAMES　すべての権利を留保します。</p><p class="small">${esc(v.version)}</p></div>
  </div>
</div>`;
}
