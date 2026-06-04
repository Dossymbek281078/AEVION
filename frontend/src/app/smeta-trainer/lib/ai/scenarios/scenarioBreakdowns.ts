/**
 * Детерминированные разборы для отдельных сценариев — офлайн-«богатая панель»
 * по образцу проёмов (openingsAdvisor), но без геометрии: на данных самой ЛСР.
 *
 * Возвращает готовый текст разбора по конкретному замечанию или null, если для
 * сценария отдельного разбора нет (тогда UI показывает общий AI-разбор).
 * Чистый, без React — см. scenarioBreakdowns.test.ts.
 */

import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/** Сценарии с собственным детерминированным разбором (помимо проёмов). */
export const SCENARIOS_WITH_BREAKDOWN = new Set<string>([
  "double-count",
  "missing-coefficient",
]);

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

/** Готовый текст разбора по замечанию или null (тогда — общий AI-разбор). */
export function deterministicBreakdown(lsr: Lsr, notice: AiNotice): string | null {
  switch (notice.scenario) {
    case "double-count":
      return explainDoubleCount(lsr, notice);
    case "missing-coefficient":
      return explainMissingCoef(lsr, notice);
    default:
      return null;
  }
}
