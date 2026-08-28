import { describe, test, expect, vi } from "vitest";

import { clientIp } from "../src/lib/rateLimit.js";

// ОТДЕЛЬНЫЙ файл намеренно. Зонд формы соседа печатает не больше трёх строк за
// жизнь ПРОЦЕССА, а vitest даёт каждому файлу свой модульный экземпляр. В общем
// файле соседние тесты успевали израсходовать потолок, и проверка «повтор не
// печатается» оставалась зелёной даже со снятой защитой от повтора —
// мутация выжила и показала это.
describe("зонд формы соседа: поведение", () => {
  test("повтор ОДНОЙ формы не печатается второй раз", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = { ip: "9.9.9.9", socket: { remoteAddress: "9.9.9.9" }, headers: {}, originalUrl: "/api/x" };
    clientIp(req);
    expect(warn.mock.calls.length, "первая форма обязана напечататься").toBe(1);
    clientIp(req);
    clientIp(req);
    clientIp(req);
    expect(warn.mock.calls.length, "повтор той же формы напечатался снова").toBe(1);
    warn.mockRestore();
  });

  test("больше трёх строк за жизнь процесса не печатается", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = warn.mock.calls.length;
    for (let i = 10; i < 30; i++) {
      clientIp({ ip: i + ".0.0.1", socket: { remoteAddress: i + ".0.0.1" }, headers: {}, originalUrl: "/api/x" });
    }
    expect(warn.mock.calls.length - before).toBeLessThanOrEqual(3);
    warn.mockRestore();
  });
});
