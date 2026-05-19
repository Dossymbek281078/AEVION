import type { Lsr, AiNotice } from "../../types";
import { findRate } from "../../corpus";

/**
 * Сценарий: монолитный бетон без опалубки.
 * Любые работы по монолитному бетону (фундамент, стены, перекрытия, колонны)
 * требуют установки опалубки. Студенты часто забывают позицию опалубки,
 * считая что её делает «арматурщик» или «бетонщик».
 *
 * Триггер: позиция с «бетон», «фундамент», «монолит», «перекрыт», «стен ж/б»
 * без сопровождающей позиции «опалубк».
 */
const CONCRETE_KEYWORDS = ["монолит", "фундамент", "перекрыт", "колонн", "стен ж/б", "стен ж-б"];
const SKIP_KEYWORDS = ["сборн", "плит сб"]; // сборный ж/б опалубку не требует

export function checkFormworkMissing(lsr: Lsr): AiNotice[] {
  const notices: AiNotice[] = [];

  // Все позиции с названиями
  const all: { posId: string; sectionId: string; title: string; code: string }[] = [];
  for (const section of lsr.sections) {
    for (const pos of section.positions) {
      const rate = findRate(pos.rateCode);
      if (!rate) continue;
      all.push({ posId: pos.id, sectionId: section.id, title: rate.title.toLowerCase(), code: pos.rateCode });
    }
  }

  for (const entry of all) {
    // Триггер: монолитный бетон
    const isMonolithic = CONCRETE_KEYWORDS.some((k) => entry.title.includes(k));
    const isPrefab = SKIP_KEYWORDS.some((k) => entry.title.includes(k));
    if (!isMonolithic || isPrefab) continue;

    // Есть ли в смете опалубка?
    const hasFormwork = all.some((other) => other.title.includes("опалубк"));
    if (hasFormwork) continue;

    notices.push({
      id: `formwork-missing-${entry.posId}`,
      severity: "error",
      scenario: "formwork-missing",
      context: { positionId: entry.posId, sectionId: entry.sectionId },
      title: "Не учтена опалубка для монолитного бетона",
      message:
        `Позиция «${entry.title}» — монолитная ж/б конструкция. ` +
        `В смете нет позиции на устройство и разборку опалубки. ` +
        `Опалубка — самостоятельная работа со своей расценкой и стоимостью.`,
      suggestion:
        `Добавьте позицию «Устройство опалубки» (фанера/щитовая Peri/Doka), ` +
        `измеритель — м² контактной поверхности. Также часто нужна позиция «Разборка опалубки».`,
      reference: "СН РК 5.03-37 «Бетонные и железобетонные конструкции», п. 8.1",
    });
  }
  return notices;
}
