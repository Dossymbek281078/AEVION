/**
 * Биржа стартапов: разбор на английском приходит без русских слов (замер 02.11.2026, /en).
 * lang=ru — прежние строки без изменений.
 */
import { describe, it, expect } from "vitest";
import express from "express";
import http from "node:http";
import { assessListing, normalizeAssessLang, tierLabel, DISCLAIMER, disclaimerFor } from "../src/lib/startupx/assess";
import { marketSourcesFor, MARKET_SOURCES } from "../src/lib/startupx/valuation";
import { normalizeListing, type ListingInput } from "../src/lib/startupx/model";

const CYR = /[Ѐ-ӿ]/;

/** Every human-readable string of the assessment, except what the user typed. */
function texts(a: ReturnType<typeof assessListing>): string[] {
  return [
    a.headline,
    a.disclaimer,
    a.deal.band.basis,
    a.deal.implied.formula ?? "",
    a.deal.ticket.note,
    a.sector.label,
    ...a.factors.flatMap((f) => [f.label, f.rationale]),
    ...a.redFlags.map((r) => r.message),
    ...a.blindSpots,
    ...a.sources.flatMap((s) => [s.publisher, s.claim]),
  ];
}

const DESC =
  "We build a platform for freelancers who waste time manually chasing invoices. Unlike competitors we automate " +
  "the reminders via API integration; subscription pricing per month. Revolutionary and unique approach.";

function make(over: Record<string, unknown>): ListingInput {
  const { listing, issues } = normalizeListing({ title: "Invoice bot", description: DESC, ...over }, { requireDeal: false });
  if (!listing) throw new Error(JSON.stringify(issues));
  return listing;
}

const CASES: Record<string, ListingInput> = {
  idea: make({ tier: "idea", deal: { intent: "raise", askUsd: 900_000, equityOfferedPct: 60 }, metrics: { monthsInDevelopment: 3, teamSize: 2, mrrUsd: 800 }, demoUrl: "https://example.com" }),
  ideaPlain: make({ tier: "idea", deal: { intent: "raise" } }),
  mvp: make({ tier: "mvp", demoUrl: "https://example.com", deal: { intent: "raise", askUsd: 30_000, equityOfferedPct: 15 }, metrics: { growthMomPct: 20, churnMonthlyPct: 12, users: 300 } }),
  product: make({ tier: "product", demoUrl: "https://example.com", repoUrl: "https://example.com/r", deal: { intent: "sell_full", askingPriceUsd: 900_000 }, metrics: { mrrUsd: 5_000, grossMarginPct: 80, growthMomPct: 12, users: 900 } }),
  productNoRev: make({ tier: "product", demoUrl: "https://example.com", deal: { intent: "sell_stake", stakePriceUsd: 10_000, stakeForSalePct: 10 } }),
  cheap: make({ tier: "product", demoUrl: "https://example.com", deal: { intent: "sell_full", askingPriceUsd: 5_000 }, metrics: { mrrUsd: 5_000 } }),
  promise: make({ tier: "idea", description: DESC + " We offer guaranteed returns to investors.", deal: { intent: "raise", askUsd: 300_000, equityOfferedPct: 35 } }),
};

describe("разбор заявки по языку", () => {
  it("normalizeAssessLang: неизвестное значение — ru", () => {
    expect(normalizeAssessLang("en")).toBe("en");
    expect(normalizeAssessLang("EN-us")).toBe("en");
    expect(normalizeAssessLang("de")).toBe("ru");
    expect(normalizeAssessLang(undefined)).toBe("ru");
    expect(normalizeAssessLang({})).toBe("ru");
  });

  for (const [name, listing] of Object.entries(CASES)) {
    it(`lang=en (${name}): нет кириллицы в текстах разбора`, () => {
      const a = assessListing(listing, "en");
      const bad = texts(a).filter((t) => CYR.test(t));
      expect(bad).toEqual([]);
      expect(a.factors.map((f) => f.label)).toEqual(["Listing clarity", "Market", "Defensibility", "Evidence", "Deal terms"]);
    });

    it(`lang=ru (${name}): прежние строки, числа те же`, () => {
      const ru = assessListing(listing);
      expect(assessListing(listing, "ru").headline).toBe(ru.headline);
      expect(ru.factors.map((f) => f.label)).toEqual(["Ясность заявки", "Рынок", "Защитимость", "Доказательства", "Условия сделки"]);
      expect(ru.disclaimer).toBe(DISCLAIMER);
      expect(ru.sources).toBe(MARKET_SOURCES);
      const en = assessListing(listing, "en");
      expect(en.score).toBe(ru.score);
      expect(en.factors.map((f) => f.score)).toEqual(ru.factors.map((f) => f.score));
      expect(en.redFlags.map((r) => r.severity)).toEqual(ru.redFlags.map((r) => r.severity));
      expect(en.deal.band.low).toBe(ru.deal.band.low);
    });
  }

  it("lang=ru: заголовок и слепые зоны — дословно прежние", () => {
    const a = assessListing(CASES.ideaPlain);
    expect(a.blindSpots[0]).toBe("Команда: кто это делает и доводил ли раньше что-нибудь до конца — анализ этого не видит.");
    expect(a.deal.ticket.note).toMatch(/^Типичный чек на уровне «idea»\.$/);
  });

  it("подписи уровней и дисклеймер по языку", () => {
    expect(tierLabel("idea", "en")).toBe("Idea only");
    expect(tierLabel("idea")).toBe("Только идея");
    expect(CYR.test(disclaimerFor("en"))).toBe(false);
    expect(marketSourcesFor("en").every((s) => !CYR.test(s.claim))).toBe(true);
  });
});

describe("HTTP: lang из body и query", () => {
  async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
    const { startupExchangeRouter } = await import("../src/routes/startupExchange");
    const app = express();
    app.use(express.json());
    app.use("/api/startupx", startupExchangeRouter);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/startupx${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: res.status, json: await res.json() };
    } finally {
      server.close();
    }
  }

  const draft = { title: "Invoice bot", description: DESC, tier: "idea" };

  it("body.lang=en — английский", async () => {
    const r = await post("/assess", { ...draft, lang: "en" });
    expect(r.status).toBe(200);
    expect(r.json.data.assessment.factors[0].label).toBe("Listing clarity");
  });
  it("?lang=en — английский", async () => {
    const r = await post("/assess?lang=en", draft);
    expect(r.json.data.assessment.factors[0].label).toBe("Listing clarity");
  });
  it("body.lang важнее query; неизвестный — ru", async () => {
    expect((await post("/assess?lang=en", { ...draft, lang: "ru" })).json.data.assessment.factors[0].label).toBe("Ясность заявки");
    expect((await post("/assess", { ...draft, lang: "xx" })).json.data.assessment.factors[0].label).toBe("Ясность заявки");
    expect((await post("/assess", draft)).json.data.assessment.factors[0].label).toBe("Ясность заявки");
  });
});
