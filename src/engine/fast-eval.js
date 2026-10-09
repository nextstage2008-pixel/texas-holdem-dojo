// 速い役判定（5〜7枚）。点数の形は evaluate と同じ（役 × 16^5 + 比べる順のランク）なので、そのまま比べられる。
// 勝率の計算で何万回も呼ぶため、配列を作らずに数える。正しさは evaluate（全組合せ版）との突き合わせで確かめる。

// ランクのビット（bit r ＝ ランク r。0=2 … 12=A）の集まりから、ストレートの一番上のランクを引く表。A-2-3-4-5 は 3。
const STRAIGHT_HIGH = new Int8Array(8192).fill(-1);
for (let m = 0; m < 8192; m++) {
  for (let hi = 12; hi >= 4; hi--) {
    const need = 0b11111 << (hi - 4);
    if ((m & need) === need) { STRAIGHT_HIGH[m] = hi; break; }
  }
  if (STRAIGHT_HIGH[m] < 0 && (m & 0x100f) === 0x100f) STRAIGHT_HIGH[m] = 3;
}

const cnt = new Int8Array(13);
const suitMask = new Int32Array(4);
const suitCnt = new Int8Array(4);

const pack = (cat, a = 0, b = 0, c = 0, d = 0, e = 0) => ((((cat * 16 + a) * 16 + b) * 16 + c) * 16 + d) * 16 + e;

// ビットの集まりから、高い順に k 個のランクを取り出す（残りは0で埋める）
function topRanks(mask, k, out) {
  let n = 0;
  for (let r = 12; r >= 0 && n < k; r--) if (mask & (1 << r)) out[n++] = r;
  for (; n < 5; n++) out[n] = 0;
  return out;
}
const tmp = [0, 0, 0, 0, 0];

export function evalFast(cards) {
  cnt.fill(0); suitMask.fill(0); suitCnt.fill(0);
  let rankMask = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const r = c >> 2;
    const s = c & 3;
    cnt[r]++; suitMask[s] |= 1 << r; suitCnt[s]++; rankMask |= 1 << r;
  }
  // 7枚以下では、フラッシュとフォーカード・フルハウスは同時に成り立たない（枚数が足りない）
  for (let s = 0; s < 4; s++) {
    if (suitCnt[s] >= 5) {
      const m = suitMask[s];
      const sf = STRAIGHT_HIGH[m];
      if (sf >= 0) return pack(8, sf);
      topRanks(m, 5, tmp);
      return pack(5, tmp[0], tmp[1], tmp[2], tmp[3], tmp[4]);
    }
  }
  let quad = -1, trip = -1, trip2 = -1, p1 = -1, p2 = -1;
  for (let r = 12; r >= 0; r--) {
    const k = cnt[r];
    if (k === 4) quad = r;
    else if (k === 3) { if (trip < 0) trip = r; else if (trip2 < 0) trip2 = r; }
    else if (k === 2) { if (p1 < 0) p1 = r; else if (p2 < 0) p2 = r; }
  }
  if (quad >= 0) {
    topRanks(rankMask & ~(1 << quad), 1, tmp);
    return pack(7, quad, tmp[0]);
  }
  if (trip >= 0 && (trip2 >= 0 || p1 >= 0)) return pack(6, trip, Math.max(trip2, p1));
  const sh = STRAIGHT_HIGH[rankMask];
  if (sh >= 0) return pack(4, sh);
  if (trip >= 0) {
    topRanks(rankMask & ~(1 << trip), 2, tmp);
    return pack(3, trip, tmp[0], tmp[1]);
  }
  if (p1 >= 0 && p2 >= 0) {
    topRanks(rankMask & ~(1 << p1) & ~(1 << p2), 1, tmp);
    return pack(2, p1, p2, tmp[0]);
  }
  if (p1 >= 0) {
    topRanks(rankMask & ~(1 << p1), 3, tmp);
    return pack(1, p1, tmp[0], tmp[1], tmp[2]);
  }
  topRanks(rankMask, 5, tmp);
  return pack(0, tmp[0], tmp[1], tmp[2], tmp[3], tmp[4]);
}

// ランクのビットの集まりがストレートを含むなら一番上のランク、なければ -1（ドローを数えるときに使う）
export const straightHighOf = (mask) => STRAIGHT_HIGH[mask & 0x1fff];
