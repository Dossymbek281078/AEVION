import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  checkAiInputBudget,
  ANON_MAX_TOTAL_CHARS,
  ANON_MAX_MESSAGES,
} from "../src/lib/aiInputBudget";

/**
 * Верхняя граница цены ОДНОГО анонимного вызова платного ИИ.
 *
 * Замер 23.08.2026 на проде: POST без токена на /api/qcoreai/chat вернул ответ
 * от claude-opus-4-8. Учёта у анонима нет по построению (enforceFreeTokenQuota
 * первой строкой отдаёт false), а ограничитель частоты этой роли не выполняет:
 * 100 запросов за 11 с против объявленного max:30 дали 2 отказа, потому что
 * счётчик живёт в памяти процесса, а процессов несколько.
 *
 * Ограничить надёжно, не заводя общего хранилища, можно только стоимость
 * одного вызова. До этой правки её держал единственный предел — 10 МБ на тело:
 * каждое сообщение резалось до 32 000 знаков, а число сообщений не
 * ограничивалось ничем.
 */

const msg = (n: number) => ({ role: "user", content: "x".repeat(n) });

describe("аноним: у одного запроса есть верхняя граница", () => {
  test("обычный разговор проходит", () => {
    const conversation = Array.from({ length: 20 }, () => msg(500)); // 10 000 знаков
    expect(checkAiInputBudget(conversation, true)).toEqual({ ok: true });
  });

  test("слишком много знаков — отказ с числами", () => {
    const huge = [msg(ANON_MAX_TOTAL_CHARS + 1)];
    const v = checkAiInputBudget(huge, true);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error).toBe("input_too_large");
    // В отказе должно быть и «сколько можно», и «сколько пришло»: без второго
    // человек не понимает, насколько промахнулся, и пробует наугад.
    expect(v.limit).toBe(ANON_MAX_TOTAL_CHARS);
    expect(v.got).toBe(ANON_MAX_TOTAL_CHARS + 1);
  });

  test("много КОРОТКИХ сообщений тоже считается — иначе предел обходится", () => {
    // Ровно этой дырой и была прежняя защита: каждое сообщение резалось до
    // 32 000 знаков, а их число не ограничивалось ничем.
    const many = Array.from({ length: 1000 }, () => msg(100)); // 100 000 знаков
    const v = checkAiInputBudget(many, true);
    expect(v.ok).toBe(false);
  });

  test("предел по числу сообщений срабатывает раньше, чем по знакам", () => {
    const many = Array.from({ length: ANON_MAX_MESSAGES + 1, }, () => msg(1));
    const v = checkAiInputBudget(many, true);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error).toBe("too_many_messages");
  });

  test("вошедшего это не касается", () => {
    const huge = Array.from({ length: 5000 }, () => msg(32_000));
    expect(checkAiInputBudget(huge, false)).toEqual({ ok: true });
  });

  test("нестроковое содержимое не роняет подсчёт", () => {
    expect(checkAiInputBudget([{ content: 42 }, { content: null }, {}], true)).toEqual({ ok: true });
  });

  test("предел ниже потолка тела запроса — иначе он ничего не меняет", () => {
    // 10 МБ общего предела тела — это порядка 10 млн знаков. Наш предел обязан
    // быть меньше на порядки, иначе он декоративный.
    expect(ANON_MAX_TOTAL_CHARS).toBeLessThan(100_000);
  });
});

describe("ворота стоят на обеих платных ручках", () => {
  const src = readFileSync(join(__dirname, "..", "src", "routes", "qcoreai.ts"), "utf8");

  test("/chat и /chat-stream обе спрашивают предел", () => {
    // Сама проверка бесполезна, если её не позвали: механизм собран, части
    // не связаны — этот класс уже стоил нам находок.
    //
    // Считаются именно ВЫЗОВЫ с аргументом, а не вхождения имени: первая
    // версия этого теста считала и строку импорта, то есть при одном
    // подключённом обработчике из двух всё равно была бы зелёной.
    const calls = src.split("checkAiInputBudget(messages").length - 1;
    expect(calls, "ворота стоят не на обеих ручках").toBe(2);
  });

  test("поток тоже под ограничителем частоты", () => {
    // У /chat ограничитель был, у /chat-stream — нет, при той же цене вызова.
    expect(src).toContain('qcoreaiRouter.post("/chat-stream", chatLimiter');
  });

  test("отказ — 413, а не 500", () => {
    // Слишком большой запрос это ошибка ЗАПРОСА. 5xx поднял бы Sentry на
    // каждом заходе робота и утопил настоящие аварии (§15г).
    const gate = src.slice(src.indexOf("checkAiInputBudget(messages"));
    expect(gate.slice(0, 400)).toContain("status(413)");
  });
});

describe("ИИ-тренер шахмат под теми же воротами", () => {
  // 27.08.2026 проверено на проде: POST /api/coach/chat БЕЗ входа в аккаунт
  // возвращает разбор позиции от claude-opus-4-8. Это третье обещание карточки
  // модуля («тренер, который объясняет ход») — и оно же самый посещаемый
  // платный вызов на день запуска.
  //
  // Собственные пределы ручки: 40 сообщений x 16 000 знаков + 8 000 системных =
  // 648 000 знаков, около 162 тысяч входных токенов ЗА ОДИН ВЫЗОВ. Это в
  // двадцать семь раз больше, чем разрешено анониму в qcoreai.
  const src = readFileSync(join(__dirname, "..", "src", "routes", "coach.ts"), "utf8");

  test("обе платные ручки тренера спрашивают предел", () => {
    // /chat и /chat/stream — обе зовут Anthropic. Считаются ВЫЗОВЫ, а не
    // упоминания имени: рядом стоит комментарий, где оно тоже есть.
    expect(src.split("checkAiInputBudget(messages").length - 1).toBe(2);
  });

  test("обе стоят под ограничителем частоты", () => {
    expect(src).toContain('generationLimit("coach_chat")');
    expect(src).toContain('generationLimit("coach_chat_stream")');
  });

  test("у ручек РАЗНЫЕ ключи счётчика", () => {
    // Один ключ на две ручки означал бы общий бюджет: поток съедал бы лимит
    // обычного разбора. Ровно этот дефект уже находили у шести лимитеров,
    // забывших keyPrefix. Считаем ВХОЖДЕНИЯ каждого ключа: их должно быть по
    // одному, а не два одинаковых.
    const keys = src.split("generationLimit(").slice(1).map((chunk) => chunk.slice(0, chunk.indexOf(")")));
    expect(keys.length, "ограничителей не два").toBe(2);
    expect(new Set(keys).size, "обе ручки считают в ОДИН счётчик").toBe(2);
  });

  test("отказ — 413, а не 500", () => {
    const at = src.indexOf("checkAiInputBudget(messages");
    expect(src.slice(at, at + 400)).toContain("status(413)");
  });
});
