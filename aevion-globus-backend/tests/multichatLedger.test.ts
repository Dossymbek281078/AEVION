// Лента веера мультичата: вопрос + ответ каждого агента.
//
// Что здесь защищается. Веер писал в ленту ТОЛЬКО вопрос пользователя: ответы
// агентов не сохранялись вообще, а три читателя (экспорт, публичная ссылка,
// расход) выбирали реплики строгим равенством conversationId. Каждый из них
// отдавал валидный ответ — просто без половины разговора, а счётчик расхода
// показывал 0 вызовов и $0.0000 на любой беседе. Ни один тест этого не ловил,
// потому что ошибки не было: было тихо неправильно.
//
// Тесты идут по настоящему пути хранения (JSON-стор, без Postgres), а не по
// заглушкам: подменяется только каталог данных.

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { listChatTurns, recordChatTurn } from "../src/lib/chatHistory";
import { usageToTokens } from "../src/lib/usageTokens";
import { aggregateUsage } from "../src/routes/multichat";

let dataDir: string;
let prevDataDir: string | undefined;
let prevDbUrl: string | undefined;

beforeEach(() => {
  prevDataDir = process.env.AEVION_DATA_DIR;
  prevDbUrl = process.env.DATABASE_URL;
  // Ветка Postgres в этих тестах не участвует — иначе прогон зависит от того,
  // что лежит в окружении разработчика.
  delete process.env.DATABASE_URL;
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-multichat-ledger-"));
  process.env.AEVION_DATA_DIR = dataDir;
});

afterEach(() => {
  if (prevDataDir === undefined) delete process.env.AEVION_DATA_DIR;
  else process.env.AEVION_DATA_DIR = prevDataDir;
  if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prevDbUrl;
  rmSync(dataDir, { recursive: true, force: true });
});

/** Готовая лента с заданными временами — порядок вставки намеренно нарушен. */
function seedTurns(items: Array<Record<string, unknown>>) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "chat-history.json"), JSON.stringify({ items }), "utf8");
}

describe("лента: беседа вместе с подветками агентов", () => {
  test("выборка по беседе возвращает и вопрос, и ответы всех агентов", async () => {
    const conv = "conv_1111";
    await recordChatTurn({ userId: "u1", conversationId: conv, role: "user", content: "вопрос" });
    await recordChatTurn({
      userId: "u1",
      conversationId: `${conv}:analyst`,
      role: "assistant",
      content: "ответ аналитика",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      tokensIn: 100,
      tokensOut: 200,
    });
    await recordChatTurn({
      userId: "u1",
      conversationId: `${conv}:skeptic`,
      role: "system",
      content: "[no-reply] provider_timeout",
    });

    const withThreads = await listChatTurns({ userId: "u1", conversationId: conv, includeAgentThreads: true });
    expect(withThreads.map((t) => t.content).sort()).toEqual(
      ["[no-reply] provider_timeout", "ответ аналитика", "вопрос"].sort(),
    );

    // Прежнее поведение (строгое равенство) остаётся доступным и по-прежнему
    // видит только вопрос — именно на нём и держались три сломанных читателя.
    const strict = await listChatTurns({ userId: "u1", conversationId: conv });
    expect(strict).toHaveLength(1);
    expect(strict[0].role).toBe("user");
  });

  test("подветки чужой беседы не попадают в выборку", async () => {
    const conv = "conv_1111";
    await recordChatTurn({ userId: "u1", conversationId: conv, role: "user", content: "наш вопрос" });
    await recordChatTurn({
      userId: "u1",
      conversationId: `${conv}:analyst`,
      role: "assistant",
      content: "наш ответ",
    });
    // Сосед с общим префиксом: если подветки искать простым startsWith по
    // conv_1111 без разделителя, его реплика утечёт в чужую выгрузку.
    await recordChatTurn({
      userId: "u1",
      conversationId: "conv_11112",
      role: "user",
      content: "чужой вопрос",
    });
    await recordChatTurn({
      userId: "u1",
      conversationId: "conv_11112:analyst",
      role: "assistant",
      content: "чужой ответ",
    });

    const turns = await listChatTurns({ userId: "u1", conversationId: conv, includeAgentThreads: true });
    expect(turns).toHaveLength(2);
    expect(turns.every((t) => !t.content.startsWith("чужой"))).toBe(true);
  });

  test("параллельные ответы агентов не затирают друг друга", async () => {
    // Веер пишет ответы одновременно, а файловое хранилище — это
    // read-modify-write целого JSON. Без очереди записи из восьми ответов в
    // ленте оседал один-два: запрос успешен, файл валиден, разговора нет.
    // Живой прогон 2026-08-10 показал ровно это — 1 ответ из 3.
    const conv = "conv_3333";
    const agents = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
    await Promise.all(
      agents.map((a) =>
        recordChatTurn({
          userId: "u1",
          conversationId: `${conv}:${a}`,
          role: "assistant",
          content: `ответ ${a}`,
        }),
      ),
    );

    const turns = await listChatTurns({ userId: "u1", conversationId: conv, includeAgentThreads: true });
    expect(turns).toHaveLength(agents.length);
    expect(turns.map((t) => t.content).sort()).toEqual(agents.map((a) => `ответ ${a}`).sort());
  });

  test("реплики отдаются по времени, а не по порядку записи в файл", async () => {
    const conv = "conv_2222";
    seedTurns([
      {
        id: "t3",
        userId: "u1",
        conversationId: `${conv}:practic`,
        role: "assistant",
        content: "третий",
        provider: null,
        model: null,
        tokensIn: null,
        tokensOut: null,
        createdAt: "2026-08-10T10:00:03.000Z",
      },
      {
        id: "t1",
        userId: "u1",
        conversationId: conv,
        role: "user",
        content: "первый",
        provider: null,
        model: null,
        tokensIn: null,
        tokensOut: null,
        createdAt: "2026-08-10T10:00:01.000Z",
      },
      {
        id: "t2",
        userId: "u1",
        conversationId: `${conv}:analyst`,
        role: "assistant",
        content: "второй",
        provider: null,
        model: null,
        tokensIn: null,
        tokensOut: null,
        createdAt: "2026-08-10T10:00:02.000Z",
      },
    ]);

    const turns = await listChatTurns({ userId: "u1", conversationId: conv, includeAgentThreads: true });
    expect(turns.map((t) => t.content)).toEqual(["первый", "второй", "третий"]);
  });
});

