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
  const reply = JSON.stringify({
    files: [{ path: "index.html", content: "<h1>Streamed!</h1>", language: "html" }],
  });
  // Ответ рвётся на неровные куски — как в жизни: границы чанков не
  // совпадают с границами JSON.
  return {
    chunks: [reply.slice(0, 7), reply.slice(7, 31), reply.slice(31)],
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
    const метки = state.runs.map((r) => String(r.module));
    expect(метки.some((m) => m.includes("devhub")), "метка учёта потеряла модуль: " + метки.join(",")).toBe(true);
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
