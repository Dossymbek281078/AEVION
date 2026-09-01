import { describe, test, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

/**
 * ССЫЛКА ИЗ ПИСЬМА РАБОТАЕТ ТОЛЬКО В ТОМ БРАУЗЕРЕ, КОТОРЫЙ ЕЁ ПРОСИЛ.
 *
 * Модуль намеренно работает без аккаунта, поэтому «кто это» = идентификатор
 * гостя из браузера. Если бы подтверждение не сверяло его, ссылка, попавшая
 * в чужие руки (переслали письмо, общий почтовый ящик, утёкший адрес),
 * привязала бы ЧУЖУЮ оплаченную покупку к чужому браузеру.
 *
 * До сегодняшнего дня это проверялось только НАЛИЧИЕМ строки в исходнике:
 * сторож читал файл и убеждался, что сравнение написано. Такой сторож
 * проходит и тогда, когда сравнение стоит после записи, обёрнуто в условие,
 * которое не выполняется, или сравнивает не то. Здесь функция вызывается.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
}));

const TOKEN = "tokenchik-iz-pisma";
const CHUZHOJ = "gost-A-poprosil";
const MOJ = "gost-B-otkryl";

// Ответ базы собирается по ТЕКСТУ запроса: подтверждение делает три обращения
// подряд (чтение токена, запись связи, отметка «использован»), и подменять их
// по порядку вызова — значит завязаться на порядок, который может смениться.
function nastroitBazu(row: Record<string, unknown> | undefined) {
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes("SELECT") && sql.includes("DevHubGuestLinkToken")) {
      return Promise.resolve({ rows: row ? [row] : [] });
    }
    return Promise.resolve({ rows: [] });
  });
}

function zapisejSvyazi() {
  // Считаем именно ЗАПИСЬ связи: отказ обязан не только вернуть "invalid",
  // но и ничего не записать. Отказ, который всё же пишет, — худший исход.
  return mockQuery.mock.calls.filter(
    (c) => typeof c[0] === "string" && c[0].includes("DevHubGuestLink") && !c[0].includes("SELECT"),
  ).length;
}

describe("гостевая ссылка привязана к одному браузеру", () => {
  let hash: string;
  beforeEach(async () => {
    hash = await bcrypt.hash(TOKEN, 10);
  });

  test("свой браузер: связывание проходит (положительный контроль)", async () => {
    const { confirmGuestLink } = await import("../src/lib/devhubGuestLink.js");
    nastroitBazu({
      guestId: CHUZHOJ,
      email: "kupil@example.com",
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    // Без этой проверки остальные были бы зелёными и на функции,
    // возвращающей "invalid" ВСЕГДА, — то есть на сломанной.
    expect(await confirmGuestLink("id-1", TOKEN, CHUZHOJ)).toBe("linked");
    expect(zapisejSvyazi(), "связь не записана").toBeGreaterThan(0);
  });

  test("чужой браузер с ВЕРНЫМ токеном: отказ и ничего не записано", async () => {
    const { confirmGuestLink } = await import("../src/lib/devhubGuestLink.js");
    nastroitBazu({
      guestId: CHUZHOJ,
      email: "kupil@example.com",
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    // Токен ВЕРНЫЙ — проверяется именно привязка к браузеру, а не подбор.
    expect(await confirmGuestLink("id-1", TOKEN, MOJ)).toBe("invalid");
    expect(zapisejSvyazi(), "отказ, но связь всё равно записана").toBe(0);
  });

  test("просроченная ссылка не срабатывает", async () => {
    const { confirmGuestLink } = await import("../src/lib/devhubGuestLink.js");
    nastroitBazu({
      guestId: CHUZHOJ,
      email: "kupil@example.com",
      tokenHash: hash,
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    expect(await confirmGuestLink("id-1", TOKEN, CHUZHOJ)).toBe("invalid");
    expect(zapisejSvyazi()).toBe(0);
  });

  test("использованная ссылка не срабатывает повторно", async () => {
    const { confirmGuestLink } = await import("../src/lib/devhubGuestLink.js");
    nastroitBazu({
      guestId: CHUZHOJ,
      email: "kupil@example.com",
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    expect(await confirmGuestLink("id-1", TOKEN, CHUZHOJ)).toBe("invalid");
    expect(zapisejSvyazi()).toBe(0);
  });

  test("неверный токен не срабатывает даже в своём браузере", async () => {
    const { confirmGuestLink } = await import("../src/lib/devhubGuestLink.js");
    nastroitBazu({
      guestId: CHUZHOJ,
      email: "kupil@example.com",
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    expect(await confirmGuestLink("id-1", "ne-tot-token", CHUZHOJ)).toBe("invalid");
    expect(zapisejSvyazi()).toBe(0);
  });
});
