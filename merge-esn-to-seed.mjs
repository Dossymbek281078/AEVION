/**
 * Merges ЭСН rates into seed.json
 * Scales resource prices up to учебные market approximations
 * (базисные prices × correction factor until ССЦ РК is connected)
 */
import { readFileSync, writeFileSync } from "fs";

const seedPath  = "C:/Users/user/aevion-smeta-trainer/frontend/src/app/smeta-trainer/data/seed.json";
const esnPath   = "C:/Users/user/aevion-smeta-trainer/esn-seed-rates.json";

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const esnRates = JSON.parse(readFileSync(esnPath, "utf8"));

// Correction factors: ЭСН базисные → учебные текущие цены
// Based on: ЭСН 2024 базис × Алматы индекс ≈ current
const PRICE_SCALE = {
  труд: 3.5,       // 250 тнг × 3.5 ≈ 875 тнг/чел-ч (current ~800-1000)
  машины: 4.0,     // 800 тнг × 4.0 ≈ 3200 тнг/маш-ч
  материал: 5.0,   // varies wildly — rough average
};

// Better material price overrides based on resource name
function scaledMaterialPrice(name, unit, basePrice) {
  const n = name.toLowerCase();
  if (/цемент/i.test(n)) return { кг: 85, т: 85000 }[unit] ?? basePrice * 5;
  if (/раствор/i.test(n)) return { м3: 18000, "м³": 18000 }[unit] ?? basePrice * 4;
  if (/плитк|плиты керам/i.test(n)) return basePrice * 6;
  if (/краска|эмаль|лак/i.test(n)) return { кг: 450 }[unit] ?? basePrice * 5;
  if (/грунтовк/i.test(n)) return { кг: 180, л: 150 }[unit] ?? basePrice * 4;
  if (/шпатлёв|шпатлев/i.test(n)) return { кг: 120 }[unit] ?? basePrice * 4;
  if (/штукатурк/i.test(n)) return { кг: 95, т: 95000 }[unit] ?? basePrice * 4;
  if (/линолеум/i.test(n)) return { "м²": 3800, м2: 3800 }[unit] ?? basePrice * 5;
  if (/ламинат/i.test(n)) return { "м²": 3200, м2: 3200 }[unit] ?? basePrice * 5;
  if (/рубероид|наплавляем|кровельн/i.test(n)) return { "м²": 1400, м2: 1400 }[unit] ?? basePrice * 5;
  if (/минерал.*вата|минват|минплит/i.test(n)) return { "м²": 2500, м2: 2500 }[unit] ?? basePrice * 6;
  if (/труба.*сталь|сталь.*труб/i.test(n)) return { м: 3200, т: 1200000 }[unit] ?? basePrice * 5;
  if (/труба.*pp|ppr|полипропилен/i.test(n)) return { м: 850 }[unit] ?? basePrice * 5;
  if (/радиатор/i.test(n)) return basePrice * 4;
  if (/кабель|провод/i.test(n)) return { м: 420 }[unit] ?? basePrice * 5;
  if (/вода/i.test(n)) return { "м³": 60, м3: 60 }[unit] ?? 60;
  if (/ветошь/i.test(n)) return { кг: 250 }[unit] ?? 250;
  return basePrice * PRICE_SCALE.материал;
}

// Scale resource prices
function scaleRate(r) {
  const scaledResources = r.resources.map(res => {
    let price;
    if (res.kind === "труд") {
      price = res.basePrice * PRICE_SCALE.труд;
      if (/машинист/i.test(res.name)) price = 350;  // explicit override
      else price = 280 + Math.random() * 80;         // 280-360 чел-ч учебная
      price = Math.round(price);
    } else if (res.kind === "машины") {
      price = Math.round(res.basePrice * PRICE_SCALE.машины);
      if (price < 800) price = 800;
      if (price > 15000) price = 15000;
    } else {
      price = Math.round(scaledMaterialPrice(res.name, res.unit, res.basePrice));
      if (price < 50) price = 50;
    }
    const scaled = { ...res, basePrice: price };
    if (res.kind === "машины") scaled.machinistWageRate = 300;
    return scaled;
  });

  const newBase = scaledResources.reduce((s, r) => s + r.qtyPerUnit * r.basePrice, 0);
  return { ...r, resources: scaledResources, baseCostPerUnit: Math.round(newBase) };
}

// Filter to most useful: keep top 200 by relevance, deduplicate similar titles
const PRIORITY_KEYWORDS = [
  "штукатурк", "шпатлёв", "окраск", "облиц.*плитк", "плитк.*пол",
  "стяжк", "линолеум", "ламинат", "подвесной.*потолок", "гкл",
  "наплавляем", "пароизоляц", "утеплен.*кровл", "трубопровод.*отоплен",
  "радиатор", "ванн", "унитаз", "умывальник", "трубопровод.*хвс",
  "кабел.*гофр", "розетк", "выключател", "светильник", "щит",
  "демонтаж.*штукатурк", "демонтаж.*покрытия", "демонтаж.*плитк",
  "перегородк", "оконн.*блок", "дверн.*блок",
];

function priorityScore(r) {
  const t = r.title.toLowerCase();
  let score = 0;
  for (const kw of PRIORITY_KEYWORDS) {
    if (new RegExp(kw).test(t)) score += 10;
  }
  if (r.unit && r.unit !== "") score += 2;
  if (r.composition.length > 0) score += 1;
  return score;
}

// Sort by relevance, take top N per category
const MAX_PER_CAT = { отделочные: 80, кровельные: 25, сантехнические: 30, электромонтажные: 35, общестроительные: 20, демонтажные: 15 };
const byCat = {};
for (const r of esnRates) {
  if (!byCat[r.category]) byCat[r.category] = [];
  byCat[r.category].push(r);
}

let selected = [];
for (const [cat, rs] of Object.entries(byCat)) {
  const sorted = [...rs].sort((a, b) => priorityScore(b) - priorityScore(a));
  const max = MAX_PER_CAT[cat] || 20;
  selected.push(...sorted.slice(0, max).map(scaleRate));
}

console.log(`Selected ${selected.length} ЭСН rates`);
const selByCat = {};
for (const r of selected) selByCat[r.category] = (selByCat[r.category]||0)+1;
console.log(selByCat);

// Existing manually-crafted rates (keep them, they have better calibrated prices)
const existingCodes = new Set(seed.rates.map(r => r.code));

// Add ЭСН rates that don't conflict with existing codes
const newRates = selected.filter(r => !existingCodes.has(r.code));
console.log(`Adding ${newRates.length} new rates (${selected.length - newRates.length} skipped: already exist)`);

// Update seed
const updatedSeed = {
  ...seed,
  _meta: { ...seed._meta, version: "0.3.0", esnSource: "ЭСН РК 8.04-01-2024 Сб.11,12,15,17,18,21", lastReview: "2026-05-02" },
  rates: [...seed.rates, ...newRates],
};

writeFileSync(seedPath, JSON.stringify(updatedSeed, null, 2));
console.log(`\nSeed updated: ${seed.rates.length} → ${updatedSeed.rates.length} rates`);
