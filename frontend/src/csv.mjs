/**
 * Чтение выгрузки бухгалтерской фирмы.
 *
 * Ловушки, ради которых это отдельный файл (все — из реальных выгрузок):
 *  - русский Excel по умолчанию разделяет точкой с запятой, а не запятой;
 *  - файл часто начинается с BOM, и первый заголовок становится "﻿id";
 *  - 1С отдаёт в windows-1251, а не UTF-8;
 *  - суммы приходят как "180 000,00" — с неразрывным пробелом и запятой;
 *  - даты приходят как 05.09.2026.
 * Каждая из них по отдельности даёт МОЛЧАЛИВО неверные данные, а не ошибку.
 */

const NBSP = String.fromCharCode(160);

/** Определяет разделитель по первой строке: побеждает тот, которого больше. */
export function detectDelimiter(firstLine) {
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  let best = ",";
  for (const d of Object.keys(counts)) if (counts[d] > counts[best]) best = d;
  return counts[best] === 0 ? "," : best;
}

export function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Разбор строки с учётом кавычек и удвоенных кавычек внутри. */
function splitLine(line, delim) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** «180 000,00» / «180000.5» / «180 000 ₸» -> 180000. Пусто или мусор -> null (не ноль!). */
export function parseAmount(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(new RegExp(NBSP, "g"), "")
    .replace(/[^\d.,-]/g, "")
    .replace(/\s/g, "");
  if (!cleaned) return null;
  // запятая как десятичный разделитель, если после неё 1-2 цифры и точки нет
  const normalized = /^-?\d+(\s?\d{3})*,\d{1,2}$/.test(cleaned) || /^-?\d+,\d{1,2}$/.test(cleaned)
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** «05.09.2026» / «2026-09-05» / «5.9.2026» -> «2026-09-05». Иначе null. */
export function parseDate(value) {
  const v = String(value || "").trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return v;
  m = v.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
    return m[3] + "-" + mo + "-" + d;
  }
  return null;
}

const TRUE_WORDS = new Set(["1", "true", "да", "yes", "оплачен", "оплачено", "y", "+"]);

export function parsePaid(value) {
  return TRUE_WORDS.has(String(value || "").trim().toLowerCase());
}

/** Синонимы заголовков: выгрузки называют одно и то же по-разному. */
const HEADER_MAP = {
  id: ["id", "код", "номер", "клиент id", "id клиента"],
  contactName: ["имя", "контакт", "фио", "name", "contactname", "директор"],
  email: ["email", "почта", "e-mail", "мейл"],
  phone: ["телефон", "phone", "тел", "моб"],
  amount: ["сумма", "amount", "долг", "к оплате"],
  currency: ["валюта", "currency"],
  subject: ["период", "услуга", "назначение", "subject", "за что"],
  dueDate: ["срок", "дата оплаты", "duedate", "оплатить до", "срок оплаты"],
  paid: ["оплачен", "оплачено", "paid", "статус оплаты"],
};

function mapHeader(name) {
  const n = stripBom(String(name || "")).trim().toLowerCase();
  for (const [field, aliases] of Object.entries(HEADER_MAP)) {
    if (aliases.includes(n)) return field;
  }
  return null;
}

/**
 * @returns {{rows: Array, unmappedHeaders: string[], badRows: number}}
 */
export function parseClientsCsv(text) {
  const clean = stripBom(String(text || "")).replace(/\r\n/g, "\n").trim();
  if (!clean) return { rows: [], unmappedHeaders: [], badRows: 0 };
  const lines = clean.split("\n").filter((l) => l.trim());
  const delim = detectDelimiter(lines[0]);
  const headerCells = splitLine(lines[0], delim);
  const fields = headerCells.map(mapHeader);
  const unmappedHeaders = headerCells.filter((h, i) => fields[i] === null && h);

  const rows = [];
  let badRows = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delim);
    const row = {};
    fields.forEach((f, i) => {
      if (!f) return;
      const raw = cells[i];
      if (f === "amount") row.amount = parseAmount(raw);
      else if (f === "dueDate") row.dueDate = parseDate(raw);
      else if (f === "paid") row.paid = parsePaid(raw);
      else if (raw) row[f] = raw;
    });
    if (!row.id || !row.dueDate) { badRows++; continue; }
    rows.push(row);
  }
  return { rows, unmappedHeaders, badRows };
}
