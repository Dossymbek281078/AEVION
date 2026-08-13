import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

import { makeHttpErrorHandler, clientErrorStatus, clientErrorBody } from "../src/lib/httpErrorHandler";
import { BODY_LIMITS, GLOBAL_BODY_LIMIT_BYTES } from "../src/lib/bodyLimitByPath";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Обработчик ошибок Express — 13.08.2026.
//
// До этого коммита он отвечал `500 internal_error` на ВСЁ и на всё же звал
// captureException. Замер на живом сервере (порт 4099, боевой src/index.ts):
//
//   битый JSON        → 500 internal_error   (должен 400)
//   тело больше 10 МБ → 500 internal_error   (должен 413)
//
// и обе ошибки уходили в Sentry. Второе последствие хуже первого: квоту Sentry
// расходует кто угодно одной строкой `curl -d '{'`, а настоящие ошибки тонут в
// этом шуме.
//
// Проверять было нечем, потому что обработчик жил внутри index.ts — дотянуться
// до него можно было только подняв весь сервер. Поэтому он вынесен в модуль, а
// `capture` передаётся параметром: «в Sentry не ушло» проверяется по самому
// действию, а не по строчкам в консоли.

/** Тихий лог: сам обработчик обязан писать, но в выводе теста это шум. */
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

function appThrowing(err: unknown, capture = vi.fn()) {
  const app = express();
  app.get("/boom", (_req, _res, next) => next(err));
  app.use(makeHttpErrorHandler(capture as never));
  return { app, capture };
}

/** Ошибка ровно той формы, какую бросает body-parser. */
function bodyParserError(type: string, status: number, message: string) {
  return Object.assign(new Error(message), { type, status, statusCode: status, expose: true });
}

describe("обработчик ошибок — клиентские отказы", () => {
  test("тело больше предела: 413 и внятная причина", async () => {
    const { app, capture } = appThrowing(
      bodyParserError("entity.too.large", 413, "request entity too large"),
    );
    const r = await request(app).get("/boom");
    expect(r.status).toBe(413);
    expect(r.body.error).toBe("payload_too_large");
    expect(r.body.message).toMatch(/10 МБ/);
    // Главное: в Sentry не ушло.
    expect(capture).not.toHaveBeenCalled();
  });

  test("битый JSON: 400, а не 500", async () => {
    const { app, capture } = appThrowing(
      bodyParserError("entity.parse.failed", 400, "Unexpected token in JSON"),
    );
    const r = await request(app).get("/boom");
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_json");
    expect(capture).not.toHaveBeenCalled();
  });

  test("текст ошибки библиотеки наружу не уходит", async () => {
    // Иначе в ответе оказываются внутренние пути и версии — и это же причина
    // не пересказывать message: он приходит из чужого кода.
    const { app } = appThrowing(
      bodyParserError("entity.parse.failed", 400, "Unexpected token '<' at C:\\Users\\user\\secret"),
    );
    const r = await request(app).get("/boom");
    expect(JSON.stringify(r.body)).not.toMatch(/C:\\\\Users|secret|Unexpected token/);
  });
});

describe("обработчик ошибок — серверные не должны потеряться", () => {
  test("обычная ошибка по-прежнему 500 и по-прежнему в Sentry", async () => {
    // Контроль: починка легко превращается в глушитель, если начать считать
    // клиентским всё, у чего есть поле status.
    const { app, capture } = appThrowing(new Error("база отвалилась"));
    const r = await request(app).get("/boom");
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "internal_error" });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  test("5xx от библиотеки — это серверная ошибка, а не клиентская", async () => {
    const { app, capture } = appThrowing(Object.assign(new Error("upstream"), { status: 502 }));
    const r = await request(app).get("/boom");
    expect(r.status).toBe(500);
    expect(capture).toHaveBeenCalledTimes(1);
  });
});

describe("clientErrorStatus — что считается клиентским", () => {
  test("только 4xx", () => {
    expect(clientErrorStatus({ status: 413 })).toBe(413);
    expect(clientErrorStatus({ statusCode: 400 })).toBe(400);
    expect(clientErrorStatus({ status: 499 })).toBe(499);
    expect(clientErrorStatus({ status: 500 })).toBeNull();
    expect(clientErrorStatus({ status: 399 })).toBeNull();
  });

  test("самодельный код домена в поле status не превращает ошибку в клиентскую", () => {
    // Встречается в своём коде: `status` как код ошибки предметной области.
    // Число вне 400..499 доверия не заслуживает, иначе серверная ошибка
    // молча перестанет доходить до Sentry.
    expect(clientErrorStatus({ status: 42 })).toBeNull();
    expect(clientErrorStatus({ status: 1001 })).toBeNull();
    expect(clientErrorStatus({ status: "413" })).toBeNull();
    expect(clientErrorStatus(new Error("без полей"))).toBeNull();
    expect(clientErrorStatus(null)).toBeNull();
  });
});

describe("текст 413 называет настоящий предел этого пути", () => {
  // Первая версия писала число прямо в текст — «предел 10 МБ» — и соврала в тот
  // же день, когда на проверку чека поставили 256 КБ. Человек читал неверное
  // число и делал вывод, что дело не в размере. Число берётся из того же
  // источника, что и решение об отказе.
  const tooLarge = { type: "entity.too.large", status: 413 };

  test("на пути с узким пределом называется узкий предел", () => {
    const body = clientErrorBody(tooLarge, 413, "/api/multichat/receipt/verify");
    expect(body.message).toMatch(/256 КБ/);
    expect(body.message).not.toMatch(/10 МБ/);
  });

  test("на прочих путях называется общий предел", () => {
    const body = clientErrorBody(tooLarge, 413, "/api/build/ai/parse-resume");
    expect(body.message).toMatch(/10 МБ/);
  });

  test("строка запроса и слеш не сбивают выбор числа", () => {
    for (const u of ["/api/multichat/receipt/verify?x=1", "/api/multichat/receipt/verify/"]) {
      expect(clientErrorBody(tooLarge, 413, u).message, u).toMatch(/256 КБ/);
    }
  });

  test("без пути — общий предел, а не пустое место", () => {
    expect(clientErrorBody(tooLarge, 413).message).toMatch(/10 МБ/);
  });
});

describe("сторож: два числа общего предела не должны разойтись", () => {
  test("GLOBAL_BODY_LIMIT_BYTES совпадает с limit в index.ts", () => {
    // Комментарий в bodyLimitByPath.ts обещает эту сверку — обещание без
    // проверки и есть тот класс дефектов, из-за которого текст соврал.
    const src = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");
    const m = src.match(/express\.json\(\{\s*limit:\s*"(\d+)(mb|kb)"/i);
    expect(m, "не нашёл limit у express.json — сверять нечего").toBeTruthy();
    const n = Number(m![1]);
    const bytes = m![2].toLowerCase() === "mb" ? n * 1024 * 1024 : n * 1024;
    expect(bytes).toBe(GLOBAL_BODY_LIMIT_BYTES);
  });

  test("узкие пределы меньше общего — иначе запись бессмысленна", () => {
    for (const [path, limit] of Object.entries(BODY_LIMITS)) {
      expect(limit, `предел ${path} не меньше общего`).toBeLessThan(GLOBAL_BODY_LIMIT_BYTES);
    }
  });
});
