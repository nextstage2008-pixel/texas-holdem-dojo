// メインポットとサイドポット。committed[i] はアンティを除いて、そのハンドで賭けた合計。
export function buildPots(committed, folded, deadMoney = 0) {
  const levels = [...new Set(committed.filter((c, i) => c > 0 && !folded[i]))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of committed) amount += Math.max(0, Math.min(c, level) - prev);
    const eligible = committed.map((_, i) => i).filter((i) => !folded[i] && committed[i] >= level);
    pots.push({ amount, eligible });
    prev = level;
  }
  // 残っている人の最高額を超えて、降りた人が賭けていた分（念のため。通常は返却済み）
  let rest = 0;
  for (const c of committed) rest += Math.max(0, c - prev);
  if (rest > 0) {
    if (pots.length > 0) pots[pots.length - 1].amount += rest;
    else pots.push({ amount: rest, eligible: [] });
  }
  // 誰も賭けていない（例：デッドSBで全員がBBに降り、BBのブラインドが返った）ときも、
  // 死に金は残っている人の権利にする。権利者がいないとアンティが消えてしまう。
  if (pots.length === 0) pots.push({ amount: 0, eligible: committed.map((_, i) => i).filter((i) => !folded[i]) });
  pots[0].amount += deadMoney;
  return pots;
}

// 引き分けの端数は50点単位で配る（ブラインド表の額はすべて50の倍数なので、持ち点も50の倍数のまま保てる）
export const ODD_CHIP_UNIT = 50;

export function awardPots(pots, scores, button, seatCount, unit = ODD_CHIP_UNIT) {
  const won = new Array(seatCount).fill(0);
  for (const pot of pots) {
    if (pot.amount === 0 || pot.eligible.length === 0) continue;
    const best = Math.max(...pot.eligible.map((i) => scores[i]));
    const winners = pot.eligible.filter((i) => scores[i] === best);
    const share = Math.floor(pot.amount / (winners.length * unit)) * unit;
    let odd = pot.amount - share * winners.length;
    for (const w of winners) won[w] += share;
    // 端数はボタンの左隣から unit ずつ（unit に満たない残りは、順番が来た人がまとめて受け取る）
    for (let k = 1; odd > 0; k++) {
      const s = (button + k) % seatCount;
      if (!winners.includes(s)) continue;
      const give = Math.min(unit, odd);
      won[s] += give;
      odd -= give;
    }
  }
  return won;
}
