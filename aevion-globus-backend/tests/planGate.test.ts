import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizeTier,
  isModuleEntitled,
  tiersForModule,
  paywallEnabledFor,
  requireModule,
  type ResolvedPlan,
} from "../src/lib/planGate";

function plan(tier: ResolvedPlan["tier"], chosenModules: string[] = []): ResolvedPlan {
  return { tier, rawTier: tier, email: "u@test.io", reason: "test", chosenModules };
}

describe("normalizeTier", () => {
  it("maps legacy aliases to canonical tiers", () => {
    // "pro" (Universe, $149.99/mo flagship) grants full module access, same
    // ceiling as "full" — it used to alias "lite" back when "pro" was a
    // placeholder id with no real tier object behind it. Fixed 2026-07-22:
    // that mapping would have gated a $149.99 customer at $19-Lite access.
    expect(normalizeTier("pro")).toBe("full");
    expect(normalizeTier("business")).toBe("full");
  });
  it("every paid term (lite … max) is access to the whole planet — canonical full (15.09.2026)", () => {
    // Тариф — это срок, а не набор модулей: lite и medium больше не урезанные наборы.
    for (const t of ["lite", "medium", "pro", "full", "max"]) {
      expect(normalizeTier(t), `${t} не открывает всю планету`).toBe("full");
    }
  });
  it("passes through canonical tiers and defaults unknown to free", () => {
    expect(normalizeTier("enterprise")).toBe("enterprise");
    expect(normalizeTier(null)).toBe("free");
    expect(normalizeTier("garbage")).toBe("free");
  });
});

describe("tiersForModule", () => {
  it("derives policy from MODULES_PRICING (qcoreai: every paid term, not free)", () => {
    const t = tiersForModule("qcoreai");
    for (const срок of ["lite", "medium", "pro", "full", "max"]) expect(t).toContain(срок);
    expect(t).not.toContain("free");
  });
  it("globus is free for everyone", () => {
    expect(tiersForModule("globus")).toContain("free");
  });
  it("unknown module defaults to full+enterprise only", () => {
    expect(tiersForModule("does-not-exist")).toEqual(["full", "enterprise"]);
  });
});

describe("isModuleEntitled", () => {
  it("full and enterprise are all-access", () => {
    expect(isModuleEntitled(plan("full"), "qcoreai")).toBe(true);
    expect(isModuleEntitled(plan("enterprise"), "does-not-exist")).toBe(true);
  });
  it("free cannot access a medium-tier module", () => {
    expect(isModuleEntitled(plan("free"), "qcoreai")).toBe(false);
  });
  it("a resolved medium (or lite) plan can access a paid module", () => {
    // Настоящий план приходит нормализованным (resolveUserPlan → normalizeTier).
    expect(isModuleEntitled(plan(normalizeTier("medium")), "qcoreai")).toBe(true);
    expect(isModuleEntitled(plan(normalizeTier("lite")), "healthai")).toBe(true);
    // Контроль: нормализованный free — нет.
    expect(isModuleEntitled(plan(normalizeTier("garbage")), "qcoreai")).toBe(false);
  });
  it("everyone can access a free module", () => {
    expect(isModuleEntitled(plan("free"), "globus")).toBe(true);
  });
  it("raw lite slot rule (not produced by resolveUserPlan since 15.09.2026) still grants only the chosen module", () => {
    // Сырой tier "lite" план больше не получает: normalizeTier сводит его к full.
    // Правило слота оставлено в isModuleEntitled — проверка, что оно не раздаёт лишнего.
    expect(isModuleEntitled(plan("lite", ["qcoreai"]), "qcoreai")).toBe(true);
    expect(isModuleEntitled(plan("lite", ["qsign"]), "qcoreai")).toBe(false);
  });
});

