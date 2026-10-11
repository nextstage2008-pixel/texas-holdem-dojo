// 遊び方の目次（設計書 段階5-4 第2節）。5つを目次の順に並べ、終えたものに「済」。
import { esc } from '../format.js';

// v：{ lessons（tutorial/lessons.js の LESSONS）, done（終えた目次の名前）}
export function tutorialMenuHTML(v) {
  const items = v.lessons.map((l, i) => {
    const done = v.done.includes(l.id);
    return `<button class="tut-item${done ? ' done' : ''}" data-go="tut-start" data-lesson="${l.id}"><b>${i + 1}　${esc(l.title)}</b><small>${esc(l.desc)}</small><em>約${l.minutes}分</em>${done ? '<span class="tut-done">済</span>' : ''}</button>`;
  }).join('');
  return `<div class="scr tut-s">
  <div class="sbar"><button class="back" data-go="title">◀ タイトル</button><h4>チュートリアル</h4><span class="sp"></span></div>
  <div class="st-body tut-menu">
    <p class="tut-lead">本物の卓を動かしながら、ゲームの進め方とルール、行動の決め方を説明します。はじめての人は上から順にどうぞ。</p>
    ${items}
  </div>
</div>`;
}
