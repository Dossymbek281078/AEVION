/**
 * Норма гостя Мультичата — личная (2 в сутки на устройство), адрес держит только потолок (10 в сутки).
 *
 * Замер на проде 30.10.2026: три разных x-aevion-device с одного адреса получили «использовано 2,
 * осталось 0» — счёт шёл по максимуму из адреса и устройства, и двое людей за одним адресом
 * (мобильный оператор, офис) гасили норму всем остальным. Решение Оркестратора 30.10: 2 на устройство,
 * потолок 10 на адрес.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => null }));

const prevKey = process.env.AEVION_EDGE_KEY;
beforeEach(() => {
  vi.resetModules();
  delete process.env.AEVION_EDGE_KEY;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  if (prevKey === undefined) delete process.env.AEVION_EDGE_KEY; else process.env.AEVION_EDGE_KEY = prevKey;
});

function запрос(адрес: string, устройство?: string) {
  const headers: Record<string, string> = {};
  if (устройство) headers["x-aevion-device"] = устройство;
  return { headers, get(h: string) { return (this.headers as Record<string, string>)[h.toLowerCase()]; }, socket: { remoteAddress: адрес }, ip: адрес } as never;
}

describe("норма на устройство, потолок на адрес", () => {
  test("исчерпало одно устройство — другое устройство с того же адреса получает свою норму", async () => {
    const m = await import("../src/lib/multichatGuestPass");
    const первый = запрос("10.1.1.1", "dev-A");
    m.засчитатьГостю(первый);
    m.засчитатьГостю(первый);
    expect(m.остатокГостя(первый).осталось, "своё устройство исчерпало норму").toBe(0);
    expect(m.остатокГостя(запрос("10.1.1.1", "dev-B")).осталось, "чужое устройство с того же адреса гасится — это и был дефект").toBe(2);
  });

  test("потолок адреса: пять устройств по два запроса — шестое устройство получает 0", async () => {
    const m = await import("../src/lib/multichatGuestPass");
    for (const d of ["d1", "d2", "d3", "d4", "d5"]) {
      const r = запрос("10.2.2.2", d);
      m.засчитатьГостю(r);
      m.засчитатьГостю(r);
    }
    expect(m.остатокГостя(запрос("10.2.2.2", "d6")).осталось, "потолок 10 на адрес не держит").toBe(0);
    expect(m.остатокГостя(запрос("10.3.3.3", "d6")).осталось, "другой адрес потолком не задет").toBe(2);
  });

  test("потолок можно задать переменной MULTICHAT_GUEST_FREE_PER_IP_DAY", async () => {
    process.env.MULTICHAT_GUEST_FREE_PER_IP_DAY = "3";
    try {
      const m = await import("../src/lib/multichatGuestPass");
      m.засчитатьГостю(запрос("10.4.4.4", "x1"));
      m.засчитатьГостю(запрос("10.4.4.4", "x2"));
      m.засчитатьГостю(запрос("10.4.4.4", "x3"));
      expect(m.остатокГостя(запрос("10.4.4.4", "x4")).осталось).toBe(0);
    } finally {
      delete process.env.MULTICHAT_GUEST_FREE_PER_IP_DAY;
    }
  });

  test("без устройства различить людей нельзя — прежняя строгая норма на адрес", async () => {
    const m = await import("../src/lib/multichatGuestPass");
    m.засчитатьГостю(запрос("10.5.5.5"));
    m.засчитатьГостю(запрос("10.5.5.5"));
    expect(m.остатокГостя(запрос("10.5.5.5")).осталось).toBe(0);
  });
});
