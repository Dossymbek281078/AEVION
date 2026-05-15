import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const pathsRaw = readFileSync("C:/Users/user/aevion-smeta-trainer/esn-paths.json", "utf8")
  .replace(/^﻿/, ""); // strip BOM
const paths = JSON.parse(pathsRaw);

const CAT_RU = {
  11: "отделочные", 12: "кровельные", 15: "отделочные",
  17: "сантехнические", 18: "сантехнические", 21: "электромонтажные"
};

function getSbornikNum(path) {
  const m = path.match(/Сборник (\d+)\./);
  return m ? parseInt(m[1]) : 0;
}

function getXml(filePath) {
  const esc = filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const ps = [
    "Add-Type -AssemblyName WindowsBase",
    `$p=[System.IO.Packaging.Package]::Open("${esc}",[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read)`,
    `$part=$p.GetPart([uri]"/word/document.xml")`,
    `$r=[System.IO.StreamReader]::new($part.GetStream(),[System.Text.Encoding]::UTF8)`,
    `$x=$r.ReadToEnd(); $r.Close(); $p.Close(); [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Write-Output $x`
  ].join("; ");
  return execSync(`powershell -Command "${ps}"`, { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });
}

function cellText(tcXml) {
  const parts = [];
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
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

    // Код нормы в первой ячейке (формат 1234-5678-9012)
    const tm = c0.match(/(\d{4}[-–]\d{4}[-–]\d{4})/);
    if (tm) {
      if (cur && cur.resources.length) rates.push(cur);
      const rawCode = tm[1].replace(/–/g, "-");
      cur = {
        code: `Э${String(num).padStart(2, "0")}-${rawCode}`,
        title: c1 || c0.replace(/\S+\s*/, "").trim(),
        category,
        unit: "",
        composition: [],
        resources: [],
        baseCostPerUnit: 0,
      };
      section = "";
      continue;
    }
    if (!cur) continue;

    // Единица нормы
    if (!cur.unit && /100\s*м|^\s*м[²2³3]?\s*$|шт|пог\.м|маш\.ч/.test(c0)) {
      cur.unit = c0.replace(/[()]/g, "").trim();
    }

    // Состав работ (текстовые строки)
    if (/Состав работ/i.test(c0 + c1)) { section = ""; continue; }
    if (/^\d+\./.test(c0) && cur.composition.length < 5 && !section) {
      const s = c0.replace(/^\d+\.\s*/, "");
      if (s.length > 3) cur.composition.push(s);
    }

    // Разделы ресурсов
    if (/ЗАТРАТЫ ТРУДА|Затраты труда рабоч/i.test(c0 + c1)) { section = "труд"; continue; }
    if (/МАШИНЫ И МЕХАНИЗМ|Машины и механизм/i.test(c0 + c1)) { section = "машины"; continue; }
    if (/МАТЕРИАЛЫ|Материалы, издел/i.test(c0 + c1)) { section = "материал"; continue; }

    // Строка ресурса
    if (section && /^\d{3}-/.test(c0) && row.length >= 4 && c1) {
      const qty = parseFloat(c3.replace(",", "."));
      if (qty > 0) {
        cur.resources.push({ kind: inferKind(c0, section), code: c0, name: c1, unit: c2, qty });
      }
    }
  }
  if (cur && cur.resources.length) rates.push(cur);
  return rates;
}

const results = {};
let total = 0;

for (const fp of paths) {
  const num = getSbornikNum(fp);
  if (!num) continue;
  process.stdout.write(`Sb${num}... `);
  try {
    const xml = getXml(fp);
    const rows = parseRows(xml);
    const rates = parseRates(rows, num, CAT_RU[num] || "общестроительные");
    results[num] = rates;
    total += rates.length;
    console.log(`${rates.length} rates`);
  } catch (e) {
    console.log(`ERR: ${e.message?.slice(0, 80)}`);
    results[num] = [];
  }
}

writeFileSync(
  "C:/Users/user/aevion-smeta-trainer/esn-parsed.json",
  JSON.stringify({ byCollection: results }, null, 2)
);
console.log(`\nTotal: ${total} rates saved to esn-parsed.json`);
