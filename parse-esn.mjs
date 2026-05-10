/**
 * Парсер ЭСН РК из docx-файлов → JSON для seed.json
 * Запуск: node parse-esn.mjs
 */
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ESN_DIR = "C:/Users/user/Downloads/esn_rk";

// Сборники для капремонта школы
const SBORNIKI = [
  { num: 11, file: "Сборник 11. Полы.docx",          category: "отделочные" },
  { num: 12, file: "Сборник 12. Кровли.docx",         category: "кровельные" },
  { num: 15, file: "Сборник 15. Отделочные работы.docx", category: "отделочные" },
  { num: 17, file: "Сборник 17. Внутренние инженерные системы водопровод, канал.docx", category: "сантехнические" },
  { num: 18, file: "Сборник 18. Внутренние инженерные системы Отопление (внутре.docx", category: "сантехнические" },
  { num: 21, file: "Сборник 21. Внутренние системы электроосвещение.docx", category: "электромонтажные" },
];

// Найдём полные имена файлов
function findFile(num) {
  const prefix = `ЭСН РК 8.04-01-2024 Элементные сметные нормы на строительные работы. Сборник ${num}.`;
  const result = execSync(`ls "${ESN_DIR}"`, { encoding: "utf8" });
  const match = result.split("\n").find((l) => l.includes(`Сборник ${num}.`));
  return match ? `${ESN_DIR}/${match.trim()}` : null;
}

function extractXml(filePath) {
  const escaped = filePath.replace(/'/g, "'\\''");
  return execSync(`unzip -p '${escaped}' word/document.xml 2>/dev/null`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
}

function stripTags(xml) {
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseTableRows(xml) {
  const rows = [];
  const tblMatches = [...xml.matchAll(/<w:tr[ >]/g)];
  // Упрощённо: вытащить все <w:tc> (ячейки) из каждой строки
  const rowRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  const cellRe = /<w:tc>[\s\S]*?<\/w:tc>/g;
  const textRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;

  let rowMatch;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const rowXml = rowMatch[0];
    const cells = [];
    let cellMatch;
    const cellIter = new RegExp(cellRe.source, "g");
    while ((cellMatch = cellIter.exec(rowXml)) !== null) {
      const cellXml = cellMatch[0];
      let text = "";
      let tMatch;
      const textIter = new RegExp(textRe.source, "g");
      while ((tMatch = textIter.exec(cellXml)) !== null) {
        text += tMatch[1];
      }
      cells.push(text.trim());
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

// Определяем тип ресурса по коду
function kindFromCode(code) {
  if (!code) return "материал";
  if (code.startsWith("003-") || code.startsWith("099-")) return "труд";
  if (code.startsWith("31") || code.startsWith("32") || code.startsWith("33")) return "машины";
  return "материал";
}

// Конвертируем строки таблицы в расценки
function tableRowsToRates(rows, sbornikNum, category) {
  const rates = [];
  let currentRate = null;
  let inResources = false;
  let resourceSection = "";

  for (const row of rows) {
    if (row.length === 0) continue;
    const first = row[0] || "";
    const second = row[1] || "";

    // Заголовок нормы (код таблицы)
    const tableMatch = first.match(/Таблица\s+(\d+[-–]\d+[-–]\d+[-–]\d+)/i)
      || first.match(/(\d{4}[-–]\d{4}[-–]\d{4})/);
    if (tableMatch) {
      if (currentRate && currentRate.resources.length > 0) rates.push(currentRate);
      const rawCode = tableMatch[1].replace(/–/g, "-");
      currentRate = {
        code: `Э${sbornikNum.toString().padStart(2, "0")}-${rawCode}`,
        title: second || first.replace(/Таблица\s+\S+\s*/i, "").trim(),
        category,
        unit: "",
        composition: [],
        resources: [],
        baseCostPerUnit: 0,
      };
      inResources = false;
      resourceSection = "";
      continue;
    }

    if (!currentRate) continue;

    // Единица измерения
    if (first.includes("м2") || first.includes("м²") || first.includes("100 м") ||
        first.includes("м3") || first.includes("шт") || first.includes("пог.м")) {
      if (!currentRate.unit) {
        currentRate.unit = first.replace(/[()]/g, "").trim();
      }
    }

    // Состав работ
    if (first.includes("Состав работ") || second.includes("Состав работ")) {
      inResources = false;
      continue;
    }
    if (first.match(/^\d+\./) && currentRate.composition.length < 5 && !inResources) {
      currentRate.composition.push(first.replace(/^\d+\.\s*/, ""));
    }

    // Ресурсы
    if (first.includes("ЗАТРАТЫ ТРУДА") || second.includes("Затраты труда рабочих")) {
      inResources = true; resourceSection = "труд"; continue;
    }
    if (first.includes("МАШИНЫ") || second.includes("Машины и механизм")) {
      inResources = true; resourceSection = "машины"; continue;
    }
    if (first.includes("МАТЕРИАЛЫ") || second.includes("Материалы, издел")) {
      inResources = true; resourceSection = "материал"; continue;
    }

    // Строка ресурса: код | название | ед. | норма
    if (inResources && row.length >= 4 && first.match(/^\d{3}-/)) {
      const qty = parseFloat((row[3] || "0").replace(",", ".")) || 0;
      if (qty > 0 && second) {
        const kind = resourceSection || kindFromCode(first);
        currentRate.resources.push({
          kind: kind === "труд" ? "труд" : kind === "машины" ? "машины" : "материал",
          code: first,
          name: second,
          unit: row[2] || "",
          qty,
        });
      }
    }
  }

  if (currentRate && currentRate.resources.length > 0) rates.push(currentRate);
  return rates;
}

// Главная функция
async function main() {
  const result = { byCollection: {} };
  let totalRates = 0;

  for (const sb of SBORNIKI) {
    console.log(`Обрабатываю Сборник ${sb.num}...`);
    try {
      const filePath = findFile(sb.num);
      if (!filePath) { console.log(`  ⚠ Файл не найден`); continue; }

      const xml = extractXml(filePath);
      const rows = parseTableRows(xml);
      const rates = tableRowsToRates(rows, sb.num, sb.category);
      result.byCollection[sb.num] = rates;
      totalRates += rates.length;
      console.log(`  ✓ ${rates.length} расценок`);
    } catch (e) {
      console.log(`  ✗ Ошибка: ${e.message?.slice(0, 100)}`);
      result.byCollection[sb.num] = [];
    }
  }

  writeFileSync(
    "C:/Users/user/aevion-smeta-trainer/esn-parsed.json",
    JSON.stringify(result, null, 2)
  );
  console.log(`\nИтого: ${totalRates} расценок → esn-parsed.json`);
}

main().catch(console.error);
