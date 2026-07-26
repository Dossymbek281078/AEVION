import { describe, test, expect } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeListing,
  tierFromLegacyStage,
  legacyStageForTier,
  TIER_SPECS,
  type ListingInput,
} from "../src/lib/startupx/model";
import { assessListing, ASSESSMENT_VERSION, DISCLAIMER } from "../src/lib/startupx/assess";
import { valuationBand, impliedTerms } from "../src/lib/startupx/valuation";

// The exchange's whole promise is that an investor can read a number and a set
// of deal terms and know what they mean. These tests protect the two ways that
// promise breaks quietly: a listing that passes validation without a real deal
// in it, and an assessment that produces a confident number about something it
// cannot see.

/** A well-formed idea-tier body, as the submit form sends it. */
function ideaBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Логистика для мелких перевозчиков",
    description:
      "Проблема: мелкие перевозчики в Казахстане ищут грузы вручную, через чаты в WhatsApp, " +
      "и теряют до трети рейсов на пустом пробеге. Для кого: перевозчики с парком 1–5 машин. " +
      "Мы делаем платформу, которая автоматически подбирает обратный груз по маршруту. " +
      "Зарабатываем на комиссии 5% с каждой сделки. В отличие от досок объявлений, подбор идёт " +
      "по факту освободившейся машины, а не по заявке водителя.",
    tier: "idea",
    sector: "marketplace",
    geography: "KZ",
    deal: { intent: "raise", askUsd: 30_000, equityOfferedPct: 15, buildBy: "founder" },
    ...overrides,
  };
}

function assessBody(body: Record<string, unknown>) {
  const { listing, issues } = normalizeListing(body);
  expect(issues, `unexpected validation issues: ${JSON.stringify(issues)}`).toEqual([]);
  return assessListing(listing as ListingInput);
}

describe("listing validation", () => {
  test("a raise with no ask and no equity is not a deal", () => {
    const { listing, issues } = normalizeListing(ideaBody({ deal: { intent: "raise" } }));
    expect(listing).toBeNull();
    const fields = issues.map((i) => i.field);
    expect(fields).toContain("deal.askUsd");
    expect(fields).toContain("deal.equityOfferedPct");
  });

  test("a working product listing must carry a link to the working product", () => {
    const { issues } = normalizeListing(
      ideaBody({
        tier: "product",
        deal: { intent: "sell_full", askingPriceUsd: 120_000 },
      }),
    );
    expect(issues.map((i) => i.field)).toContain("demoUrl");
  });

  test("an intent the tier does not allow is rejected", () => {
    // You cannot sell an idea outright on this exchange — there is nothing to
    // transfer. Idea tier is equity-for-capital only.
    const { issues } = normalizeListing(ideaBody({ deal: { intent: "sell_full", askingPriceUsd: 50_000 } }));
    expect(issues.map((i) => i.field)).toContain("deal.intent");
  });

  test("the free preview works on a description alone, but publishing does not", () => {
    // The front door of the exchange: type what you are building, see the
    // analysis, then decide on terms. Publishing the same body must still fail.
    const bare = { title: "Идея", description: ideaBody().description, tier: "idea" };
    const preview = normalizeListing(bare, { requireDeal: false });
    expect(preview.issues).toEqual([]);
    expect(preview.listing).not.toBeNull();

    const publish = normalizeListing(bare);
    expect(publish.listing).toBeNull();
    expect(publish.issues.map((i) => i.field)).toContain("deal.intent");

    // With no terms, the deal factor must say so rather than score a guess.
    const a = assessListing(preview.listing as ListingInput);
    const dealFactor = a.factors.find((f) => f.key === "deal")!;
    expect(a.deal.implied.postMoneyUsd).toBeNull();
    expect(dealFactor.rationale).toMatch(/не позволяют посчитать/);
  });

  test("a product preview does not demand a demo link, publishing it does", () => {
    const body = ideaBody({ tier: "product", deal: { intent: "sell_full", askingPriceUsd: 120_000 } });
    expect(normalizeListing(body, { requireDeal: false }).issues).toEqual([]);
    expect(normalizeListing(body).issues.map((i) => i.field)).toContain("demoUrl");
  });

  test("адрес, по которому нельзя ответить, не проходит", () => {
    // Биржа обещает основателю, что инвестор до него дойдёт, а инвестору — что
    // основатель ответит. Поле почты, в котором лежит «напишите мне», ломает
    // обе стороны обещания молча.
    const bad = normalizeListing(ideaBody({ founderEmail: "напишите мне в телеграм" }));
    expect(bad.listing).toBeNull();
    expect(bad.issues.map((i) => i.field)).toContain("founderEmail");

    const good = normalizeListing(ideaBody({ founderEmail: "founder@example.com" }));
    expect(good.issues).toEqual([]);
  });

  test("legacy rows map onto tiers both ways without drifting", () => {
    expect(tierFromLegacyStage("idea")).toBe("idea");
    expect(tierFromLegacyStage("prototype")).toBe("mvp");
    expect(tierFromLegacyStage("mvp")).toBe("mvp");
    expect(tierFromLegacyStage("scaling")).toBe("product");
    // Round-trip: writing a tier's legacy stage back must land on the same tier.
    for (const tier of ["idea", "mvp", "product"] as const) {
      expect(tierFromLegacyStage(legacyStageForTier(tier))).toBe(tier);
    }
  });
});

