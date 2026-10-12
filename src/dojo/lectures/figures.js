// 講義の図。図の指定（kind と数字の元）から、画面が描く部品（blocks）を作る。数字はゲームの計算部品から出す。
// 部品の種類：cards（ラベルつきのカードの列）・table（表）・formula（式と大きな答え）・bar（損と得の帯）・
//            gauge（勝つ見込みの計器）・chips（チップの山）・seats（席の並び）・note（大きな一文）・
//            repeatBars・repeatLine・repeatHist（1万回やり直すの内訳の横棒・回数と平均の線・100回ずつの平均のヒストグラム）
import { parseCards } from '../../engine/cards.js';
import { evaluate, describe } from '../../engine/evaluator.js';
import { breakeven, drawOuts, outsChance, ruleOfThumb } from '../../calc/odds.js';
import { classFromLabel, classSize, liveCombos, COMBO_A, COMBO_B, CLASS_COMBOS } from '../../calc/combos.js';
import { CLASS_PCT } from '../../calc/chart.js';
import { OPEN_PCT } from '../../calc/position.js';
import { handClass } from '../../coach/features.js';
import { TYPE_STATS, COUNTER, typeName } from '../questions/ch7.js';
import { CLASS_NAME } from '../questions/ch3.js';
import { standardAt, PUSH_SEATS } from '../questions/ch5.js';
import { bubbleSpot } from '../questions/ch6.js';
import { icmShares, placeProbs } from '../../calc/icm.js';
import { solveSpot, pushEvOf, callEvOf, rangeShare, weightsOf } from '../../calc/pushfold.js';
import { pushFormula } from '../../coach/explain.js';
import { PUSH_BLINDS } from '../scene.js';
import { pct1, handName, topPct } from '../questions/util.js';
import { repeatOutcomes } from '../../calc/repeat.js';
import { partsOf, partsText, spts } from '../../coach/repeat.js';
import { createRng } from '../../engine/rng.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (x) => `${Math.round(x * 100)}%`;
const BB = PUSH_BLINDS.bb;
const bbs = (x) => `${Number(x.toFixed(1))}BB`;
const sbb = (x) => (x >= 0 ? `+${x.toFixed(1)}BB` : `−${(-x).toFixed(1)}BB`);
const spct = (x) => (x >= 0 ? `+${(x * 100).toFixed(1)}%` : `−${(-x * 100).toFixed(1)}%`);
const PLACE = ['1位', '2位', '3位', '4位'];
// 第8章：コール（勝つ見込み eq・払う額 pay・勝てば取れる額 win）を1万回やり直す
const callRows = (f) => [{ p: f.eq, v: f.win - f.pay, kind: 'win' }, { p: 1 - f.eq, v: -f.pay, kind: 'lose' }];
const repeatCall = (f) => repeatOutcomes(callRows(f), createRng(f.seed));
// 第8章 5ページ目：1ハンドごとの増減のばらつきと、1回の判断ごとの損失のばらつき（BB）。
// あなたの席も上級者のCPUに打たせた30大会（1,995ハンド・判断2,563回）で測った値（2026-10-08）
export const HAND_SD = 13.4;
export const LOSS_SD = 2.55;
// 残り4人・全員 bb BB のバブル（BTN が押す場面）：賞金で解いた基準と、点で解いた基準
const bubbleOf = (bb) => {
  const b = bubbleSpot([bb, bb, bb, bb], 'BTN');
  return { ...b, chip: solveSpot(b.spot) };
};
const shown = (label) => label; // 手の書き方（AK・AKs・TT）。10 は T と書く（第4章で教える。2026-10-12）
const expand = (label) => (label.length === 2 && label[0] !== label[1] ? [`${label}s`, `${label}o`] : [label]);
export const SEAT_ORDER = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
// プリフロップで何番目に行動するか（序章の「そのほかの席の呼び名」の図）
const SEAT_TURN = { UTG: '1番目', 'UTG+1': '2番目', MP: '3番目', LJ: '4番目', HJ: '5番目', CO: '6番目', BTN: '7番目', SB: '8番目', BB: '9番目' };
// 役の形の短い説明（序章の役の図）
export const ROLE_NOTE = {
  ストレートフラッシュ: '同じマークで数字が5つ続く', フォーカード: '同じ数字が4枚', フルハウス: '同じ数字3枚＋2枚', フラッシュ: '同じマークが5枚',
  ストレート: '数字が5つ続く', スリーカード: '同じ数字が3枚', ツーペア: '同じ数字2枚が2組', ワンペア: '同じ数字が2枚', ハイカード: '役がない',
};

