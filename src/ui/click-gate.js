// 手番のボタンが出た直後のクリックと、ダブルクリックの2回目を無視する。
// （あなたが続けて行動する場面で、1回の操作が2回分の行動にならないように）
export function createClickGate(ms = 250) {
  let armedAt = -Infinity;
  return {
    arm(now) { armedAt = now; },
    accept(now, detail = 1) { return detail <= 1 && now - armedAt >= ms; },
  };
}
