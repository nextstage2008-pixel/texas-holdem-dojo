// 保存先（ブラウザの localStorage）とのやり取り。本体と控え（ひとつ前の記録）を持つ。
// area は localStorage と同じ形（getItem・setItem）のもの。使えないときは null を渡す（プライベートモードなど）。
export const SAVE_KEY = 'yassy-games-holdem-dojo';
export const BACKUP_KEY = `${SAVE_KEY}:backup`;

export function createStorage(area) {
  let usable = !!area;
  let failed = false; // 書けていたのに途中で書けなくなった（まだ知らせていない）
  const get = (k) => {
    try {
      return area.getItem(k);
    } catch {
      usable = false;
      return null;
    }
  };
  return {
    get usable() { return usable; },
    // 起動時に読む：{ main, backup }（なければ null）
    read() {
      if (!area) return { main: null, backup: null };
      return { main: get(SAVE_KEY), backup: get(BACKUP_KEY) };
    },
    // 保存する。前の本体を控えに回してから書く。返す値：保存できたか
    write(text) {
      if (!usable) return false;
      try {
        const prev = area.getItem(SAVE_KEY);
        if (prev !== null && prev !== text) area.setItem(BACKUP_KEY, prev);
        area.setItem(SAVE_KEY, text);
        return true;
      } catch {
        usable = false;
        failed = true;
        return false;
      }
    },
    // 途中で書けなくなったことを、1回だけ true で返す（遊ぶ人に知らせるため）
    takeFailure() {
      const f = failed;
      failed = false;
      return f;
    },
    // 壊れた記録を別の名前で残す
    keepBroken(text, stamp) {
      if (!area || text === null) return;
      try { area.setItem(`${SAVE_KEY}:broken-${stamp}`, text); } catch { /* 残せなくても続ける */ }
    },
    // 記録を消して最初から（本体と控え）
    clear() {
      if (!area) return;
      try { area.removeItem(SAVE_KEY); area.removeItem(BACKUP_KEY); } catch { usable = false; }
    },
    // この回は保存しない（新しい版の記録を上書きしないため）
    disable() { usable = false; },
  };
}
