// 本番大会の顔ぶれ（設計書 段階4-3 第4節・段階4-4 第5節）。いつもの8人のほかの36人は、人ごとに名前・打ち方・顔が決まる。
// 顔の絵は scripts/cut-faces.py で先生が Gemini で作った画像から切り分けたもの（assets/avatars/av_<id>.webp）。
// type：コールしすぎる人（station）・堅い人（tight）・上級者（pro）・荒い人（aggro）
const P = (id, name, type) => ({ id, name, type, avatar: `av_${id}` });
export const MAIN_PEOPLE = [
  // 楽天家（コールしすぎる人）13人
  P('takahashi', 'タカハシ', 'station'), P('nakamura', 'ナカムラ', 'station'), P('yoshida', 'ヨシダ', 'station'), P('yamamoto', 'ヤマモト', 'station'),
  P('inoue', 'イノウエ', 'station'), P('kimura', 'キムラ', 'station'), P('hayashi', 'ハヤシ', 'station'), P('shimizu', 'シミズ', 'station'),
  P('yamazaki', 'ヤマザキ', 'station'), P('mori', 'モリ', 'station'), P('abe', 'アベ', 'station'), P('ikeda', 'イケダ', 'station'),
  P('hashimoto', 'ハシモト', 'station'),
  // 慎重派（堅い人）9人
  P('yamashita', 'ヤマシタ', 'tight'), P('ishikawa', 'イシカワ', 'tight'), P('nakajima', 'ナカジマ', 'tight'), P('maeda', 'マエダ', 'tight'),
  P('fujita', 'フジタ', 'tight'), P('ogawa', 'オガワ', 'tight'), P('goto', 'ゴトウ', 'tight'), P('okada', 'オカダ', 'tight'), P('hasegawa', 'ハセガワ', 'tight'),
  // 勝負師（上級者）8人
  P('murakami', 'ムラカミ', 'pro'), P('kondo', 'コンドウ', 'pro'), P('ishii', 'イシイ', 'pro'), P('saito', 'サイトウ', 'pro'),
  P('sakamoto', 'サカモト', 'pro'), P('endo', 'エンドウ', 'pro'), P('aoki', 'アオキ', 'pro'), P('fujii', 'フジイ', 'pro'),
  // 強気（荒い人）6人
  P('nishimura', 'ニシムラ', 'aggro'), P('fukuda', 'フクダ', 'aggro'), P('ota', 'オオタ', 'aggro'), P('miura', 'ミウラ', 'aggro'),
  P('fujiwara', 'フジワラ', 'aggro'), P('nomura', 'ノムラ', 'aggro'),
];
export const MAIN_NAMES = MAIN_PEOPLE.map((p) => p.name);
// 相手44人（いつもの8人を含む）：コールしすぎる人14・堅い人12・上級者10・荒い人8（アミューズメントらしく）
export const MAIN_MIX = { station: 14, tight: 12, pro: 10, aggro: 8 };
