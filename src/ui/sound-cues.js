// 何が起きたらどの音を鳴らすか（設計書 段階4-5 第4節）。画面にも音にも触れない（ハンドの形を読むだけで、書き換えない）。
// 返す並び：効果音 { sfx: 'shuffle'|'deal'|'flip'|'chip'|'chipAllin'|'knock'|'collect', at（秒）} と、
//           声 { voice: { who（人の id か 'hero'）, scene（'call'|'bet'|'raise'|'allin'|'bigwin'|'bigloss'|'bust'|'champion'）}, at }。
// 乱数（言い回しの始め）は外から渡す。ゲームの乱数（配る札・CPU・コーチ）は使わない。

export const BIG_BB = 20; // 一言「大きく勝った・負けた」になる増減（BB）
export const CHATTER_RATE = { many: 1, normal: 0.5, none: 0 }; // 一言の量ごとの、一言を言う割合（sound.js が使う）
const RANK = { champion: 1, bust: 2, bigwin: 3, bigloss: 4 };

// ハンドを配ったとき：シャッフルと、あなたの2枚を配る音
export const dealCues = () => [{ sfx: 'shuffle', at: 0 }, { sfx: 'deal', at: 0.35 }, { sfx: 'deal', at: 0.5 }];

// 行動のあと：前の形（prev）から増えた行動と、開いた札の音。whoOf(seat) → 人の id（わからなければ null）
export function stepCues(prev, next, { whoOf }) {
  const out = [];
  if (!prev || !next || next.log.length < prev.log.length || next.board.length < prev.board.length) return out;
  for (const e of next.log.slice(prev.log.length)) {
    if (e.type === 'check') {
      out.push({ sfx: 'knock', at: 0 });
      continue;
    }
    if (e.type !== 'call' && e.type !== 'raise') continue; // 降りる・ブラインド・アンティは鳴らさない
    const scene = e.allIn ? 'allin' : e.type === 'call' ? 'call' : e.kind; // kind：'bet'（だれも賭けていない所）か 'raise'
    out.push({ sfx: e.allIn ? 'chipAllin' : 'chip', at: 0 });
    const who = whoOf(e.seat);
    if (who) out.push({ voice: { who, scene }, at: 0 });
  }
  const opened = Math.min(5, next.board.length - prev.board.length);
  for (let k = 0; k < opened; k++) out.push({ sfx: 'flip', at: Math.round((0.25 + 0.15 * k) * 100) / 100 });
  return out;
}

// 大会の優勝が決まったハンドか：最後の卓（1卓の大会か、本番大会の決勝卓）で、持ち点が残ったのが1人だけ。返す値：その席か null
export function championOf(hand, { lastTable }) {
  const alive = hand.seats.map((s, i) => (s.stack > 0 ? i : -1)).filter((i) => i >= 0);
  return lastTable && alive.length === 1 ? alive[0] : null;
}

// そのハンドの増減（取った点 − 出した点 − アンティ）
const netOf = (hand, i) => hand.result.won[i] - hand.seats[i].committed
  - hand.log.filter((e) => e.type === 'ante' && e.seat === i).reduce((t, e) => t + e.amount, 0);

// 一言を言う人と場面（あなたとハンドに入っていない席は除く）。強さの順がいちばん上、同じ順なら増減の大きい人。いなければ null
export function chatterOf(hand, { heroSeat, championSeat }) {
  if (!hand.result) return null;
  const big = BIG_BB * hand.blinds.bb;
  const list = [];
  hand.seats.forEach((s, i) => {
    if (i === heroSeat || !s.inHand) return;
    const net = netOf(hand, i);
    const scene = i === championSeat ? 'champion' : s.stack === 0 ? 'bust' : net >= big ? 'bigwin' : net <= -big ? 'bigloss' : null;
    if (scene) list.push({ seat: i, scene, size: Math.abs(net) });
  });
  list.sort((a, b) => RANK[a.scene] - RANK[b.scene] || b.size - a.size || a.seat - b.seat);
  return list.length ? { seat: list[0].seat, scene: list[0].scene } : null;
}

// ハンドの終わり（結果の帯を出すとき）：ポットを取る音と、0.4秒後に一言。
// 一言には chatter: true の印を付ける（言うかどうかは、設定の一言の量で指揮役 sound.js が決める）
export function handEndCues(hand, { whoOf, heroSeat, championSeat = null }) {
  const out = [{ sfx: 'collect', at: 0 }];
  const c = chatterOf(hand, { heroSeat, championSeat });
  const who = c ? whoOf(c.seat) : null;
  if (who) out.push({ voice: { who, scene: c.scene }, at: 0.4, chatter: true });
  return out;
}

// 声のファイルの選び方。manifest（assets/voice/manifest.json）の言い回しの数を、人と場面ごとに順に使う（始めだけ乱数でずらす）
export function createVoiceBook(manifest, rng) {
  const next = new Map();
  const pick = (counts, dir, key) => (scene) => {
    const n = counts?.[key]?.[scene];
    if (!n) return null;
    const k = `${dir}|${scene}`;
    const i = next.has(k) ? next.get(k) : Math.floor(rng() * n);
    next.set(k, (i + 1) % n);
    return `assets/voice/${dir}/${scene}_${i + 1}.mp3`;
  };
  return {
    person: (id, scene) => pick(manifest?.people, id, id)(scene),
    hero: (key, scene) => pick(manifest?.hero, `hero/${key}`, key)(scene),
  };
}

// 音の並びの記録係：前に見たハンドの形を覚えておき、新しい形との違いを返す
export function createCueTracker() {
  let last = null;
  return {
    deal(hand) { last = hand; return dealCues(); }, // 配ったとき（ブラインドの行は数えない）
    step(hand, ctx) { const prev = last; last = hand; return stepCues(prev, hand, ctx); }, // 行動のあと
    reset(hand) { last = hand; }, // 続きから再開・卓の移動など：鳴らさずに今の形を覚える
  };
}
