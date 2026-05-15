/**
 * Минимальный XLSX-писатель без зависимостей. Генерирует валидный
 * Office Open XML (.xlsx) файл, который открывается в Excel/LibreOffice/
 * Google Sheets/Numbers.
 *
 * Архитектура:
 *  - ZIP в stored mode (без сжатия) — ~80 строк, никаких deps
 *  - XLSX = 4 XML внутри ZIP (Content_Types, .rels, workbook, sheet1)
 *  - Inline strings в ячейках (без sharedStrings.xml — упрощает код)
 *
 * Использование:
 *   const blob = buildXlsx([
 *     { name: "ЛСР", rows: [
 *       [{v: "№", style: "header"}, {v: "Наименование", style: "header"}, ...],
 *       [{v: 1}, {v: "Штукатурка стен"}, {v: 52.0, fmt: "num"}],
 *     ]}
 *   ]);
 *   downloadBlob(blob, "smeta.xlsx");
 */

// ── Типы ──────────────────────────────────────────────────────────────

export type CellValue = string | number | boolean | null;

export interface Cell {
  /** Значение. Если undefined / null / "" — ячейка пустая. */
  v?: CellValue;
  /** Базовое форматирование (текст / число / валюта). */
  fmt?: "text" | "num" | "money" | "percent" | "int";
  /** Жирность / выделение шапки. */
  style?: "header" | "total" | "subtotal";
}

export interface Sheet {
  name: string;
  rows: Cell[][];
  /** Ширины колонок в "Excel units" (примерно символы). */
  colWidths?: number[];
}

// ── CRC-32 ────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ── ZIP в stored mode ────────────────────────────────────────────────

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

