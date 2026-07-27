import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizeTrafficChannel, TRAFFIC_CHANNELS } from "../src/lib/trafficChannel";
import { provisionSubscription, readLatestSubscription } from "../src/routes/provisioning";

// Источник трафика, доехавший до оплаты.
//
// У Gumroad метка доезжает до дашборда сама — она лежит в url_params заказа.
// У LemonSqueezy такого пути нет: единственное место, где её видно, это вебхук,
// а он её не читал. В результате модули-подписки — самые дорогие позиции
// каталога ($19–$149/мес) — не атрибутировались вовсе, хотя страница /go
// исправно подставляла checkout[custom][channel] в ссылку оплаты.

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "traffic-channel-test-"));
  process.env.SUBSCRIPTIONS_FILE = path.join(dir, "subscriptions.jsonl");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.SUBSCRIPTIONS_FILE;
});

describe("нормализация метки канала", () => {
  test("известные каналы проходят", () => {
    for (const c of TRAFFIC_CHANNELS) {
      expect(normalizeTrafficChannel(c)).toBe(c);
    }
  });

  test("регистр и пробелы не мешают", () => {
    expect(normalizeTrafficChannel("  Instagram ")).toBe("instagram");
    expect(normalizeTrafficChannel("FACEBOOK")).toBe("facebook");
  });

  test("неизвестное значение отбрасывается, а не сохраняется как есть", () => {
    // Метка приходит из адресной строки через сторонний процессинг — её пишет
    // кто угодно. Непроверенное значение в отчёте о деньгах хуже отсутствующего:
    // оно выглядит как факт.
    expect(normalizeTrafficChannel("своя-строка")).toBeNull();
    expect(normalizeTrafficChannel("<script>alert(1)</script>")).toBeNull();
    expect(normalizeTrafficChannel("instagram; DROP TABLE")).toBeNull();
  });

  test("не-строки не роняют и дают null", () => {
    for (const v of [undefined, null, 42, {}, [], true]) {
      expect(normalizeTrafficChannel(v)).toBeNull();
    }
  });

  test("подстрока известного канала не считается им", () => {
    expect(normalizeTrafficChannel("instagram-fake")).toBeNull();
    expect(normalizeTrafficChannel("nstagram")).toBeNull();
  });
});

describe("канал доезжает до записи о подписке", () => {
  test("переданный канал сохраняется отдельно от платёжного", async () => {
    await provisionSubscription({
      email: "buyer@test.aevion.dev",
      tierId: "lite",
      source: "lemonsqueezy",
      channel: "instagram",
    });
    const sub = readLatestSubscription("buyer@test.aevion.dev");
    // Два разных поля: source отвечает «через кого деньги», channel — «за что
    // платить рекламой». Покупка через LemonSqueezy из Instagram имеет оба.
    expect(sub?.source).toBe("lemonsqueezy");
    expect(sub?.channel).toBe("instagram");
  });

  test("без канала запись остаётся валидной, поле просто отсутствует", async () => {
    await provisionSubscription({
      email: "nochannel@test.aevion.dev",
      tierId: "lite",
      source: "lemonsqueezy",
    });
    const sub = readLatestSubscription("nochannel@test.aevion.dev");
    expect(sub?.source).toBe("lemonsqueezy");
    expect(sub?.channel).toBeUndefined();
  });

  test("в файл попадает ровно то, что нормализовано", async () => {
    const raw = normalizeTrafficChannel("  TikTok ");
    await provisionSubscription({
      email: "tt@test.aevion.dev",
      tierId: "lite",
      source: "lemonsqueezy",
      channel: raw ?? undefined,
    });
    const line = readFileSync(process.env.SUBSCRIPTIONS_FILE!, "utf8").trim().split("\n").pop()!;
    expect(JSON.parse(line).channel).toBe("tiktok");
  });
});

// ── Страж: список каналов продублирован во фронте и бэке ────────────────────
// Дублирование сознательное — фронт и бэкенд собираются отдельно, общего пакета
// между ними нет, и тянуть один ради восьми строк дороже. Но у дублирования
// есть цена: списки расходятся молча. Метка, добавленная только во фронте,
// доедет до оплаты и будет отброшена бэкендом как неизвестная — продажа
// потеряет источник, и никакой ошибки при этом не возникнет.
describe("список каналов совпадает с фронтендом", () => {
  test("CHANNELS в products.ts и TRAFFIC_CHANNELS содержат одно и то же", () => {
    const p = path.join(process.cwd(), "..", "frontend", "src", "lib", "products.ts");
    const src = readFileSync(p, "utf8");
    const block = src.match(/export const CHANNELS[^{]*\{([^}]*)\}/);
    expect(block, "не нашёл CHANNELS в frontend/src/lib/products.ts").toBeTruthy();

    const frontValues = [...block![1].matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]).sort();
    const backValues = [...TRAFFIC_CHANNELS].sort();

    expect(frontValues).toEqual(backValues);
  });
});