const MAKERS = {
  // 進み方：手札2枚と場の5枚
  flow: (f) => ({
    blocks: [
      { kind: 'cards', rows: [
        { label: 'あなたの2枚', cards: parseCards(f.hole), note: 'プリフロップ' },
        { label: 'フロップ', cards: parseCards(f.board).slice(0, 3), note: '3枚' },
        { label: 'ターン・リバー', cards: parseCards(f.board).slice(3), note: '1枚ずつ' },
      ] },
      { kind: 'formula', text: '7枚のうち一番強い5枚で勝負', big: f.hideHand ? '' : describe(evaluate([...parseCards(f.hole), ...parseCards(f.board)])) }, // 序章の1ページ目は役を習う前なので役の名前を出さない
    ],
  }),
  // 役の一覧（例の5枚から役の名前を役判定で出す。notes のときは役の形の短い説明を添える）
  ranking: (f) => ({
    blocks: [{ kind: 'cards', rows: f.rows.map((cards) => {
      const label = describe(evaluate(parseCards(cards)));
      return { label, cards: parseCards(cards), note: f.notes ? ROLE_NOTE[label] ?? '' : '' };
    }) }],
  }),
  // 2人の勝負
  showdown: (f) => {
    const board = parseCards(f.board);
    const a = parseCards(f.a);
    const b = parseCards(f.b);
    const sa = evaluate([...a, ...board]);
    const sb = evaluate([...b, ...board]);
    return {
      blocks: [
        { kind: 'cards', rows: [
          { label: '場', cards: board, note: '' },
          { label: 'Aさん', cards: a, note: describe(sa) },
          { label: 'Bさん', cards: b, note: describe(sb) },
        ] },
        { kind: 'formula', text: sa === sb ? '使う5枚が同じ強さ' : '同じ役ならキッカーで比べる', big: sa > sb ? 'Aさんの勝ち' : sb > sa ? 'Bさんの勝ち' : '引き分け' },
      ],
    };
  },
  // 席の並び（withPct のときは参加の目安を添える）。mode：'blinds'＝ボタンとブラインドの3つだけ名前を出す・'order'＝そこに UTG を足す・
  // 'all'＝全部の席に何番目に行動するかを添える（序章で、席の呼び名を少しずつ出すため。2026-10-12）
  seats: (f) => {
    const shownIn = { blinds: ['BTN', 'SB', 'BB'], order: ['UTG', 'BTN', 'SB', 'BB'] }[f.mode] ?? SEAT_ORDER;
    const felt = f.mode === 'blinds' ? ['ボタンの次の2人が', 'ブラインドを置く'] : null;
    return {
      blocks: [{ kind: 'seats', felt, seats: SEAT_ORDER.map((s) => ({
        name: !shownIn.includes(s) ? '・' : f.mode === 'blinds' && s === 'BTN' ? 'ボタン' : s, btn: s === 'BTN',
        note: f.withPct && OPEN_PCT[s] ? `上位${pct(OPEN_PCT[s])}` : f.mode === 'all' ? SEAT_TURN[s] : '',
      })) }],
    };
  },
  // 手の書き方（第4章）：書き方とふだんの言葉の表
  notation: (f) => ({
    blocks: [{ kind: 'table', head: ['書き方', '意味'], rows: f.labels.map((l) => [l, `${handName(l)}${l.length === 2 && l[0] !== l[1] ? '（マークは問わない）' : ''}`]) }],
  }),
  // 組み合わせの数
  combos: (f) => ({
    blocks: [{ kind: 'table', head: ['手', '組み合わせ'], rows: f.labels.map((l) => [shown(l), `${expand(l).reduce((a, x) => a + classSize(classFromLabel(x)), 0)}通り`]) }],
  }),
  // 強い順の位置（上位何%か）。手はふだんの言葉で（第1章）
  top: (f) => ({
    blocks: [{ kind: 'table', head: ['手', '強い順'], rows: f.labels.map((l) => [handName(l), `上位${topPct(CLASS_PCT[classFromLabel(l)])}`]) }],
  }),
  // 同じ手を席ごとに：参加するか
  openBySeat: (f) => {
    const p = CLASS_PCT[classFromLabel(f.label)];
    return {
      blocks: [
        { kind: 'formula', text: `${handName(f.label)}は、強い順で上位`, big: pct(p) },
        { kind: 'table', head: ['席', '目安', 'この手'], rows: SEAT_ORDER.filter((s) => OPEN_PCT[s]).map((s) => [s, `上位${pct(OPEN_PCT[s])}`, p <= OPEN_PCT[s] ? '参加' : '降りる']) },
      ],
    };
  },
  // コールの値段
  potOdds: (f) => {
    const x = breakeven(f.bet, f.pot + f.bet);
    return {
      blocks: [
        { kind: 'chips', stacks: [{ label: 'ポット', amount: f.pot }, { label: '相手のベット', amount: f.bet }, { label: 'あなたのコール', amount: f.bet }] },
        { kind: 'formula', text: `${fmt(f.bet)} ÷（${fmt(f.pot)}＋${fmt(f.bet)}＋${fmt(f.bet)}）＝`, big: pct(x) },
        { kind: 'bar', value: x },
      ],
      value: x,
    };
  },
  // 計器（勝つ見込みと損益分岐点）
  gauge: (f) => ({
    blocks: [
      { kind: 'gauge', value: f.eq, mark: f.breakeven },
      { kind: 'formula', text: `勝つ見込み ${pct(f.eq)}　損益分岐点 ${pct(f.breakeven)}`, big: f.eq > f.breakeven ? 'コールは得' : '降りる' },
    ],
  }),
  // アウツと2と4の法則（countOnly のときはアウツの数だけ。2と4の法則を習う前のページ）
  outs: (f) => {
    const hole = parseCards(f.hole);
    const board = parseCards(f.board);
    const n = drawOuts(hole, board).outs.length;
    const street = board.length === 3 ? 'flop' : 'turn';
    return {
      blocks: [
        { kind: 'cards', rows: [{ label: 'あなたの手', cards: hole, note: '' }, { label: '場', cards: board, note: '' }] },
        { kind: 'formula', text: f.countOnly ? 'アウツ' : `アウツ ${n}枚：${n}×${street === 'flop' ? 4 : 2} ≒ ${pct(ruleOfThumb(n, street))}（正確には ${(outsChance(n, street) * 100).toFixed(2)}%）`, big: `${n}枚` },
      ],
      outs: n,
    };
  },
  // 手の5つの区分（区分は coach/features.js の handClass で出す）
  classes: (f) => ({
    blocks: [{ kind: 'cards', rows: f.rows.map((r) => {
      const hole = parseCards(r.hole);
      const board = parseCards(r.board);
      return { label: CLASS_NAME[handClass(hole, board)], cards: [...hole, ...board], split: 2, note: describe(evaluate([...hole, ...board])) };
    }) }],
  }),
  // 相手の手の候補と、見えているカードで減った組合せ
  range: (f) => {
    const board = f.board ? parseCards(f.board) : [];
    const dead = new Set(board);
    const rows = f.labels.map((l) => {
      const full = expand(l).reduce((a, x) => a + classSize(classFromLabel(x)), 0);
      const live = expand(l).reduce((a, x) => a + liveCombos(classFromLabel(x), dead).length, 0);
      return [shown(l), `${full}通り`, board.length ? `${live}通り` : '―'];
    });
    const total = f.labels.reduce((a, l) => a + expand(l).reduce((b, x) => b + liveCombos(classFromLabel(x), dead).length, 0), 0);
    return {
      blocks: [
        ...(board.length ? [{ kind: 'cards', rows: [{ label: '場', cards: board, note: '' }] }] : []),
        { kind: 'table', head: ['相手の手', 'もとの数', board.length ? '見えているカードを除く' : ''], rows },
        { kind: 'formula', text: '合わせて', big: `${total}通り` },
      ],
      total,
    };
  },
  // 相手の手の候補のうち、今あなたが勝っている組合せ
  rangeShare: (f) => {
    const hero = parseCards(f.hero);
    const board = parseCards(f.board);
    const dead = new Set([...hero, ...board]);
    const mine = evaluate([...hero, ...board]);
    let all = 0;
    let wins = 0;
    const rows = f.labels.map((l) => {
      let n = 0;
      let w = 0;
      for (const x of expand(l)) {
        for (const i of CLASS_COMBOS[classFromLabel(x)]) {
          if (dead.has(COMBO_A[i]) || dead.has(COMBO_B[i])) continue;
          n++;
          if (mine > evaluate([COMBO_A[i], COMBO_B[i], ...board])) w++;
        }
      }
      all += n;
      wins += w;
      return [shown(l), `${n}通り`, `${w}通り`];
    });
    return {
      blocks: [
        { kind: 'cards', rows: [{ label: 'あなたの手', cards: hero, note: describe(mine) }, { label: '場', cards: board, note: '' }] },
        { kind: 'table', head: ['相手の手', '組み合わせ', 'あなたが勝っている'], rows },
        { kind: 'formula', text: `${wins} ÷ ${all} ＝`, big: pct(wins / all) },
      ],
      share: wins / all,
    };
  },
  // CPUの4タイプ
  // 相手のタイプの表（noCounter のときは攻め方の列を出さない。攻め方の言葉を習う前のページ）
  types: (f) => ({
    blocks: [{ kind: 'table', head: ['タイプ', '参加率', 'レイズ率', ...(f.noCounter ? [] : ['攻め方'])], rows: f.keys.map((k) => [typeName(k), `${TYPE_STATS[k].vpip}%`, `${TYPE_STATS[k].pfr}%`, ...(f.noCounter ? [] : [COUNTER[k]])]) }],
  }),
  // 第5章：持ち点が少ないとき、レイズして押し返されたら（持ち点・レイズ・残り）
  shortStack: (f) => ({
    blocks: [
      { kind: 'chips', stacks: [{ label: `持ち点 ${f.bb}BB`, amount: f.bb * BB }, { label: `レイズ ${f.raise}BB`, amount: f.raise * BB }, { label: `残り ${f.bb - f.raise}BB`, amount: (f.bb - f.raise) * BB }] },
      { kind: 'formula', text: `${f.bb}BBで${f.raise}BBのレイズ → 押し返されたら残り${f.bb - f.raise}BB`, big: '払うか降りるかだけ' },
    ],
  }),
  // 第5章：降りてもらえる得（ポットと、全員が降りる見込み）
  foldEquity: (f) => {
    const p = f.fold ** f.n;
    return {
      blocks: [
        { kind: 'chips', stacks: [{ label: 'SB', amount: PUSH_BLINDS.sb }, { label: 'BB', amount: PUSH_BLINDS.bb }, { label: 'アンティ', amount: PUSH_BLINDS.ante }] },
        { kind: 'formula', text: `${new Array(f.n).fill(f.fold).join(' × ')} ＝`, big: pct1(p) },
      ],
      value: p,
    };
  },
  // 第5章：押す範囲の表（9人・全員同じ持ち点。上級者どうしの基準）
  pushTable: (f) => {
    const shares = f.stacks.map((bb) => PUSH_SEATS.map((pos) => rangeShare(standardAt(bb, pos).push)));
    return {
      blocks: [{ kind: 'table', head: ['持ち点', ...PUSH_SEATS], rows: f.stacks.map((bb, i) => [`${bb}BB`, ...shares[i].map(pct)]) }],
      shares,
    };
  },
  // 第5章：押す範囲と受ける範囲（pusher が bb BB で押したとき、後ろの人が受ける範囲）と、BB の損益分岐点
  callVsPush: (f) => {
    const s = standardAt(f.bb, f.pusher);
    const bbPair = s.pay.pairs[s.pay.pairs.length - 1];
    const be = (bbPair.e - bbPair.posted) / bbPair.potC;
    const rows = [[`${f.pusher}が押す`, pct(rangeShare(s.push))], ...s.call.map((c, k) => [`${k === s.call.length - 1 ? 'BB' : k === s.call.length - 2 ? 'SB' : '後ろの人'}が受ける`, pct(rangeShare(c))])];
    return {
      blocks: [
        { kind: 'table', head: ['', '範囲の広さ'], rows },
        { kind: 'formula', text: `BBの損益分岐点：${bbs((bbPair.e - bbPair.posted) / BB)} ÷ ${bbs(bbPair.potC / BB)} ＝`, big: pct(be) },
      ],
      push: rangeShare(s.push), call: s.call.map(rangeShare), breakeven: be, pay: bbPair,
    };
  },
  // 第5章：押したときの得の計算式（上級者どうしの基準で受けられるとき）
  pushEv: (f) => {
    const s = standardAt(f.bb, f.pos);
    const d = pushEvOf(s.pay, classFromLabel(f.hand), s.call);
    const text = pushFormula(d, s.pay, BB);
    const at = text.lastIndexOf('＝');
    return {
      blocks: [
        { kind: 'table', head: ['', `${f.pos}・${f.bb}BB・${shown(f.hand)}`], rows: [['全員が降りる見込み', pct(d.pAllFold)], ['受けられる見込み', pct(d.pCalled)], ['受けられたときの勝つ見込み', pct(d.eqCalled)]] },
        { kind: 'formula', text: text.slice(0, at + 1), big: text.slice(at + 1).trim() },
      ],
      detail: d,
    };
  },
  // 第6章：持ち点と賞金の見込み
  icm: (f) => {
    const total = f.stacks.reduce((a, x) => a + x, 0);
    const v = icmShares(f.stacks, f.payouts);
    return {
      blocks: [{ kind: 'table', head: ['', '持ち点', '持ち点の割合', '賞金の見込み'], rows: f.stacks.map((s, i) => [f.names[i], fmt(s), pct1(s / total), pct1(v[i])]) }],
      shares: [...v],
    };
  },
  // 第6章：1人目の順位ごとの見込みと賞金の見込み
  icmSteps: (f) => {
    const p = placeProbs(f.stacks, f.payouts.length)[0];
    const v = icmShares(f.stacks, f.payouts)[0];
    return {
      blocks: [
        { kind: 'table', head: [`${f.name}の順位`, '見込み', '賞金'], rows: f.payouts.map((x, k) => [PLACE[k], pct1(p[k]), pct(x)]) },
        { kind: 'formula', text: f.payouts.map((x, k) => `${pct1(p[k])}×${pct(x)}`).join(' ＋ ') + ' ＝', big: pct1(v) },
      ],
      places: [...p], value: v,
    };
  },
  // 第6章：バブル（残り4人・全員 bb BB）の範囲を、点と賞金で比べる。rows：'push'（BTNが押す）・'sb'・'bb'（受ける）
  bubbleRanges: (f) => {
    const b = bubbleOf(f.bb);
    const pick = { push: (x) => x.push, sb: (x) => x.call[0], bb: (x) => x.call[1] };
    const label = { push: 'BTNが押す範囲', sb: 'SBが受ける範囲', bb: 'BBが受ける範囲' };
    const values = Object.fromEntries(f.rows.map((r) => [r, [rangeShare(pick[r](b.chip)), rangeShare(pick[r](b.solved))]]));
    return {
      blocks: [{ kind: 'table', head: [`残り4人・入賞3人・全員${f.bb}BB`, '点で計算', '賞金で計算'], rows: f.rows.map((r) => [label[r], pct(values[r][0]), pct(values[r][1])]) }],
      values,
    };
  },
  // 第6章：点では得なのに賞金では損なコール（バブルで BTN が押し、BB が受けるか）
  chipVsPrize: (f) => {
    const b = bubbleOf(f.bb);
    const pushW = weightsOf(b.solved.push);
    const c = classFromLabel(f.hand);
    const dp = callEvOf(b.solved.pay, 1, c, pushW);
    const dc = callEvOf(b.chipPay, 1, c, pushW);
    return {
      blocks: [
        { kind: 'table', head: [`BBの ${shown(f.hand)} で受ける`, '得'], rows: [['点で計算', sbb(dc.ev / BB)], ['賞金で計算', `${spct(dp.ev / b.total)}（点に直すと ${sbb(dp.ev / BB)}）`]] },
        { kind: 'gauge', value: dp.eq, mark: dp.breakeven },
        { kind: 'formula', text: `損益分岐点：点なら ${pct(dc.breakeven)} →`, big: `賞金なら ${pct(dp.breakeven)}` },
      ],
      chip: dc, prize: dp, total: b.total,
    };
  },
  // 第8章：1回だけの勝負（勝つ見込みと損益分岐点、負ける見込み）
  oneShot: (f) => ({
    blocks: [
      { kind: 'gauge', value: f.eq, mark: f.mark },
      { kind: 'formula', text: `勝つ見込み ${pct(f.eq)}・損益分岐点 ${pct(f.mark)}。1回だけなら、負ける見込み`, big: pct(1 - f.eq) },
    ],
    lose: 1 - f.eq,
  }),
  // 第8章：1万回やり直した内訳・平均・回数と平均の線
  repeatCall: (f) => {
    const r = repeatCall(f);
    const parts = partsOf(callRows(f), r.counts, { win: '勝ち', lose: '負け' });
    return {
      blocks: [
        { kind: 'repeatBars', label: `勝つ見込み${pct(f.eq)}のコールを1万回`, parts, n: r.n, text: partsText(parts) },
        { kind: 'formula', text: `1万回の平均 ${spts(r.mean)}／期待値 ${pct(f.eq)}×${fmt(f.win)}−${fmt(f.pay)} ＝`, big: spts(r.exact) },
        { kind: 'repeatLine', line: r.line, exact: r.exact },
      ],
      mean: r.mean, exact: r.exact, counts: r.counts,
    };
  },
  // 第8章：100回ずつ100組の平均のヒストグラムと、回数ごとの平均の95%の範囲（期待値±1.96×ばらつき÷√回数）
  repeatSpread: (f) => {
    const r = repeatCall(f);
    const ranges = f.ns.map((n) => {
      const w = (1.96 * r.sd) / Math.sqrt(n);
      return [r.exact - w, r.exact + w];
    });
    return {
      blocks: [
        { kind: 'repeatHist', groups: r.groups, exact: r.exact, caption: '1万回を100回ずつ100組に分けた、組ごとの平均' },
        { kind: 'table', head: ['回数', '平均の95%の範囲'], rows: f.ns.map((n, i) => [`${fmt(n)}回`, `${spts(ranges[i][0])}〜${spts(ranges[i][1])}`]) },
      ],
      exact: r.exact, sd: r.sd, ranges,
    };
  },
  // 第8章：オールインの本来の取り分と運
  allinEv: (f) => {
    const share = f.pot * f.eq;
    return {
      blocks: [
        { kind: 'table', head: ['オールインのあと', '受け取り'], rows: [['勝てば', `${fmt(f.pot)}点`], ['負ければ', '0点'], ['本来の取り分（平均）', `${fmt(share)}点`]] },
        { kind: 'formula', text: `本来の取り分 ${fmt(f.pot)}×${pct(f.eq)} ＝`, big: `${fmt(share)}点` },
        { kind: 'formula', text: `負けたときの運 0−${fmt(share)} ＝`, big: spts(-share) },
      ],
      share,
    };
  },
  // 第8章：成績（100ハンドあたり）と判断の質（1回あたりの損失）の95%の幅
  skillVsLuck: (f) => {
    const hand = f.ns.map((n) => (1.96 * 100 * HAND_SD) / Math.sqrt(n));
    const loss = f.ns.map((n) => (1.96 * LOSS_SD) / Math.sqrt(n));
    return {
      blocks: [{
        kind: 'table', head: ['回数', '成績の幅（100ハンドあたり）', '判断の質の幅（1回あたりの損失）'],
        rows: f.ns.map((n, i) => [`${fmt(n)}回`, `±${Math.round(hand[i])}BB`, `±${loss[i].toFixed(2)}BB`]),
      }],
      hand, loss,
    };
  },
  // 大きな一文だけ
  note: (f) => ({ blocks: [{ kind: 'note', text: f.text }] }),
};

export function figureData(fig) {
  const make = MAKERS[fig.kind];
  if (!make) throw new Error(`知らない図: ${fig.kind}`);
  return make(fig);
}