interface ZipEntry {
  name: string;
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

function writeUint16LE(arr: number[], v: number): void {
  arr.push(v & 0xff, (v >>> 8) & 0xff);
}
function writeUint32LE(arr: number[], v: number): void {
  arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

/** Собрать ZIP-архив из набора файлов (без сжатия — method = 0 stored). */
export function zipStored(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries: ZipEntry[] = [];
  const chunks: number[] = [];

  for (const f of files) {
    const nameBytes = utf8(f.name);
    const crc = crc32(f.data);
    const offset = chunks.length;

    // Local file header (signature 0x04034b50)
    writeUint32LE(chunks, 0x04034b50);
    writeUint16LE(chunks, 20);          // version needed
    writeUint16LE(chunks, 0x0800);      // flags: bit 11 = UTF-8 filename
    writeUint16LE(chunks, 0);           // method 0 = stored
    writeUint16LE(chunks, 0);           // mod time
    writeUint16LE(chunks, 0);           // mod date
    writeUint32LE(chunks, crc);
    writeUint32LE(chunks, f.data.length);  // compressed size
    writeUint32LE(chunks, f.data.length);  // uncompressed size
    writeUint16LE(chunks, nameBytes.length);
    writeUint16LE(chunks, 0);           // extra field length
    for (let i = 0; i < nameBytes.length; i++) chunks.push(nameBytes[i]);
    for (let i = 0; i < f.data.length; i++) chunks.push(f.data[i]);

    entries.push({ name: f.name, nameBytes, data: f.data, crc, offset });
  }

  const cdStart = chunks.length;
  for (const e of entries) {
    // Central directory header (signature 0x02014b50)
    writeUint32LE(chunks, 0x02014b50);
    writeUint16LE(chunks, 20);          // version made by
    writeUint16LE(chunks, 20);          // version needed
    writeUint16LE(chunks, 0x0800);      // flags
    writeUint16LE(chunks, 0);           // method
    writeUint16LE(chunks, 0);           // mod time
    writeUint16LE(chunks, 0);           // mod date
    writeUint32LE(chunks, e.crc);
    writeUint32LE(chunks, e.data.length);
    writeUint32LE(chunks, e.data.length);
    writeUint16LE(chunks, e.nameBytes.length);
    writeUint16LE(chunks, 0);           // extra
    writeUint16LE(chunks, 0);           // comment
    writeUint16LE(chunks, 0);           // disk number
    writeUint16LE(chunks, 0);           // internal attrs
    writeUint32LE(chunks, 0);           // external attrs
    writeUint32LE(chunks, e.offset);
    for (let i = 0; i < e.nameBytes.length; i++) chunks.push(e.nameBytes[i]);
  }
  const cdSize = chunks.length - cdStart;

  // End of Central Directory (signature 0x06054b50)
  writeUint32LE(chunks, 0x06054b50);
  writeUint16LE(chunks, 0);             // disk number
  writeUint16LE(chunks, 0);             // disk where CD starts
  writeUint16LE(chunks, entries.length);
  writeUint16LE(chunks, entries.length);
  writeUint32LE(chunks, cdSize);
  writeUint32LE(chunks, cdStart);
  writeUint16LE(chunks, 0);             // comment length

  return new Uint8Array(chunks);
}

// ── XLSX генерация ───────────────────────────────────────────────────

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Колонка по индексу (0 → A, 25 → Z, 26 → AA). */
function colLetter(idx: number): string {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

// numFmtId соответствуют style numFmts в styles.xml ниже.
function styleIdFor(cell: Cell): number {
  // Базовые стили (см. styles.xml):
  //   0 = default, 1 = header, 2 = total, 3 = subtotal,
  //   4 = num (general number), 5 = money, 6 = percent, 7 = int
  if (cell.style === "header") return 1;
  if (cell.style === "total") return 2;
  if (cell.style === "subtotal") return 3;
  if (cell.fmt === "money") return 5;
  if (cell.fmt === "percent") return 6;
  if (cell.fmt === "int") return 7;
  if (cell.fmt === "num") return 4;
  return 0;
}

function renderCell(cell: Cell, ref: string): string {
  const styleId = styleIdFor(cell);
  const styleAttr = styleId > 0 ? ` s="${styleId}"` : "";
  if (cell.v === undefined || cell.v === null || cell.v === "") {
    return `<c r="${ref}"${styleAttr}/>`;
  }
  if (typeof cell.v === "number") {
    return `<c r="${ref}"${styleAttr}><v>${cell.v}</v></c>`;
  }
  if (typeof cell.v === "boolean") {
    return `<c r="${ref}"${styleAttr} t="b"><v>${cell.v ? 1 : 0}</v></c>`;
  }
  // Строка через inlineStr — без sharedStrings.xml
  return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(cell.v))}</t></is></c>`;
}

function buildSheetXml(sheet: Sheet): string {
  const rows = sheet.rows.map((row, ri) => {
    const cells = row.map((cell, ci) => renderCell(cell, `${colLetter(ci)}${ri + 1}`)).join("");
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join("");

  const cols = sheet.colWidths
    ? `<cols>${sheet.colWidths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";

  return `${XML_HEADER}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${cols}
<sheetData>${rows}</sheetData>
</worksheet>`;
}

function buildContentTypes(sheets: Sheet[]): string {
  const overrides = sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return `${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${overrides}
</Types>`;
}

function buildRels(): string {
  return `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildWorkbook(sheets: Sheet[]): string {
  const sheetsXml = sheets.map((s, i) =>
    `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  ).join("");
  return `${XML_HEADER}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetsXml}</sheets>
</workbook>`;
}

function buildWorkbookRels(sheets: Sheet[]): string {
  const rels = sheets.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join("") +
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  return `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

/**
 * styles.xml с 8 стилями:
 *  0 = default (без форматирования)
 *  1 = header (жирный, с фоном)
 *  2 = total (жирный, бордеры сверху)
 *  3 = subtotal (курсив)
 *  4 = num (формат «0.00»)
 *  5 = money (формат «#,##0.00 ₸»)
 *  6 = percent (формат «0%»)
 *  7 = int (формат «0»)
 */
function buildStyles(): string {
  return `${XML_HEADER}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3">
  <numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;₸&quot;"/>
  <numFmt numFmtId="165" formatCode="0.00"/>
  <numFmt numFmtId="166" formatCode="0%"/>
</numFmts>
<fonts count="2">
  <font><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFE0F2F1"/></patternFill></fill>
</fills>
<borders count="2">
  <border><left/><right/><top/><bottom/></border>
  <border><top style="thin"><color rgb="FF0F766E"/></top></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left"/></xf>
  <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;
}

/** Собрать .xlsx Blob из набора листов. */
export function buildXlsx(sheets: Sheet[]): Blob {
  const files: { name: string; data: Uint8Array }[] = [
    { name: "[Content_Types].xml", data: utf8(buildContentTypes(sheets)) },
    { name: "_rels/.rels", data: utf8(buildRels()) },
    { name: "xl/workbook.xml", data: utf8(buildWorkbook(sheets)) },
    { name: "xl/_rels/workbook.xml.rels", data: utf8(buildWorkbookRels(sheets)) },
    { name: "xl/styles.xml", data: utf8(buildStyles()) },
  ];
  sheets.forEach((s, i) => {
    files.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: utf8(buildSheetXml(s)),
    });
  });
  const zipBytes = zipStored(files);
  return new Blob([zipBytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Скачать blob браузером. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
