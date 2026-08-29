import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import crypto from "node:crypto";
import { EXTRA_MOUNTS } from "../src/routes/moduleManifest";

/**
 * Новая ручка достижима в приложении, СОБРАННОМ ИЗ МАНИФЕСТА.
 *
 * Остальные проверки монтируют роутер сами. Здесь — как в проде: если ручка
 * добавлена, но модуль подключён иначе, тесты были бы зелёными при живом 404.
 */
function realApp() {
  const a = express();
  a.use(express.json());
  for (const m of EXTRA_MOUNTS) a.use(m.path, m.router);
  return a;
}

describe("подписанные байты доступны по настоящему пути", () => {
  test("ручка отвечает и хэш сходится", async () => {
    const res = await request(realApp()).get("/api/qskyway/city/signed-payload?city=nyc");
    expect(res.status, "по пути из манифеста ручка не отвечает").toBe(200);
    const mine = crypto.createHash("sha256").update(res.body.payload, "utf8").digest("hex");
    expect(mine).toBe(res.body.contentHash);
  });

  test("и знак на витрине совпадает с ним же", async () => {
    const app = realApp();
    const sp = await request(app).get("/api/qskyway/city/signed-payload?city=nyc");
    const city = await request(app).get("/api/qskyway/city?city=nyc");
    expect(city.body?._signature?.contentHash).toBe(sp.body.contentHash);
  });
});
