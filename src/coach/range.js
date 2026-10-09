// 相手の手の推定。相手の行動ごとに「この2枚ならこの行動をとる確率」（CPUの打ち方）を掛けて絞る。
// trail：このハンドの行動の記録 [{ state（行動の直前のハンド）, seat, action }]
import { COMBO_COUNT, COMBO_A, COMBO_B } from '../calc/combos.js';
import { policyContext, probsFor } from './policy.js';

const kindOf = (action) => action.type; // fold・check・call・raise

// 見えているカード（あなたの2枚と場）と重ならない組合せに1を置く
export function priorRange(dead) {
  const w = new Float64Array(COMBO_COUNT);
  for (let i = 0; i < COMBO_COUNT; i++) w[i] = dead.has(COMBO_A[i]) || dead.has(COMBO_B[i]) ? 0 : 1;
  return w;
}

export function estimateRange({ trail, seat, typeKey, dead }) {
  const w = priorRange(dead);
  const hole = [0, 0];
  for (const step of trail) {
    if (step.seat !== seat) continue;
    const ctx = policyContext(step.state, seat, typeKey);
    const kind = kindOf(step.action);
    for (let i = 0; i < COMBO_COUNT; i++) {
      if (w[i] === 0) continue;
      hole[0] = COMBO_A[i]; hole[1] = COMBO_B[i];
      w[i] *= probsFor(ctx, hole)[kind];
    }
  }
  const total = w.reduce((a, x) => a + x, 0);
  if (total > 0) for (let i = 0; i < COMBO_COUNT; i++) w[i] /= total;
  return w;
}
