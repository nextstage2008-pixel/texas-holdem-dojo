// mulberry32。シードを決めれば同じ列が出るので、大会を丸ごと再現してテストできる。
// エンジンでは標準の乱数を使わず、必ずこの関数を受け取って使う（純粋性テストで縛る）。
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}
