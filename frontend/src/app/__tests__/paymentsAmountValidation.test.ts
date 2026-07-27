import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_MINOR, parseAmountMinor, parseLimit, webhookUrlError } from "../api/payments/v1/_lib";

/**
 * Публичный финтех-API AEVION принимал сумму по проверке
 * `typeof amount === "number" && amount > 0`. Этого мало, и не в теории:
 * `JSON.parse('{"amount":1e400}')` возвращает **Infinity** — тело без единого
 * нечислового символа проходило проверку и создавало ссылку на оплату с
 * бесконечной суммой. Дальше возврат «в пределах остатка» разрешал любую сумму,
 * потому что остаток тоже был бесконечным.
 *
 * Проверка на реальном разборе JSON, а не на заранее собранных числах:
 * иначе тест доказывал бы только то, что функция умеет сравнивать.
 */
describe("сумма в минорных единицах: только целое, положительное, конечное", () => {
  const amountFromJson = (raw: string) => parseAmountMinor(JSON.parse(raw).amount);

  it("нормальная сумма проходит", () => {
    expect(amountFromJson('{"amount":4900}')).toBe(4900);
  });

  it("переполнение в JSON превращается в Infinity и отбивается", () => {
    expect(JSON.parse('{"amount":1e400}').amount).toBe(Infinity); // контроль предпосылки
    expect(amountFromJson('{"amount":1e400}')).toBe(
      "amount must be a finite number (minor units).",
    );
  });

  it("дробные минорные единицы отбиваются", () => {
    expect(amountFromJson('{"amount":0.5}')).toBe(
      "amount must be a whole number of minor units (no fractions).",
    );
  });

  it("ноль и отрицательное отбиваются", () => {
    expect(typeof amountFromJson('{"amount":0}')).toBe("string");
    expect(typeof amountFromJson('{"amount":-100}')).toBe("string");
  });

  it("выше верхней границы отбивается, ровно граница проходит", () => {
    expect(parseAmountMinor(MAX_AMOUNT_MINOR)).toBe(MAX_AMOUNT_MINOR);
    expect(typeof parseAmountMinor(MAX_AMOUNT_MINOR + 1)).toBe("string");
  });

  it("строка, null и отсутствие поля отбиваются", () => {
    expect(typeof amountFromJson('{"amount":"4900"}')).toBe("string");
    expect(typeof amountFromJson('{"amount":null}')).toBe("string");
    expect(typeof amountFromJson("{}")).toBe("string");
  });
});

/**
 * `?limit=` разбирался как `Math.min(100, Number(raw))`. На `?limit=abc` это NaN,
 * а `slice(0, NaN)` возвращает пустой массив — API отвечал `count: 0`,
 * `has_more: false`, то есть «данных нет» вместо «параметр мусорный».
 * `?limit=-5` был не лучше: `slice(0, -5)` молча режет С КОНЦА.
 */
describe("limit из строки запроса: мусор — это ошибка, а не пустой список", () => {
  it("нормальное значение проходит и обрезается по максимуму", () => {
    expect(parseLimit("10", 25, 100)).toBe(10);
    expect(parseLimit("5000", 25, 100)).toBe(100);
  });

  it("отсутствие параметра даёт значение по умолчанию", () => {
    expect(parseLimit(null, 25, 100)).toBe(25);
    expect(parseLimit("", 25, 100)).toBe(25);
  });

  it("мусор больше не превращается в пустой список", () => {
    expect(Number("abc")).toBeNaN(); // контроль предпосылки
    expect([1, 2, 3].slice(0, Number("abc")).length).toBe(0); // так это выглядело
    expect(parseLimit("abc", 25, 100)).toBe("limit must be a whole number.");
  });

  it("отрицательное и ноль отбиваются, а не режут с конца", () => {
    expect([1, 2, 3].slice(0, -5).length).toBe(0); // так это выглядело
    expect(parseLimit("-5", 25, 100)).toBe("limit must be at least 1.");
    expect(parseLimit("0", 25, 100)).toBe("limit must be at least 1.");
  });

  it("дробное и бесконечность отбиваются", () => {
    expect(parseLimit("2.5", 25, 100)).toBe("limit must be a whole number.");
    expect(parseLimit("1e400", 25, 100)).toBe("limit must be a whole number.");
  });
});

/**
 * По адресу вебхука СЕРВЕР потом сам идёт запросом (`fetch(att.webhook_url)`),
 * поэтому проверки «начинается на http(s)» мало: она пропускала `127.0.0.1`,
 * `10.x`, `169.254.169.254` (метаданные облака) и `[::1]` — классический SSRF.
 */
describe("адрес вебхука: только публичный хост", () => {
  it("нормальный внешний адрес проходит", () => {
    expect(webhookUrlError("https://example.com/hook")).toBeNull();
    expect(webhookUrlError("http://api.partner.io:8080/aevion")).toBeNull();
  });

  it("петля и приватные сети отбиваются", () => {
    for (const u of [
      "http://127.0.0.1:4001/x",
      "http://localhost/x",
      "http://10.0.0.5/x",
      "http://192.168.1.1/x",
      "http://172.16.0.9/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/x",
      "http://svc.internal/x",
    ]) {
      expect(webhookUrlError(u), u).toBeTruthy();
    }
  });

  it("похожий публичный адрес приватным НЕ считается", () => {
    // 172.32.x вне диапазона 172.16–172.31, 10.x только как первый октет
    expect(webhookUrlError("http://172.32.0.1/x")).toBeNull();
    expect(webhookUrlError("http://110.0.0.5/x")).toBeNull();
  });

  it("не-строка и относительный адрес отбиваются", () => {
    expect(webhookUrlError(null)).toBeTruthy();
    expect(webhookUrlError("/hook")).toBeTruthy();
    expect(webhookUrlError("ftp://example.com/x")).toBeTruthy();
  });
});