describe("the backfill and the code agree on what a legacy row is", () => {
  // The tier of an old row is decided twice: once in SQL (the one-time backfill
  // in ensureStartupExchangeTables) and once in TypeScript (tierFromLegacyStage,
  // used on every read as a fallback). If those two ever disagree, a row's tier
  // changes depending on which path saw it — a listing would sit in one lane in
  // the feed and another in its own page, with nothing failing anywhere.
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "src", "lib", "ensureStartupExchangeTables.ts"),
    "utf8",
  );

  test("every legacy stage is backfilled to the tier the code would derive", () => {
    const backfill = sql.slice(sql.indexOf("UPDATE startup_ideas SET tier"));
    expect(backfill).toContain("WHEN stage = 'idea' THEN 'idea'");
    expect(backfill).toContain("WHEN stage IN ('prototype','mvp') THEN 'mvp'");
    expect(backfill).toContain("WHEN stage = 'scaling' THEN 'product'");

    // Same three claims, checked against the function that reads rows back.
    expect(tierFromLegacyStage("idea")).toBe("idea");
    expect(tierFromLegacyStage("prototype")).toBe("mvp");
    expect(tierFromLegacyStage("mvp")).toBe("mvp");
    expect(tierFromLegacyStage("scaling")).toBe("product");
  });

  test("the migration only adds, never rewrites the existing table", () => {
    // Prod already holds rows; a DROP or a column type change here would take
    // them with it. Every new column must be an additive IF NOT EXISTS.
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/ALTER\s+COLUMN/i);
    const addColumns = sql.match(/ADD COLUMN[^;]*/gi) ?? [];
    expect(addColumns.length).toBeGreaterThan(5);
    for (const stmt of addColumns) expect(stmt).toMatch(/IF NOT EXISTS/i);
  });
});

describe("правила и их версия двигаются вместе", () => {
  // Балл принадлежит правилам, которые его сделали: лента сортирует заявки по
  // баллу, а страница показывает его рядом с чужими. Поменять веса или пороги,
  // не подняв ASSESSMENT_VERSION, — значит начать сравнивать несравнимое, и
  // ничего при этом не упадёт. Тот же приём уже стоит в QVenture и там сработал.
  //
  // Если этот тест покраснел: поднимите ASSESSMENT_VERSION, впишите новый
  // отпечаток сюда — одним коммитом с изменением правил.
  const EXPECTED_VERSION = 1;
  const EXPECTED_FINGERPRINT = "50aa89b012e21c4a";

  /** Отпечаток берётся с того, что реально влияет на балл, на всех трёх уровнях. */
  function rulesFingerprint(): string {
    const parts: string[] = [];
    for (const tier of ["idea", "mvp", "product"] as const) {
      const body =
        tier === "idea"
          ? ideaBody()
          : ideaBody({
              tier,
              demoUrl: "https://example.com",
              deal:
                tier === "mvp"
                  ? { intent: "raise", askUsd: 80_000, equityOfferedPct: 12 }
                  : { intent: "sell_full", askingPriceUsd: 150_000 },
              metrics: tier === "product" ? { arrUsd: 90_000 } : undefined,
            });
      const a = assessBody(body);
      parts.push(
        `${tier}:${a.score}:${a.band}:` +
          a.factors.map((f) => `${f.key}=${f.weight}/${f.score}`).sort().join(","),
      );
    }
    return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
  }

  test("веса и пороги не изменились без подъёма версии", () => {
    expect(rulesFingerprint()).toBe(EXPECTED_FINGERPRINT);
    expect(ASSESSMENT_VERSION).toBe(EXPECTED_VERSION);
  });

  test("каждый разбор несёт текущую версию правил", () => {
    expect(assessBody(ideaBody()).version).toBe(ASSESSMENT_VERSION);
  });
});

