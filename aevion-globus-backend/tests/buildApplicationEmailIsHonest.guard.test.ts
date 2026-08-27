import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Письмо кандидату о решении по заявке: «отправлено» только если отправлено.
 *
 * Замер 28.08.2026, `notifyCandidate` в build/applications.ts:
 *
 * 1. После `await fetch(...)` строка `console.info("email sent")` печаталась
 *    БЕЗ ПРОВЕРКИ ответа. Отказ провайдера (4xx, 5xx, исчерпанная квота)
 *    выглядел в журнале удачей. Это хуже отсутствия журнала: на такую запись
 *    потом ссылаются как на доказательство отправки.
 *
 * 2. `if (!apiKey) return;` — молчаливый пропуск, когда почта не настроена.
 *    Кандидат не узнаёт решения по своей заявке, и об этом не знает никто.
 *
 * Решения не изменены: без ключа письмо по-прежнему не уходит, отказ
 * провайдера по-прежнему не роняет обработку заявки. Изменилось одно — оба
 * случая перестали быть невидимыми.
 *
 * СТОРОЖ ПО ИСХОДНИКУ. Поведенческая проверка потребовала бы подменять сеть и
 * ключ окружения внутри модуля, который поднимает весь роутер; в этом файле
 * такого харнеса нет. Он ловит возврат «печатаем успех не глядя» и пропажу
 * следа, но не докажет, что журнал получил именно это сообщение.
 */

const FILE = path.join(__dirname, "..", "src", "routes", "build", "applications.ts");

function code(): string {
  return fs
    .readFileSync(FILE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

/** Тело функции уведомления кандидата. */
function notifyBody(): string {
  const c = code();
  const start = c.indexOf("async function notifyCandidate");
  expect(start, "функция уведомления кандидата не найдена — сторож смотрит не туда").toBeGreaterThan(-1);
  const end = c.indexOf("\n}", start);
  return c.slice(start, end);
}

describe("письмо кандидату честно отчитывается", () => {
  test("прибор работает: тело функции найдено и непустое", () => {
    const b = notifyBody();
    expect(b.length).toBeGreaterThan(300);
    expect(b).toContain("api.resend.com");
  });

  test("ответ провайдера читается, а не игнорируется", () => {
    const b = notifyBody();
    expect(b, "ответ провайдера снова не проверяется").toMatch(/if \(!resp\.ok\)/);
    // Успех печатается ПОСЛЕ проверки, иначе отказ снова выглядит удачей.
    const okAt = b.indexOf("if (!resp.ok)");
    const sentAt = b.indexOf("email sent to");
    expect(okAt).toBeGreaterThan(-1);
    expect(sentAt).toBeGreaterThan(okAt);
  });

  test("отказ провайдера назван вместе с кандидатом и решением", () => {
    const b = notifyBody();
    expect(b).toContain("ПИСЬМО НЕ ПРИНЯТО ПРОВАЙДЕРОМ");
    expect(b).toMatch(/ПИСЬМО НЕ ПРИНЯТО ПРОВАЙДЕРОМ[^`]*\$\{candidateId\}/);
    expect(b).toMatch(/ПИСЬМО НЕ ПРИНЯТО ПРОВАЙДЕРОМ[^`]*\$\{status\}/);
  });

  test("пропуск без настроенной почты тоже оставляет след", () => {
    const b = notifyBody();
    expect(b).toContain("ПИСЬМО НЕ ОТПРАВЛЕНО");
    expect(b).toMatch(/ПИСЬМО НЕ ОТПРАВЛЕНО[^`]*\$\{candidateId\}/);
  });

  test("направление: отказ письма НЕ роняет обработку заявки", () => {
    // Заявка уже принята или отклонена; ронять обработку из-за письма нельзя.
    expect(notifyBody()).not.toMatch(/throw\s/);
  });
});
