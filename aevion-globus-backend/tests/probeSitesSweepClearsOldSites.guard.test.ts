/**
 * Периодический свип убирает ЗАЛЕЖАВШИЕСЯ пробные сайты и не трогает чужое.
 *
 * 🔴 ЗАЧЕМ. Уборка пробного сайта после выкатки живёт в ПАМЯТИ процесса
 * (deferred + setTimeout), а перезапуск сервиса случается при каждой выкатке —
 * значит отложенные уборки стираются, и пробный сайт остаётся публичным
 * навсегда. Замер 07.10.2026: мою собственную пробу на проде пришлось убирать
 * руками именно поэтому (в волне 25 самоуборка есть, но на проде её ещё нет, а
 * перезапуск её всё равно стёр бы).
 *
 * Сторож проверяет РЕШЕНИЕ свипа на четырёх случаях разом, потому что работает
 * не отбор сам по себе, а РАЗНИЦА между соседями: пробный и старый — снять;
 * пробный и свежий — не трогать; чужой и старый — не трогать; без адреса —
 * нечего снимать.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  свипПробныхСайтов,
  __положитьПроектForTest,
  __прочитатьПроектForTest,
} from "../src/routes/devhub";

const ЧАС = 60 * 60 * 1000;

function проект(над: Partial<Record<string, unknown>> & { id: string; name: string }) {
  const давно = new Date(Date.now() - 6 * ЧАС).toISOString();
  return {
    id: над.id,
    userId: "guest:test-sweep",
    name: над.name,
    description: null,
    stack: "static",
    status: "live",
    repoUrl: null,
    deployUrl: "https://aevion-" + над.name + "-abcdef.pages.dev",
    customDomain: null,
    envVars: {},
    collaborators: [],
    createdAt: давно,
    updatedAt: давно,
    ...над,
  } as never;
}

let запросы: string[] = [];

beforeEach(() => {
  запросы = [];
  /*
   * Снятие сайта идёт только при заданных ключах Cloudflare (иначе оно молча
   * пропускается — и первая редакция сторожа показала ровно это: «осмотрено 1,
   * снято 0»). Значения ЗДЕСЬ ТЕСТОВЫЕ: сеть подменена ниже, наружу не уходит
   * ни один запрос.
   */
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  // Cloudflare в проверке не участвует: нам важно РЕШЕНИЕ свипа, а не сеть.
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { method?: string }) => {
    запросы.push(`${init?.method ?? "GET"} ${String(url)}`);
    return { ok: true, status: 200, json: async () => ({ result: [] }), text: async () => "" } as never;
  }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("свип пробных сайтов", () => {
  it("снимает залежавшийся пробный сайт и обнуляет адрес", async () => {
    __положитьПроектForTest(проект({ id: "sw-1", name: "probe-fd-old" }));
    const итог = await свипПробныхСайтов();
    expect(итог.осмотрено, "залежавшийся пробный сайт не попал в выборку").toBeGreaterThanOrEqual(1);
    expect(итог.снято, "сайт не снят").toBeGreaterThanOrEqual(1);
    expect(__прочитатьПроектForTest("sw-1")?.deployUrl,
      "адрес не обнулён — тот же проект попадёт в выборку снова, и счётчик потолка будет его считать",
    ).toBeNull();
  });

  it("свежий пробный сайт не трогает", async () => {
    const сейчас = new Date().toISOString();
    __положитьПроектForTest(проект({ id: "sw-2", name: "probe-fd-fresh", createdAt: сейчас, updatedAt: сейчас }));
    await свипПробныхСайтов();
    expect(__прочитатьПроектForTest("sw-2")?.deployUrl,
      "снят сайт, у которого срок ещё не вышел",
    ).toBeTruthy();
  });

  it("чужой сайт не трогает, даже если он старый", async () => {
    __положитьПроектForTest(проект({ id: "sw-3", name: "Моя витрина" }));
    await свипПробныхСайтов();
    expect(__прочитатьПроектForTest("sw-3")?.deployUrl,
      "🔴 снят НЕ пробный сайт — это чужая работа",
    ).toBeTruthy();
  });

  it("проект без адреса в выборку не попадает", async () => {
    __положитьПроектForTest(проект({ id: "sw-4", name: "probe-fd-nosite", deployUrl: null }));
    const итог = await свипПробныхСайтов();
    expect(итог.осмотрено).not.toBeNull();
    // Контроль: иначе свип ходил бы в Cloudflare за тем, чего нет.
    expect(запросы.some((з) => з.includes("probe-fd-nosite")),
      "свип пошёл снимать сайт у проекта без адреса").toBe(false);
  });

  it("второй проход по тому же проекту ничего не делает", async () => {
    __положитьПроектForTest(проект({ id: "sw-5", name: "probe-fd-twice" }));
    await свипПробныхСайтов();
    запросы = [];
    const второй = await свипПробныхСайтов();
    expect(второй.снято, "тот же сайт снимается повторно — вечный шум в журнале").toBe(0);
    expect(запросы.some((з) => з.includes("probe-fd-twice")), "второй проход снова пошёл в Cloudflare").toBe(false);
  });
});
