// 記録の書き出し（ファイルとして保存）と読み込み（ファイルを選ぶ）。
export function downloadText(fileName, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ファイルを選ばせて中身の文字列を返す（選ばなければ null）
export function pickTextFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

// 使える保存先（localStorage が使えないときは null）
export function browserStorageArea() {
  try {
    const area = window.localStorage;
    const probe = '__yassy_probe__';
    area.setItem(probe, '1');
    area.removeItem(probe);
    return area;
  } catch {
    return null;
  }
}
