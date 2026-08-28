import { describe, test, expect, vi } from "vitest";

import { clientIp } from "../src/lib/rateLimit.js";

// ОТДЕЛЬНЫЙ файл: зонд печатает не больше трёх форм за жизнь процесса, а vitest
// даёт каждому файлу свой модульный экземпляр. Здесь тратятся ровно две.
describe("зонд называет ВЕТКУ, по которой пошёл ключ", () => {
  test("сосед внутренний и заголовок — адрес: ветка x-real-ip", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    clientIp({
      ip: "100.64.0.1",
      socket: { remoteAddress: "100.64.0.1" },
      headers: { "x-real-ip": "203.0.113.7" },
      originalUrl: "/api/x",
    });
    // console.warn подставляет %s только при печати, поэтому проверяем
    // АРГУМЕНТЫ как элементы, а не склеенную строку: в шаблоне слово
    // «x-real-ip» встречается и само по себе.
    const args = warn.mock.calls.flat();
    expect(args, "ветка названа неверно").toContain("x-real-ip");
    warn.mockRestore();
  });

  test("заголовок — СПИСОК: ветка req.ip, хотя сосед внутренний", () => {
    // Ровно тот случай, ради которого зонд и дописан: условие падает не там,
    // где кажется, и по коду ответа этого не видно.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    clientIp({
      ip: "100.64.0.2",
      socket: { remoteAddress: "100.64.0.2" },
      headers: { "x-real-ip": "203.0.113.7, 100.64.0.1" },
      originalUrl: "/api/x",
    });
    const args = warn.mock.calls.flat();
    expect(args).toContain("req.ip");
    expect(args).toContain("список");
    warn.mockRestore();
  });
});
