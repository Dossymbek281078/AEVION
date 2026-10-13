/*
 * Прокси сайта передаёт бэкенду адрес гостя и секрет; присланные гостем
 * одноимённые заголовки затираются. Замер прода 13.10.2026: без этого бэкенд
 * видел всех гостей сайта под адресом Vercel (окно Приложения-31.12).
 */
import { describe, expect, it } from "vitest";
import { заголовкиДляБэкенда, адресНаБэкенде } from "../middleware";

const СЕКРЕТ = "s".repeat(32);

describe("заголовкиДляБэкенда", () => {
  it("кладёт первый адрес X-Forwarded-For и секрет", () => {
    const h = заголовкиДляБэкенда(new Headers({ "x-forwarded-for": "178.91.246.196, 10.0.0.1" }), СЕКРЕТ)!;
    expect(h.get("x-aevion-client-ip")).toBe("178.91.246.196");
    expect(h.get("x-aevion-edge-key")).toBe(СЕКРЕТ);
  });

  it("поддельные заголовки гостя затираются", () => {
    const h = заголовкиДляБэкенда(
      new Headers({ "x-forwarded-for": "178.91.246.196", "x-aevion-client-ip": "6.6.6.6", "x-aevion-edge-key": "forged-key" }),
      СЕКРЕТ,
    )!;
    expect(h.get("x-aevion-client-ip")).toBe("178.91.246.196");
    expect(h.get("x-aevion-edge-key")).toBe(СЕКРЕТ);
  });

  it("без адреса гостя секрет не уходит, а подделка всё равно стёрта", () => {
    const h = заголовкиДляБэкенда(new Headers({ "x-aevion-client-ip": "6.6.6.6" }), СЕКРЕТ)!;
    expect(h.get("x-aevion-client-ip")).toBeNull();
    expect(h.get("x-aevion-edge-key")).toBeNull();
  });

  it("КОНТРОЛЬ: без секрета ничего не меняет", () => {
    expect(заголовкиДляБэкенда(new Headers({ "x-forwarded-for": "1.2.3.4" }), undefined)).toBeNull();
    expect(заголовкиДляБэкенда(new Headers({ "x-forwarded-for": "1.2.3.4" }), "short")).toBeNull();
  });
});

describe("адресНаБэкенде: middleware проксирует сам только действия с нормой", () => {
  const Ц = "https://api.aevion.app";
  it("POST проверки HealthAI и начала проверки бюро — на бэкенд, с запросом", () => {
    expect(адресНаБэкенде("POST", "/api-backend/api/healthai/check", "?c=x", Ц)?.toString()).toBe("https://api.aevion.app/api/healthai/check?c=x");
    expect(адресНаБэкенде("POST", "/api-backend/api/bureau/verify/start", "", Ц + "/")?.toString()).toBe("https://api.aevion.app/api/bureau/verify/start");
  });
  it("КОНТРОЛЬ: GET, чужие модули и платёжные вебхуки идут прежним путём", () => {
    expect(адресНаБэкенде("GET", "/api-backend/api/healthai/check", "", Ц)).toBeNull();
    expect(адресНаБэкенде("POST", "/api-backend/api/devhub/build", "", Ц)).toBeNull();
    expect(адресНаБэкенде("POST", "/api-backend/api/bureau/payment/webhook", "", Ц)).toBeNull();
  });
  it("КОНТРОЛЬ: без https-цели ничего не проксируем", () => {
    expect(адресНаБэкенде("POST", "/api-backend/api/healthai/check", "", undefined)).toBeNull();
    expect(адресНаБэкенде("POST", "/api-backend/api/healthai/check", "", "http://127.0.0.1:4001")).toBeNull();
  });
});
