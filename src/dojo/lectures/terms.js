// 言葉の一覧（設計書 2026-10-12 plain-words §6）。ポーカーを知らない人が知らない言葉を、どこで・どう説明したかを残す。
// term：言葉。aliases：同じものの別の書き方（略語など）。pattern：書き方の決まり（手の書き方 AK・K10o など。英字の語の確かめに使う）。
// at：説明した場所（'<章>/desc'・'<章>/lecture/<ページ 1から>'・'<章>/lesson/<レッスンの id>'・'<章>/questions'）。
// says：その場所の文に必ず入っている説明の文字列。
// 見張り（tests/plain-words.test.js）は、書き直した章の文で、言葉が説明した場所より前に出てこないことを確かめる。
// 新しい言葉を使うときは、説明した場所と説明をここに足す
export const TERMS = [
  // 序章：ルール・役・席
  { term: '役', at: 'prologue/desc', says: '5枚の形の強さ（役）' },
  { term: '手札', at: 'prologue/lecture/1', says: 'あなただけが見られる手札' },
  { term: 'プリフロップ', at: 'prologue/lecture/1', says: '場が開く前を「プリフロップ」と呼びます' },
  { term: 'フロップ', at: 'prologue/lecture/1', says: 'フロップ3枚' },
  { term: 'ターン', at: 'prologue/lecture/1', says: 'ターン1枚' },
  { term: 'リバー', at: 'prologue/lecture/1', says: 'リバー1枚' },
  { term: 'フォーカード', at: 'prologue/lecture/2', says: '同じ数字が4枚' },
  { term: 'フルハウス', at: 'prologue/lecture/2', says: '同じ数字3枚＋2枚' },
  { term: 'スリーカード', at: 'prologue/lecture/2', says: '同じ数字が3枚' },
  { term: 'ツーペア', at: 'prologue/lecture/2', says: '同じ数字2枚が2組' },
  { term: 'ワンペア', at: 'prologue/lecture/2', says: '同じ数字が2枚' },
  { term: 'ストレート', at: 'prologue/lecture/3', says: '数字が5つ続く形が「ストレート」' },
  { term: 'フラッシュ', at: 'prologue/lecture/3', says: '同じマークが5枚そろう形が「フラッシュ」' },
  { term: 'ストレートフラッシュ', at: 'prologue/lecture/3', says: '両方がそろうと「ストレートフラッシュ」' },
  { term: 'ハイカード', at: 'prologue/lecture/3', says: '一番高いカードで比べます（ハイカード）' },
  { term: 'キッカー', at: 'prologue/lecture/4', says: '残りのカード（キッカー）' },
  { term: 'ポット', at: 'prologue/lecture/4', says: 'みんなが賭けた点の集まり（ポット）' },
  { term: 'ボタン', aliases: ['BTN'], at: 'prologue/lecture/5', says: '「ボタン」という目印' },
  { term: 'ブラインド', at: 'prologue/lecture/5', says: 'これを「ブラインド」と呼びます' },
  { term: 'スモールブラインド', aliases: ['SB'], at: 'prologue/lecture/5', says: 'スモールブラインド（SB・小さい額）' },
  { term: 'ビッグブラインド', aliases: ['BB'], at: 'prologue/lecture/5', says: 'ビッグブラインド（BB・その倍の額）' },
  { term: 'ハンド', at: 'prologue/lecture/5', says: '配ってから勝負までを「1ハンド」と数えます' },
  { term: 'UTG', at: 'prologue/lecture/6', says: 'UTG（アンダー・ザ・ガン）' },
  { term: 'UTG+1', at: 'prologue/lecture/7', says: 'UTG+1（2番目）' },
  { term: 'MP', at: 'prologue/lecture/7', says: 'MP（3番目）' },
  { term: 'LJ', at: 'prologue/lecture/7', says: 'LJ（4番目）' },
  { term: 'HJ', at: 'prologue/lecture/7', says: 'HJ（5番目）' },
  { term: 'CO', at: 'prologue/lecture/7', says: 'CO（ボタンの右隣）' },
  { term: 'アンティ', at: 'prologue/lesson/screen', says: 'アンティ（全員分の参加料' },
  { term: 'レベル', at: 'prologue/lesson/screen', says: 'レベル（ブラインドの段階）' },
  { term: '最善手', at: 'prologue/lesson/screen', says: 'いちばん良い行動（最善手）' },
  { term: '勝つ見込み', at: 'prologue/lesson/screen', says: '「勝つ見込み」（この手が最後に勝つ割合）' },
  { term: '損益分岐点', at: 'prologue/lesson/screen', says: '「損益分岐点」（賭けに合わせて得になるのに要る割合）' },
  { term: 'コール', at: 'prologue/lesson/basic', says: 'に合わせて参加します' },
  { term: 'レイズ', at: 'prologue/lesson/basic', says: '「レイズ」。額を 600 に上げました' },
  { term: 'チェック', at: 'prologue/lesson/basic', says: '「チェック」（賭けずに次の人へ）' },
  { term: 'ベット', at: 'prologue/lesson/basic', says: '「ベット」（最初に賭けること）' },
  { term: 'ショーダウン', at: 'prologue/lesson/basic', says: '勝負（ショーダウン）' },
  // 第1章：配られた2枚の強さ（手は書き方の記号を使わず「A と K（同じマーク）」のように言う）
  { term: '上位', at: 'ch1/lecture/2', says: '上から何%の所にあるかを「上位○%」と言います' },
  // 第2章：コールしてよいとき（損益分岐点・勝つ見込みは序章の卓で体験で短く説明し、ここでくわしく）
  { term: '計器', at: 'ch2/lecture/3', says: '計器（針のついた丸い目盛り）' },
  { term: 'ドロー', at: 'ch2/lecture/4', says: 'あと1枚で役ができる形を「ドロー」と呼びます' },
  { term: 'アウツ', at: 'ch2/lecture/4', says: 'ドローを完成させるカードを「アウツ」と呼びます' },
  { term: 'オールイン', at: 'ch2/lecture/6', says: 'オールイン（持ち点を全部賭けること）' },
  // 第3章：場が開いたあとの基本
  { term: 'トップペア', at: 'ch3/lecture/3', says: '場のいちばん高いカードと同じ数字のペアを「トップペア」' },
  { term: 'オーバーペア', at: 'ch3/lecture/3', says: '場のどのカードよりも高いペアを「オーバーペア」' },
  // 第4章：相手の手を考える（手の書き方はここで教える。10 は T）
  { term: '手の書き方', pattern: /[AKQJT2-9]{2}[so]?/, at: 'ch4/lecture/2', says: '手は、2枚の数字を並べて書きます' },
  { term: '組み合わせの数', at: 'ch4/lecture/3', says: 'この数を「組み合わせの数」と呼びます' },
  { term: 'レンジ', at: 'ch4/lecture/4', says: 'この「ありそうな手の集まり」を「レンジ」と呼びます' },
  // 第5章：持ち点が少ないとき（押す＝全部賭ける・受ける＝押された側がコールする は、その場で言う）
  { term: 'メインポット', at: 'ch5/lesson/allin', says: '自分が賭けた 2,000 を全員から取る分まで（メインポット' },
  { term: 'サイドポット', at: 'ch5/lesson/allin', says: 'それより上の分（サイドポット' },
  { term: '飛び', at: 'ch5/lesson/allin', says: '持ち点が0になったコバヤシさんは「飛び」' },
  // 第6章：入賞の直前
  { term: '入賞', at: 'ch6/desc', says: '入賞（賞金がもらえる順位）' },
  { term: '賞金の見込み', at: 'ch6/lecture/1', says: '「賞金の見込み」（この先、平均でもらえそうな賞金の割合）' },
  { term: 'ICM', at: 'ch6/lecture/3', says: 'この計算を「ICM」と呼びます' },
  { term: 'バブル', at: 'ch6/lecture/4', says: '入賞まであと1人の場面を「バブル」と呼びます' },
  // 第7章：相手を見抜く
  { term: '参加率', at: 'ch7/lecture/2', says: 'プリフロップで、自分から点を入れて参加した割合' },
  { term: 'レイズ率', at: 'ch7/lecture/2', says: '全部のハンドのうち、プリフロップでレイズして参加した割合' },
  { term: 'ブラインドを盗', at: 'ch7/lecture/3', says: 'レイズしてブラインドの2人を降ろし、置かれた点を取る' },
  { term: 'はったり', at: 'ch7/lecture/3', says: 'はったり（弱い手で強く見せて賭けること）' },
  { term: 'やり返し', at: 'ch7/lecture/4', says: 'さらにレイズで返すこと（やり返し）' },
  // 第8章：運と実力
  { term: '期待値', at: 'ch8/desc', says: '1万回やり直したときの平均（期待値）' },
  { term: '95%の範囲', at: 'ch8/lecture/4', says: '20回のうち19回は入る幅（95%の範囲）' },
  { term: '√', at: 'ch8/lecture/4', says: '回数の平方根' },
  { term: '平均損失', at: 'ch8/lecture/6', says: '最善手と比べて、1回の判断で損した点の平均' },
  { term: '標準偏差', at: 'ch8/lecture/6', says: '標準偏差＝結果が平均からどれくらい離れるかの目安' },
  { term: '正答率', at: 'ch8/lecture/6', says: '正答率（最善手と同じ行動をした割合）' },
];
