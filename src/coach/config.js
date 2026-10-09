// コーチの基準値（遊んでみて調整する。設計書 第5-3・6-2節）。
// 損失（BB）の境目：最善／許容／疑問手（超えると悪手）。foldUncertainty：相手が降りる確率の推定の幅（±15%）
export const GRADE = { best: 0.05, ok: 0.3, dubious: 1.0, foldUncertainty: 0.15 };
export const CHART = {
  minStackBB: 16,   // これ以上の持ち点で、誰もレイズしていないときは参加表で判定する
  border: 0.02,     // 参加ラインの上下2%は「許容」
  base: 0.3,        // 境目の外に出たときの損失のはじまり（BB）
  perPct: 0.1,      // 境目から1%離れるごとに増える損失（BB）
  cap: 3.0,         // 損失の上限（BB）
  limpMin: 0.4,     // レイズせずにコールで参加したときの最小の損失（BB）
  allInBB: 25,      // プリフロップでオールインを勧める候補に入れる持ち点の上限（BB）
  allInSpr: 2,      // フロップ以降でオールインを候補に入れる「持ち点÷ポット」の上限
  maxOpenBB: 4,     // 参加表の場面で標準とみなすレイズ額の上限（BB。参加者1人ごとに+1BB）
  oversizeLoss: 0.5, // それを超える額で参加したときの最小の損失（BB）＝疑問手
  shoveLoss: 1.5,   // 持ち点が allInBB より多いのにオールインで参加したときの最小の損失（BB）＝悪手
};
// 指南の段階：直近 recent 回の判断で、正答率 upAccuracy 以上かつ平均損失 upLoss 以下なら進み、downAccuracy 未満なら戻る
export const LEVELS = { recent: 50, upAccuracy: 0.9, upLoss: 0.3, downAccuracy: 0.75 };
// 押す・受ける判断（設計書 段階4-1 第3〜5節）。maxBB：押すか降りるかで考える持ち点の上限（BB）、
// icmWithin：賞金の見込みで計算する場面（残り人数が「入賞人数＋icmWithin」以下）、
// halfLoss：15BB以下の中途半端な額（オールインに満たないレイズ・コールでの参加）の最小の損失（BB）、
// foldUncertainty：押す場面で、相手が受ける確率の推定の幅（±5%）。受ける範囲は相手の打ち方そのもの（CPUはこの確率で打つ）なので、
//   期待値の場面（GRADE.foldUncertainty ±15%）より狭くする。±15%だと、押す範囲の中の手でも得が0.7BB弱までなら「降りる」を勧めてしまう
export const ALLIN = { maxBB: 15, icmWithin: 3, halfLoss: 0.5, foldUncertainty: 0.05 };
