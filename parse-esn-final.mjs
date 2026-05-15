/**
 * Final ЭСН РК parser: reads XML nodes in document order.
 * Norm headers are in paragraphs ("Таблица 1115-0101-0101 - Title")
 * Resource rows are in following table rows (code | name | unit | qty)
 */
import { readFileSync, writeFileSync } from "fs";

const XML_DIR = "C:/Users/user/aevion-smeta-trainer/esn-xml";
const OUT     = "C:/Users/user/aevion-smeta-trainer/esn-parsed.json";

const CAT = {
  11: "отделочные", 12: "кровельные", 15: "отделочные",
  17: "сантехнические", 18: "сантехнические", 21: "электромонтажные"
};

// Extract text from a node's <w:t> tags
function nodeText(nodeXml) {
  const parts = [];
  const re = /<w:t(?:[ >][^>]*)?>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(nodeXml)) !== null) parts.push(m[1]);
  return parts.join("").trim();
}

// Extract all cells from a <w:tr>
function rowCells(trXml) {
  const cells = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m;
  while ((m = re.exec(trXml)) !== null) cells.push(nodeText(m[0]));
  return cells;
}

// Document-order node stream: yields {pos, kind:"para"|"row", text|cells}
function* streamNodes(xml) {
  // Match paragraphs (outside tables) and table rows, track position
  const nodeRe = /(<w:p[ >][\s\S]*?<\/w:p>|<w:tr[ >][\s\S]*?<\/w:tr>)/g;
  let m;
  while ((m = nodeRe.exec(xml)) !== null) {
    const tag = m[1];
    if (tag.startsWith("<w:p")) {
      const t = nodeText(tag);
      if (t.length > 0) yield { pos: m.index, kind: "para", text: t };
    } else {
      const cells = rowCells(tag);
      if (cells.some(c => c.length > 0)) yield { pos: m.index, kind: "row", cells };
    }
  }
}

function inferKind(code) {
  if (/^003-|^099-/.test(code)) return "труд";
  if (/^3\d{2}-/.test(code)) return "машины";
  return "материал";
}

function parseCollection(xml, num, category) {
  const rates = [];
  let cur = null;
  let inResSection = "";
  let compMode = false;

  for (const node of streamNodes(xml)) {
    if (node.kind === "para") {
      const t = node.text;

      // Norm header: "Таблица 1115-0101-0101 - Work name"
      const normM = t.match(/Таблица\s+(\d{4}-\d{4}-\d{4}(?:-\d+)?)\s*[-–—]\s*(.+)/i);
      if (normM) {
        if (cur && cur.resources.length > 0) rates.push(cur);
        cur = {
          code: `ЭСН${num}-${normM[1]}`,
          title: normM[2].trim().replace(/\s+/g, " "),
          category,
          unit: "",
          composition: [],
          resources: [],
          baseCostPerUnit: 0,
          esn_ref: `ЭСН РК 8.04-01-2024 Сб.${num}`,
        };
        inResSection = "";
        compMode = false;
        continue;
      }

      if (!cur) continue;

      // Единица нормы (стандартная строка типа "м2 поверхности облицовки" или "100 м2 стен")
      const unitM = t.match(/^(100\s*м[²2]?\s*\S*|м[²2³3]?|шт\.?|пог\.м|м|т\b|кг|км|маш\.?[-–]ч|чел\.?[-–]ч)/i);
      if (unitM && !cur.unit && t.length < 60) {
        cur.unit = t;
        continue;
      }

      // Состав работ
      if (/Состав работ/i.test(t)) { compMode = true; inResSection = ""; continue; }
      if (compMode && /^\d+\./.test(t)) {
        const s = t.replace(/^\d+\.\s*/, "");
        if (s.length > 3 && s.length < 300 && cur.composition.length < 6) cur.composition.push(s);
        continue;
      }

      // Разделы ресурсов в параграфах
      if (/Затраты труда рабочих|ЗАТРАТЫ ТРУДА/i.test(t)) { inResSection = "труд"; compMode = false; continue; }
      if (/Затраты труда машинистов/i.test(t)) { inResSection = "труд"; continue; }
      if (/Машины и механизм/i.test(t)) { inResSection = "машины"; compMode = false; continue; }
      if (/Материалы, издел/i.test(t)) { inResSection = "материал"; compMode = false; continue; }

    } else if (node.kind === "row" && cur) {
      const [c0 = "", c1 = "", c2 = "", c3 = ""] = node.cells;

      // Detect section headers in table rows too
      if (/Затраты труда рабочих/i.test(c1)) { inResSection = "труд"; continue; }
      if (/Машины и механизм/i.test(c1)) { inResSection = "машины"; continue; }
      if (/Материалы, издел/i.test(c1)) { inResSection = "материал"; continue; }

      // Состав работ строки в таблице
      if (/Состав работ/i.test(c0 + c1)) { compMode = true; inResSection = ""; continue; }
      if (compMode && /^\d+\./.test(c0) && cur.composition.length < 6) {
        const s = c0.replace(/^\d+\.\s*/, "");
        if (s.length > 3 && s.length < 300) cur.composition.push(s);
        continue;
      }

      // Resource row: 3-digit-dash code in first cell
      if (/^\d{3}-\d/.test(c0) && c1.length > 2) {
        const qty = parseFloat(c3.replace(",", "."));
        if (qty > 0 && qty < 100000) {
          const kind = inResSection || inferKind(c0);
          cur.resources.push({ kind, code: c0, name: c1.replace(/\s+/g, " "), unit: c2, qty });
          compMode = false;
        }
      }

      // Единица нормы в таблице (часто в строке с "м2" в первой ячейке)
      if (!cur.unit && c0 && /^(100\s*м|м[²2³3]?$|шт|пог\.м|т$|кг$)/i.test(c0.trim())) {
        cur.unit = c0.trim();
      }
    }
  }

  if (cur && cur.resources.length > 0) rates.push(cur);
  return rates;
}

// Main
const results = {};
let total = 0;
const files = ["sb11", "sb12", "sb15", "sb17", "sb18", "sb21"];

for (const fname of files) {
  const num = parseInt(fname.replace("sb", ""));
  process.stdout.write(`Сборник ${num}... `);
  const xml = readFileSync(`${XML_DIR}/${fname}.xml`, "utf8");
  const rates = parseCollection(xml, num, CAT[num]);
  results[num] = rates;
  total += rates.length;
  console.log(`${rates.length} расценок`);
  if (rates.length > 0) {
    console.log(`  Пример: ${rates[0].code} | ${rates[0].title.slice(0, 60)} | ${rates[0].unit} | ${rates[0].resources.length} ресурсов`);
  }
}

writeFileSync(OUT, JSON.stringify({ byCollection: results }, null, 2));
console.log(`\nИтого: ${total} расценок → esn-parsed.json`);
