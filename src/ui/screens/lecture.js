// 講義（めくり式。確定見本 mock-dojo-v1.html の②）。見開きの左に図、右に見出し・文章・ここが大事（最後はまとめ）。
import { esc } from '../format.js';
import { figureHTML } from './figures.js';
import { lectureOf } from '../../dojo/lectures/chapters.js';
import { figureData } from '../../dojo/lectures/figures.js';
import { chapterLabel, chapterOf } from '../../dojo/chapters.js';

export function buildLectureView(chapterId, page) {
  const pages = lectureOf(chapterId);
  const p = Math.max(0, Math.min(page, pages.length - 1));
  const data = pages[p];
  return {
    chapterId, page: p, count: pages.length, last: p === pages.length - 1,
    heading: `${chapterLabel(chapterId)}　${chapterOf(chapterId).title}`,
    title: data.title, text: data.text ?? [], key: data.key ?? null, summary: data.summary ?? null,
    figure: figureData(data.figure),
  };
}

export function lectureHTML(v) {
  const dots = Array.from({ length: v.count }, (_, i) => `<i${i === v.page ? ' class="on"' : ''}></i>`).join('');
  const body = v.summary
    ? `<ol class="sum">${v.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`
    : `<div class="txt">${v.text.map((t) => `<p>${esc(t)}</p>`).join('')}</div>${v.key ? `<div class="key"><strong>ここが大事</strong>${esc(v.key)}</div>` : ''}`;
  return `<div class="scr lc">
  <div class="sbar"><button class="back" data-go="dojo">◀ 道場</button><h4>講 義</h4><span class="sp"></span><span class="who">${esc(v.heading)}</span></div>
  <div class="book">
    <div class="pg">${figureHTML(v.figure)}</div>
    <div class="pg"><h6>${v.page + 1} / ${v.count}</h6><h3>${esc(v.title)}</h3>${body}</div>
  </div>
  <div class="nav"><button class="nb" data-go="lec-prev"${v.page === 0 ? ' disabled' : ''}>◀ 前へ</button><span class="dots">${dots}</span>
    ${v.last ? '<button class="nb p" data-go="lec-done">練習問題へ ▶</button>' : '<button class="nb p" data-go="lec-next">次へ ▶</button>'}</div>
</div>`;
}
