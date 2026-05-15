import type { Lsr, AiNotice } from "../../types";

/** Зимнее удорожание — работы с красками/растворами в ноябре–марте без спецзамечания. */
export function checkWinterSurcharge(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  const WINTER_SENSITIVE = ["краск", "грунт", "шпатлёв", "раствор", "штукатур", "клей", "мастик"];
  const NOW_MONTH = new Date().getMonth() + 1; // 1-12
  const IS_WINTER = NOW_MONTH <= 3 || NOW_MONTH >= 11;

  if (!IS_WINTER) return notices;

  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      const isSensitive = WINTER_SENSITIVE.some((kw) =>
        pos.rateCode.toLowerCase().includes(kw) || (pos.note ?? "").toLowerCase().includes(kw)
      );
      if (!isSensitive) continue;

      const hasWinterCoef = pos.coefficients.some((c) => c.kind === "выходные");
      if (hasWinterCoef) continue;

      notices.push({
        id: `winter-${pos.id}`,
        severity: "warning",
        scenario: "winter-surcharge",
        context: { positionId: pos.id, sectionId: section.id },
        title: "Возможно зимнее удорожание",
        message: "Работы с красками, растворами и клеями при отрицательных температурах требуют учёта зимнего удорожания по СН РК 8.02-09.",
        suggestion: "Проверьте температурный режим. Если работы вели при t° < 0°C — добавьте зимний коэффициент.",
        reference: "СН РК 8.02-09 «Дополнительные затраты при производстве работ в зимнее время»",
      });
    }
  }

  return notices;
}
