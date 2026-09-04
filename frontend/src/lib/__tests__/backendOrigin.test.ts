/**
 * getBackendOrigin() отдаёт origin для ССЫЛОК, по которым ходит человек, и
 * зовётся из SiteHeader — то есть из шапки каждой страницы сайта.
 *
 * До 14.08.2026 в проде она возвращала `API_INTERNAL_BASE_URL`, служебный
 * адрес Railway, потому что публичная переменная не задана. Наружу это
 * выглядело как ссылка «API» на `aevion-production-a70c.up.railway.app` на
 * всех страницах разом; ежедневный claims-audit ловил её на /partner —
 * странице для инвесторов.
 *
 * Проверяем именно ветку «прод без публичной переменной»: это то состояние,
 * в котором сайт живёт сегодня.
 */
import { describe, test, expect, afterEach, vi } from "vitest";

const ORIGINAL = { ...process.env };

async function freshOrigin(): Promise<string> {
  // Модуль читает process.env при вызове, но импорт кэшируется между тестами —
  // сбрасываем, чтобы каждая проверка видела своё окружение.
  vi.resetModules();
  const mod = await import("../apiBase");
  return mod.getBackendOrigin();
}

describe("getBackendOrigin — наружу только публичный адрес", () => {
  afterEach(() => {
    // vi.stubEnv нужно снимать своим вызовом: восстановление process.env
    // целиком его НЕ отменяет — подмена живёт в самом vitest, а не в объекте.
    // Иначе NODE_ENV протечёт в соседние файлы прогона.
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL };
    vi.resetModules();
  });

  test("прод без публичной переменной: публичный адрес, а не внутренний хост", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.API_INTERNAL_BASE_URL = "https://aevion-production-a70c.up.railway.app";

    const origin = await freshOrigin();

    expect(origin).toBe("https://aevion.app/api-backend");
    expect(origin).not.toMatch(/railway\.app/);
  });

  test("публичная переменная, если задана, сильнее умолчания", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.aevion.app";

    expect(await freshOrigin()).toBe("https://api.aevion.app");
  });

  test("вне прода служебный адрес по-прежнему доступен — им работают локально", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.API_INTERNAL_BASE_URL = "http://127.0.0.1:4001";

    expect(await freshOrigin()).toBe("http://127.0.0.1:4001");
  });

  test("ни одной переменной — локальный бэкенд, а не пустая строка", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.API_INTERNAL_BASE_URL;

    expect(await freshOrigin()).toBe("http://127.0.0.1:4001");
  });
});
