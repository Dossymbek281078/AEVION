import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { путиРоутера, путьСовпадает } from "../src/lib/planGate";

/**
 * Неизвестный путь под платным модулем — это 404, а не «купите тариф».
 *
 * Повод, замер 06.10.2026 на проде: `/api/multichat/vydumannyi-put` — такого
 * маршрута нет вовсе — отвечал **402 upgrade_required**. Два следствия:
 *   1. человек с опечаткой в адресе читает предложение заплатить;
 *   2. снаружи «сломано» и «платно» становятся неразличимы — в тот же заход
 *      выдуманный путь дал тот же код, что живой платный, и проверить
 *      существование маршрутов с прода стало невозможно.
 *
 * Проверяется НАСТОЯЩИЙ `requireModule`, смонтированный так же, как на проде.
 */

process.env.AUTH_JWT_SECRET = "unknown-path-guard-secret-at-least-32-chars";
process.env.PAYWALL_MODULES = "multichat-engine";
process.env.NODE_ENV = "test";

const { requireModule } = await import("../src/lib/planGate");

function приложение() {
  const роутер = express.Router();
  // платный путь
  роутер.get("/conversations", (_req, res) => { res.json({ ok: true, тут: "платное" }); });
  роутер.get("/conversations/:id/usage", (_req, res) => { res.json({ ok: true }); });
  // бесплатный путь: `/status` у стены в списке исключений
  роутер.get("/status", (_req, res) => { res.json({ ok: true, тут: "бесплатное" }); });

  const a = express();
  a.use("/api/multichat", requireModule("multichat-engine", роутер), роутер);
  // Хвостовой обработчик: так же, как на проде, неизвестный путь доходит сюда.
  a.use((_req, res) => { res.status(404).json({ error: "not_found" }); });
  return a;
}

const код = async (путь: string) => (await request(приложение()).get(путь)).status;

describe("стена отличает несуществующий путь от платного", () => {
  test("🔴 выдуманный путь → 404, а не 402", async () => {
    expect(await код("/api/multichat/vydumannyi-put")).toBe(404);
    expect(await код("/api/multichat/conversations/abc/vydumannoe")).toBe(404);
  });

  test("существующий платный без входа → 402", async () => {
    expect(await код("/api/multichat/conversations")).toBe(402);
    // путь с параметром тоже обязан опознаваться как существующий
    expect(await код("/api/multichat/conversations/abc123/usage")).toBe(402);
  });

  test("существующий бесплатный (исключение стены) → 200", async () => {
    expect(await код("/api/multichat/status")).toBe(200);
  });

  test("🔴 стек не прочитался → стена работает как раньше, платное НЕ открывается", async () => {
    // Мутация показала, что это надо проверять через саму стену, а не через
    // помощник: тест на `путиРоутера` пропускал вариант, где пустой список
    // считается промахом — и тогда живой платный путь отдавал бы 404, то есть
    // заплативший получал бы «страницы нет» вместо продукта.
    const роутер = express.Router();
    роутер.get("/conversations", (_req, res) => { res.json({ ok: true }); });
    const a = express();
    // Стене передаём объект БЕЗ стека — так выглядит «прочитать не вышло».
    a.use("/api/multichat", requireModule("multichat-engine", {} as never), роутер);
    a.use((_req, res) => { res.status(404).json({ error: "not_found" }); });
    const r = await request(a).get("/api/multichat/conversations");
    expect(r.status, "платный путь отдал не 402 — стена ослепла").toBe(402);
  });

  test("контроль: при выключенной стене платный путь открыт", async () => {
    // Иначе 402 выше мог бы объясняться чем угодно, а не стеной.
    const было = process.env.PAYWALL_MODULES;
    process.env.PAYWALL_MODULES = "";
    try {
      expect(await код("/api/multichat/conversations")).toBe(200);
    } finally {
      process.env.PAYWALL_MODULES = было;
    }
  });
});

describe("сопоставление путей: сомнение оставляет прежнее поведение", () => {
  test("пути берутся из стека роутера, а не из списка руками", () => {
    const р = express.Router();
    р.get("/a", (_q, s) => s.end());
    р.post("/b/:id", (_q, s) => s.end());
    expect(путиРоутера(р as never).sort()).toEqual(["/a", "/b/:id"]);
  });

  test("стек прочитать не вышло → пустой список, и стена ведёт себя как раньше", () => {
    expect(путиРоутера(undefined)).toEqual([]);
    expect(путиРоутера({} as never)).toEqual([]);
  });

  test(":параметр совпадает с любым непустым сегментом", () => {
    expect(путьСовпадает(["/c/:id/usage"], "/c/abc/usage")).toBe(true);
    expect(путьСовпадает(["/c/:id/usage"], "/c/abc/other")).toBe(false);
    expect(путьСовпадает(["/c/:id"], "/c")).toBe(false);
  });

  test("звёздочка совпадает с хвостом", () => {
    expect(путьСовпадает(["/files/*"], "/files/a/b/c")).toBe(true);
  });

  test("🔴 непонятный шаблон считается СОВПАДЕНИЕМ, а не промахом", () => {
    // Направление выбрано по цене ошибки: лишний 402 — неудобство, лишний
    // 404 на живом платном пути — закрытый продукт у заплатившего.
    expect(путьСовпадает(["/x/(\\d+)"], "/что-угодно")).toBe(true);
  });
});
