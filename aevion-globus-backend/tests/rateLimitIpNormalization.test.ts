import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";

import { rateLimit, normalizeAddressForKey } from "../src/lib/rateLimit";

// Нормализация адреса в ключе лимитера — 13.08.2026.
//
// Локальный хелпер брал адрес как есть. Для IPv6 это означает, что лимит по
// адресу не ограничивает НИЧЕГО: провайдер выдаёт клиенту целый префикс, и
// каждый адрес из него получал свой счётчик. Обход не требует инструментов —
// достаточно менять последние группы адреса.
//
// Находка пришла из чужого кода: `qpaynet` и `build/public` нормализуют через
// `ipKeyGenerator` и прямо пишут в комментарии, зачем. Наш хелпер, на котором
// 77 мест, не нормализовал вовсе. Поэтому и починка — та же функция, а не своя:
// две реализации одного правила разойдутся на первом краевом случае.

/** Свой keyPrefix на каждый случай: бюджеты живут в модульной Map. */
function appWith(keyPrefix: string, max = 2) {
  const app = express();
  app.set("trust proxy", 1);
  app.get("/r", rateLimit({ windowMs: 60_000, max, keyPrefix }), (_req, res) => res.json({ ok: true }));
  return app;
}

describe("normalizeAddressForKey", () => {
  test("адреса одного префикса IPv6 сводятся к одному ключу", () => {
    const a = normalizeAddressForKey("2001:db8:1234:5678:aaaa:bbbb:cccc:dddd");
    const b = normalizeAddressForKey("2001:db8:1234:5678:1111:2222:3333:4444");
    expect(a).toBe(b);
  });

  test("разные префиксы остаются разными — иначе это уже не лимит, а блокировка", () => {
    const a = normalizeAddressForKey("2001:db8:1234:5678::1");
    const b = normalizeAddressForKey("2001:db8:9999:5678::1");
    expect(a).not.toBe(b);
  });

  test("IPv4 не искажается, IPv4-mapped разворачивается", () => {
    expect(normalizeAddressForKey("203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeAddressForKey("::ffff:127.0.0.1")).toBe("127.0.0.1");
  });

  test("мусор на входе не приводит к исключению", () => {
    // Лимитер не имеет права быть причиной отказа запроса.
    expect(() => normalizeAddressForKey("unknown")).not.toThrow();
    expect(() => normalizeAddressForKey("")).not.toThrow();
    expect(normalizeAddressForKey("unknown")).toBe("unknown");
  });
});

describe("лимит по адресу не обходится сменой адреса внутри префикса", () => {
  test("два адреса одного префикса делят бюджет", async () => {
    const app = appWith("ipv6-same-prefix");
    const hit = (ip: string) => request(app).get("/r").set("X-Forwarded-For", ip);

    expect((await hit("2001:db8:aaaa:bbbb:1::1")).status).toBe(200);
    expect((await hit("2001:db8:aaaa:bbbb:2::2")).status).toBe(200);
    // Третий адрес того же префикса — бюджет уже истрачен первыми двумя.
    // До починки здесь было 200, и так до бесконечности.
    expect((await hit("2001:db8:aaaa:bbbb:3::3")).status).toBe(429);
  });

  test("чужой префикс сохраняет свой бюджет", async () => {
    const app = appWith("ipv6-other-prefix");
    const hit = (ip: string) => request(app).get("/r").set("X-Forwarded-For", ip);

    expect((await hit("2001:db8:1111:1111::1")).status).toBe(200);
    expect((await hit("2001:db8:1111:1111::2")).status).toBe(200);
    expect((await hit("2001:db8:1111:1111::3")).status).toBe(429);
    // Другой клиент не должен пострадать от соседа.
    expect((await hit("2001:db8:2222:2222::1")).status).toBe(200);
  });

  test("аккаунтный ключ нормализацию не проходит — в нём нет адреса", async () => {
    // Иначе идентификатор аккаунта, случайно похожий на адрес, был бы искажён.
    const app = express();
    app.set("trust proxy", 1);
    app.get(
      "/r",
      rateLimit({ windowMs: 60_000, max: 1, keyPrefix: "acct-key", keyFn: (req) => String(req.query.u) }),
      (_req, res) => res.json({ ok: true }),
    );
    expect((await request(app).get("/r?u=2001:db8:1:2::9")).status).toBe(200);
    expect((await request(app).get("/r?u=2001:db8:1:2::9")).status).toBe(429);
    // Другой «адресоподобный» аккаунт из того же префикса — свой бюджет.
    expect((await request(app).get("/r?u=2001:db8:1:2::8")).status).toBe(200);
  });
});
