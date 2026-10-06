import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ЗАПРОСЫ МОДУЛЯ НЕСУТ ТОКЕН — ИНАЧЕ ЗАПЛАТИВШИЙ НЕОТЛИЧИМ ОТ ГОСТЯ.
 *
 * Повод 06.10.2026. Замер по заданию оркестратора: за что вообще платят в четырёх
 * продаваемых модулях. У QVenture на сервере НОЛЬ проверок прав (контроль: тот же
 * поиск по devhub даёт 2 проверки и 9 обращений к нормам), а интерфейс платного
 * отказа уже готов — рядом живут сторожа paywallDenialIsActionable и
 * paidAccessTiedToEmailIsStated со ссылками на requiredTier и upgradeUrl.
 *
 * То есть включить стену нельзя было не потому, что её негде включить, а потому что
 * страница шлёт запросы БЕЗ ТОКЕНА: сервер не узнал бы заплатившего и закрыл бы
 * модуль и для него. Токен — предусловие включения стены, а не украшение.
 *
 * Образец взят у соседа по тому же модулю (_watchlist.ts уже шлёт getAuthHeaders),
 * второго способа добывать токен не заведено.
 */

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

const ФАЙЛ = join(__dirname, "..", "page.tsx");
const ИСХОДНИК = readFileSync(ФАЙЛ, "utf8");
const ПЕРЕВОД = String.fromCharCode(10); // эскейп съедается на границе вызова (§2е)

/**
 * Все места, где страница зовёт свои ручки. Знаменатель охвата.
 *
 * ⚠️ Первая версия искала токен в окне 420 знаков после вызова — и объявила
 * analyze «БЕЗ ТОКЕНА», хотя токен там стоял: моё же пояснение рядом с вызовом
 * оказалось длиннее окна. Соврал прибор, а выглядело как найденный дефект.
 * Поэтому граница теперь не «столько-то знаков», а СЛЕДУЮЩИЙ вызов ручки:
 * у неё нет произвольного числа, которое можно подобрать неудачно.
 */
function вызовыРучек(): string[] {
  const метки: Array<{ путь: string; от: number }> = [];
  const образец = /fetch\(apiUrl\("(\/api\/qventure\/[a-z-]+)"\)/g;
  let m: RegExpExecArray | null;
  while ((m = образец.exec(ИСХОДНИК)) !== null) метки.push({ путь: m[1], от: m.index });
  return метки.map((м, i) => {
    const до = i + 1 < метки.length ? метки[i + 1].от : ИСХОДНИК.length;
    const кусок = ИСХОДНИК.slice(м.от, до);
    return м.путь + (кусок.includes("getAuthHeaders") ? " :токен" : " :БЕЗ ТОКЕНА");
  });
}

describe("QVenture: запросы несут токен входа", () => {
  beforeEach(() => {
    try {
      window.localStorage.setItem("aevion_auth_token_v1", "tok-oplativshego");
    } catch {
      /* приватное окно — проверка ниже всё равно честно покраснеет */
    }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    try {
      window.localStorage.removeItem("aevion_auth_token_v1");
    } catch { /* нечего убирать */ }
  });

  test("ЗНАМЕНАТЕЛЬ: все вызовы ручек модуля, и у каждого токен", () => {
    const вызовы = вызовыРучек();
    process.stderr.write(`[сторож] вызовов ручек QVenture: ${вызовы.length} — ${вызовы.join(", ")}` + ПЕРЕВОД);
    // Ноль найденных означал бы, что образец перестал понимать код, а сторож
    // при этом зеленел бы — худший исход. Замер 06.10: вызовов три.
    expect(вызовы.length, "образец не нашёл ни одного вызова — сторож ослеп").toBeGreaterThanOrEqual(3);
    expect(
      вызовы.filter((в) => в.endsWith(":БЕЗ ТОКЕНА")),
      "появился вызов ручки модуля без токена: заплативший будет неотличим от гостя",
    ).toEqual([]);
  });

  test("ПОВЕДЕНИЕ: запрос, который уходит при открытии, несёт Authorization", async () => {
    const вызовы: Array<{ url: string; auth: string | null }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const h = new Headers(init?.headers as HeadersInit | undefined);
      вызовы.push({ url: String(url), auth: h.get("Authorization") });
      return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
    }));
    const { default: Стр } = await import("../page");
    render(<Стр />);
    await new Promise((r) => setTimeout(r, 60));
    const справочник = вызовы.find((в) => в.url.includes("/sectors"));
    expect(справочник, "страница не позвала справочник отраслей вовсе").toBeTruthy();
    expect(
      справочник?.auth,
      "запрос ушёл без Authorization — после включения стены заплативший получил бы пустую форму",
    ).toBe("Bearer tok-oplativshego");
  });

  test("КОНТРОЛЬ: без токена заголовка нет, и это не ошибка", async () => {
    // Иначе первая проверка проходила бы и на коде, который шлёт Authorization
    // всегда — например с пустым значением, — а это уже обман сервера.
    window.localStorage.removeItem("aevion_auth_token_v1");
    const вызовы: Array<string | null> = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      вызовы.push(new Headers(init?.headers as HeadersInit | undefined).get("Authorization"));
      return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
    }));
    const { default: Стр } = await import("../page");
    render(<Стр />);
    await new Promise((r) => setTimeout(r, 60));
    expect(вызовы.some((a) => a === null), "гость тоже шлёт Authorization — значение пустое?").toBe(true);
  });
});
