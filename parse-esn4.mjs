import { readFileSync, writeFileSync, readdirSync } from "fs";

const XML_DIR = "C:/Users/user/aevion-smeta-trainer/esn-xml";
const CAT_RU = {
  11: "отделочные", 12: "кровельные", 15: "отделочные",
  17: "сантехнические", 18: "сантехнические", 21: "электромонтажные"
};

function cellText(tcXml) {
  const parts = [];
  // IMPORTANT: <w:t> only — NOT <w:tc>, <w:tcPr>, <w:tr> etc.
  // Use word boundary: must be <w:t> or <w:t space/attr>
  const re = /<w:t(?:[ >][^>]*)?>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(tcXml)) !== null) parts.push(m[1]);
  return parts.join("").trim();
}

function parseRows(xml) {
  const rows = [];
  const trRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  let trM;
  while ((trM = trRe.exec(xml)) !== null) {
    const cells = [];
    const tcRe = /<w:tc>[\s\S]*?<\/w:tc>/g;
    let tcM;
    while ((tcM = tcRe.exec(trM[0])) !== null) cells.push(cellText(tcM[0]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function inferKind(code, section) {
  if (section) return section;
  if (/^003-|^099-/.test(code)) return "труд";
  if (/^3\d{2}-/.test(code)) return "машины";
  return "материал";
}

function parseRates(rows, num, category) {
  const rates = [];
  let cur = null;
  let section = "";

  for (const row of rows) {
    const [c0 = "", c1 = "", c2 = "", c3 = ""] = row;

    // Код нормы (4-4-4 или 4-4-4-1)
    const tm = c0.match(/(\d{4}[-–]\d{4}[-–]\d{4}(?:-\d+)?)/);
    if (tm) {
      if (cur && cur.resources.length) rates.push(cur);
      const rawCode = tm[1].replace(/–/g, "-");
      cur = {
        code: `ЭСН-${String(num).padStart(2, "0")}-${rawCode}`,
        title: c1 || c0.replace(/\S+\s*/, "").trim(),
        category,
        unit: "",
        composition: [],
        resources: [],
        baseCostPerUnit: 0,
        esn: `8.04-01-2024 Сб.${num}`,
      };
      section = "";
      continue;
    }
    if (!cur) continue;

    // Единица нормы
    if (!cur.unit) {
      const unitMatch = c0.match(/^(100\s*м[²2]?|м[²2]|м[³3]|м|шт|пог\.м|маш-ч|чел-ч|т\b|кг|км)$/);
      if (unitMatch) cur.unit = c0.replace(/[()]/g, "").trim();
    }

    // Состав работ
    if (/Состав работ/i.test(c0 + c1)) { section = ""; continue; }
    if (/^\d+\./.test(c0) && cur.composition.length < 5 && !section) {
      const s = c0.replace(/^\d+\.\s*/, "");
      if (s.length > 3 && s.length < 200) cur.composition.push(s);
    }

    // Разделы ресурсов
    if (/ЗАТРАТЫ ТРУДА|Затраты труда рабоч/i.test(c0 + c1)) { section = "труд"; continue; }
    if (/МАШИНЫ И МЕХАНИЗМ|Машины и механизм/i.test(c0 + c1)) { section = "машины"; continue; }
    if (/МАТЕРИАЛЫ|Материалы, издел/i.test(c0 + c1)) { section = "материал"; continue; }

    // Строка ресурса: код начинается с 3 цифр-дефис
    if (section && /^\d{3}-\d/.test(c0) && row.length >= 4 && c1) {
      const qty = parseFloat(c3.replace(",", "."));
      if (qty > 0 && qty < 100000) {
        cur.resources.push({ kind: inferKind(c0, section), code: c0, name: c1, unit: c2, qty });
      }
    }
  }
  if (cur && cur.resources.length) rates.push(cur);
  return rates;
}

const results = {};
let total = 0;

const files = readdirSync(XML_DIR).filter(f => f.endsWith(".xml"));
for (const file of files) {
  const num = parseInt(file.replace("sb", "").replace(".xml", ""));
  process.stdout.write(`Сборник ${num}... `);
  const xml = readFileSync(`${XML_DIR}/${file}`, "utf8");
  const rows = parseRows(xml);
  const rates = parseRates(rows, num, CAT_RU[num] || "общестроительные");
  results[num] = rates;
  total += rates.length;
  console.log(`${rates.length} расценок (${rows.length} строк)`);
}

writeFileSync(
  "C:/Users/user/aevion-smeta-trainer/esn-parsed.json",
  JSON.stringify({ byCollection: results }, null, 2)
);
console.log(`\nИтого: ${total} расценок → esn-parsed.json`);
