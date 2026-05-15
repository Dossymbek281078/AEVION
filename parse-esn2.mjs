import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

// Read file paths from PowerShell output
const pathsRaw = readFileSync("C:/Users/user/aevion-smeta-trainer/esn-paths.json", "utf8");
const paths = JSON.parse(pathsRaw);

// Map sbornik number to category
const CATEGORIES = { 11:"otdelochnie", 12:"krovelnye", 15:"otdelochnie", 17:"santehnicheskie", 18:"santehnicheskie", 21:"elektromon" };
const CAT_RU = { 11:"отделочные", 12:"кровельные", 15:"отделочные", 17:"сантехнические", 18:"сантехнические", 21:"электромонтажные" };

function getSbornikNum(path) {
  const m = path.match(/\. Сборник (\d+)\./);
  return m ? parseInt(m[1]) : 0;
}

// Extract XML from docx (it's a ZIP)
function extractDocxXml(filePath) {
  const { execSync } = await import("child_process");
  // Use PowerShell to extract since bash has encoding issues
  const escaped = filePath.replace(/"/g, '\\"');
  const ps = `
Add-Type -AssemblyName WindowsBase
$pkg = [System.IO.Packaging.Package]::Open("${escaped}", [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read)
$part = $pkg.GetPart([uri]"/word/document.xml")
$reader = [System.IO.StreamReader]::new($part.GetStream(), [System.Text.Encoding]::UTF8)
$xml = $reader.ReadToEnd()
$reader.Close()
$pkg.Close()
$xml
  `.trim();
  return execSync(`powershell -Command "${ps.replace(/\n/g, "; ")}"`, { encoding: "utf8", maxBuffer: 100*1024*1024 });
}

function getTexts(tcXml) {
  const texts = [];
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(tcXml)) !== null) texts.push(m[1]);
  return texts.join("").trim();
}

function parseRows(xml) {
  const rows = [];
  const trRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  const tcRe = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let trM;
  while ((trM = trRe.exec(xml)) !== null) {
    const cells = [];
    let tcM;
    const tcRe2 = new RegExp(tcRe.source, "g");
    while ((tcM = tcRe2.exec(trM[0])) !== null) cells.push(getTexts(tcM[0]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function inferKind(code, section) {
  if (section) return section;
  if (/^003-|^099-/.test(code)) return "труд";
  if (/^3[0-9]{2}-/.test(code)) return "машины";
  return "материал";
}

function parseRates(rows, sbornikNum, category) {
  const rates = [];
  let cur = null;
  let section = "";

  for (const row of rows) {
    const c0 = row[0] || "", c1 = row[1] || "", c2 = row[2] || "", c3 = row[3] || "";

    // Код нормы
    const tm = c0.match(/(\d{4}[-–]\d{4}[-–]\d{4})/);
    if (tm) {
      if (cur && cur.resources.length) rates.push(cur);
      const code = `Э${String(sbornikNum).padStart(2,"0")}-${tm[1].replace(/–/g,"-")}`;
      cur = { code, title: c1 || c0.replace(/\S+\s*/, "").trim(), category, unit: "", composition: [], resources: [], baseCostPerUnit: 0 };
      section = "";
      continue;
    }
    if (!cur) continue;

    // Единица нормы
    if (!cur.unit && /100\s*м[²2]?|^\s*м[²2]?\s*$|шт|пог|м[³3]?/.test(c0)) cur.unit = c0.replace(/[()]/g,"").trim();

    // Состав работ
    if (/Состав работ/.test(c0+c1)) { section = ""; continue; }
    if (/^\d+\./.test(c0) && cur.composition.length < 4 && !section) {
      const s = c0.replace(/^\d+\.\s*/,""); if (s.length > 3) cur.composition.push(s);
    }

    // Разделы ресурсов
    if (/ЗАТРАТЫ ТРУДА|Затраты труда рабоч/.test(c0+c1)) { section = "труд"; continue; }
    if (/МАШИНЫ|Машины и механизм/.test(c0+c1)) { section = "машины"; continue; }
    if (/МАТЕРИАЛЫ|Материалы, издел/.test(c0+c1)) { section = "материал"; continue; }

    // Строка ресурса
    if (section && /^\d{3}-/.test(c0) && row.length >= 4) {
      const qty = parseFloat(c3.replace(",","."));
      if (qty > 0 && c1) {
        cur.resources.push({ kind: inferKind(c0, section), code: c0, name: c1, unit: c2, qty });
      }
    }
  }
  if (cur && cur.resources.length) rates.push(cur);
  return rates;
}

const { execSync } = await import("child_process");
const results = {};
let total = 0;

for (const fp of paths) {
  const num = getSbornikNum(fp);
  if (!num) continue;
  process.stdout.write(`Sbornik ${num}... `);
  try {
    const escaped = fp.replace(/"/g, '\\"');
    const ps = `Add-Type -AssemblyName WindowsBase; $pkg=[System.IO.Packaging.Package]::Open("${escaped}",[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read); $part=$pkg.GetPart([uri]"/word/document.xml"); $reader=[System.IO.StreamReader]::new($part.GetStream(),[System.Text.Encoding]::UTF8); $xml=$reader.ReadToEnd(); $reader.Close(); $pkg.Close(); $xml`;
    const xml = execSync(`powershell -Command "${ps}"`, { encoding: "utf8", maxBuffer: 100*1024*1024 });
    const rows = parseRows(xml);
    const rates = parseRates(rows, num, CAT_RU[num] || "общестроительные");
    results[num] = rates;
    total += rates.length;
    console.log(`${rates.length} расценок`);
  } catch(e) {
    console.log(`ERR: ${e.message?.slice(0,80)}`);
    results[num] = [];
  }
}

writeFileSync("C:/Users/user/aevion-smeta-trainer/esn-parsed.json", JSON.stringify({ byCollection: results }, null, 2));
console.log(`\nTotal: ${total} rates -> esn-parsed.json`);
