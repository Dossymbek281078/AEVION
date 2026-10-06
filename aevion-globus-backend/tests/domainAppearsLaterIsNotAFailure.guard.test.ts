import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Домен появляется примерно через минуту — это НЕ отказ поставщика.
 *
 * 🔴 ЗАМЕР 06.10.2026 на живом проде, свежая гостевая выкатка:
 *   24 с → HTTP 000 ; 39 с → HTTP 000 ; 54 с → HTTP 200
 * Контроль, что дело во ВРЕМЕНИ: сайт соседнего окна
 * smoke-kofe-58231-c54d4f.aevion.app отдаёт 200 и 3508 знаков сгенерированной
 * страницы, CNAME в зоне есть; два никогда не выкатывавшихся имени — CNAME нет,
 * HTTP 404. Прибор различает три случая, значит «не отвечает» было про время.
 *
 * А проверка на выкатке смотрела на ~35-й секунде (HTTPS 6x5 с + CNAME 2x1 с) и
 * записывала noteProviderFailure("domain"). После этого витрина возможностей
 * показывала degraded НАВСЕГДА — ручка /studio/capabilities на проде так и
 * отвечала, с причиной от чужой пробы, — а интерфейс каждому посетителю говорил
 * «домен aevion.app пока не подтверждён, адрес будет на *.pages.dev».
 * Работающая возможность была обесценена переходным состоянием.
 */
const { отметки } = vi.hoisted(() => ({ отметки: [] as string[] }));
vi.mock("../src/lib/providerHealth", () => ({
  applyHealth: (x: unknown) => x,
  getProviderHealth: () => ({}),
  noteProviderSuccess: (id: string) => { отметки.push("success:" + id); },
  noteProviderFailure: (id: string, reason: string) => { отметки.push("failure:" + id + ":" + String(reason).slice(0, 40)); },
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => { throw new Error("нет базы"); } }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

// eslint-disable-next-line import/first
import { __scheduleDomainRecheckForTest as перепроверить, DOMAIN_RECHECK_DELAYS_MS, dnsProbe } from "../src/routes/devhub";

const исходный = dnsProbe.cnameResolves;

beforeEach(() => { отметки.length = 0; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); dnsProbe.cnameResolves = исходный; });

describe("домен, появившийся позже, — не отказ", () => {
  test("прибор исправен: сроки перепроверки заданы и они МИНУТЫ, а не секунды", () => {
    expect(DOMAIN_RECHECK_DELAYS_MS.length, "перепроверок не осталось").toBeGreaterThanOrEqual(2);
    // Замер дал 54 с — окно короче минуты снова ловило бы переходное состояние.
    expect(DOMAIN_RECHECK_DELAYS_MS[0], "первая перепроверка раньше, чем домен успевает появиться").toBeGreaterThanOrEqual(60_000);
  });

  test("появился на перепроверке — отметка УСПЕХА, отказа нет", async () => {
    dnsProbe.cnameResolves = (async () => true) as typeof dnsProbe.cnameResolves;
    перепроверить("probe-timing.aevion.app");
    await vi.advanceTimersByTimeAsync(DOMAIN_RECHECK_DELAYS_MS[0] + 1000);
    expect(отметки, "успех домена не отмечен").toContain("success:domain");
    expect(отметки.some((o) => o.startsWith("failure:domain")), "записан отказ у работающего домена").toBe(false);
  });

  test("не появился и за ДОЛГОЕ окно — вот это отказ", async () => {
    dnsProbe.cnameResolves = (async () => false) as typeof dnsProbe.cnameResolves;
    перепроверить("probe-nikogda.invalid");
    const всего = DOMAIN_RECHECK_DELAYS_MS.reduce((a, b) => a + b, 0);
    await vi.advanceTimersByTimeAsync(всего + 30_000);
    // Контроль в обратную сторону к предыдущей проверке: без него «успех всегда»
    // прошёл бы обе, и сторож ничего бы не различал.
    expect(отметки.some((o) => o.startsWith("failure:domain")), "отказ не записан даже спустя всё окно").toBe(true);
  });

  test("на ПЕРВОЙ перепроверке отказ ещё НЕ записывается", async () => {
    dnsProbe.cnameResolves = (async () => false) as typeof dnsProbe.cnameResolves;
    перепроверить("probe-nikogda.invalid");
    await vi.advanceTimersByTimeAsync(DOMAIN_RECHECK_DELAYS_MS[0] + 1000);
    expect(отметки.some((o) => o.startsWith("failure:domain")), "поспешил с отказом на первой же перепроверке").toBe(false);
  });

  test("выкатка больше НЕ записывает отказ домена, а переспрашивает", () => {
    // Утверждение про путь выкатки: отметка отказа ушла из markDeploymentLive.
    const src = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
    const i = src.indexOf("async function markDeploymentLive");
    const тело = src.slice(i, src.indexOf("async function", i + 30));
    expect(тело.includes('noteProviderFailure("domain"'), "выкатка снова пишет отказ домена").toBe(false);
    expect(тело, "перепроверка не запускается").toContain("scheduleDomainRecheck(customDomain)");
  });

  test("подсказка про static больше не обещает «verified» поддомен", () => {
    const src = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
    expect(src.includes("including a verified *.aevion.app subdomain"), "ложное обещание вернулось").toBe(false);
    expect(src, "не сказано, что адрес появляется позже").toMatch(/follows about a minute later/);
  });
});
