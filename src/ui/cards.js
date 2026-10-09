import { rankOf, suitOf, RANK_CHARS, SUIT_SYMBOLS, isRed } from '../engine/cards.js';

const FACES = new Set([9, 10, 11]); // J Q K

export function cardHTML(c, size = '') {
  const r = RANK_CHARS[rankOf(c)];
  const label = r === 'T' ? '10' : r;
  const suit = SUIT_SYMBOLS[suitOf(c)];
  const cls = ['cd', size, isRed(c) ? 'r' : ''].filter(Boolean).join(' ');
  const center = FACES.has(rankOf(c)) ? `<div class="face">${label}<i>${suit}</i></div>` : `<div class="pip">${suit}</div>`;
  return `<div class="${cls}"><div class="ix">${label}<i>${suit}</i></div>${center}<div class="ix b">${label}<i>${suit}</i></div></div>`;
}

export const cardBackHTML = (size = '') => `<div class="bk${size ? ` ${size}` : ''}"></div>`;
