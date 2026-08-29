import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { EXTRA_MOUNTS } from "../src/routes/moduleManifest";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Модуль ПОДКЛЮЧЁН по тому же адресу, по которому его проверяют тесты.
 *
 * ПОВОД (29.08.2026). Все 524 проверки модуля монтируют роутер сами:
 * `app.use("/api/qskyway", qskywayRouter)`. А приложение монтирует его через
 * `routes/moduleManifest.ts`. Пути сегодня совпадают — проверил, — но ничто
 * этого не требовало.
 *
 * Значит удали кто-нибудь запись из манифеста (или поменяй в ней путь), и весь
 * набор остался бы ЗЕЛЁНЫМ, пока живой API отвечает 404. Тест, монтирующий
 * иначе, чем прод, проверяет не то приложение.
 *
 * Проверяем не «строка есть в файле», а ЧТО ИМЕННО подключено: сам объект
 * роутера и живой ответ по этому пути.
 */
describe("qskyway подключён там, где его ищут", () => {
  const mount = EXTRA_MOUNTS.find((m) => m.router === qskywayRouter);

  test("модуль вообще есть в манифесте", () => {
    expect(mount, "qskywayRouter не подключён ни по одному пути — живой API его не отдаст").toBeTruthy();
  });

  test("путь тот же, по которому бьют тесты и страница", () => {
    expect(mount?.path).toBe("/api/qskyway");
  });

  test("по этому пути приложение ОТВЕЧАЕТ, а не только объявляет", async () => {
    // Собираем приложение ИЗ МАНИФЕСТА, а не руками: иначе проверялось бы наше
    // представление о монтировании, а не само монтирование.
    const a = express();
    a.use(express.json());
    for (const m of EXTRA_MOUNTS) a.use(m.path, m.router);
    const res = await request(a).get("/api/qskyway/health");
    expect(res.status, "по пути из манифеста модуль не отвечает").toBe(200);
  });

  test("путь не занят другим модулем", () => {
    // Две записи с одним путём — вторая недостижима, и это молчаливо.
    const same = EXTRA_MOUNTS.filter((m) => m.path === "/api/qskyway");
    expect(same.length, "путь /api/qskyway объявлен дважды — одна из записей мертва").toBe(1);
  });
});