describe("assessment honesty", () => {
  test("every assessment carries the disclaimer and its blind spots", () => {
    const a = assessBody(ideaBody());
    expect(a.disclaimer).toBe(DISCLAIMER);
    expect(a.disclaimer).toMatch(/не гарантирует ни успеха, ни неудачи/);
    expect(a.blindSpots.length).toBeGreaterThanOrEqual(4);
    expect(a.blindSpots.join(" ")).toMatch(/Команда/);
  });

  test("the same listing always scores the same", () => {
    const a = assessBody(ideaBody());
    const b = assessBody(ideaBody());
    expect(a.score).toBe(b.score);
    expect(a.factors.map((f) => f.score)).toEqual(b.factors.map((f) => f.score));
  });

  test("factor weights sum to 1 at every tier", () => {
    for (const body of [
      ideaBody(),
      ideaBody({
        tier: "mvp",
        demoUrl: "https://example.com/demo",
        deal: { intent: "raise", askUsd: 80_000, equityOfferedPct: 12 },
      }),
      ideaBody({
        tier: "product",
        demoUrl: "https://example.com",
        deal: { intent: "sell_full", askingPriceUsd: 150_000 },
        metrics: { arrUsd: 60_000 },
      }),
    ]) {
      const a = assessBody(body);
      const sum = a.factors.reduce((s, f) => s + f.weight, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    }
  });

  test("an idea is not punished for having no traction, a product is", () => {
    // Same text, same absence of numbers. At idea tier that absence is normal;
    // at product tier it is the thing the buyer came for.
    const asIdea = assessBody(ideaBody());
    const asProduct = assessBody(
      ideaBody({
        tier: "product",
        demoUrl: "https://example.com",
        deal: { intent: "sell_full", askingPriceUsd: 150_000 },
      }),
    );
    const ideaEvidence = asIdea.factors.find((f) => f.key === "evidence")!.score;
    const productEvidence = asProduct.factors.find((f) => f.key === "evidence")!.score;
    expect(productEvidence).toBeLessThan(ideaEvidence);
    expect(asProduct.redFlags.some((f) => /выручка не раскрыта/i.test(f.message))).toBe(true);
  });

  test("stuffing the cue words into a list does not buy a clarity score", () => {
    // Every cue the rubric looks for, packed into comma-separated fragments.
    // Before the fix this scored 88/100 on clarity and 71 overall — above a real
    // pitch — so the feed would have ranked spam first, and a founder would have
    // discovered that before we did.
    const stuffed = assessBody(
      ideaBody({
        title: "Проект",
        description:
          "Проблема. Для кого: клиенты - все. Мы делаем платформу. Подписка, комиссия, тариф, цена. " +
          "В отличие от конкурентов, аналогов нет. Проблема, вручную, теряют, платформа, алгоритм, " +
          "интеграция, монетизация, конкурент, альтернатива, подписка.",
      }),
    );
    const real = assessBody(ideaBody());
    const clarityOf = (a: typeof stuffed) => a.factors.find((f) => f.key === "clarity")!.score;

    expect(clarityOf(stuffed)).toBeLessThan(50);
    expect(clarityOf(stuffed)).toBeLessThan(clarityOf(real) - 30);
    expect(stuffed.score).toBeLessThan(real.score);
  });

  test("clarity rewards a specific pitch and penalises adjectives with no numbers", () => {
    const specific = assessBody(ideaBody()).factors.find((f) => f.key === "clarity")!;
    const vague = assessBody(
      ideaBody({
        description:
          "Революционная уникальная платформа нового поколения, не имеющая аналогов на рынке. " +
          "Инновационное прорывное решение, которое изменит индустрию навсегда и станет лучшим в мире " +
          "продуктом в своей категории для всех пользователей без исключения.",
      }),
    ).factors.find((f) => f.key === "clarity")!;
    expect(specific.score).toBeGreaterThan(vague.score + 25);
    expect(vague.rationale).toMatch(/громкие слова без цифр/);
  });
});

describe("the sector the market factor is scored against", () => {
  // The submit form's default is "определить автоматически". For a while nothing
  // determined anything: an unset sector resolved to the generic fallback whose
  // own source note says "no sector-specific report" — so the founder was shown
  // market numbers documented as not being about their market.

  test("a Russian description is classified, not dumped into the fallback", () => {
    // Title deliberately neutral: the classification must come from the body,
    // not from a giveaway word in the headline.
    const a = assessBody({ ...ideaBody(), title: "Проект без названия отрасли", sector: undefined });
    expect(a.sector.origin).toBe("detected");
    expect(a.sector.id).toBe("logistics");
    expect(a.factors.find((f) => f.key === "market")!.rationale).toMatch(/Отрасль определена по описанию/);
  });

  test("what the founder declares beats what the words suggest", () => {
    const a = assessBody(ideaBody({ sector: "marketplace" }));
    expect(a.sector.id).toBe("marketplace");
    expect(a.sector.origin).toBe("declared");
  });

  test("a prototype key cannot masquerade as a sector", () => {
    // The shared resolver looks its table up with SECTORS[key], and every object
    // answers to constructor / toString / valueOf / __proto__. Measured before
    // the guard: sector "constructor" produced label undefined, TAM undefined
    // and a market score of 0 — a confident-looking analysis of nothing.
    for (const key of ["constructor", "__proto__", "toString", "valueOf"]) {
      const a = assessBody(ideaBody({ sector: key }));
      expect(typeof a.sector.id).toBe("string");
      expect(typeof a.sector.label).toBe("string");
      expect(Number.isFinite(a.sector.tamUsdBn)).toBe(true);
      expect(a.factors.find((f) => f.key === "market")!.score).toBeGreaterThan(0);
      expect(a.sector.origin).not.toBe("declared");
    }
  });

  test("an unrecognised sector string is not passed off as the founder's choice", () => {
    // resolveSector answers `other` for anything it does not know. Calling that
    // "declared" would relabel a typo as a decision.
    const a = assessBody(ideaBody({ sector: "квантовые единороги" }));
    expect(a.sector.origin).not.toBe("declared");
  });

  test("when the text says nothing, the analysis admits the numbers are generic", () => {
    const a = assessBody(
      ideaBody({
        sector: undefined,
        // The title is read too — a listing called "Логистика для перевозчиков"
        // is about logistics whatever the body says — so a genuinely
        // uninformative case has to be uninformative in both fields.
        title: "Хороший продукт",
        description:
          "Мы строим очень хороший продукт для людей. Он будет удобным и понятным, им будут " +
          "пользоваться каждый день, и мы будем постоянно его улучшать вместе с сообществом.",
      }),
    );
    expect(a.sector.origin).toBe("fallback");
    expect(a.factors.find((f) => f.key === "market")!.rationale).toMatch(/не про ваш рынок/);
  });
});

describe("deal terms vs the market", () => {
  test("a $10M post-money on an unbuilt idea is flagged, not quietly scored", () => {
    // $500k for 5% implies a $10M valuation for something that does not exist.
    const a = assessBody(ideaBody({ deal: { intent: "raise", askUsd: 500_000, equityOfferedPct: 5 } }));
    expect(a.deal.implied.postMoneyUsd).toBe(10_000_000);
    expect(a.deal.implied.ratioToBandHigh).not.toBeNull();
    expect(a.deal.implied.ratioToBandHigh!).toBeGreaterThan(4);
    const dealFactor = a.factors.find((f) => f.key === "deal")!;
    expect(dealFactor.score).toBeLessThan(35);
    // And the size of the ask itself gets its own note at idea stage.
    expect(a.redFlags.some((f) => /Запрос \$500K на стадии идеи/.test(f.message))).toBe(true);
  });

  test("terms inside the market band score well and raise no price flag", () => {
    // $30k for 15% → $200k post-money, inside the $50k–$500k idea band.
    const a = assessBody(ideaBody());
    expect(a.deal.implied.postMoneyUsd).toBe(200_000);
    expect(a.deal.implied.ratioToBandHigh!).toBeLessThanOrEqual(1);
    expect(a.factors.find((f) => f.key === "deal")!.score).toBeGreaterThan(70);
    expect(a.redFlags.some((f) => f.severity === "high")).toBe(false);
  });

  test("giving away half the company on the first cheque is a high-severity flag", () => {
    const a = assessBody(ideaBody({ deal: { intent: "raise", askUsd: 40_000, equityOfferedPct: 55 } }));
    const flag = a.redFlags.find((f) => /контроль уходит инвестору/.test(f.message));
    expect(flag?.severity).toBe("high");
  });

  test("a promise of guaranteed returns is refused as a legal problem, not a style note", () => {
    const a = assessBody(
      ideaBody({
        deal: { intent: "raise", askUsd: 30_000, equityOfferedPct: 15, notes: "Гарантирую доход 40% годовых инвестору." },
      }),
    );
    const flag = a.redFlags.find((f) => /гарантированн/i.test(f.message));
    expect(flag?.severity).toBe("high");
  });

  test("a revenue-earning product is priced off its revenue, inside published multiples", () => {
    const a = assessBody(
      ideaBody({
        tier: "product",
        demoUrl: "https://example.com",
        deal: { intent: "sell_full", askingPriceUsd: 180_000 },
        metrics: { arrUsd: 90_000, growthMomPct: 6, grossMarginPct: 82 },
      }),
    );
    expect(a.deal.band.method).toBe("revenue-multiple");
    // The band must stay inside the multiples the cited sources report for
    // micro-SaaS (1.3×–5× of annual revenue), and bracket its own base.
    const lowMult = a.deal.band.low / 90_000;
    const highMult = a.deal.band.high / 90_000;
    expect(lowMult).toBeGreaterThanOrEqual(1.3);
    expect(highMult).toBeLessThanOrEqual(5);
    expect(lowMult).toBeLessThan(highMult);
    expect(a.deal.band.base).toBeGreaterThanOrEqual(a.deal.band.low);
    expect(a.deal.band.base).toBeLessThanOrEqual(a.deal.band.high);
    expect(a.sources.length).toBeGreaterThan(0);
  });

  test("the revenue multiple has no cliff between two near-identical businesses", () => {
    // Written as brackets, $99k and $101k of revenue landed in different
    // multiple ranges and were told very different things by an accident of
    // rounding. The multiple is interpolated, so the two must nearly agree.
    const at = (arrUsd: number) =>
      assessBody(
        ideaBody({
          tier: "product",
          demoUrl: "https://example.com",
          deal: { intent: "sell_full", askingPriceUsd: 200_000 },
          metrics: { arrUsd },
        }),
      ).deal.band;

    const below = at(99_000);
    const above = at(101_000);
    const multBelow = below.high / 99_000;
    const multAbove = above.high / 101_000;
    expect(Math.abs(multBelow - multAbove)).toBeLessThan(0.05);
    // And the multiple still grows with size across the whole range.
    expect(at(2_000_000).high / 2_000_000).toBeGreaterThan(multAbove);
  });

  test("asking above 6x revenue is called out with the market number", () => {
    const a = assessBody(
      ideaBody({
        tier: "product",
        demoUrl: "https://example.com",
        deal: { intent: "sell_full", askingPriceUsd: 900_000 },
        metrics: { arrUsd: 100_000 },
      }),
    );
    expect(a.redFlags.some((f) => f.severity === "high" && /× годовой выручки/.test(f.message))).toBe(true);
  });

  test("revenue claimed at the idea tier is called out as a contradiction", () => {
    // "Ничего не построено" and a revenue figure cannot both be true. Usually
    // it is the wrong tier — and the idea rubric barely weighs evidence, so the
    // founder's real numbers would quietly count for almost nothing.
    const a = assessBody(ideaBody({ metrics: { mrrUsd: 4_000 } }));
    const flag = a.redFlags.find((f) => /Уровень «только идея», но заявлена выручка/.test(f.message));
    expect(flag?.severity).toBe("medium");
    expect(flag?.message).toMatch(/выберите «идея \+ MVP» или «готовый продукт»/);
  });

  test("a price far below the claimed revenue is questioned, not treated as a bargain", () => {
    // Nobody sells a working product for less than half a year of its own
    // revenue unless something is wrong with one of the two numbers. Saying
    // nothing here would let an inflated revenue figure pass as a discount.
    const a = assessBody(
      ideaBody({
        tier: "product",
        demoUrl: "https://example.com",
        deal: { intent: "sell_full", askingPriceUsd: 30_000 },
        metrics: { arrUsd: 200_000 },
      }),
    );
    const flag = a.redFlags.find((f) => /меньше половины заявленной годовой выручки/.test(f.message));
    expect(flag?.severity).toBe("medium");
  });

  test("невероятная выручка не проходит молча: цена ловит её на несогласованности", () => {
    // Цифры основателя биржа не проверяет и честно об этом пишет. Единственное,
    // что можно сделать без верификации, — сверить их между собой: заявленный
    // $1млрд выручки при цене $150K означает, что одно из двух чисел выдумано.
    // Без этой сверки фальшивая выручка читалась бы как выгодная сделка.
    const a = assessBody(
      ideaBody({
        tier: "product",
        demoUrl: "https://example.com",
        deal: { intent: "sell_full", askingPriceUsd: 150_000 },
        metrics: { arrUsd: 1_000_000_000 },
      }),
    );
    expect(a.redFlags.some((f) => /меньше половины заявленной годовой выручки/.test(f.message))).toBe(true);
    // И «доказательства» всё равно остаются в шкале 0–100, а не улетают в бесконечность.
    const evidence = a.factors.find((f) => f.key === "evidence")!;
    expect(evidence.score).toBeLessThanOrEqual(100);
    expect(evidence.rationale).toMatch(/не проверялись биржей/);
  });

  test("the valuation band never depends on the asking price it is compared against", () => {
    // If the ask could move the band, the comparison would be circular and every
    // listing would look fairly priced.
    const cheap = assessBody(ideaBody({ deal: { intent: "raise", askUsd: 10_000, equityOfferedPct: 20 } }));
    const dear = assessBody(ideaBody({ deal: { intent: "raise", askUsd: 900_000, equityOfferedPct: 9 } }));
    expect(cheap.deal.band.base).toBe(dear.deal.band.base);
    expect(cheap.deal.band.high).toBe(dear.deal.band.high);
  });

  test("a stake sale implies a whole-company valuation, not the stake price", () => {
    const band = valuationBand({ tier: "mvp", score: 60, annualRevenueUsd: null });
    const implied = impliedTerms(
      { intent: "sell_stake", stakeForSalePct: 20, stakePriceUsd: 60_000 },
      band,
    );
    expect(implied.postMoneyUsd).toBe(300_000);
    expect(implied.formula).toMatch(/оценка всей компании/);
  });
});

describe("tier specifications stay coherent", () => {
  test("each tier's allowed intents make sense for what is on offer", () => {
    expect(TIER_SPECS.idea.intents).toEqual(["raise"]);
    expect(TIER_SPECS.product.intents).toContain("sell_full");
    // Ticket norms rise with tier — an idea cheque should never exceed a
    // product cheque, or the tiers convey nothing about deal size.
    expect(TIER_SPECS.idea.ticketUsd.high).toBeLessThan(TIER_SPECS.mvp.ticketUsd.high);
    expect(TIER_SPECS.mvp.ticketUsd.high).toBeLessThan(TIER_SPECS.product.ticketUsd.high);
  });

  test("a raise anchors the suggested cheque to the round, not to the tier norm", () => {
    const a = assessBody(ideaBody());
    expect(a.deal.ticket.low).toBe(10_000); // a third of the $30k round
    expect(a.deal.ticket.high).toBe(30_000);
  });
});
