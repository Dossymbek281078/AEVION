/**
 * Детерминированные разборы для отдельных сценариев — офлайн-«богатая панель»
 * по образцу проёмов (openingsAdvisor), но без геометрии: на данных самой ЛСР.
 *
 * Возвращает готовый текст разбора по конкретному замечанию или null, если для
 * сценария отдельного разбора нет (тогда UI показывает общий AI-разбор).
 * Чистый, без React — см. scenarioBreakdowns.test.ts.
 */

import type { Lsr, AiNotice } from "../../types";
import { findRate, findIndex, findOverhead } from "../../corpus";
import { MATERIAL_LOSS_RULES } from "./wasteFactorMissing";

/** Сценарии с собственным детерминированным разбором (помимо проёмов). */
export const SCENARIOS_WITH_BREAKDOWN = new Set<string>([
  "double-count",
  "missing-coefficient",
  "index-mismatch",
  "index-stale",
  "duplicate-material",
  "material-price-unjustified",
  "coef-double",
  "winter-surcharge",
  "height-coefficient",
  "waste-factor-missing",
  "overhead-mismatch",
  "index-double",
]);

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function rateTitle(code: string): string {
  return findRate(code)?.title ?? code;
}

function findPosition(lsr: Lsr, positionId?: string) {
  if (!positionId) return null;
  for (const s of lsr.sections) {
    const p = s.positions.find((x) => x.id === positionId);
    if (p) return { section: s, position: p };
  }
  return null;
}

/** Разбор двойного счёта: где именно дублируется расценка и что оставить. */
export function explainDoubleCount(lsr: Lsr, notice: AiNotice): string | null {
  const found = findPosition(lsr, notice.context.positionId);
  if (!found) return null;
  const code = found.position.rateCode;
  const places = lsr.sections
    .filter((s) => s.positions.some((p) => p.rateCode === code))
    .map((s) => s.title);
  if (places.length < 2) return null;

  const lines: string[] = [];
  lines.push(`**Расценка ${code} — «${rateTitle(code)}» — учтена в ${places.length} разделах:**`);
  for (const t of places) lines.push(`   • ${t}`);
  lines.push("");
  lines.push(`Одна и та же работа не может оплачиваться дважды. Оставьте позицию **только в одном**`);
  lines.push(`разделе (где она логически уместна), из остальных — удалите.`);
  lines.push("");
  lines.push(`Двойной счёт — первое, что ловит госэкспертиза: объёмы суммируются, смета завышается.`);
  return lines.join("\n");
}

/** Разбор забытого коэффициента: к какой позиции, почему и +15%. */
export function explainMissingCoef(lsr: Lsr, notice: AiNotice): string | null {
  const found = findPosition(lsr, notice.context.positionId);
  if (!found) return null;
  const { section, position } = found;
  const lines: string[] = [];
  lines.push(`**Позиция ${position.rateCode} — «${rateTitle(position.rateCode)}» (раздел «${section.title}») без коэффициента условий.**`);
  lines.push("");
  lines.push(`Работы в действующем (эксплуатируемом) здании ведутся в стеснённых условиях:`);
  lines.push(`доступ ограничен, темп ниже. По ЕНиР (прил. 1) применяется **К=1.15** ко всем работам.`);
  lines.push("");
  lines.push(`Это повышает стоимость работ позиции на **15%** (умножается ФОТ, ЭМ и материалы).`);
  lines.push(`Добавьте коэффициент «действующий-объект» кнопкой **+К** на строке позиции.`);
  lines.push("");
  lines.push(`Основание — приказ о режиме работы объекта во время ремонта (для школы №47 — каникулы).`);
  return lines.join("\n");
}