describe("paywallEnabledFor (env-driven, dormant by default)", () => {
  const saved = {
    mods: process.env.PAYWALL_MODULES,
    off: process.env.PAYWALL_DISABLED,
  };
  beforeEach(() => {
    delete process.env.PAYWALL_MODULES;
    delete process.env.PAYWALL_DISABLED;
  });
  afterEach(() => {
    if (saved.mods === undefined) delete process.env.PAYWALL_MODULES;
    else process.env.PAYWALL_MODULES = saved.mods;
    if (saved.off === undefined) delete process.env.PAYWALL_DISABLED;
    else process.env.PAYWALL_DISABLED = saved.off;
  });

  it("is off when env unset", () => {
    expect(paywallEnabledFor("qcoreai")).toBe(false);
  });
  it("enables only listed modules", () => {
    process.env.PAYWALL_MODULES = "multichat-engine, healthai";
    expect(paywallEnabledFor("multichat-engine")).toBe(true);
    expect(paywallEnabledFor("healthai")).toBe(true);
    expect(paywallEnabledFor("qsign")).toBe(false);
  });
  it("'*' enables everything except UNSAFE_TO_GATE modules", () => {
    process.env.PAYWALL_MODULES = "*";
    expect(paywallEnabledFor("anything")).toBe(true);
    expect(paywallEnabledFor("qcoreai")).toBe(false);
  });
  it("UNSAFE_TO_GATE modules stay off even when explicitly listed — 2026-07-16 incident regression", () => {
    // qcoreai briefly went enforced in prod for ~44min via a manual Railway
    // flip that listed it in PAYWALL_MODULES without checking that its free
    // tier promises 100k tokens/mo with no usage metering to back a 402
    // fallback. This guard strips it (and qright/qsign, same conflict)
    // server-side regardless of what the env var says.
    process.env.PAYWALL_MODULES = "qcoreai, qright, qsign, healthai";
    expect(paywallEnabledFor("qcoreai")).toBe(false);
    expect(paywallEnabledFor("qright")).toBe(false);
    expect(paywallEnabledFor("qsign")).toBe(false);
    expect(paywallEnabledFor("healthai")).toBe(true);
  });
  it("PAYWALL_DISABLED kill-switch overrides", () => {
    process.env.PAYWALL_MODULES = "*";
    process.env.PAYWALL_DISABLED = "1";
    expect(paywallEnabledFor("qcoreai")).toBe(false);
  });
});

describe("requireModule middleware", () => {
  const saved = process.env.PAYWALL_MODULES;
  afterEach(() => {
    if (saved === undefined) delete process.env.PAYWALL_MODULES;
    else process.env.PAYWALL_MODULES = saved;
  });

  // Гейт стал асинхронным 13.08.2026: получив отказ по тарифу, он спрашивает
  // базу про отдельную подписку на этот модуль. Промис надо дождаться, иначе
  // утверждения читают состояние раньше, чем гейт успел ответить.
  async function run(mw: ReturnType<typeof requireModule>, req: any) {
    let nexted = false;
    let status = 0;
    let body: any = null;
    const res: any = {
      status(c: number) { status = c; return this; },
      json(b: any) { body = b; return this; },
    };
    await mw(req as any, res, () => { nexted = true; });
    return { nexted, status, body };
  }

  it("is a no-op when paywall is dormant", async () => {
    delete process.env.PAYWALL_MODULES;
    const r = await run(requireModule("qcoreai"), { method: "GET", path: "/chat", headers: {} });
    expect(r.nexted).toBe(true);
  });

  it("402s an unentitled free caller when enforced", async () => {
    process.env.PAYWALL_MODULES = "healthai";
    const r = await run(requireModule("healthai"), { method: "GET", path: "/chat", headers: {} });
    expect(r.nexted).toBe(false);
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("upgrade_required");
    expect(r.body.module).toBe("healthai");
  });
  it("never 402s qcoreai even when explicitly listed in PAYWALL_MODULES", async () => {
    process.env.PAYWALL_MODULES = "qcoreai";
    const r = await run(requireModule("qcoreai"), { method: "GET", path: "/chat", headers: {} });
    expect(r.nexted).toBe(true);
  });

  it("lets health/plan introspection through even when enforced", async () => {
    // Uses healthai, not qcoreai — qcoreai is never actually enforced (see
    // the UNSAFE_TO_GATE tests above), so this needs a module that can be
    // to genuinely exercise the exempt-path bypass rather than the guard.
    process.env.PAYWALL_MODULES = "healthai";
    const r = await run(requireModule("healthai"), { method: "GET", path: "/health", headers: {} });
    expect(r.nexted).toBe(true);
  });

  // 22.09.2026: сроки lite…max сводятся к full, и 402 перечислял «full» пять раз —
  // экран оплаты рисовал шесть плашек, текст ошибки звучал как «нужен только Full».
  it("lists each required tier once in the 402", async () => {
    process.env.PAYWALL_MODULES = "qlearn";
    const r = await run(requireModule("qlearn"), { method: "GET", path: "/courses", headers: {} });
    expect(r.status).toBe(402);
    const tiers: string[] = r.body.requiredTiers;
    expect(new Set(tiers).size).toBe(tiers.length);
    expect(r.body.message).not.toMatch(/full, full/);
  });
});
