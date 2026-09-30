import { describe, it, expect } from "vitest";
import { planPhrase, buildPlatformWaitlistEmail } from "../src/lib/constitutionBrevo";

/**
 * Письмо подписчику не имеет права говорить «напишем, как только откроем»
 * про модуль, который УЖЕ открыт.
 *
 * Замер 30.09.2026: обещанный день (20 сентября) прошёл у восьми модулей, и
 * всем восьми письмо отвечало «Обещали 20 сентября — напишем, как только
 * откроем». Среди них devhub и multichat, чьи страницы запуска в тот же день
 * печатали «Уже открыто», qright с текстом «Реестр открыт уже сейчас» и
 * qventure, где человек ровно что получил разбор бесплатно и без входа.
 *
 * Стоит это не вежливости: человек оставил адрес на работающем продукте и
 * получил письмо, что продукт закрыт. Следующего шага после такого письма нет.
 */
const ПОСЛЕ = new Date("2026-09-30T09:00:00Z");
const ДО = new Date("2026-09-01T09:00:00Z");

function тело(источник: string): string {
  const письмо = buildPlatformWaitlistEmail("probe@aevion.app", источник) as unknown as {
    text?: string; textContent?: string; html?: string;
  };
  return String(письмо.text ?? письмо.textContent ?? письмо.html ?? "").replace(/<[^>]+>/g, " ");
}

describe("письмо не закрывает открытые модули", () => {
  it("модуль с отметкой открытия зовёт внутрь, а не ждать", () => {
    const ф = planPhrase("20 сентября", Date.UTC(2026, 8, 20), true, ПОСЛЕ, Date.UTC(2026, 8, 20), "https://aevion.app/qventure");
    expect(ф, "открытый модуль по-прежнему обещает написать позже").not.toContain("напишем");
    expect(ф).toContain("уже открыт");
    expect(ф, "не названо, куда идти").toContain("https://aevion.app/qventure");
  });

  it("КОНТРОЛЬ: без отметки открытия текст прежний", () => {
    const ф = planPhrase("20 сентября", Date.UTC(2026, 8, 20), true, ПОСЛЕ);
    expect(ф).toContain("Обещали 20 сентября");
    expect(ф).toContain("напишем");
  });

  it("КОНТРОЛЬ: до дня открытия — прежнее обещание, а не «уже открыт»", () => {
    const ф = planPhrase("20 сентября", Date.UTC(2026, 8, 20), true, ДО, Date.UTC(2026, 8, 20));
    expect(ф, "модуль объявлен открытым РАНЬШЕ своего дня").not.toContain("уже открыт");
    expect(ф).toContain("Открываем по плану");
  });

  it("живые источники подписки больше не получают «как только откроем»", () => {
    for (const источник of ["devhub", "multichat", "qright", "qventure-result"]) {
      const т = тело(источник);
      expect(т.length, источник + ": письмо прочитано пустым — проверка слепа").toBeGreaterThan(50);
      expect(т, источник + ": письмо говорит, что открытый модуль ещё закрыт").not.toContain("как только откроем");
    }
  });

  it("КОНТРОЛЬ: модуль без отметки (bureau) по-прежнему честно ждёт", () => {
    const т = тело("bureau");
    expect(т.length).toBeGreaterThan(50);
    expect(т, "bureau не открыт, и письмо обязано это говорить").toContain("как только откроем");
  });
});