/** Разбор индекса: какой набор применён/не найден и чем грозит. */
export function explainIndex(lsr: Lsr, notice: AiNotice): string | null {
  if (lsr.method !== "базисно-индексный") return null;
  const idx = findIndex(lsr.indexRegion, lsr.indexQuarter);
  const lines: string[] = [];
  if (!idx) {
    lines.push(`**Индекс для «${lsr.indexRegion}», квартал «${lsr.indexQuarter}» — не найден в корпусе.**`);
    lines.push("");
    lines.push(`При базисно-индексном методе базисные цены умножаются на индекс пересчёта к текущему`);
    lines.push(`уровню. Если набора нет — текущая стоимость считается **×1**, то есть остаётся в ценах`);
    lines.push(`базисного года и оказывается заниженной в разы.`);
    lines.push("");
    lines.push(`Проверьте регион и квартал в шапке ЛСР. В учебном квартале действует **Алматы 2026-Q2**.`);
    return lines.join("\n");
  }
  lines.push(`**Применён индекс: ${lsr.indexRegion}, ${lsr.indexQuarter}.**`);
  lines.push("");
  lines.push(`Индекс умножает базисные ПЗ на коэффициент пересчёта к текущим ценам. Если квартал старше`);
  lines.push(`фактического периода работ — цены занижены, экспертиза потребует пересчёт на актуальный набор.`);
  lines.push("");
  lines.push(`Сверьте квартал индекса с датой уровня цен в шапке: они должны совпадать.`);
  return lines.join("\n");
}

/** Разбор дубля материала: какой материал, сколько раз, как чинить. */
export function explainDuplicateMaterial(lsr: Lsr, notice: AiNotice): string | null {
  const found = findPosition(lsr, notice.context.positionId);
  if (!found) return null;
  const { position } = found;
  const overrides = position.resourceOverrides ?? [];
  const counts = new Map<string, { name: string; n: number; price: number; qty: number }>();
  for (const r of overrides) {
    if (r.kind !== "материал") continue;
    const k = normName(r.name);
    const prev = counts.get(k);
    counts.set(k, { name: r.name, n: (prev?.n ?? 0) + 1, price: r.basePrice, qty: r.qtyPerUnit });
  }
  const dup = [...counts.values()].find((c) => c.n >= 2);
  if (!dup) return null;

  const lines: string[] = [];
  lines.push(`**Материал «${dup.name}» в позиции ${position.rateCode} учтён ${dup.n} раза.**`);
  lines.push("");
  lines.push(`Каждая строка материала умножается на объём позиции и попадает в ПЗ. Две одинаковые строки`);
  lines.push(`= двойная стоимость материала (≈ +${dup.price.toLocaleString("ru-RU")} ₸ на единицу нормы лишних).`);
  lines.push("");
  lines.push(`Оставьте **одну** строку «${dup.name}», задайте в ней суммарный расход на единицу нормы,`);
  lines.push(`остальные удалите в редакторе состава ресурсов.`);
  return lines.join("\n");
}

/** Разбор индивидуальной цены без обоснования (урок 2.6). */
export function explainMaterialPrice(lsr: Lsr, notice: AiNotice): string | null {
  const found = findPosition(lsr, notice.context.positionId);
  if (!found) return null;
  const { position } = found;
  const lines: string[] = [];
  lines.push(`**Индивидуальная цена материала в позиции ${position.rateCode} — без обоснования.**`);
  lines.push("");
  lines.push(`Методика РК допускает замену нормативной цены на текущую (индивидуальную), но **только`);
  lines.push(`при документальном обосновании**: прайс поставщика, коммерческое предложение, счёт или`);
  lines.push(`конъюнктурный анализ (минимум 3 КП с расчётом средней).`);
  lines.push("");
  lines.push(`Без ссылки на источник экспертиза вернёт смету. Добавьте обоснование в **заметку позиции**`);
  lines.push(`(например: «цена по КП ТОО “…” №… от …»).`);
  return lines.join("\n");
}

/** Разбор двойного коэффициента условий. */
export function explainCoefDouble(lsr: Lsr, notice: AiNotice): string | null {
  const found = findPosition(lsr, notice.context.positionId);
  if (!found) return null;
  const { position } = found;
  const coefs = position.coefficients ?? [];
  if (coefs.length < 2) return null;
  const product = coefs.reduce((m, c) => m * (c.value || 1), 1);

  const lines: string[] = [];
  lines.push(`**Позиция ${position.rateCode} — коэффициенты перемножаются в ${product.toFixed(3)}.**`);
  lines.push("");
  for (const c of coefs) lines.push(`   • ${c.kind} = ${c.value}${c.justification ? ` (${c.justification})` : ""}`);
  lines.push("");
  lines.push(`Признаки условий производства не суммируются, если описывают одно и то же (например,`);
  lines.push(`«стеснённые» и «действующий-объект» — это стеснённость на эксплуатируемом объекте).`);
  lines.push(`Повтор одного признака или перекрытие задваивает удорожание.`);
  lines.push("");
  lines.push(`Оставьте один коэффициент, точнее отражающий условия, либо подтвердите документом, что`);
  lines.push(`условия действительно независимы.`);
  return lines.join("\n");
}

