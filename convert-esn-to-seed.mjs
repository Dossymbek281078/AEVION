/**
 * Конвертация ЭСН РК в формат seed.json (учебные расценки).
 * Цены берутся из учебных базисных ставок (ССЦ не подключён),
 * базисные ставки приближённые — для образовательных целей.
 */
import { readFileSync, writeFileSync } from "fs";

const parsed = JSON.parse(readFileSync("C:/Users/user/aevion-smeta-trainer/esn-parsed.json", "utf8"));

// Учебные базисные ставки (тнг/ед.) — приблизительно
// до получения ССЦ РК — используем реалистичные учебные значения
const BASE_PRICES = {
  труд_default: 250,      // тнг/чел.-ч (средний разряд ~4)
  труд_machine: 320,      // тнг/чел.-ч машиниста
  machine_default: 800,   // тнг/маш.-ч (малый механизм)
  // Материалы — по коду-префиксу
  "211": 12000,   // Земля, щебень (м³)
  "212": 15000,   // Растворы (м³)
  "213": 8000,    // Бетон (м³)
  "214": 9500,    // Железобетон (м³)
  "215": 4500,    // Стекло (м²)
  "216": 1800,    // Цемент (кг)
  "217": 50,      // Вода (м³)
  "218": 200,     // Ветошь, вспомогательные (кг)
  "219": 2500,    // Лесоматериалы (м³)
  "221": 85000,   // Кирпич (1000 шт)
  "231": 35000,   // Трубы стальные (т)
  "232": 48000,   // Трубы чугунные (т)
  "233": 800,     // Трубы ПВХ (м)
  "234": 1200,    // Трубы PPR (м)
  "235": 4500,    // Краска (кг)
  "236": 3000,    // Клеи, мастики (кг)
  "237": 1500,    // Грунтовки (кг)
  "238": 1200,    // Шпатлёвка (кг)
  "239": 800,     // Штукатурка (кг)
  "241": 1800,    // Провода кабели (м)
  "242": 2500,    // Кабель силовой (м)
  "261": 4500,    // Плитка кер. (м²)
  "262": 3200,    // Линолеум (м²)
  "263": 2800,    // Ламинат (м²)
  "264": 2200,    // Паркет (м²)
  "271": 3500,    // Рулонная кровля (м²)
  "272": 18000,   // Теплоизоляция (м²)
  "281": 25000,   // Санприборы (шт)
  "282": 12000,   // Арматура сантехническая (шт)
  "291": 8500,    // Розетки, выключатели (шт)
  "292": 15000,   // Светильники (шт)
  "293": 12000,   // Щиты, панели (шт)
  "314": 950,     // Малые механизмы (маш.-ч)
  "315": 4800,    // Краны (маш.-ч)
  "316": 2500,    // Автотранспорт (маш.-ч)
  "317": 1200,    // Растворонасосы, сварка (маш.-ч)
  default_mat: 1500,
};

function getMaterialPrice(code) {
  const prefix = code.slice(0, 3);
  return BASE_PRICES[prefix] || BASE_PRICES.default_mat;
}

function getMachinePrice(code) {
  const prefix = code.slice(0, 3);
  return BASE_PRICES[prefix] || BASE_PRICES.machine_default;
}

function getLaborPrice(name) {
  if (/машинист/i.test(name)) return BASE_PRICES.труд_machine;
  return BASE_PRICES.труд_default;
}

// Категория по сборнику и тексту нормы
function getCategory(num, title) {
  const t = title.toLowerCase();
  if (num === 12) return "кровельные";
  if (num === 17 || num === 18) return "сантехнические";
  if (num === 21) return "электромонтажные";
  if (num === 11 || /пол|стяжк|линолеум|ламинат|плитк|покрыт/i.test(t)) return "отделочные";
  if (/штукатур|шпатлёв|маляр|окраск|облиц|плитк|потолок|гипс/i.test(t)) return "отделочные";
  if (/демонтаж|разборк|снятие/i.test(t)) return "демонтажные";
  if (/кладка|кирпич|перегород/i.test(t)) return "общестроительные";
  if (/трубопровод|труб|задвижк|кран.*водо/i.test(t)) return "сантехнические";
  if (/кабел|провод|светильник|розетк|щит|выключател/i.test(t)) return "электромонтажные";
  if (/кровл|рубероид|гидроиз/i.test(t)) return "кровельные";
  return "общестроительные";
}

