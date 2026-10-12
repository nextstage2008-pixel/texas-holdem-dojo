// 章の定義（設計書 段階3 第3節・段階4-1 第6〜7節・段階4-2 第6節・全体設計 第6-1節）。遊べるのは序章・1〜8章。
// types：その章の問題の型（questions/index.js の名前）。道場は座学だけ（講義・練習問題・章末試験。2026-10-12）
export const CHAPTERS = [
  { id: 'prologue', seal: '序', title: 'ルール・役・席', ask: 'どちらが勝ち？', playable: true,
    desc: 'テキサスホールデムの進み方と、5枚の形の強さ（役）、席の呼び名を覚えます。', types: ['winner', 'bestHand'] },
  { id: 'ch1', seal: '1', title: '配られた2枚の強さ', ask: 'この手で参加する？', playable: true,
    desc: '配られた2枚の強さと、席ごとにどこまでの手で参加するかを覚えます。', types: ['open'] },
  { id: 'ch2', seal: '2', title: 'コールしてよいとき', ask: 'コールする？', playable: true,
    desc: '相手が賭けてきたとき、コールして得か損かを、払う額の割合と勝つ見込みを比べて決めます。役ができるカードの数え方も覚えます。', types: ['outs', 'breakeven', 'drawCall'] },
  { id: 'ch3', seal: '3', title: '場が開いたあとの基本', ask: 'ベットする？', playable: true,
    desc: '場に3枚が開いたあと、自分の手が「強い・中くらい・弱い・ドロー・何もない」のどれかを見分けて、ベットするか待つかを決めます。', types: ['handClass', 'betOrCheck'] },
  { id: 'ch4', seal: '4', title: '相手の手を考える', ask: '相手の手は何通り？', playable: true,
    desc: '相手の手を1つに決めつけず、ありそうな手をいくつか考えて、その数を数えます。', types: ['combos', 'rangeCount'] }, // 組み合わせの数は第1章から移した（2026-10-12）
  { id: 'ch5', seal: '5', title: '持ち点が少ないとき', ask: '押す？降りる？', playable: true,
    desc: '持ち点が少なくなったら、持ち点を全部賭ける（オールイン）か、降りるかの2つで考えます。全部賭けて得になるのは、相手が降りてくれる得と、勝負になったときの得を足してプラスのときです。',
    types: ['pushFold', 'callPush', 'foldEquity'] },
  { id: 'ch6', seal: '6', title: '入賞の直前', ask: '賞金では損？', playable: true,
    desc: '入賞（賞金がもらえる順位）が近い場面では、持ち点ではなく、もらえそうな賞金で考えます。点では得でも賞金では損な勝負を見分け、入賞の直前では押す側に回ります。',
    types: ['icmValue', 'bubbleCall', 'bubblePush'] },
  { id: 'ch7', seal: '7', title: '相手を見抜く', ask: 'この人はどのタイプ？', playable: true,
    desc: '相手がどれくらい参加するか・どれくらいレイズするかから相手のタイプを見抜き、タイプに合わせて攻め方を変えます。', types: ['typeGuess', 'counter'] },
  { id: 'ch8', seal: '8', title: '運と実力', ask: '1万回やり直したら？', playable: true,
    desc: '1回の勝ち負けと、判断の良し悪しを分けて考えます。1万回やり直したときの平均（期待値）と、回数が少ないときのぶれの大きさを知り、成績を判断の質で測ります。',
    types: ['allinShare', 'longRun', 'sampleSize'] },
];

// 章の一覧の最後の段：卒業試験（遊べる章ではない。全9章の合格で開く。2026-10-12）
CHAPTERS.push({ id: 'grad', seal: '卒', title: '卒業試験', ask: '全9章の総合問題', playable: false,
  desc: '全9章の問題から30問。ヒントなし。24問正解で卒業です。何度でも受けられます。', types: [] });

export const PLAYABLE = CHAPTERS.filter((c) => c.playable).map((c) => c.id);

export function chapterOf(id) {
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) throw new Error(`知らない章: ${id}`);
  return c;
}

// 遊べる章の中で1つ前の章（序章は null）
export function previousPlayable(id) {
  const k = PLAYABLE.indexOf(id);
  if (k < 0) throw new Error(`遊べない章: ${id}`);
  return k === 0 ? null : PLAYABLE[k - 1];
}

// 章の名前（「序章」「第3章」「卒業試験」）
export const chapterLabel = (id) => (id === 'prologue' ? '序章' : id === 'grad' ? '卒業試験' : `第${chapterOf(id).seal}章`);

// 練習問題・章末試験・合格の数
export const PRACTICE_COUNT = 10;
export const TEST_COUNT = 20;
export const TEST_PASS = 16;
// 卒業試験（全9章の合格で開く総合問題。2026-10-12）：30問・24問正解で合格・各章から3問以上
export const GRAD = { count: 30, pass: 24, perChapter: 3 };
// 段「卓で体験」（チュートリアルのレッスンを本物の卓で遊ぶ。2026-10-12）：章 → レッスンの id（tutorial/lessons.js）の並び
export const TRIAL = { prologue: ['screen', 'basic', 'fold'], ch5: ['allin'], ch6: ['tour'] };
