/**
 * Сторож: платный тариф не выдаётся по строке в адресе.
 *
 * 27.08.2026 на живом сайте `/cyberchess?paid=ultimate` включал Ultimate
 * любому посетителю. Ни подписи, ни токена, ни запроса к серверу — параметра
 * адреса было достаточно. Тест-активацию к тому моменту уже закрыли за
 * отладочный флаг «ради готовности к запуску», а рядом оставалась дверь,
 * про которую знал каждый, кто видел ссылку возврата из /bank.
 *
 * Проверяется ДВА разных утверждения, и оба нужны:
 *   1) чистая логика (`verifyPaymentRequest`) — что вердикт верный, включая
 *      третий исход «не смогли спросить»;
 *   2) сама страница — что она этот вердикт СПРАШИВАЕТ. Без второго логику
 *      можно оставить зелёной, вернув выдачу тарифа прямо по параметру:
 *      модуль останется правильным, а дверь откроется снова.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPaymentRequest } from "../billing";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(HERE, "..", "page.tsx"), "utf8");

function reply(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("вердикт оплаты", () => {
  it("оплаченный счёт — paid", async () => {
    vi.stubGlobal("fetch", async () => reply(200, { status: "paid" }));
    expect(await verifyPaymentRequest("tok")).toBe("paid");
  });

  it("проставленная дата оплаты тоже считается оплатой", async () => {
    vi.stubGlobal("fetch", async () => reply(200, { paidAt: "2026-08-27T10:00:00Z" }));
    expect(await verifyPaymentRequest("tok")).toBe("paid");
  });

  it("ожидающий счёт — не оплачен", async () => {
    vi.stubGlobal("fetch", async () => reply(200, { status: "pending" }));
    expect(await verifyPaymentRequest("tok")).toBe("unpaid");
  });

  it("выдуманный токен — не оплачен, а не «не знаю»", async () => {
    // 404 означает, что такого счёта нет. Выдумать строку может кто угодно,
    // и отвечать на это «не смогли проверить» значило бы оставить лазейку.
    vi.stubGlobal("fetch", async () => reply(404, {}));
    expect(await verifyPaymentRequest("выдуманный")).toBe("unpaid");
  });

  it("пустой токен даже не идёт в сеть", async () => {
    const f = vi.fn(async () => reply(200, { status: "paid" }));
    vi.stubGlobal("fetch", f);
    // Оба вида пустоты: "" и строка из пробелов. Мутационная проверка нашла,
    // что вторая ветка не охранялась — а именно она приходит из адресной
    // строки, где ?token= легко оказывается пробелом или %20.
    for (const пусто of ["", "   ", "\t"]) {
      expect(await verifyPaymentRequest(пусто), `токен ${JSON.stringify(пусто)}`).toBe("unpaid");
    }
    expect(f, "спрашивали сервер про пустой токен").not.toHaveBeenCalled();
  });

  it("сервер не ответил — «не знаю», и это НЕ оплата", async () => {
    // Третий исход. Если бы «не знаю» приравняли к paid, тариф выдавала бы
    // любая сетевая заминка; если к unpaid — заплативший получил бы отказ.
    vi.stubGlobal("fetch", async () => reply(503, {}));
    expect(await verifyPaymentRequest("tok")).toBe("unknown");
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    expect(await verifyPaymentRequest("tok")).toBe("unknown");
  });

  it("ответ без понятного статуса — «не знаю», а не оплата", async () => {
    vi.stubGlobal("fetch", async () => reply(200, {}));
    expect(await verifyPaymentRequest("tok")).toBe("unknown");
  });
});

describe("страница спрашивает сервер, а не адресную строку", () => {
  it("тариф не выдаётся прямо по параметру paid", () => {
    // ЗАКРЕПЛЯЕМ ОТСУТСТВИЕ ИМЕННО ТОЙ ФОРМЫ, которая была дырой: присвоение
    // owned[paid] в той же строке, где читается параметр. Проверка «в файле
    // есть слово verifyPaymentRequest» была бы зелёной и на сломанном коде —
    // имя осталось бы в строке импорта.
    const блок = PAGE.slice(
      PAGE.indexOf('const paid=params.get("paid")'),
      PAGE.indexOf('const fenParam=params.get("fen")'),
    );
    expect(блок.length, "контроль: блок возврата из оплаты не найден в странице").toBeGreaterThan(
      200,
    );
    expect(блок, "тариф выдаётся до проверки оплаты").toContain("verifyPaymentRequest(");
    // Выдача owned обязана стоять ПОСЛЕ вердикта, а не до него.
    const выдача = блок.indexOf("owned:{...c.owned,[paid]:true}");
    const проверка = блок.indexOf("verifyPaymentRequest(");
    expect(выдача, "контроль: выдача тарифа не найдена").toBeGreaterThan(-1);
    expect(проверка, "проверка оплаты стоит после выдачи тарифа").toBeLessThan(выдача);
    expect(блок, "выдача не привязана к вердикту «оплачено»").toContain('verdict==="paid"');
  });

  it("токен счёта не остаётся в адресной строке", () => {
    const блок = PAGE.slice(
      PAGE.indexOf('const paid=params.get("paid")'),
      PAGE.indexOf('const fenParam=params.get("fen")'),
    );
    expect(блок).toContain('searchParams.delete("token")');
  });

  it("самораздача тарифа закрыта отладочным флагом", () => {
    // Соседняя дверь того же класса: кнопка тест-активации. Она уже закрыта,
    // и сторож держит её закрытой — открывали её однажды не со зла, а потому
    // что «временно для QA».
    expect(PAGE, "тест-активация снова видна обычному посетителю").toContain(
      'window.localStorage.getItem("aevion_debug")==="1"',
    );
  });
});
