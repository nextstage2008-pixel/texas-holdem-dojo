// 動きの台本（設計書 段階5-3 第2・3-1節）。画面に触れない：ハンドの前の形と今の形を読み（書き換えない）、動きの並びを返す。
// 1つの動き：{ kind, at（始めるミリ秒）, ms（長さ）, …種類ごとの中身 }
//   'bet'（席 seat → その席の賭けた額の所。amount・allIn）、'ante'（席 seat → ポット）、'deal'（山 → 席 seat の伏せた札。round＝何周目）、
//   'flipHero'（あなたの手札を表に）、'fold'（席 seat の札 → 卓の中央）、'check'（動きなし。音の時刻だけ）、
//   'collect'（賭けた額 → ポット。seats＝賭けていた席）、'place'（山 → 場の札の k 枚目）、'flip'（場の札の k 枚目を表に）、
//   'reveal'（勝負で見せる人 seat の札を表に）、'light'（役を作った5枚を光らせる）、'award'（ポット → 勝った人 seats）
// 席の番号はハンドの席（あなたは heroSeat）。表示の位置への置き換えは動きの層（motion.js）が受け持つ。

export const MOTION_MS = { deal: 180, dealGap: 60, bet: 250, fold: 200, collect: 350, place: 120, flip: 220, award: 500 };
export const RESULT_HOLD_MS = 3000; // 結果の帯を出しておく長さ（その前でも卓を押せば次へ）

const round = (x) => Math.round(x * 1000) / 1000;

// prev：前の形（新しいハンドを配ったときは null）、next：今の形。factor：速さの係数。
// 勝負になったハンドの「見せる → 光らせる → 流す」はふつうの速さ（係数を掛けない。設計書 第4-1節）。返す値：{ steps, ms（全部が終わる時刻）}
export function motionPlan(prev, next, { factor = 1, heroSeat = 0 } = {}) {
  const M = Object.fromEntries(Object.entries(MOTION_MS).map(([k, v]) => [k, round(v * factor)]));
  const steps = [];
  let t = 0;
  const push = (s) => { steps.push(s); return s; };
  if (prev === null) {
    // 配る：ブラインド（とアンティ）のチップ → ボタンの左から1枚ずつ2周 → あなたの手札を表に
    for (const e of next.log) {
      if (e.type === 'sb') { push({ kind: 'bet', seat: e.seat, amount: e.amount, allIn: false, at: t, ms: M.bet }); t += M.bet; }
    }
    for (const e of next.log) {
      if (e.type === 'bb') { push({ kind: 'bet', seat: e.seat, amount: e.amount, allIn: false, at: t, ms: M.bet }); }
      if (e.type === 'ante') push({ kind: 'ante', seat: e.seat, amount: e.amount, at: t, ms: M.bet });
    }
    if (next.log.some((e) => e.type === 'bb')) t += M.bet;
    const n = next.seats.length;
    let k = 0;
    let heroEnd = null;
    for (let r = 0; r < 2; r++) {
      for (let j = 1; j <= n; j++) {
        const seat = (next.button + j) % n;
        if (!next.seats[seat].inHand) continue;
        const s = push({ kind: 'deal', seat, round: r, at: round(t + k * M.dealGap), ms: M.deal });
        if (seat === heroSeat) heroEnd = s.at + s.ms;
        k++;
      }
    }
    t = round(t + Math.max(0, k - 1) * M.dealGap + (k ? M.deal : 0));
    if (heroEnd !== null) { push({ kind: 'flipHero', seat: heroSeat, at: round(heroEnd), ms: M.flip }); t = round(Math.max(t, heroEnd + M.flip)); }
    if (next.street !== 'complete') return { steps, ms: t };
    // 配った時点で終わったハンド（ブラインドとアンティだけでオールイン）：配ったあとに、ブラインドを置いただけの形から
    // 下と同じく「集める → 回りごとに置いて返す → 見せる → 光らせる → 流す」を続ける（勝負が先に出ないように）
    const lead = [];
    for (const e of next.log) {
      if (e.type !== 'sb' && e.type !== 'bb' && e.type !== 'ante') break;
      lead.push(e);
    }
    const blindOf = (i) => lead.filter((e) => e.seat === i && e.type !== 'ante').reduce((a, e) => a + e.amount, 0);
    prev = { log: lead, seats: next.seats.map((_, i) => ({ bet: blindOf(i) })), board: [] };
  }
  if (next.log.length < prev.log.length) return { steps, ms: 0 };
  // 増えた行動
  const added = next.log.slice(prev.log.length);
  const bets = prev.seats.map((s) => s.bet);
  for (const e of added) {
    if (e.type === 'fold') { push({ kind: 'fold', seat: e.seat, at: t, ms: M.fold }); t += M.fold; continue; }
    if (e.type === 'check') { push({ kind: 'check', seat: e.seat, at: t, ms: 0 }); continue; }
    if (e.type === 'call' || e.type === 'raise') {
      const amount = e.type === 'call' ? e.amount : e.to - bets[e.seat];
      bets[e.seat] += amount;
      push({ kind: 'bet', seat: e.seat, amount, allIn: !!e.allIn, at: t, ms: M.bet });
      t += M.bet;
    }
  }
  const done = next.street === 'complete';
  // 回りが終わった：賭けた額がポットへ集まる
  if (done || next.board.length > prev.board.length) {
    const seats = bets.map((b, i) => (b > 0 ? i : -1)).filter((i) => i >= 0);
    if (seats.length) { push({ kind: 'collect', seats, at: t, ms: M.collect }); t += M.collect; }
  }
  // 開いた場の札：回りごとに、全部を順に置いてから1枚ずつ返す（リバーまで一度に開くときは回りごとに）
  const groups = [];
  for (let k = prev.board.length; k < next.board.length; k++) {
    if (k < 3) { if (!groups.length) groups.push([]); groups[0].push(k); } else groups.push([k]);
  }
  for (const g of groups) {
    for (const k of g) { push({ kind: 'place', k, at: t, ms: M.place }); t += M.place; }
    for (const k of g) { push({ kind: 'flip', k, at: t, ms: M.flip }); t += M.flip; }
  }
  t = round(t);
  if (done) {
    const r = next.result;
    if (r.showdown) {
      // 勝負：あなた以外の見せる人の札を返す → 光らせる → 流す（ふつうの速さ）
      next.seats.forEach((s, i) => {
        if (i === heroSeat || !s.inHand || s.folded) return;
        push({ kind: 'reveal', seat: i, at: t, ms: MOTION_MS.flip });
        t += MOTION_MS.flip;
      });
      push({ kind: 'light', at: t, ms: 0 });
      // 分け合うポットは1人ずつ順に流す（設計書 第2節）
      for (const w of r.winners) {
        push({ kind: 'award', seats: [w], at: t, ms: MOTION_MS.award });
        t += MOTION_MS.award;
      }
    } else {
      for (const w of r.winners) {
        push({ kind: 'award', seats: [w], at: t, ms: M.award });
        t += M.award;
      }
    }
  }
  return { steps, ms: round(t) };
}