/** Разбор зимнего удорожания: какая позиция и за что надбавка. */
export function explainWinter(lsr: Lsr, notice: AiNotice): string | null {
  const found = findPosition(lsr, notice.context.positionId);
  if (!found) return null;
  const { section, position } = found;
  const lines: string[] = [];
  lines.push(`**Позиция ${position.rateCode} — «${rateTitle(position.rateCode)}» (раздел «${section.title}») чувствительна к холоду.**`);
  lines.push("");
  lines.push(`Краски, грунтовки, штукатурные и клеевые растворы при t° < 0 °C требуют подогрева,`);
  lines.push(`противоморозных добавок, укрытий и снижают производительность. Эти затраты учитываются`);
  lines.push(`зимним удорожанием по **СН РК 8.02-09** (надбавка в % к СМР за зимний период).`);
  lines.push("");
  lines.push(`Если работы по этой позиции фактически велись в ноябре–марте при отрицательной температуре —`);
  lines.push(`добавьте зимний коэффициент. Если в отапливаемом помещении — оставьте заметку об этом.`);
  return lines.join("\n");
}

/** Разбор коэффициента высоты: к какой позиции и диапазон K. */
export function explainHeight(lsr: Lsr, notice: AiNotice): string | null {
  const found = findPosition(lsr, notice.context.positionId);
  if (!found) return null;
  const { section, position } = found;
  const lines: string[] = [];
  lines.push(`**Позиция ${position.rateCode} — «${rateTitle(position.rateCode)}» (раздел «${section.title}») без коэффициента высоты.**`);
  lines.push("");
  lines.push(`Работы на высоте от 4 м с лесов/подмостей идут медленнее (страховка, подача материала`);
  lines.push(`наверх, ограниченный фронт). По ЕНиР (общая часть, прил. 1, п. 4) применяется коэффициент:`);
  lines.push(`   • до 8 м — **K≈1.05**`);
  lines.push(`   • 8–15 м — **K≈1.10–1.15**`);
  lines.push(`   • выше 15 м — **K≈1.20**`);
  lines.push("");
  lines.push(`Если работы реально велись с лесов/подмостей — добавьте коэффициент «высота» кнопкой **+К**.`);
  lines.push(`Не путайте с самими лесами: их устройство — отдельная позиция.`);
  return lines.join("\n");
}

/** Разбор забытых потерь материала: какой материал и типовой % потерь. */
export function explainWaste(lsr: Lsr, notice: AiNotice): string | null {
  const found = findPosition(lsr, notice.context.positionId);
  if (!found) return null;
  const { position } = found;
  const rate = findRate(position.rateCode);
  const resources = position.resourceOverrides ?? rate?.resources ?? [];
  // Находим материал, попадающий под правило потерь.
  let hit: { name: string; qty: number; unit: string; loss: string; minRatio: number } | null = null;
  for (const r of resources) {
    if (r.kind !== "материал") continue;
    const low = r.name.toLowerCase();
    const rule = MATERIAL_LOSS_RULES.find((ru) => ru.name.some((k) => low.includes(k)));
    if (rule && r.unit === "м²" && r.qtyPerUnit > 0.95 && r.qtyPerUnit < rule.minRatio) {
      hit = { name: r.name, qty: r.qtyPerUnit, unit: r.unit, loss: rule.loss, minRatio: rule.minRatio };
      break;
    }
  }
  if (!hit) return null;

  const lines: string[] = [];
  lines.push(`**Материал «${hit.name}»: расход ${hit.qty} ${hit.unit} на 1 ${rate?.unit ?? "ед."} — без запаса на потери.**`);
  lines.push("");
  lines.push(`Часть материала уходит в бой, обрезку и подгонку. Норму расхода берут с учётом потерь:`);
  lines.push(`для этого материала типовой запас — **${hit.loss}**, то есть расход ≈ **${hit.minRatio.toFixed(2)} ${hit.unit}**.`);
  lines.push("");
  lines.push(`Увеличьте расход до ≥ ${hit.minRatio.toFixed(2)} ${hit.unit} в составе ресурсов, либо поясните`);
  lines.push(`в заметке, почему потери ниже типовых (крупный формат, прямые стены, заводская подгонка).`);
  lines.push("");
  lines.push(`Основание — ВСН 38-77 «Нормы расхода материалов» + СН РК 8.04-08.`);
  return lines.join("\n");
}

