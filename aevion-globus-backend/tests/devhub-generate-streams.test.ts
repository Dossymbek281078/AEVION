import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

// Шаг 1 стриминга генерации (07.09.2026): для anthropic без картинок ответ
// читается ПОТОКОМ (streamProviderResilient), а не callProvider. Тест
// закрепляет СЛЕДСТВИЯ, а не форму: (1) файлы собираются из чанков потока;
// (2) расход учтён по done-событию (insertSmartRun получает настоящую цену
// пути); (3) старый callProvider на этом пути НЕ зовётся — иначе легко
// получить двойной вызов модели или двойной учёт.
//
// Честная сноска: самый ПЕРВЫЙ прогон файла один раз упал (лог утрачен,
// конвейер съел), три повтора и прогон в компании соседей — зелёные,
// мутация учёта ловится. Если файл флейкнет в полном наборе — смотреть
// сюда: подозрение на первый transform, воспроизвести не удалось.

const { chunks, state } = vi.hoisted(() => {
  // ДВА файла: первый объект закрывается задолго до конца — по нему обязан
  // прийти file_ready ещё ДО результата (шаг 2). Первый файл раздут за
  // порог разбора (~4КБ), чтобы инкрементальный salvage точно запустился.
  const f1 = { path: "index.html", content: "<h1>Streamed!</h1>" + "x".repeat(4200), language: "html" };
  const f2 = { path: "style.css", content: "body{}", language: "css" };
  const reply = JSON.stringify({ files: [f1, f2] });
  // Резать СТРОГО на границе второго объекта: прежняя арифметика (-12)
  // попадала внутрь первого — фикстура сама делала file_ready невозможным,
  // и «нет события» было ошибкой ТЕСТА, не продукта (поймано пробой salvage).
  const cut = reply.indexOf('{"path":"style.css"');
  return {
    chunks: [reply.slice(0, 7), reply.slice(7, cut), reply.slice(cut)],
    state: { callProviderCalls: 0, runs: [] as any[], streamThrows: false },
  };
});

vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [{ id: "anthropic", defaultModel: "claude-test", configured: true }],
  callProvider: async () => {
    state.callProviderCalls++;
    return { reply: JSON.stringify({ files: [{ path: "fallback.html", content: "<p>fb</p>", language: "html" }] }), model: "claude-test", usage: { prompt_tokens: 1, completion_tokens: 1 } };
  },
  streamProviderResilient: async function* () {
    if (state.streamThrows) throw new Error("stream down");
    for (const c of chunks) yield { kind: "text", text: c };
    yield { kind: "done", tokensIn: 111, tokensOut: 222 };
  },
}));
vi.mock("../src/lib/smartRunLog", () => ({
  insertSmartRun: (row: any) => { state.runs.push(row); },
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

async function app() {
  process.env.AUTH_JWT_SECRET = "test-secret-for-stream-gen-long-enough";
  const { devhubRouter } = await import("../src/routes/devhub");
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("генерация читает anthropic ПОТОКОМ", () => {
  test("файлы собраны из чанков, расход учтён, старый путь не тронут", async () => {
    const a = await app();
    const guest = { "x-devhub-guest": "stream-gen-guest-1" };
    const созд = await request(a).post("/api/devhub/projects").set(guest)
      .send({ name: "stream test", stack: "static" });
    expect(созд.status).toBe(201);
    const pid = созд.body.project.id;

    const ген = await request(a).post(`/api/devhub/projects/${pid}/generate`).set(guest)
      .send({ prompt: "streamed page" });
    expect(ген.status).toBe(200);
    expect(ген.body.aiGenerated).toBe(true);
    // Файл именно из ПОТОКА (маркер Streamed!), а не из callProvider-заглушки.
    const idx = (ген.body.files as Array<{ path: string; content: string }>).find((f) => f.path === "index.html");
    expect(idx?.content, "файлы не из потоковых чанков").toContain("Streamed!");
    expect(state.callProviderCalls, "стрим-путь всё равно позвал callProvider — двойной вызов модели").toBe(0);
    // Учёт по done-событию: запись расхода с меткой гостевой генерации.
    expect(state.runs.length, "расход потоковой генерации не учтён").toBeGreaterThanOrEqual(1);
    // Per-run видимость (обещание Show HN): точные токены запуска в ответе.
    expect(ген.body.runTokens, "runTokens не вернулись").toEqual({ in: 111, out: 222 });
    expect(typeof ген.body.runCostUsd, "runCostUsd не вернулся").toBe("number");
    const метки = state.runs.map((r) => String(r.module));
    expect(метки.some((m) => m.includes("devhub")), "метка учёта потеряла модуль: " + метки.join(",")).toBe(true);
  });

  test("file_ready первого файла приходит в SSE ДО результата (шаг 2)", async () => {
    const a = await app();
    const guest = { "x-devhub-guest": "stream-gen-guest-sse" };
    const созд = await request(a).post("/api/devhub/projects").set(guest)
      .send({ name: "sse order", stack: "static" });
    const pid = созд.body.project.id;
    const r = await request(a).post(`/api/devhub/projects/${pid}/generate/stream`).set(guest)
      .send({ prompt: "two files" });
    const текст = r.text;
    const ready = текст.indexOf('"file_ready"');
    const result = текст.indexOf('"result"');
    expect(ready, "события file_ready нет в SSE вовсе").toBeGreaterThan(-1);
    expect(result, "результата нет — ручка сломана").toBeGreaterThan(-1);
    expect(ready, "file_ready пришёл ПОСЛЕ результата — прогресс декоративен").toBeLessThan(result);
    expect(текст.indexOf('"index.html"'), "объявлен не тот файл").toBeGreaterThan(-1);
  });

  test("отказ потока НЕ фатален: работает прежний путь с фолбэком", async () => {
    state.streamThrows = true;
    state.callProviderCalls = 0;
    try {
      const a = await app();
      const guest = { "x-devhub-guest": "stream-gen-guest-2" };
      const созд = await request(a).post("/api/devhub/projects").set(guest)
        .send({ name: "stream fb", stack: "static" });
      const pid = созд.body.project.id;
      const ген = await request(a).post(`/api/devhub/projects/${pid}/generate`).set(guest)
        .send({ prompt: "page" });
      expect(ген.status).toBe(200);
      const fb = (ген.body.files as Array<{ path: string }>).find((f) => f.path === "fallback.html");
      expect(fb, "фолбэк-путь не сработал при мёртвом потоке").toBeTruthy();
      expect(state.callProviderCalls).toBeGreaterThanOrEqual(1);
    } finally {
      state.streamThrows = false;
    }
  });
});