// 音の時刻を台本に合わせる（設計書 第3-4節）。cues：sound-cues.js の音の並び（at は秒）。steps：motionPlan の steps。
// 配る音はあなたの札が届いた時、チップと掛け声は賭けた時、チェックの音はチェックの時、めくる音は返した時、
// ポットの音は流し始めた時（一言はそこから元の間をおく）。合う動きがない音は元の時刻のまま
export function timedCues(cues, steps, heroSeat = 0) {
  const of = (kind, pred = () => true) => steps.filter((s) => s.kind === kind && pred(s));
  const checks = of('check');
  const bets = of('bet');
  const flips = of('flip');
  const deals = of('deal', (s) => s.seat === heroSeat);
  const award = of('award')[0] ?? null;
  let ci = 0;
  let bi = 0;
  let fi = 0;
  let di = 0;
  let betAt = null;
  return cues.map((c) => {
    let at = c.at;
    if (c.sfx === 'knock' && checks[ci]) at = checks[ci++].at / 1000;
    else if ((c.sfx === 'chip' || c.sfx === 'chipAllin') && bets[bi]) { betAt = bets[bi++].at / 1000; at = betAt; }
    else if (c.voice && !c.chatter && betAt !== null) at = betAt;
    else if (c.sfx === 'flip' && flips[fi]) at = flips[fi++].at / 1000;
    else if (c.sfx === 'deal' && deals[di]) { const s = deals[di++]; at = (s.at + s.ms) / 1000; }
    else if (c.sfx === 'collect' && award) at = award.at / 1000;
    else if (c.chatter && award) at = award.at / 1000 + c.at;
    return { ...c, at: round(at) };
  });
}
