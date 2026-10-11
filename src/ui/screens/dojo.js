// 道場：章を選ぶ画面（確定見本 mock-dojo-v1.html の①）。
import { esc } from '../format.js';
import { CHAPTERS, chapterLabel, previousPlayable, PRACTICE_COUNT, TEST_COUNT, TEST_PASS, GRAD } from '../../dojo/chapters.js';
import { chapterState, rankOf, currentChapter, gradState } from '../../dojo/progress.js';
import { dueToday } from '../../dojo/reviews.js';
import { lectureOf } from '../../dojo/lectures/chapters.js';

const STEP_KEYS = ['lecture', 'practice', 'test'];
const STEP_SHORT = { lecture: '講', practice: '練', test: '試' };

// 卒業試験の段（2026-10-12）：全9章に合格する前は鍵（押せない）・途中は「受験中」・卒業したら「卒業」
function gradRow(rec, sel) {
  const c = CHAPTERS.find((x) => x.id === 'grad');
  const g = gradState(rec);
  const status = !g.open ? 'locked' : g.passed ? 'passed' : 'doing';
  const label = !g.open ? '🔒 全9章の後' : g.passed ? '卒業' : g.inProgress !== null ? '受験中' : '受けられる';
  return { id: c.id, seal: c.seal, title: c.title, ask: c.ask, status, label, steps: [], selected: sel === 'grad', clickable: g.open };
}

// 卒業試験の中身：出題・合格の決まり・あなたの結果と、ボタン（受ける／続きから／もう一度受ける／全章合格の前は押せない）
function gradDetail(rec) {
  const c = CHAPTERS.find((x) => x.id === 'grad');
  const g = gradState(rec);
  const result = g.passed ? `卒業（${g.passedAt}）・最高 ${g.best}点` : g.best !== null ? `まだ卒業していません・最高 ${g.best}点` : 'まだ受けていません';
  const rows = [
    { n: 1, name: '出題', sub: `全9章から${GRAD.count}問（各章${GRAD.perChapter}問以上）・ヒントなし`, state: 'open', note: '' },
    { n: 2, name: '合格', sub: `${GRAD.pass}問正解で卒業・何度でも受けられます`, state: 'open', note: '' },
    { n: 3, name: 'あなたの結果', sub: result, state: g.passed ? 'ok' : 'open', note: g.inProgress !== null ? '途中' : '' },
  ];
  const button = !g.open ? { label: '全部の章に合格すると受けられます', disabled: true }
    : g.inProgress !== null ? { label: `続きから（${g.inProgress + 1}問目から）`, disabled: false }
      : { label: g.passed ? 'もう一度受ける' : '受ける', disabled: false };
  return { id: 'grad', heading: `卒業試験　${c.ask}`, desc: c.desc, open: true, grad: { rows, button } };
}

// selected：選んだ章（道場に入ったばかりなら null。縦の並べ方では、選んだ章があればその章の中身だけを出す＝picked）
export function buildDojoView(rec, selected, today) {
  const sel = selected ?? currentChapter(rec);
  const picked = selected !== null && selected !== undefined;
  const chapters = CHAPTERS.map((c) => {
    if (c.id === 'grad') return gradRow(rec, sel);
    const st = chapterState(rec, c.id);
    let status = st.status;
    let label = { passed: '合格', doing: '挑戦中', new: '挑戦中', soon: '準備中' }[status] ?? '';
    if (status === 'locked') label = `🔒 ${chapterLabel(previousPlayable(c.id))}の後`;
    if (status === 'new') status = 'doing';
    const firstOpen = st.steps ? STEP_KEYS.find((k) => st.steps[k].open && !st.steps[k].done) : null;
    const steps = st.steps ? STEP_KEYS.map((k) => ({ short: STEP_SHORT[k], state: st.steps[k].done ? 'ok' : k === firstOpen && st.open ? 'now' : '' })) : [];
    return { id: c.id, seal: c.seal, title: c.title, ask: c.ask, status, label, steps, selected: c.id === sel, clickable: c.playable && st.open };
  });
  if (sel === 'grad') return { name: rec.profile.name ?? '', rank: rankOf(rec).label, reviews: dueToday(rec.reviews, today).length, chapters, picked, detail: gradDetail(rec) };
  const st = chapterState(rec, sel);
  const pages = st.meta.playable ? lectureOf(sel).length : 0;
  const rows = st.steps ? [
    { key: 'lecture', name: '講義', sub: `めくり式・${pages}ページ` },
    { key: 'practice', name: '練習問題', sub: `${PRACTICE_COUNT}問・その場で答え合わせ` },
    { key: 'test', name: '章末試験', sub: `${TEST_COUNT}問・ヒントなし・${TEST_PASS}問正解で合格` },
  ].map((r, i) => ({ ...r, n: i + 1, state: st.steps[r.key].done ? 'ok' : st.steps[r.key].open ? 'open' : 'locked', note: st.steps[r.key].note })) : [];
  return {
    name: rec.profile.name ?? '', rank: rankOf(rec).label, reviews: dueToday(rec.reviews, today).length,
    chapters, picked,
    detail: { id: sel, heading: `${chapterLabel(sel)}　${st.meta.title}`, desc: st.meta.desc, rows, next: st.next, open: st.open },
  };
}

