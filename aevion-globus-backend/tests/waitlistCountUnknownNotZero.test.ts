import { describe, test, expect, vi } from "vitest";

/**
 * Счётчик списка ожидания печатается людям на публичных страницах модулей
 * («waitlist: N») как социальное доказательство. При сбое чтения базы он
 * возвращал размер словаря в ПАМЯТИ ПРОЦЕССА — а память в этом режиме не
 * хранилище: она наполняется только тем, что прошло через этот процесс после
 * запуска, и сразу после выкатки там ноль.
 *
 * То есть дрожание базы показывало «waitlist: 0» при живых подписавшихся.
 * Здесь проверяется, что теперь это «не знаю» (null), а страница покажет
 * многоточие.
 *
 * Мок устроен так, чтобы РАЗЛИЧАТЬ две операции: создание таблиц проходит
 * (значит база доступна и она и есть хранилище), а COUNT падает. Без этого
 * различения тест проверял бы «базы нет вовсе» — другой случай, у которого
 * ответ памятью как раз правильный.
 */
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn((sql: string) =>
    String(sql).includes("COUNT(*)")
      ? Promise.reject(new Error("соединение оборвалось"))
      : Promise.resolve({ rows: [] })
  ),
}));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

describe("счётчик списка ожидания при сбое чтения", () => {
  test("модульные заглушки: «не знаю», а не ноль", async () => {
    const { getWaitlistCount } = await import("../src/routes/planningStubs");
    const n = await getWaitlistCount("veilnetx");
    expect(n, "ноль прочтётся как «никто не ждёт» и уедет на публичную страницу").toBeNull();
  });

  test("veilnetx: «не знаю», а не ноль", async () => {
    const { getWaitlistCount } = await import("../src/routes/veilnetx");
    const n = await getWaitlistCount();
    expect(n).toBeNull();
  });

  test("контроль: мок действительно роняет только COUNT", async () => {
    // Без этого контроля предыдущие проверки проходили бы и оттого, что
    // сломалось вообще всё, включая создание таблиц, — а это другой случай.
    await expect(mockQuery("CREATE TABLE IF NOT EXISTS x ()")).resolves.toBeTruthy();
    await expect(mockQuery("SELECT COUNT(*)::int AS c FROM x")).rejects.toThrow();
  });
});
