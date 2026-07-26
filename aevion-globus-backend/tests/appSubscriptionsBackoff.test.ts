import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * Ретрай на холодный пул не должен превращаться в налог, пока база лежит.
 *
 * Контекст: `activeAppModules` делает вторую попытку через 150 мс, потому что
 * ПЕРВЫЙ запрос после старта процесса падает на непрогретом пуле (замерено
 * 2026-07-26) — без него покупатель, открывший страницу сразу после редеплоя,
 * видел пустой веер при купленных модулях.
 *
 * Обратная сторона, найденная вычиткой: если база недоступна по-настоящему,
 * те же 150 мс платит КАЖДЫЙ вызов, и чем хуже дела у базы, тем медленнее
 * отвечает сайт. Кулдаун подавляет ретрай после неудачной пары попыток, а
 * первый успех его снимает.
 *
 * Тест держит все три половины: холодный старт лечится, лежачая база не
 * тормозит, восстановление не задерживается.
 */

const query = vi.fn();
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query }) }));

let activeAppModules: (email: string) => Promise<{ modules: string[]; source: string }>;
let resetBackoff: () => void;

beforeEach(async () => {
  vi.resetModules();
  query.mockReset();
  const mod = await import("../src/lib/appSubscriptions");
  activeAppModules = mod.activeAppModules;
  resetBackoff = mod.__resetAppSubscriptionsBackoff;
  resetBackoff();
});

afterEach(() => vi.useRealTimers());

describe("appSubscriptions: ретрай и кулдаун", () => {
  test("холодный пул: первая попытка падает, вторая проходит", async () => {
    query.mockRejectedValueOnce(new Error("pool not ready")).mockResolvedValueOnce({ rows: [{ appSlug: "qpaynet" }] });
    const r = await activeAppModules("buyer@test.dev");
    expect(r.source).toBe("db");
    expect(r.modules).toEqual(["qpaynet-embedded"]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  test("🔴 пока база лежит, ретрай подавлен — второй вызов идёт в ОДИН заход", async () => {
    query.mockRejectedValue(new Error("db down"));

    const first = await activeAppModules("buyer@test.dev");
    expect(first.source).toBe("unavailable");
    expect(query, "первый вызов обязан попробовать дважды").toHaveBeenCalledTimes(2);

    query.mockClear();
    const second = await activeAppModules("buyer@test.dev");
    expect(second.source).toBe("unavailable");
    expect(query, "в кулдаун второй попытки быть не должно").toHaveBeenCalledTimes(1);
  });

  test("✅ первый успех снимает кулдаун — восстановление не задерживается", async () => {
    // Без этой половины проверка выше совместима с «ретрай выключен навсегда».
    query.mockRejectedValue(new Error("db down"));
    await activeAppModules("buyer@test.dev");

    query.mockReset();
    query.mockResolvedValueOnce({ rows: [{ appSlug: "smeta" }] });
    const ok = await activeAppModules("buyer@test.dev");
    expect(ok.source).toBe("db");
    expect(ok.modules).toEqual(["smeta-trainer"]);

    // …и следующий сбой снова получает полноценный ретрай.
    query.mockReset();
    query.mockRejectedValueOnce(new Error("blip")).mockResolvedValueOnce({ rows: [] });
    const after = await activeAppModules("buyer@test.dev");
    expect(after.source, "после успеха ретрай должен вернуться").toBe("db");
    expect(query).toHaveBeenCalledTimes(2);
  });

  test("неизвестный слаг не ломает ответ и не выдумывает модуль", async () => {
    query.mockResolvedValueOnce({ rows: [{ appSlug: "qpaynet" }, { appSlug: "нет-такого" }] });
    const r = await activeAppModules("buyer@test.dev");
    expect(r.source).toBe("db");
    expect(r.modules).toEqual(["qpaynet-embedded"]);
  });

  test("пустой email не ходит в базу вовсе", async () => {
    const r = await activeAppModules("   ");
    expect(r.source).toBe("unavailable");
    expect(query).not.toHaveBeenCalled();
  });
});
