/**
 * Минимальный QR-кодер для печати на сертификате (pure TypeScript, без зависимостей).
 *
 * Поддерживает: версии 1-10, byte mode (UTF-8), ECC level L (наибольшая ёмкость),
 * автоподбор мин. версии под входные данные, выбор лучшей маски по скорингу спека.
 *
 * Алгоритмы: GF(256) с примитивным многочленом 0x11d, Reed-Solomon ECC,
 * BCH(15,5) для format info, стандартное размещение модулей по ISO 18004.
 *
 * Использование:
 *   const matrix = encodeQR("https://aevion.kz/...");  // boolean[][], true = чёрный
 *   const svg = renderQRSvg(matrix, 200);              // SVG-строка для <img src> или dangerouslySetInnerHTML
 */

// ── GF(256) арифметика ────────────────────────────────────────────────
const EXP: number[] = new Array(512);
const LOG: number[] = new Array(256);
(function buildGfTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

// ── Reed-Solomon ──────────────────────────────────────────────────────
function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, EXP[i]]);
  }
  return poly;
}

function polyMul(a: number[], b: number[]): number[] {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return out;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const buf = data.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = buf[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        buf[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return buf.slice(data.length);
}

// ── Ёмкости ECC L (codewords) и параметры ─────────────────────────────
// [version]: { totalCodewords, dataCodewords, ecCodewordsPerBlock, blocks: [[count, dataPerBlock], ...] }
// Только ECC L (наибольшая ёмкость для байт-режима).
const VERSION_L: Record<number, { dataCodewords: number; ecCodewordsPerBlock: number; blocks: Array<[number, number]> }> = {
  1:  { dataCodewords: 19,  ecCodewordsPerBlock: 7,  blocks: [[1, 19]] },
  2:  { dataCodewords: 34,  ecCodewordsPerBlock: 10, blocks: [[1, 34]] },
  3:  { dataCodewords: 55,  ecCodewordsPerBlock: 15, blocks: [[1, 55]] },
  4:  { dataCodewords: 80,  ecCodewordsPerBlock: 20, blocks: [[1, 80]] },
  5:  { dataCodewords: 108, ecCodewordsPerBlock: 26, blocks: [[1, 108]] },
  6:  { dataCodewords: 136, ecCodewordsPerBlock: 18, blocks: [[2, 68]] },
  7:  { dataCodewords: 156, ecCodewordsPerBlock: 20, blocks: [[2, 78]] },
  8:  { dataCodewords: 194, ecCodewordsPerBlock: 24, blocks: [[2, 97]] },
  9:  { dataCodewords: 232, ecCodewordsPerBlock: 30, blocks: [[2, 116]] },
  10: { dataCodewords: 274, ecCodewordsPerBlock: 18, blocks: [[2, 68], [2, 69]] },
};

// Версия → размер матрицы
function sizeOf(version: number): number {
  return version * 4 + 17;
}

// Координаты центров alignment patterns (для версий 2-10)
const ALIGNMENT_POS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// ── Подбор минимальной версии для байт-данных ─────────────────────────
function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 10; v++) {
    const cap = VERSION_L[v].dataCodewords;
    // 4 бита mode + 8 или 16 бит счётчика + 8 бит на байт + 4 бита terminator
    const charCountBits = v <= 9 ? 8 : 16;
    const bitsNeeded = 4 + charCountBits + byteLen * 8 + 4;
    const bytesNeeded = Math.ceil(bitsNeeded / 8);
    if (bytesNeeded <= cap) return v;
  }
  throw new Error("QR: data too long (max version 10 supported)");
}

// ── Битовый буфер ─────────────────────────────────────────────────────
class BitBuffer {
  bits: number[] = [];
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }
  toBytes(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && i + j < this.bits.length; j++) {
        byte = (byte << 1) | this.bits[i + j];
      }
      // дополнить байт нулями справа если bits не кратно 8
      if (this.bits.length - i < 8) {
        byte <<= 8 - (this.bits.length - i);
      }
      out.push(byte);
    }
    return out;
  }
}

// ── Кодирование данных в codewords ────────────────────────────────────
function encodeData(text: string, version: number): number[] {
  const utf8: number[] = [];
  for (const ch of unescape(encodeURIComponent(text))) {
    utf8.push(ch.charCodeAt(0));
  }
  const buf = new BitBuffer();
  buf.put(0b0100, 4); // byte mode
  const charCountBits = version <= 9 ? 8 : 16;
  buf.put(utf8.length, charCountBits);
  for (const b of utf8) buf.put(b, 8);

  const totalDataCw = VERSION_L[version].dataCodewords;
  const totalDataBits = totalDataCw * 8;
  // Terminator (до 4 нулей)
  const remBits = totalDataBits - buf.bits.length;
  buf.put(0, Math.min(4, Math.max(0, remBits)));
  // Дополнение до целого байта
  while (buf.bits.length % 8 !== 0) buf.bits.push(0);
  // Padding bytes 0xEC, 0x11
  let bytes = buf.toBytes();
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (bytes.length < totalDataCw) {
    bytes.push(padBytes[pi % 2]);
    pi++;
  }
  return bytes;
}

