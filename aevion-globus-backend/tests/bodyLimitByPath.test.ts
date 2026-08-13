import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";

import { bodyLimitByPath, BODY_LIMITS } from "../src/lib/bodyLimitByPath";
import { makeHttpErrorHandler } from "../src/lib/httpErrorHandler";
import { buildReceipt } from "../src/services/multichat/receipt";

// Узкий предел тела для публичной проверки чека — 13.08.2026.
//
// Общий предел `express.json({ limit: "10mb" })` высок не случайно: замер дал 25
// ручек-кандидатов на большое тело в 12 файлах (base64-аудио для расшифровки,
// клон голоса, картинки DevHub, сканы резюме), и список неполон. Опускать общее
// умолчание значило бы сломать денежные медиа-пути ради одной публичной ручки.
//
// Поэтому предел узкий и вниз — только для `/api/multichat/receipt/verify`.
// Проверка стоит ДО общего разборщика: после него тело уже прочитано, и меньший
// предел ставить поздно.

/** То же соседство, что в index.ts: предел → разборщик → обработчик ошибок. */
function app() {
  const a = express();
  a.use(bodyLimitByPath);
  a.use(express.json({ limit: "10mb" }));
  a.post("/api/multichat/receipt/verify", (req, res) => res.json({ ok: true, keys: Object.keys(req.body || {}).length }));
  a.post("/api/build/ai/parse-resume", (_req, res) => res.json({ ok: true }));
  a.use(makeHttpErrorHandler(() => {}));
  return a;
}

const LIMIT = BODY_LIMITS["/api/multichat/receipt/verify"];

describe("предел тела по пути", () => {
  test("настоящий чек проходит с большим запасом", async () => {
    // Замер боевым buildReceipt, а не выдуманный размер: максимальный чек — это
    // 8 агентов (предел отправки), ответы по 4000 символов, 40 пунктов проверки.
    const answers = Array.from({ length: 8 }, (_, i) => ({
      agentId: "agent_" + i,
      role: "Аналитик " + i,
      provider: "anthropic",
      model: "claude-opus-5",
      ok: true,
      reply: "о".repeat(4000),
    }));
    const receipt = buildReceipt({
      conversationId: "c-1",
      prompt: "п".repeat(8000),
      answers,
      dissent: {
        verdict: "split",
        agreement: 0.4,
        numericConflicts: [1, 2],
        outlier: { agentId: "agent_3" },
        hedges: [{ agentId: "agent_1" }],
        checks: Array.from({ length: 40 }, (_, i) => ({ kind: "k" + i, weight: 0.9, text: "t" + i })),
      },
      askedAt: "1970-01-01T00:00:00.000Z",
    } as never);

    const payload = JSON.stringify({ receipt, hash: "a".repeat(64), signature: "b".repeat(128) });
    // Само по себе значимое утверждение: чек мал ПО УСТРОЙСТВУ — он хранит хеши
    // ответов, а не тексты. Вырастет на порядок — этот тест скажет об этом
    // раньше, чем предел начнёт отказывать живым людям.
    expect(payload.length).toBeLessThan(LIMIT / 8);

    const r = await request(app())
      .post("/api/multichat/receipt/verify")
      .set("Content-Type", "application/json")
      .send(payload);
    expect(r.status).toBe(200);
  });

  test("тело сверх предела отклоняется с 413 и внятной причиной", async () => {
    const big = JSON.stringify({ receipt: { panel: [], pad: "x".repeat(LIMIT) } });
    const r = await request(app())
      .post("/api/multichat/receipt/verify")
      .set("Content-Type", "application/json")
      .send(big);
    expect(r.status).toBe(413);
    expect(r.body.error).toBe("payload_too_large");
  });

  test("остальные пути сохраняют общий предел — иначе починка ломает медиа", async () => {
    // Ровно тот путь, ради которого общий предел и поднят до 10 МБ.
    const big = JSON.stringify({ imageBase64: "x".repeat(LIMIT * 2) });
    const r = await request(app())
      .post("/api/build/ai/parse-resume")
      .set("Content-Type", "application/json")
      .send(big);
    expect(r.status).toBe(200);
  });

  test("строка запроса и завершающий слеш не обходят предел", async () => {
    const big = JSON.stringify({ pad: "x".repeat(LIMIT) });
    for (const url of [
      "/api/multichat/receipt/verify?debug=1",
      "/api/multichat/receipt/verify/",
    ]) {
      const r = await request(app()).post(url).set("Content-Type", "application/json").send(big);
      expect(r.status, `обошли предел через ${url}`).toBe(413);
    }
  });

  test("без Content-Length запрос не отклоняется — его ловит общий предел", () => {
    // Проверяем мидлвару напрямую: через supertest этот случай не
    // воспроизводится — он ставит свой Content-Length, а `Transfer-Encoding:
    // chunked` поверх него даёт 400 (тело не читается вовсе), то есть тест
    // проверял бы не то, что написано в его названии.
    //
    // Chunked-передача не сообщает размер заранее. Молча закрывать такие запросы
    // значило бы ломать законных клиентов ради случая, который общий предел
    // express.json и так поймает.
    for (const headers of [{}, { "content-length": "не число" }, { "content-length": "" }]) {
      let passed = false;
      let err: unknown = null;
      bodyLimitByPath(
        { originalUrl: "/api/multichat/receipt/verify", headers } as never,
        {} as never,
        ((e?: unknown) => {
          if (e) err = e;
          else passed = true;
        }) as never,
      );
      expect(passed, `отклонён при headers=${JSON.stringify(headers)}`).toBe(true);
      expect(err).toBeNull();
    }
  });

  test("превышение ловится и при прямом вызове — без участия express", () => {
    // Отрицательный контроль к случаю выше: та же форма вызова обязана
    // отклонять, иначе «пропустил» ничего не доказывает.
    let err: unknown = null;
    bodyLimitByPath(
      {
        originalUrl: "/api/multichat/receipt/verify",
        headers: { "content-length": String(LIMIT + 1) },
      } as never,
      {} as never,
      ((e?: unknown) => {
        err = e ?? null;
      }) as never,
    );
    expect((err as { status?: number } | null)?.status).toBe(413);
    expect((err as { type?: string } | null)?.type).toBe("entity.too.large");
  });
});
