// Панель платежей обязана говорить, где лежат её данные — ВСЕГДА, а не только
// пока экран пуст.
//
// Замер 27.08.2026: оговорка «this dashboard reflects the same localStorage
// your other surfaces write to» жила в блоке «No data yet». Создал первую
// ссылку — блок пропал, и дальше экран выглядит обычной платёжной панелью.
// Оговорка показывалась ровно тогда, когда терять нечего, и исчезала ровно
// тогда, когда данные появились.

import { describe, expect, it } from "vitest";
import {
  dashboardNotice,
  readServerPersistence,
  type ServerPersistence,
} from "./persistenceNotice";

describe("состояние серверного хранилища читается тремя исходами", () => {
  it("kv — подключено", () => {
    expect(readServerPersistence({ persistence: "kv" })).toBe("kv");
  });

  it("memory — так отвечает прод на 27.08.2026", () => {
    expect(readServerPersistence({ persistence: "memory" })).toBe("memory");
  });

  const notAnswer: Array<[string, unknown]> = [
    ["сервер не ответил", null],
    ["ответ не объект", "memory"],
    ["поля нет вовсе", { status: "ok" }],
    ["значение незнакомое", { persistence: "postgres" }],
    ["значение не строка", { persistence: 1 }],
  ];

  it.each(notAnswer)("%s → unknown, а НЕ «всё хорошо»", (_n, input) => {
    expect(readServerPersistence(input)).toBe("unknown");
  });
});

describe("надпись про хранение не исчезает вместе с пустым экраном", () => {
  const modes: ServerPersistence[] = ["kv", "memory", "unknown"];

  it.each(modes)(
    "сервер=%s: надпись есть и с данными, и без них",
    (mode) => {
      for (const hasData of [true, false]) {
        const n = dashboardNotice(mode, hasData);
        expect(n, `${mode}/${hasData}`).toBeTruthy();
        expect(n.title.length).toBeGreaterThan(0);
        expect(n.body.length).toBeGreaterThan(0);
      }
    },
  );

  it.each(modes)("сервер=%s: сказано, что данные только в браузере", (mode) => {
    for (const hasData of [true, false]) {
      expect(dashboardNotice(mode, hasData).body).toMatch(/браузере/);
    }
  });

  it.each(modes)("сервер=%s: сказано, что это не касса", (mode) => {
    // Главное, что человек должен унести с экрана: настоящие деньги сюда
    // не приходят. Без этой фразы «витрина» читается как «пока пусто».
    for (const hasData of [true, false]) {
      expect(dashboardNotice(mode, hasData).body).toMatch(
        /не касса|настоящие деньги/,
      );
    }
  });

  it("с данными предупреждение строже: названа причина потери", () => {
    const withData = dashboardNotice("kv", true);
    expect(withData.tone).toBe("warn");
    expect(withData.body).toMatch(/очистка данных сайта|другое устройство/);
  });

  it("сервер в памяти — сказано и про серверные поверхности", () => {
    const n = dashboardNotice("memory", true);
    expect(n.tone).toBe("warn");
    expect(n.body).toMatch(/постоянное хранилище/i);
  });

  it("сервер не ответил — это названо отсутствием ответа, а не порядком", () => {
    const n = dashboardNotice("unknown", true);
    expect(n.tone).toBe("warn");
    expect(n.body).toMatch(/выяснить не удалось/);
    // И ни в коем случае не обещание сохранности.
    expect(n.body).not.toMatch(/сохранено|сохраняются надёжно/);
  });

  it("контроль: тексты для разных состояний РАЗНЫЕ", () => {
    // Без этого все проверки выше прошли бы и на одной константе,
    // а состояние сервера ни на что бы не влияло.
    const bodies = new Set([
      dashboardNotice("kv", true).body,
      dashboardNotice("memory", true).body,
      dashboardNotice("unknown", true).body,
      dashboardNotice("kv", false).body,
    ]);
    expect(bodies.size).toBe(4);
  });
});
