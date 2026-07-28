import { describe, it, expect } from "vitest";
import { publicTurnFields, sanitizeSharedTurn } from "../src/routes/multichat";

/**
 * Публичная ссылка на разговор не должна отдавать чужие внутренние поля.
 *
 * Найдено 28.07 чтением, не тестом. Ручка `GET /api/multichat/shared/:token`
 * открыта без аутентификации и снимала поля так:
 *
 *     const { usage, ...rest } = t;   // "Strip per-turn usage"
 *
 * Поля `usage` у строки истории НЕ СУЩЕСТВУЕТ: `ChatTurn` содержит `userId`,
 * `tokensIn`, `tokensOut`. То есть деструктуризация не убирала ничего, и
 * публично уходили внутренний идентификатор владельца и счётчики токенов —
 * ровно та «cost/billing info», которую комментарий обещал не отдавать.
 *
 * Почему промолчал компилятор: перед снятием полей массив приводился к
 * `Array<Record<string, unknown>>`, и приведение стёрло тип — выбирать
 * несуществующий ключ из `Record<string, unknown>` совершенно законно.
 *
 * Поэтому фильтр теперь БЕЛЫЙ список, а не чёрный. Чёрный список ошибается
 * молча при каждом новом поле в таблице; белый — по умолчанию не отдаёт ничего
 * нового, пока его не впишут осознанно.
 */

describe("публичная ссылка на разговор не течёт", () => {
  it("отдаёт только разрешённые поля", () => {
    const turn = {
      id: "t1",
      userId: "usr_секрет",
      conversationId: "c1",
      role: "assistant",
      content: "ответ",
      provider: "anthropic",
      model: "claude-opus-5",
      tokensIn: 1234,
      tokensOut: 5678,
      createdAt: "2026-07-28T00:00:00.000Z",
    };
    expect(Object.keys(sanitizeSharedTurn(turn)).sort()).toEqual([...publicTurnFields].sort());
  });

  it("внутренний идентификатор владельца и счётчики токенов не уходят", () => {
    const out = sanitizeSharedTurn({
      id: "t1",
      userId: "usr_секрет",
      tokensIn: 1234,
      tokensOut: 5678,
      content: "ответ",
      role: "assistant",
      createdAt: "2026-07-28T00:00:00.000Z",
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain("usr_секрет");
    expect(json).not.toContain("1234");
    expect(json).not.toContain("5678");
    expect(out).not.toHaveProperty("userId");
    expect(out).not.toHaveProperty("tokensIn");
    expect(out).not.toHaveProperty("tokensOut");
  });

  it("новое поле в таблице не просачивается само", () => {
    // Главная причина белого списка: назавтра в chat_turns появится колонка
    // (ip, стоимость, ключ провайдера), и чёрный список отдал бы её наружу.
    const out = sanitizeSharedTurn({
      id: "t1",
      role: "user",
      content: "вопрос",
      createdAt: "2026-07-28T00:00:00.000Z",
      internalCostUsd: 0.42,
      requesterIp: "203.0.113.7",
    });
    expect(out).not.toHaveProperty("internalCostUsd");
    expect(out).not.toHaveProperty("requesterIp");
  });

  it("отсутствующее необязательное поле не превращается в undefined-ключ", () => {
    // Иначе ответ обрастает мусором вида "model": null у каждого хода.
    const out = sanitizeSharedTurn({ id: "t1", role: "user", content: "в", createdAt: "x" });
    expect(Object.keys(out).sort()).toEqual(["content", "createdAt", "id", "role"]);
  });

  it("белый список не пуст и содержит то, ради чего страница существует", () => {
    // Страховка от «отфильтровали всё»: публичная ссылка обязана показывать
    // сам разговор, иначе фильтр из защиты превращается в поломку.
    expect(publicTurnFields).toContain("content");
    expect(publicTurnFields).toContain("role");
    expect(publicTurnFields).not.toContain("userId");
  });
});