// Единица нормы: нормализация
function normalizeUnit(raw) {
  if (!raw) return "100 м²";
  const u = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (/100\s*м[²2]/.test(u)) return "100 м²";
  if (/100\s*м[³3]/.test(u)) return "100 м³";
  if (/100\s*м/.test(u)) return "100 м";
  if (/^м[²2]/.test(u)) return "м²";
  if (/^м[³3]/.test(u)) return "м³";
  if (/^м\b/.test(u)) return "м";
  if (/шт/.test(u)) return "шт";
  if (/т\b/.test(u)) return "т";
  if (/кг/.test(u)) return "кг";
  if (/пог\.?м/.test(u)) return "м";
  return raw.split(" ").slice(0, 2).join(" ");
}

// Конвертируем ресурс ЭСН → ресурс seed.json
function convertResource(r) {
  let basePrice;
  let kind;
  if (r.kind === "труд") {
    kind = "труд";
    basePrice = getLaborPrice(r.name);
  } else if (r.kind === "машины") {
    kind = "машины";
    basePrice = getMachinePrice(r.code);
  } else {
    kind = "материал";
    basePrice = getMaterialPrice(r.code);
  }

  // Нормализация единицы ресурса
  const unitMap = { "чел.-ч": "чел.-ч", "маш.-ч": "маш.-ч", "м3": "м³", "м2": "м²", "м": "м", "кг": "кг", "т": "т", "шт": "шт", "шт.": "шт" };
  const unit = unitMap[r.unit] || r.unit;

  const res = { kind, name: r.name, qtyPerUnit: r.qty, unit, basePrice };
  if (kind === "машины") res.machinistWageRate = 280;
  return res;
}

const RELEVANT_KEYWORDS = [
  // Отделка (кр.15)
  "окраск", "шпатлёв", "штукатур", "облиц", "плиткой", "плитки", "плитка",
  "грунтовк", "потолок", "подвесной", "гкл", "гипсокартон",
  // Полы (сб.11)
  "стяжк", "цементн", "линолеум", "ламинат", "напольн", "покрытие пола",
  "плинтус", "наливной", "паркет",
  // Кровля (сб.12)
  "кровл", "рулонн", "наплавляем", "гидроиз", "пароиз", "утеплен",
  "минерал", "уклон", "парапет", "обрешетк",
  // Сантехника (сб.17,18)
  "трубопровод", "труб", "радиатор", "отоплен", "унитаз", "умывальник",
  "ванн", "душев", "смеситель", "задвижк", "вентил",
  "водоснабж", "канализац", "хвс", "гвс",
  // Электро (сб.21)
  "кабел", "провод", "розетк", "выключател", "светильник", "щит",
  "автоматическ", "осветительн", "электропроводк",
  // Демонтаж
  "демонтаж", "разборк", "снятие", "вскрытие",
  // Строительные работы
  "кладка", "перегород", "окна", "двери", "блок",
];

function isRelevant(rate) {
  const t = (rate.title + " " + rate.category).toLowerCase();
  return RELEVANT_KEYWORDS.some(kw => t.includes(kw));
}

// Сборка расценок
const seedRates = [];
let skipped = 0;

for (const [numStr, rates] of Object.entries(parsed.byCollection)) {
  const num = parseInt(numStr);
  for (const r of rates) {
    if (r.resources.length === 0) { skipped++; continue; }
    if (!isRelevant(r)) { skipped++; continue; }

    const category = getCategory(num, r.title);
    const resources = r.resources.map(convertResource);
    const baseCostPerUnit = resources.reduce((s, res) => s + res.qtyPerUnit * res.basePrice, 0);

    // Обрезаем слишком длинные названия
    const title = r.title.length > 120 ? r.title.slice(0, 117) + "..." : r.title;

    seedRates.push({
      code: r.code,
      title,
      category,
      unit: normalizeUnit(r.unit),
      composition: r.composition.slice(0, 5),
      resources,
      baseCostPerUnit: Math.round(baseCostPerUnit),
      esn_ref: r.esn_ref,
    });
  }
}

console.log(`Отфильтровано: ${seedRates.length} расценок (пропущено ${skipped})`);
console.log("По категориям:");
const byCat = {};
for (const r of seedRates) byCat[r.category] = (byCat[r.category] || 0) + 1;
for (const [k, v] of Object.entries(byCat)) console.log(`  ${k}: ${v}`);

// Записываем только отфильтрованное для ручной проверки
writeFileSync(
  "C:/Users/user/aevion-smeta-trainer/esn-seed-rates.json",
  JSON.stringify(seedRates, null, 2)
);
console.log("\nesn-seed-rates.json готов.");
