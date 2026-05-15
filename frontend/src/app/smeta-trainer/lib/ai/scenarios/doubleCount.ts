import type { Lsr, AiNotice } from "../../types";

/**
 * Сценарий: двойной счёт — одна и та же расценка встречается в двух или более разделах.
 * Типичная ошибка студентов при копировании позиций из черновика.
 */
export function checkDoubleCount(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  // Собираем карту: code → все позиции с их section
  const codeMap = new Map<string, { sectionId: string; sectionTitle: string; positionId: string }[]>();
  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      const existing = codeMap.get(pos.rateCode) ?? [];
      existing.push({ sectionId: section.id, sectionTitle: section.title, positionId: pos.id });
      codeMap.set(pos.rateCode, existing);
    }
  }

  for (const [code, entries] of codeMap.entries()) {
    if (entries.length < 2) continue;

    // Только если позиции из РАЗНЫХ разделов — это двойной счёт
    const sections = new Set(entries.map((e) => e.sectionId));
    if (sections.size < 2) continue;

    const sectionNames = [...new Set(entries.map((e) => e.sectionTitle))].join(", ");

    for (const entry of entries) {
      notices.push({
        id: `double-count-${code}-${entry.positionId}`,
        severity: "error",
        scenario: "double-count",
        context: { positionId: entry.positionId, sectionId: entry.sectionId },
        title: "Двойной счёт",
        message: `Расценка ${code} встречается в нескольких разделах: ${sectionNames}.`,
        suggestion: "Убедитесь, что работа считается только один раз. Удалите дублирующую позицию из одного из разделов.",
        reference: "Методическое письмо МСИ РК — исключение задвоения объёмов работ.",
      });
    }
  }

  return notices;
}