/** Разбор несоответствия НР/СП категории раздела. */
export function explainOverhead(lsr: Lsr, notice: AiNotice): string | null {
  const section = lsr.sections.find((s) => s.id === notice.context.sectionId);
  if (!section || section.positions.length === 0) return null;

  const catCounts = new Map<string, number>();
  for (const pos of section.positions) {
    const rate = findRate(pos.rateCode);
    if (!rate) continue;
    catCounts.set(rate.category, (catCounts.get(rate.category) ?? 0) + 1);
  }
  let dominantCat = section.category;
  let dominantCnt = 0;
  let total = 0;
  for (const [cat, cnt] of catCounts) {
    total += cnt;
    if (cnt > dominantCnt) {
      dominantCnt = cnt;
      dominantCat = cat as typeof section.category;
    }
  }
  if (total === 0) return null;
  const sectionOv = findOverhead(section.category);
  const dominantOv = findOverhead(dominantCat);

  const lines: string[] = [];
  lines.push(`**Раздел «${section.title}» — категория «${section.category}», но работы внутри другие.**`);
  lines.push("");
  lines.push(`${Math.round((dominantCnt / total) * 100)}% позиций раздела относятся к категории «${dominantCat}».`);
  if (sectionOv && dominantOv) {
    lines.push(`НР/СП считаются от ФОТ по категории раздела: НР=${sectionOv.overheadPct}% / СП=${sectionOv.profitPct}%,`);
    lines.push(`а для фактических работ норматив иной: НР=${dominantOv.overheadPct}% / СП=${dominantOv.profitPct}%.`);
  } else {
    lines.push(`НР/СП начисляются по нормативу категории раздела, а он не соответствует работам.`);
  }
  lines.push("");
  lines.push(`Разнесите позиции по разделам своих категорий — тогда НР/СП начислятся по верным нормативам.`);
  return lines.join("\n");
}

/** Разбор двойного индекса по материалу. */
export function explainIndexDouble(lsr: Lsr, notice: AiNotice): string | null {
  if (lsr.method !== "базисно-индексный") return null;
  const idx = findIndex(lsr.indexRegion, lsr.indexQuarter);
  const found = findPosition(lsr, notice.context.positionId);
  if (!idx || !found) return null;
  const { position } = found;
  const rate = findRate(position.rateCode);

  const lines: string[] = [];
  lines.push(`**Позиция ${position.rateCode} — цена материала уже в текущем уровне (метод базисно-индексный).**`);
  lines.push("");
  lines.push(`Логика базисно-индексного метода в две ступени:`);
  lines.push(`   1) в смету вносится **базисная** цена материала (уровень базового года);`);
  lines.push(`   2) калькулятор сам умножает её на **индекс материалов ×${idx.toMaterials}** → текущий уровень.`);
  lines.push("");
  lines.push(`Если сразу ввести текущую цену, шаг 2 применится к ней повторно — материал подорожает`);
  lines.push(`в ~${idx.toMaterials} раза против факта. Это завышение, которое сразу ловит экспертиза.`);
  lines.push("");
  lines.push(`Верните в состав ресурсов **базисную** цену${rate ? "" : ""}, либо переключите ЛСР на`);
  lines.push(`**ресурсный** метод (там цены сразу текущие и индекс не применяется).`);
  return lines.join("\n");
}

/** Готовый текст разбора по замечанию или null (тогда — общий AI-разбор). */
export function deterministicBreakdown(lsr: Lsr, notice: AiNotice): string | null {
  switch (notice.scenario) {
    case "double-count":
      return explainDoubleCount(lsr, notice);
    case "missing-coefficient":
      return explainMissingCoef(lsr, notice);
    case "index-mismatch":
    case "index-stale":
      return explainIndex(lsr, notice);
    case "duplicate-material":
      return explainDuplicateMaterial(lsr, notice);
    case "material-price-unjustified":
      return explainMaterialPrice(lsr, notice);
    case "coef-double":
      return explainCoefDouble(lsr, notice);
    case "winter-surcharge":
      return explainWinter(lsr, notice);
    case "height-coefficient":
      return explainHeight(lsr, notice);
    case "waste-factor-missing":
      return explainWaste(lsr, notice);
    case "overhead-mismatch":
      return explainOverhead(lsr, notice);
    case "index-double":
      return explainIndexDouble(lsr, notice);
    default:
      return null;
  }
}