function chapterRow(c) {
  const steps = c.steps.map((s) => `<i class="st ${s.state}">${s.short}</i>`).join('');
  const cls = ['ch', c.selected && 'sel', c.status === 'soon' && 'off', c.clickable && 'click'].filter(Boolean).join(' ');
  return `<div class="${cls}"${c.clickable ? ` data-go="pick" data-ch="${c.id}"` : ''}>
    <span class="seal">${c.seal}</span><span class="tt">${esc(c.title)}<small>${esc(c.ask)}</small></span>
    <span class="steps">${steps}</span><span class="stt ${c.status}">${esc(c.label)}</span></div>`;
}

// 縦の並べ方で、章の中身から一覧へ戻るボタン（PC では出さない）
const BACK_LIST = '<button class="back-list" data-go="dojo">◀ 章の一覧</button>';

function detailHTML(d) {
  if (d.grad) {
    const rows = d.grad.rows.map((r) => `<div class="row ${r.state}"><span class="n">${r.state === 'ok' ? '✓' : r.n}</span><span><b>${r.name}</b><small>${esc(r.sub)}</small></span>
      <span class="r">${esc(r.note)}</span></div>`).join('');
    return `<div class="det">${BACK_LIST}<h5>${esc(d.heading)}</h5><p>${esc(d.desc)}</p>${rows}
    <button class="go" data-go="grad"${d.grad.button.disabled ? ' disabled' : ''}>${esc(d.grad.button.label)}</button></div>`;
  }
  if (!d.open) {
    return `<div class="det">${BACK_LIST}<h5>${esc(d.heading)}</h5><p>${esc(d.desc || 'この章は準備中です。')}</p></div>`;
  }
  const rows = d.rows.map((r) => `<div class="row ${r.state}"${r.state !== 'locked' ? ` data-go="step" data-step="${r.key}"` : ''}>
      <span class="n">${r.state === 'ok' ? '✓' : r.n}</span><span><b>${r.name}</b><small>${esc(r.sub)}</small></span>
      <span class="r">${r.state === 'locked' ? '🔒' : esc(r.note)}</span></div>`).join('');
  return `<div class="det">${BACK_LIST}<h5>${esc(d.heading)}</h5><p>${esc(d.desc)}</p>${rows}
    ${d.next ? `<button class="go" data-go="step" data-step="${d.next.kind}">${esc(d.next.label)}</button>` : ''}</div>`;
}

export function dojoHTML(v) {
  return `<div class="scr dj${v.picked ? ' detail' : ''}">
  <div class="sbar"><button class="back" data-go="title">◀ タイトル</button><h4>道 場</h4><span class="sp"></span>
    <button class="rev" data-go="review"${v.reviews ? '' : ' disabled'}>今日の復習 <em>${v.reviews}問</em></button>
    <span class="medal">${esc(v.rank)}</span><span class="who">${esc(v.name)} さん</span></div>
  <div class="dj-body"><div class="chs">${v.chapters.map(chapterRow).join('')}</div>${detailHTML(v.detail)}</div>
</div>`;
}