// ── Сборка codewords с ECC и interleaving ─────────────────────────────
function buildCodewords(data: number[], version: number): number[] {
  const v = VERSION_L[version];
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (const [count, dataPerBlock] of v.blocks) {
    for (let i = 0; i < count; i++) {
      const block = data.slice(offset, offset + dataPerBlock);
      offset += dataPerBlock;
      blocks.push(block);
      ecBlocks.push(rsEncode(block, v.ecCodewordsPerBlock));
    }
  }
  // Interleave data
  const out: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) {
      if (i < b.length) out.push(b[i]);
    }
  }
  // Interleave EC
  const ecLen = v.ecCodewordsPerBlock;
  for (let i = 0; i < ecLen; i++) {
    for (const b of ecBlocks) out.push(b[i]);
  }
  return out;
}

// ── Матрица модулей ───────────────────────────────────────────────────
type Cell = boolean | null; // null = ещё не заполнено / functional pattern bit (не маскируется)

function newMatrix(size: number): Cell[][] {
  return Array.from({ length: size }, () => new Array<Cell>(size).fill(null));
}

function setFunc(m: Cell[][], reserved: boolean[][], r: number, c: number, val: boolean): void {
  m[r][c] = val;
  reserved[r][c] = true;
}

function placeFinder(m: Cell[][], reserved: boolean[][], r: number, c: number): void {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= m.length || cc < 0 || cc >= m.length) continue;
      const isBorder = (dr === 0 || dr === 6 || dc === 0 || dc === 6) && dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const isInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      const isPattern = (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) && (isBorder || isInner);
      setFunc(m, reserved, rr, cc, isPattern);
    }
  }
}

function placeAlignment(m: Cell[][], reserved: boolean[][], cy: number, cx: number): void {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const isBorder = Math.max(Math.abs(dr), Math.abs(dc)) === 2;
      const isCenter = dr === 0 && dc === 0;
      setFunc(m, reserved, cy + dr, cx + dc, isBorder || isCenter);
    }
  }
}

function placeFunctionalPatterns(m: Cell[][], reserved: boolean[][], version: number): void {
  const size = sizeOf(version);
  // 3 finder patterns
  placeFinder(m, reserved, 0, 0);
  placeFinder(m, reserved, 0, size - 7);
  placeFinder(m, reserved, size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(m, reserved, 6, i, i % 2 === 0);
    setFunc(m, reserved, i, 6, i % 2 === 0);
  }

  // Dark module
  setFunc(m, reserved, 4 * version + 9, 8, true);

  // Format info reserve (заполнится позже, пока резервируем 0)
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) setFunc(m, reserved, 8, i, false);
    if (!reserved[i][8]) setFunc(m, reserved, i, 8, false);
  }
  for (let i = size - 8; i < size; i++) {
    setFunc(m, reserved, 8, i, false);
    setFunc(m, reserved, i, 8, false);
  }

  // Alignment patterns (V2+)
  const positions = ALIGNMENT_POS[version] ?? [];
  for (const py of positions) {
    for (const px of positions) {
      // Не накладывать на finder patterns
      const inFinder =
        (py <= 8 && px <= 8) ||
        (py <= 8 && px >= size - 8) ||
        (py >= size - 8 && px <= 8);
      if (!inFinder) placeAlignment(m, reserved, py, px);
    }
  }
}

// ── Заполнение данных по зигзагу ──────────────────────────────────────
function placeData(m: Cell[][], reserved: boolean[][], codewords: number[]): void {
  const size = m.length;
  let bitIdx = 0;
  let upward = true;
  // Колонки идут парами справа налево; пропускаем колонку 6 (timing)
  for (let cRight = size - 1; cRight > 0; cRight -= 2) {
    if (cRight === 6) cRight--; // skip timing column 6
    for (let i = 0; i < size; i++) {
      const r = upward ? size - 1 - i : i;
      for (let dc = 0; dc < 2; dc++) {
        const c = cRight - dc;
        if (reserved[r][c]) continue;
        const byte = codewords[bitIdx >> 3];
        const bit = ((byte ?? 0) >> (7 - (bitIdx & 7))) & 1;
        m[r][c] = bit === 1;
        bitIdx++;
      }
    }
    upward = !upward;
  }
}

// ── Маски ─────────────────────────────────────────────────────────────
const MASKS = [
  (r: number, c: number) => (r + c) % 2 === 0,
  (r: number, _c: number) => r % 2 === 0,
  (_r: number, c: number) => c % 3 === 0,
  (r: number, c: number) => (r + c) % 3 === 0,
  (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(m: Cell[][], reserved: boolean[][], maskFn: (r: number, c: number) => boolean): void {
  const size = m.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && m[r][c] !== null && maskFn(r, c)) {
        m[r][c] = !m[r][c];
      }
    }
  }
}

