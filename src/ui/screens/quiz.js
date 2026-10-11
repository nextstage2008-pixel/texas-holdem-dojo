// 練習問題・復習・章末試験・卒業試験の画面（確定見本 mock-dojo-v1.html の③）と、試験の結果（④）。
import { cardHTML } from '../cards.js';
import { esc } from '../format.js';
import { chapterLabel, chapterOf, TEST_COUNT, TEST_PASS, GRAD } from '../../dojo/chapters.js';

const MODE = { practice: '練習問題', review: '今日の復習', test: '章末試験', grad: '卒業試験' };
// 答えたあとに正誤と解説を出さない試験（章末試験・卒業試験）
const exam = (mode) => mode === 'test' || mode === 'grad';

// v：{ mode, chapterId, index, total, correct（ここまでの正解数）, q（makeQuestion の結果）, chosen（選んだ番号か null）}
export function quizHTML(v) {
  const { q } = v;
  const head = v.mode === 'review' ? '今日の復習' : v.mode === 'grad' ? '全9章の総合問題' : `${chapterLabel(v.chapterId)}　${chapterOf(v.chapterId).title}`;
  const answered = v.chosen !== null;
  const showResult = answered && !exam(v.mode);
  const choices = q.choices.map((c, i) => {
    let cls = 'op';
    if (showResult) cls += i === q.answer ? ' right' : i === v.chosen ? ' wrong' : ' dim';
    return `<button class="${cls}" data-go="choose" data-i="${i}"${answered ? ' disabled' : ''}>${esc(c)}${showResult && i === q.answer ? ' ✓' : ''}</button>`;
  }).join('');
  const ok = v.chosen === q.answer;
  const fb = showResult ? `<div class="fb ${ok ? 'ok' : 'ng'}">
      <h4>${ok ? `正解！ ${esc(q.choices[q.answer])}` : `残念… 正解は「${esc(q.choices[q.answer])}」`}</h4>
      ${q.explain.map((e) => `<p>${esc(e)}</p>`).join('')}
      ${q.calc ? `<div class="calc">${esc(q.calc)}</div>` : ''}
      ${ok ? '' : '<div class="memo">この問題は1日後にもう一度出ます（今日の復習）</div>'}
      <div class="nxr"><button class="nx" data-go="next">${v.index + 1 >= v.total ? '終わる' : '次へ ▶'}</button></div></div>` : '';
  const counter = exam(v.mode) ? '<span class="cnt">ヒントも正誤も出ません</span>' : `<span class="cnt">正解 ${v.correct}</span>`;
  return `<div class="scr qz-s">
  <div class="sbar"><button class="back" data-go="quit">◀ やめる</button><h4>${MODE[v.mode]}</h4><span class="sp"></span><span class="who">${esc(head)}</span></div>
  <div class="qz">
    <div>${sceneHTML(q.scene)}</div>
    <div>
      <div class="qh"><span class="qno">${v.index + 1} / ${v.total}</span><span class="qbar"><i style="width:${Math.round(((v.index + (answered ? 1 : 0)) / v.total) * 100)}%"></i></span>${counter}</div>
      <div class="q">${esc(q.prompt)}</div>
      <div class="chs2${q.choices.length > 4 ? ' five' : ''}${q.choices.some((c) => c.length > 14) ? ' long' : ''}">${choices}</div>
      ${fb}
    </div>
  </div>
</div>`;
}

// 場面：卓の上に場のカードと札、下にあなたの手。A・B の手があれば並べる
export function sceneHTML(s) {
  const board = s.board.length ? `<div class="cards">${s.board.map((c) => cardHTML(c)).join('')}</div>` : '';
  const pills = s.pills.map((p) => `<span class="pot">${esc(p)}</span>`).join('');
  const others = s.others.map((o) => `<div class="other"><span class="lab">${esc(o.label)}</span>${o.cards.map((c) => cardHTML(c)).join('')}</div>`).join('');
  const mine = s.hole?.length ? `<div class="mine"><span class="lab">あなたの手</span>${s.hole.map((c) => cardHTML(c)).join('')}</div>` : '';
  return `<div class="qfelt">${board}<div class="pills">${pills}</div>${others ? `<div class="others">${others}</div>` : ''}</div>${mine}`;
}

// 間違えた問題の一覧。questions：makeQuestion の結果の列、results：gradeTest の results。why は解説の全部の行
export const wrongList = (questions, results) => results.map((x, k) => ({ x, k })).filter(({ x }) => !x.correct).map(({ x, k }) => ({
  no: k + 1, chosen: questions[k].choices[x.chosen], right: questions[k].choices[questions[k].answer], why: questions[k].explain,
}));

// 試験の結果。v：{ chapterId, score, passed, firstPass, rankBefore, rankAfter, opened（章の id か null）, wrong: wrongList の結果 }。
// 卒業試験は v.grad＝true（chapterId・段位・開いた章はない。30問・24問で合格・合格のはんこは「卒業」）
export function testResultHTML(v) {
  const total = v.grad ? GRAD.count : TEST_COUNT;
  const pass = v.grad ? GRAD.pass : TEST_PASS;
  const up = !v.grad && v.firstPass ? `<div class="up"><span class="medal">${esc(v.rankBefore)}</span><span class="ar">➜</span><span class="medal big">${esc(v.rankAfter)}</span></div>` : '';
  const opened = !v.grad && v.opened ? `<span class="opn">${chapterLabel(v.opened)}「${esc(chapterOf(v.opened).title)}」が開きました</span>` : '';
  const miss = v.wrong.length
    ? v.wrong.map((w) => `<div class="mi">問${w.no}　あなたの答え <b>${esc(w.chosen)}</b>　正解 <span>${esc(w.right)}</span><br>${w.why.map(esc).join('<br>')}</div>`).join('')
    : '<div class="mi">全問正解です！</div>';
  const buttons = v.passed
    ? `<button class="nb" data-go="dojo">道場へ戻る</button>${!v.grad && v.opened ? `<button class="nb p" data-go="open-next" data-ch="${v.opened}">${chapterLabel(v.opened)}へ ▶</button>` : '<button class="nb p" data-go="title">タイトルへ</button>'}`
    : '<button class="nb" data-go="dojo">道場へ戻る</button><button class="nb p" data-go="retest">もう一度受ける</button>';
  return `<div class="scr rs">
  <div class="sbar"><button class="back" data-go="dojo">◀ 道場</button><h4>${v.grad ? '卒業試験' : '章末試験'}</h4><span class="sp"></span><span class="who">${v.grad ? '全9章の総合問題' : `${chapterLabel(v.chapterId)}　${esc(chapterOf(v.chapterId).title)}`}</span></div>
  <div class="res">
    <div class="score">
      <span class="stamp${v.passed ? '' : ' ng'}">${v.passed ? (v.grad ? '卒業' : '合格') : '不合格'}</span>
      <div class="pts"><b>${v.score}</b> / ${total} 問正解<small>${v.passed ? '' : `あと ${pass - v.score}問で合格　`}合格は${pass}問から　何度でも受け直せます</small></div>
      ${up}${opened}
    </div>
    <div class="det miss"><h5>${v.wrong.length ? `間違えた${v.wrong.length}問` : '間違えた問題'}</h5><div class="mis">${miss}</div><div class="btns">${buttons}</div></div>
  </div>
</div>`;
}
