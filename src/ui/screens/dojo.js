// 道場：章を選ぶ画面（確定見本 mock-dojo-v1.html の①）。
import { esc } from '../format.js';
import { CHAPTERS, chapterLabel, previousPlayable, PRACTICE_COUNT, TEST_COUNT, TEST_PASS, GAME_RULE } from '../../dojo/chapters.js';
import { chapterState, rankOf, currentChapter } from '../../dojo/progress.js';
import { dueToday } from '../../dojo/reviews.js';
import { lectureOf } from '../../dojo/lectures/chapters.js';
import { canTakeExam, EXAM } from '../../dojo/exam.js';
import { MASTER } from '../../dojo/ranks.js';
import { resumeLabel } from '../../game/main-event.js';

const STEP_KEYS = ['lecture', 'practice', 'game', 'test'];
const STEP_SHORT = { lecture: '講', practice: '練', game: '局', test: '試' };

// 受験の途中（始めの札を開いただけの、まだ何もしていない受験は数えない）
const attemptOf = (rec) => (rec.exam && (rec.exam.tournaments > 0 || rec.exam.decisions.length > 0 || rec.exam.game) ? rec.exam : null);

// 最終試験の札（設計書 段階4-4 第7節）：三段の前は鍵・受験の途中は「受験中」・達人は「達人」
function finalRow(rec, sel) {
  const c = CHAPTERS.find((x) => x.id === 'final');
  const open = canTakeExam(rec);
  const e = attemptOf(rec);
  const status = !open ? 'locked' : e ? 'doing' : rec.dan.level >= MASTER ? 'passed' : 'doing';
  const label = !open ? '🔒 三段から' : e ? '受験中' : rec.dan.level >= MASTER ? '達人' : '受けられる';
  return { id: c.id, seal: c.seal, title: c.title, ask: c.ask, status, label, steps: [], selected: sel === 'final', clickable: true };
}

// この受験でもう数えた判断の数（足してきた判断と、続きの大会の判断）
const examCount = (e) => e.decisions.length + (e.game ? e.game.verdicts.length + (e.game.hand?.verdicts.length ?? 0) : 0);
const RULE = `判断${EXAM.minDecisions}回以上で、正答率${Math.round(EXAM.accuracy * 100)}%以上・平均損失${EXAM.loss.toFixed(2)}BB以下`;
function examDetail(rec) {
  const open = canTakeExam(rec);
  const e = attemptOf(rec);
  const n = e ? examCount(e) : 0;
  const rows = [
    { n: 1, name: '大会の形', sub: '45人・9人×5卓・上位6人入賞・開始20,000点', state: 'open', note: '' },
    { n: 2, name: '相手', sub: '本番大会と同じ44人（相手のタイプは伏せる）', state: 'open', note: '' },
    { n: 3, name: '合格の基準', sub: RULE, state: 'open', note: '' },
    !open ? { n: '🔒', name: '受けられる人', sub: `三段（いまは${rankOf(rec).label}。成績画面の「段位の判定」で、あとどれだけか分かります）`, state: 'locked', note: '' }
      : e ? { n: 4, name: 'いまの受験', sub: `判断${n}回（${EXAM.minDecisions}回で判定）・${e.tournaments + 1}大会目${e.game ? `・${resumeLabel(e.game.field)}` : ''}`, state: 'open', note: '途中' }
        : { n: 4, name: '受けられる人', sub: rec.dan.level >= MASTER ? '達人（何度でも受けられ、入賞・優勝の称号が増えます）' : '三段（受けられます）', state: 'ok', note: '' },
  ];
  const button = !open ? { label: `三段で受けられます（いま${rankOf(rec).label}）`, disabled: true }
    : e?.game ? { label: `続きから（判断${n}回・${resumeLabel(e.game.field)}）`, disabled: false }
      : e ? { label: `次の大会へ（判断${n}回）`, disabled: false } : { label: '受ける', disabled: false };
  return {
    id: 'final', heading: '最終試験　45人の多卓大会・指南なし', open: true,
    desc: '本番大会と同じ45人の大会を、指南なしで打ちます。入賞したかどうかは問いません。判断の質で合否を決めます。', exam: { rows, button },
  };
}

// selected：選んだ章（道場に入ったばかりなら null。縦の並べ方では、選んだ章があればその章の中身だけを出す＝picked）
export function buildDojoView(rec, selected, today) {
  const sel = selected ?? currentChapter(rec);
  const picked = selected !== null && selected !== undefined;
  const chapters = CHAPTERS.map((c) => {
    if (c.id === 'final') return finalRow(rec, sel);
    const st = chapterState(rec, c.id);
    let status = st.status;
    let label = { passed: '合格', doing: '挑戦中', new: '挑戦中', soon: '準備中' }[status] ?? '';
    if (status === 'locked') label = `🔒 ${chapterLabel(previousPlayable(c.id))}の後`;
    if (status === 'new') status = 'doing';
    const firstOpen = st.steps ? STEP_KEYS.find((k) => st.steps[k].open && !st.steps[k].done) : null;
    const steps = st.steps ? STEP_KEYS.map((k) => ({ short: STEP_SHORT[k], state: st.steps[k].done ? 'ok' : k === firstOpen && st.open ? 'now' : '' })) : [];
    return { id: c.id, seal: c.seal, title: c.title, ask: c.ask, status, label, steps, selected: c.id === sel, clickable: c.playable && st.open };
  });
  if (sel === 'final') return { name: rec.profile.name ?? '', rank: rankOf(rec).label, reviews: dueToday(rec.reviews, today).length, chapters, picked, detail: examDetail(rec) };
  const st = chapterState(rec, sel);
  const pages = st.meta.playable ? lectureOf(sel).length : 0;
  const rows = st.steps ? [
    { key: 'lecture', name: '講義', sub: `めくり式・${pages}ページ` },
    { key: 'practice', name: '練習問題', sub: `${PRACTICE_COUNT}問・その場で答え合わせ` },
    { key: 'game', name: '指南つき対局', sub: `9人卓・判断${GAME_RULE.minDecisions}回以上で正答率${Math.round(GAME_RULE.passAccuracy * 100)}%なら合格` },
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
  if (d.exam) {
    const rows = d.exam.rows.map((r) => `<div class="row ${r.state}"><span class="n">${r.state === 'ok' ? '✓' : r.n}</span><span><b>${r.name}</b><small>${esc(r.sub)}</small></span>
      <span class="r">${r.state === 'locked' ? '🔒' : esc(r.note)}</span></div>`).join('');
    return `<div class="det">${BACK_LIST}<h5>${esc(d.heading)}</h5><p>${esc(d.desc)}</p>${rows}
    <button class="go" data-go="exam"${d.exam.button.disabled ? ' disabled' : ''}>${esc(d.exam.button.label)}</button></div>`;
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
