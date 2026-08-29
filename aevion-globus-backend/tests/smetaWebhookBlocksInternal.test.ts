/**
 * Вебхук тренажёра смет не должен указывать внутрь нашей сети.
 *
 * 28.08.2026. Путь у ручки — `/admin/webhooks`, но администратором быть НЕ
 * требуется: проверяется только подпись токена (`readUserIdFromBearer`).
 * Проверка адреса была одна — «начинается с http». Значит любой
 * зарегистрированный пользователь мог указать `http://169.254.169.254/`
 * (служебный адрес метаданных облака), а соседняя ручка
 * `/admin/webhooks/:id/test` тут же сходила бы туда С НАШЕГО сервера.
 *
 * Список внутренних адресов ОБЩИЙ с вебхуками QCoreAI и живёт в
 * `src/lib/internalHost.ts` — намеренно один: два списка разошлись бы молча.
 *
 * Этот тест проверяет ПРЕДИКАТ, а не ручку: поднимать роутер ради одной
 * ветки дороже, чем закрепить правило, на котором она стоит. Отдельно
 * проверено прогоном, что ручка отвечает 401 без токена.
 */

import { describe, expect, it } from "vitest";
import { isInternalHost } from "../src/lib/internalHost";

// Ручки /admin тренажёра закрыты проверкой роли (28.08.2026). Этот прогон
// проверяет доставку, а не доступ, поэтому отдушина включается ЯВНО —
// раньше она включалась сама при NODE_ENV=test и прятала настоящую логику.
process.env.SMETA_ADMIN_TEST_BYPASS = "1";

describe("вебхук тренажёра смет не указывает внутрь сети", () => {
  it("контроль прибора: обычные адреса не считаются внутренними", () => {
    // Без этого «проверку» можно было бы пройти, объявив внутренним всё.
    for (const h of ["example.com", "hooks.slack.com", "11.0.0.1", "172.32.0.1"]) {
      expect(isInternalHost(h), `законный адрес объявлен внутренним: ${h}`).toBe(false);
    }
  });

  it("адрес метаданных облака и петля считаются внутренними", () => {
    const bad = ["169.254.169.254", "metadata.google.internal", "127.0.0.1", "127.0.0.2",
                 "0.0.0.0", "10.1.2.3", "192.168.0.1", "172.16.0.1", "100.64.0.1",
                 "localhost", "::1", "::ffff:7f00:1"];
    const passed = bad.filter((h) => !isInternalHost(h));
    expect(passed, "эти адреса ведут внутрь и НЕ распознаны:\n  " + passed.join("\n  ")).toEqual([]);
  });

  // ЗАМЕНЕНО 28.08.2026 (вечер). Раньше здесь стояла проверка ИСХОДНИКА:
  // есть ли импорт и сколько раз зовётся помощник. Она ловила УДАЛЕНИЕ защиты
  // и не ловила её ОБЕЗВРЕЖИВАНИЕ — а именно обезвреживанием была отдушина
  // `NODE_ENV === "test"`, под которой помощник в тестах всегда отвечал
  // «разрешено». Плюс она была хрупкой не по делу: покраснела от того, что я
  // дописал комментарий и искомое ушло за окно в 400 знаков.
  //
  // Теперь спрашиваем РУЧКУ и смотрим ответ.
  it("ручка регистрации отказывает внутреннему адресу", async () => {
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;
    process.env.SMETA_ADMIN_TEST_BYPASS = "1";
    delete process.env.ALLOW_INTERNAL_WEBHOOKS;
    const { smetaTrainerRouter } = await import("../src/routes/smeta-trainer");
    const app = express();
    app.use(express.json());
    app.use(smetaTrainerRouter);

    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:9999/hook",
      "http://10.0.0.5/hook",
    ]) {
      const res = await request(app).post("/admin/webhooks")
        .set("Authorization", "Bearer test-token")
        .send({ url, label: "проба", events: ["grade.passed"] });
      expect(res.status, `принят внутренний адрес: ${url}`).toBe(400);
      expect(res.body.reason, `не та причина отказа для ${url}`).toBe("internal_target");
    }
  });

  it("контроль прибора: внешний адрес этой же ручкой НЕ отвергается", async () => {
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;
    process.env.SMETA_ADMIN_TEST_BYPASS = "1";
    delete process.env.ALLOW_INTERNAL_WEBHOOKS;
    const { smetaTrainerRouter } = await import("../src/routes/smeta-trainer");
    const app = express();
    app.use(express.json());
    app.use(smetaTrainerRouter);

    // Без контроля сторож остался бы зелёным на ручке, которая отвергает ВСЁ.
    //
    // Адрес ЛИТЕРАЛЬНЫЙ, а не имя: проверка теперь разрешает имя в адреса, и
    // с именем набор зависел бы от сети — то зелёный, то красный от чужой
    // доступности. У литерала разрешение возвращает его сам, без запроса.
    const res = await request(app).post("/admin/webhooks")
      .set("Authorization", "Bearer test-token")
      .send({ url: "https://8.8.8.8/hook", label: "проба", events: ["grade.passed"] });
    expect(res.body?.reason).not.toBe("internal_target");
  });
});