// ── Скоринг масок (ISO 18004 §8.8.2) ──────────────────────────────────
function maskScore(m: Cell[][]): number {
  const size = m.length;
  let score = 0;
  // Rule 1: ряды и колонки одинаковых модулей >= 5
  for (let r = 0; r < size; r++) {
    let runColor = m[r][0] === true;
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      const cur = m[r][c] === true;
      if (cur === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = cur;
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = m[0][c] === true;
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      const cur = m[r][c] === true;
      if (cur === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = cur;
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }
  // Rule 2: блоки 2x2 одного цвета
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }
  // Rule 3: паттерн 1011101 (как у finder) с обрамлением 0000
  const pattern1 = [true, false, true, true, true, false, true, false, false, false, false];
  const pattern2 = [false, false, false, false, true, false, true, true, true, false, true];
  function matchAt(rr: number, cc: number, vert: boolean, pat: boolean[]): boolean {
    for (let i = 0; i < pat.length; i++) {
      const r = vert ? rr + i : rr;
      const c = vert ? cc : cc + i;
      if (r >= size || c >= size) return false;
      if ((m[r][c] === true) !== pat[i]) return false;
    }
    return true;
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matchAt(r, c, false, pattern1)) score += 40;
      if (matchAt(r, c, false, pattern2)) score += 40;
      if (matchAt(r, c, true, pattern1)) score += 40;
      if (matchAt(r, c, true, pattern2)) score += 40;
    }
  }
  // Rule 4: процент тёмных модулей
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) if (m[r][c] === true) dark++;
  }
  const total = size * size;
  const ratio = (dark * 100) / total;
  const k = Math.floor(Math.abs(ratio - 50) / 5);
  score += k * 10;
  return score;
}

// ── Format info bits ──────────────────────────────────────────────────
const ECC_LEVEL_L = 0b01;
function buildFormatBits(maskIdx: number): number {
  const data = (ECC_LEVEL_L << 3) | maskIdx; // 5 бит
  // BCH(15,5) с генератором 0b10100110111
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0b10100110111 << (i - 10);
    }
  }
  let bits = (data << 10) | rem;
  bits ^= 0b101010000010010; // маска по спеку
  return bits;
}

function placeFormatInfo(m: Cell[][], maskIdx: number, version: number): void {
  const size = sizeOf(version);
  const bits = buildFormatBits(maskIdx);
  // Записываем 15 бит формата в две позиции (рядом с finder'ами)
  // Top-left + top-right/bottom-left
  for (let i = 0; i < 15; i++) {
    const bit = ((bits >> i) & 1) === 1;
    // Top-left vertical (column 8)
    let r1: number, c1: number;
    if (i < 6) { r1 = i; c1 = 8; }
    else if (i === 6) { r1 = 7; c1 = 8; }
    else if (i === 7) { r1 = 8; c1 = 8; }
    else if (i === 8) { r1 = 8; c1 = 7; }
    else { r1 = 8; c1 = 14 - i; }
    m[r1][c1] = bit;
    // Bottom-left + top-right
    let r2: number, c2: number;
    if (i < 8) { r2 = size - 1 - i; c2 = 8; }
    else { r2 = 8; c2 = size - 15 + i; }
    m[r2][c2] = bit;
  }
}

// ── Финальный публичный API ───────────────────────────────────────────
export function encodeQR(text: string): boolean[][] {
  // Подбираем версию по UTF-8 длине
  const utf8Len = unescape(encodeURIComponent(text)).length;
  const version = pickVersion(utf8Len);
  const data = encodeData(text, version);
  const codewords = buildCodewords(data, version);
  const size = sizeOf(version);

  // Пробуем все 8 масок, выбираем минимальный score
  let bestMatrix: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let maskIdx = 0; maskIdx < 8; maskIdx++) {
    const m: Cell[][] = newMatrix(size);
    const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
    placeFunctionalPatterns(m, reserved, version);
    placeData(m, reserved, codewords);
    applyMask(m, reserved, MASKS[maskIdx]);
    placeFormatInfo(m, maskIdx, version);
    // Финальная булевая копия (заменим оставшиеся null на false — на всякий случай)
    const final: boolean[][] = m.map((row) => row.map((v) => v === true));
    const s = maskScore(final);
    if (s < bestScore) {
      bestScore = s;
      bestMatrix = final;
    }
  }
  if (!bestMatrix) throw new Error("QR: no mask selected");
  return bestMatrix;
}

/** SVG-рендер. size — итоговый размер в px, quietZone — модулей padding (по спеку 4). */
export function renderQRSvg(matrix: boolean[][], pxSize = 200, quietZone = 4): string {
  const modules = matrix.length + quietZone * 2;
  const scale = pxSize / modules;
  let path = "";
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (matrix[r][c]) {
        const x = ((c + quietZone) * scale).toFixed(2);
        const y = ((r + quietZone) * scale).toFixed(2);
        const s = scale.toFixed(2);
        path += `M${x},${y}h${s}v${s}h-${s}z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pxSize}" height="${pxSize}" viewBox="0 0 ${pxSize} ${pxSize}" shape-rendering="crispEdges"><rect width="${pxSize}" height="${pxSize}" fill="white"/><path d="${path}" fill="black"/></svg>`;
}
