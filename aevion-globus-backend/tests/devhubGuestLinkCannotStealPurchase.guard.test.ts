import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Связывание гостя с покупкой не даёт присвоить чужую.
 *
 * Проверки читают ИСХОДНИК, а не поведение: путь требует настоящей базы и
 * отправки письма, а поднимать то и другое в наборе дороже, чем польза.
 * Поэтому здесь закрепляются четыре РЕШЕНИЯ, каждое из которых при отмене
 * даёт тихую дыру, а не падение:
 *
 *   1. связь пишется только после подтверждения по почте;
 *   2. ссылка действительна лишь в браузере, откуда её запросили;
 *   3. секрет хранится хешем, не открытым текстом;
 *   4. ответ формы одинаков при любом исходе (иначе она — способ узнать,
 *      кто у нас покупал).
 */
const LIB = join(__dirname, "..", "src", "lib", "devhubGuestLink.ts");
const ROUTE = join(__dirname, "..", "src", "routes", "devhub.ts");
const L = readFileSync(LIB, "utf8");
const R = readFileSync(ROUTE, "utf8");

// Комментарии вырезаем: в них ОБЪЯСНЯЕТСЯ правило теми же словами, и
// проверка ловила собственное объяснение (поймано 31.08.2026).
const NL = String.fromCharCode(10);
function stripComments(src: string): string {
  return src.split(NL).filter((l) => !l.trim().startsWith("//")).join(NL);
}

describe("связывание гостя с покупкой", () => {
  test("контроль: оба файла прочитаны и это они", () => {
    // Пустое чтение сделало бы все проверки ниже зелёными молча.
    expect(L.length, "модуль связывания не прочитан").toBeGreaterThan(2000);
    expect(R.length, "маршруты не прочитаны").toBeGreaterThan(10000);
    expect(L, "читается не тот модуль").toContain("confirmGuestLink");
    expect(R, "ручка запроса ссылки не найдена").toContain("/guest/link-request");
  });

  test("связь пишется только в подтверждении, а не в запросе", () => {
    const at = L.indexOf("export async function confirmGuestLink");
    expect(at, "функции подтверждения нет").toBeGreaterThan(0);
    const before = L.slice(0, at);
    expect(
      before.includes("DevHubGuestEmail"),
      "запись в DevHubGuestEmail стоит ДО подтверждения: тогда любой, кто " +
        "знает адрес покупателя, присвоит покупку без письма",
    ).toBe(false);
    expect(
      L.slice(at).includes("DevHubGuestEmail"),
      "подтверждение не связывает гостя с покупкой — ручка работает впустую",
    ).toBe(true);
  });

  test("ссылка работает только в браузере, откуда запрошена", () => {
    expect(
      L,
      "нет сверки guestId: письмо, попавшее к постороннему, привязало бы " +
        "покупку к ЕГО браузеру",
    ).toContain("row.guestId !== guestId");
  });

  test("секрет хранится хешем, а не открытым текстом", () => {
    expect(L, "токен не хешируется перед записью").toContain("bcrypt.hash");
    expect(L, "подтверждение не сверяет хеш").toContain("bcrypt.compare");
    const insert = L.indexOf('INSERT INTO "DevHubGuestLinkToken"');
    expect(insert, "вставки токена нет").toBeGreaterThan(0);
    const stmt = L.slice(insert, insert + 300);
    expect(stmt, "в таблицу пишется не хеш").toContain("tokenHash");
  });

  test("ответ формы одинаков при отправке и при отсутствии покупки", () => {
    const at = R.indexOf("/guest/link-request");
    const body = stripComments(R.slice(at, at + 2000));
    // Ровно один текст на оба исхода. Отдельная ветка со своим сообщением
    // вернула бы возможность перебирать адреса.
    expect(body, "нейтрального ответа нет").toContain("LINK_NEUTRAL");
    expect(
      body.includes("no_purchase") && body.includes("sent"),
      "исходы «отправлено» и «покупки нет» разведены по разным ответам — " +
        "форма стала способом узнать, кто покупал",
    ).toBe(false);
  });

  test("отказ базы и транспорта не выдаётся за успех", () => {
    // НЕ «слово есть в файле»: так проверка выживала мутацию, где отказ
    // чтения возвращал "no_purchase", а слово оставалось в другом месте.
    // Смотрим ИМЕННО тот catch, который оборачивает чтение тарифа.
    const readAt = L.indexOf("tier = await paidTierFor(email);");
    expect(readAt, "чтения тарифа нет — файл изменился").toBeGreaterThan(0);
    // Границу берём до законной ветки «покупки нет» (она про ОТСУТСТВИЕ
    // покупки, а не про отказ базы). Окно на 700 символов захватывало её и
    // краснело на исправном коде — ложная тревога, поймана сразу.
    const tierBranch = L.indexOf("if (!tier)", readAt);
    expect(tierBranch, "ветки «покупки нет» не найдено").toBeGreaterThan(readAt);
    const readCatch = L.slice(readAt, tierBranch);
    expect(
      readCatch,
      "отказ чтения тарифа превращается в «покупки нет»: платящий останется " +
        "без доступа, и снаружи это неотличимо от честного отказа",
    ).toContain('return "storage_down"');
    expect(
      readCatch,
      "в обработчике отказа стоит «покупки нет» — отказ базы выдан за ответ",
    ).not.toContain('return "no_purchase"');
    expect(L, "нет отдельного исхода на неработающий транспорт").toContain("transport_down");
    const at = R.indexOf("/guest/link-request");
    const body = stripComments(R.slice(at, at + 2000));
    expect(body, "отказ отдаётся как успех — человек будет ждать письма зря").toContain("503");
  });

  test("форма отправки писем ограничена по частоте", () => {
    // Ограничитель обязан стоять НА САМОЙ ручке отправки. Проверка «слово
    // есть в файле» выживала мутацию, где его снимали с этой ручки, а на
    // соседней он оставался.
    expect(
      R,
      "у формы отправки писем нет ограничителя: без него она рассылает " +
        "письма на любые чужие адреса нашими руками",
    ).toContain('"/guest/link-request", dhLinkLimit()');
    const at = R.indexOf("function dhLinkLimit");
    const fn = R.slice(at, at + 400);
    expect(fn, "ограничитель без строгого умолчания").toContain("Number.isFinite");
  });
});
