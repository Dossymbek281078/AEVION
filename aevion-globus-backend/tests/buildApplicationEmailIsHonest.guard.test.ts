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

describe("оповещения о вакансиях считают принятое, а не разосланное", () => {
  const ALERTS = path.join(__dirname, "..", "src", "routes", "build", "alerts.ts");
  const alerts = () =>
    fs
      .readFileSync(ALERTS, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");

  test("прибор работает: файл читается и рассылка в нём есть", () => {
    const a = alerts();
    expect(a.length).toBeGreaterThan(500);
    expect(a).toContain("api.resend.com");
  });

  test("итог считает ПРИНЯТОЕ провайдером", () => {
    const a = alerts();
    // Раньше печаталось «sent to ${matches.length} subscribers» безусловно:
    // отказ во всех пачках выглядел полной рассылкой.
    expect(a, "итог снова считает разосланное нами, а не принятое").not.toMatch(
      /job alerts sent to \$\{matches\.length\}/,
    );
    expect(a).toMatch(/accepted for \$\{accepted\} of \$\{matches\.length\}/);
  });

  test("отказ пачки назван вместе с числом адресов и вакансией", () => {
    const a = alerts();
    expect(a).toContain("ПАЧКА ОПОВЕЩЕНИЙ НЕ ПРИНЯТА");
    expect(a).toMatch(/ПАЧКА ОПОВЕЩЕНИЙ НЕ ПРИНЯТА[^`]*\$\{batch\.length\}/);
    expect(a).toMatch(/ПАЧКА ОПОВЕЩЕНИЙ НЕ ПРИНЯТА[^`]*vacancy\.id/);
  });

  test("ответ провайдера читается", () => {
    expect(alerts()).toMatch(/if \(resp\.ok\)/);
  });
});
