import { describe, test, expect, vi } from "vitest";

import { clientIp, realIpShape } from "../src/lib/rateLimit.js";

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

describe("форма X-Real-IP: печатаем вид значения, не значение", () => {
  // Ветка X-Real-IP не срабатывала даже при соседе из 100.x и заголовке на
  // месте. Какое из условий падает — снаружи не видно, а три догадки подряд
  // оказались мимо. Поэтому зонд печатает исход, а не предположение.
  test.each([
    ["203.0.113.7", "адрес"],
    ["2001:db8::1", "адрес"],
    ["203.0.113.7, 100.64.0.1", "список"],
    ["203.0.113.7:51234", "с-портом"],
    ["  ", "пусто"],
    ["не-адрес", "иное"],
    [undefined, "нет"],
    [["203.0.113.7"], "не-строка"],
  ])("%s -> %s", (input, expected) => {
    expect(realIpShape(input)).toBe(expected);
  });

  test("само значение в форму не попадает", () => {
    expect(realIpShape("203.0.113.7")).not.toContain("203");
  });
});
