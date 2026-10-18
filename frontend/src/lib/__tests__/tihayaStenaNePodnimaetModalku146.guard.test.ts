import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { installPaywallInterceptor, PAYWALL_EVENT, ТИХАЯ_СТЕНА } from "../paywall";

/*
 * 🔴 146 (18.10.2026): перехватчик поднимает модалку стены на ЛЮБОЙ 402 — и на запрос загрузки без жеста человека.
 * Гость на /qnews видел модалку первым экраном (замер на проде 5aa03bb5e), хотя страница показывает отказ сама.
 * Запрос, помеченный ТИХАЯ_СТЕНА (поле init, не заголовок — без preflight), на 402 события не даёт; ответ при этом
 * доходит до вызывающего как есть. Без пометки событие по-прежнему уходит — это контроль, что перехватчик жив.
 */
const СТЕНА = { error: "upgrade_required", module: "qnews", plan: "pro", requiredTiers: ["pro"], upgradeUrl: "/pricing?app=qnews", message: "нужен тариф", authState: "anonymous" };

describe("146: тихая стена", () => {
  const исходный = globalThis.fetch;
  let события: number;
  const слушатель = () => { события += 1; };
  beforeEach(() => {
    события = 0;
    delete (window as unknown as Record<symbol, unknown>)[Symbol.for("aevion.paywall.fetchPatched")];
    window.fetch = vi.fn(async () => new Response(JSON.stringify(СТЕНА), { status: 402, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    installPaywallInterceptor();
    window.addEventListener(PAYWALL_EVENT, слушатель);
  });
  afterEach(() => { window.removeEventListener(PAYWALL_EVENT, слушатель); globalThis.fetch = исходный; });

  it("🔴 402 на запрос с ТИХАЯ_СТЕНА: события нет, ответ 402 доходит до вызывающего", async () => {
    const r = await fetch("/api-backend/api/qnews/articles", { ...ТИХАЯ_СТЕНА });
    expect(r.status).toBe(402);
    expect((await r.json()).error).toBe("upgrade_required");
    await new Promise((x) => setTimeout(x, 0));
    expect(события).toBe(0);
  });
  it("КОНТРОЛЬ: тот же 402 без пометки поднимает событие стены", async () => {
    const r = await fetch("/api-backend/api/qnews/articles");
    expect(r.status).toBe(402);
    await new Promise((x) => setTimeout(x, 0));
    expect(события).toBe(1);
  });
});