describe("расход по беседе", () => {
  test("считает вызовы, токены и цену по прайс-листу, не трогая вопросы", () => {
    const out = aggregateUsage([
      { role: "user", content: "вопрос" },
      {
        role: "assistant",
        content: "a",
        provider: "anthropic",
        model: "claude-sonnet-4-6", // $3 / $15 за 1M
        tokensIn: 1_000_000,
        tokensOut: 1_000_000,
      },
      {
        role: "assistant",
        content: "b",
        provider: "openai",
        model: "gpt-4o-mini", // $0.15 / $0.6 за 1M
        tokensIn: 1_000_000,
        tokensOut: 1_000_000,
      },
      { role: "system", content: "[no-reply] provider_timeout" },
    ]);

    expect(out.calls).toBe(2);
    expect(out.tokens).toEqual({ input: 2_000_000, output: 2_000_000, total: 4_000_000 });
    expect(out.costUsd).toBeCloseTo(3 + 15 + 0.15 + 0.6, 6);
    expect(out.unpricedCalls).toBe(0);
  });

  test("вызов без известной цены считается отдельно, а не как бесплатный", () => {
    const out = aggregateUsage([
      { role: "assistant", content: "a", provider: "groq", model: "llama-3.3-70b-versatile", tokensIn: 10, tokensOut: 10 },
      { role: "assistant", content: "b", provider: "неизвестный", model: "какая-то", tokensIn: 10, tokensOut: 10 },
    ]);

    expect(out.calls).toBe(2);
    expect(out.costUsd).toBe(0);
    expect(out.unpricedCalls).toBe(2);
    // Токены известны даже там, где цена — нет.
    expect(out.tokens.total).toBe(40);
  });

  test("пустая беседа — честные нули, а не отсутствие ответа", () => {
    expect(aggregateUsage([])).toEqual({
      calls: 0,
      tokens: { input: 0, output: 0, total: 0 },
      costUsd: 0,
      unpricedCalls: 0,
    });
  });
});

describe("нормализация usage провайдеров", () => {
  test("три формата дают одни и те же токены", () => {
    expect(usageToTokens({ input_tokens: 12, output_tokens: 34 })).toEqual({ tokensIn: 12, tokensOut: 34 });
    expect(usageToTokens({ prompt_tokens: 12, completion_tokens: 34 })).toEqual({ tokensIn: 12, tokensOut: 34 });
    expect(usageToTokens({ promptTokenCount: 12, candidatesTokenCount: 34 })).toEqual({ tokensIn: 12, tokensOut: 34 });
  });

  test("мусор и отсутствие usage не роняют счёт", () => {
    expect(usageToTokens(null)).toEqual({ tokensIn: 0, tokensOut: 0 });
    expect(usageToTokens({ input_tokens: "много", output_tokens: NaN })).toEqual({ tokensIn: 0, tokensOut: 0 });
  });
});
