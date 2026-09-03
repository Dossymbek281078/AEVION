import { describe, test, expect } from "vitest";
import { собратьCustomId } from "../src/lib/payment/paypalProvider";

/**
 * `custom_id` PayPal всегда разбираем — и теряет поле, а не смысл.
 *
 * 🔴 Находка соседнего окна 02.09.2026, проверена в файле. Было так:
 *
 *     JSON.stringify({ reference, ...customData }).slice(0, 127)
 *
 * Срез СТРОКИ JSON. Перевалило за 127 — наружу уезжает обрезанный, то есть
 * НЕВАЛИДНЫЙ JSON. Разбор в вебхуке падает в запасную ветку и возвращает
 * `{ reference: customId }` — кусок JSON целиком вместо ссылки заказа.
 *
 * Теряется не «поле аналитики», а ВЫДАЧА КУПЛЕННОГО: деньги пришли, привязать
 * их не к чему. И проявилось бы это не сразу, а ровно тогда, когда в
 * `customData` добавят ещё одно поле — то есть при обычной работе и молча.
 *
 * Порядок починки был важен и выбран не мной: сперва безопасное усечение,
 * потом добавление канала. Обратный порядок и есть тот случай, который ломает.
 */

describe("custom_id PayPal переживает переполнение", () => {
  test("обычный случай: всё влезает, поля на месте", () => {
    const s = собратьCustomId("tier_lite_monthly", { channel: "tt", module: "devhub" });
    const j = JSON.parse(s);
    expect(j.reference).toBe("tier_lite_monthly");
    expect(j.channel).toBe("tt");
    expect(j.module).toBe("devhub");
    expect(s.length).toBeLessThanOrEqual(127);
  });

  test("переполнение: JSON остаётся ЦЕЛЫМ, лишнее поле не едет", () => {
    // Ради этого случая всё и переписано. Раньше здесь получался обрезок.
    const s = собратьCustomId("tier_enterprise_annual", {
      channel: "x".repeat(60),
      module: "y".repeat(60),
      extra: "z".repeat(60),
    });
    expect(s.length, "предел провайдера превышен").toBeLessThanOrEqual(127);
    const j = JSON.parse(s); // упадёт, если JSON обрезан — это и есть проверка
    expect(j.reference, "ссылка заказа потеряна — платёж не к чему привязать").toBe(
      "tier_enterprise_annual",
    );
  });

  test("контроль: старый способ на тех же данных давал НЕразбираемое", () => {
    // Без этого контроля проверка выше могла бы проходить оттого, что данные
    // и так помещаются, а не оттого, что мы починили усечение.
    const поСтарому = JSON.stringify({
      reference: "tier_enterprise_annual",
      channel: "x".repeat(60),
      module: "y".repeat(60),
      extra: "z".repeat(60),
    }).slice(0, 127);
    expect(поСтарому.length).toBe(127);
    expect(() => JSON.parse(поСтарому), "старый способ вдруг разбирается — контроль негоден").toThrow();
  });

  test("пустые значения не занимают место", () => {
    const s = собратьCustomId("tier_lite_monthly", { channel: "", module: undefined });
    const j = JSON.parse(s);
    expect(Object.keys(j)).toEqual(["reference"]);
  });

  test("ссылка длиннее предела отдаётся голой строкой, а не обрезком JSON", () => {
    // Запасная ветка разбора в вебхуке вернёт её как reference — это верный
    // ответ. Обрезок JSON вернулся бы как мусор.
    const длинная = "tier_" + "a".repeat(200);
    const s = собратьCustomId(длинная);
    expect(s.length).toBeLessThanOrEqual(127);
    expect(s.startsWith("tier_"), "отдан обрезок JSON вместо ссылки").toBe(true);
    expect(s.startsWith("{"), "отдан обрезок JSON вместо ссылки").toBe(false);
  });
});
