import { describe, it, expect } from "vitest";
import { buildPlatformWaitlistEmail, модулиБезДняОткрытия } from "../src/lib/constitutionBrevo";

/**
 * Письмо подписчику обязано отражать, РАДИ ЧЕГО человек подписался.
 *
 * Замер 27.08.2026: подписчик со страницы протокола долголетия получал общий
 * текст «платформа выпускает модули по одному, напишем в день запуска
 * следующего». Он подписался ради протокола и уже забрал его бесплатно —
 * письмо не подтверждало ни того, что он получил, ни следующего шага.
 *
 * Тестов на это письмо не было вовсе, поэтому расхождение источника и текста
 * ничем не удерживалось. Здесь закрыты все три ветки, а не только новая:
 * иначе следующая правка тихо сломает соседнюю.
 */
describe("письмо подписчику отражает источник подписки", () => {
  it("работающий вход: говорит «открыт», а НЕ «ждите запуска»", () => {
    const m = buildPlatformWaitlistEmail("a@b.co", "longevity");
    expect(m.subject).toContain("Протокол долголетия");
    expect(m.htmlContent).toContain("уже открыт для вас");
    expect(m.htmlContent).toContain("aevion.app/longevity");
    // Главное утверждение: обещания ждать быть НЕ должно.
    expect(m.htmlContent).not.toContain("напишем вам в день запуска");
    expect(m.htmlContent.toLowerCase()).not.toContain("открываем по плану");
    expect(m.textContent).toContain("уже открыт");
  });

  it("работающий вход: ссылка ведёт на страницу продукта, не на /go", () => {
    const m = buildPlatformWaitlistEmail("a@b.co", "longevity-upsell");
    // Префикс с дефисом должен попадать в ту же ветку — форма шлёт разные метки.
    expect(m.htmlContent).toContain("aevion.app/longevity");
    expect(m.subject).toContain("открыт");
  });

  it("не выдумывает скидок и условий: цену решает основатель", () => {
    const m = buildPlatformWaitlistEmail("a@b.co", "longevity");
    for (const forbidden of ["скидк", "%", "бесплатно навсегда", "промокод"]) {
      expect(m.htmlContent.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("модуль, который ещё не открыт: письмо честно ждёт и ведёт на его страницу", () => {
    /*
     * 🔴 Модуль выбирается ПО ПРИЗНАКУ, а не по имени, и это главное в тесте.
     *
     * Раньше здесь стоял `cyberchess` как пример «ещё не открытого». 30.09.2026
     * он открылся — и тест покраснел, хотя в коде не поменялось ничего: вчера
     * утверждение было верным, сегодня нет. Фикстура, названная именем,
     * протухает вместе с календарём и краснеет на исправной системе, а к
     * вечно красной проверке перестают присматриваться.
     *
     * Признак «нет отметки openedAt» от даты не зависит: это утверждение о
     * том, что открытие мы ещё не подтверждали.
     */
    const [модуль] = модулиБезДняОткрытия();
    expect(
      модуль,
      "в таблице не осталось ни одного модуля без дня открытия — значит эта " +
        "проверка больше ничего не проверяет, и её надо не чинить, а убирать",
    ).toBeTruthy();

    const m = buildPlatformWaitlistEmail("a@b.co", модуль.prefix);
    expect(m.subject).toContain(модуль.name);
    expect(m.htmlContent, "неоткрытый модуль обязан обещать письмо, а не звать внутрь").toContain(
      "как только откроем",
    );
    expect(m.htmlContent, "письмо не ведёт на страницу самого модуля").toContain(
      модуль.page.replace("https://", ""),
    );
  });

  it("КОНТРОЛЬ: у ОТКРЫТОГО модуля текст другой — иначе проверка выше пуста", () => {
    // Без этого «письмо содержит „как только откроем“» верно и при сломанной
    // развилке: если бы фраза стояла у всех, тест выше был бы всегда зелёным.
    const m = buildPlatformWaitlistEmail("a@b.co", "devhub");
    expect(m.htmlContent, "открытый модуль по-прежнему говорит, что закрыт").not.toContain(
      "как только откроем",
    );
  });

  it("общий вход /go: остаётся прежний текст про следующий модуль", () => {
    const m = buildPlatformWaitlistEmail("a@b.co", "go");
    expect(m.htmlContent).toContain("aevion.app/go");
    expect(m.htmlContent).toContain("Платформа выпускает модули по одному");
    expect(m.htmlContent).toContain("странице aevion.app/go");
  });

  it("источник не указан: письмо всё равно собирается и ссылается на главную", () => {
    const m = buildPlatformWaitlistEmail("a@b.co");
    expect(m.subject.length).toBeGreaterThan(0);
    expect(m.htmlContent).toContain("главной странице aevion.app");
  });

  it("письмо адресовано верно, а адрес в ТЕЛЕ не печатается", () => {
    const m = buildPlatformWaitlistEmail("kto@to.kz", "longevity");
    expect(m.to[0].email).toBe("kto@to.kz");
    // Первая версия этого теста требовала адрес в теле письма и падала. Код
    // оказался прав, а тест нет: `unsubBlock` печатает ссылку отписки, а без
    // настроенного секрета — контакт для отписки. Адрес получателя в теле не
    // нужен и лучше, что его там нет.
    expect(m.htmlContent).not.toContain("kto@to.kz");
    expect(m.htmlContent).toContain("Отписаться");
  });
});
