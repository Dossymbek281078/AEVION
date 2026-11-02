import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * 2.11.2026, замер Playwright на проде (телефон, /en): 92 из 232 строк main на кириллице — заголовок
 * вкладки, герой, «Подать заявку», уровни, мастер, сортировка, «Предложить сделку», кабинет. Англоязычный
 * приглашённый видел русскую форму и уходил: из 20 приглашений биржи заявок 0.
 *
 * Сторож: на lang="en" в отрисованном тексте, placeholder, aria-label, title и значениях нет кириллицы —
 * кроме данных, которые приходят из мока (названия заявок и т.п. заданы здесь латиницей, так что исключений
 * нет вовсе). Серверные подписи уровней мок отдаёт ПО-РУССКИ, как прод: их обязан перевести фронт.
 * На lang="ru" русский остаётся как был.
 */

const lang = vi.hoisted(() => ({ value: "en" }));
const route = vi.hoisted(() => ({ id: "1", token: "tok-123" }));

vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18nOptional: () => ({ lang: lang.value, langReady: true, t: (k: string) => k }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/startup-exchange",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`token=${route.token}`),
  useParams: () => ({ id: route.id }),
}));
// Общие оболочки — не область биржи; подменяем, чтобы замерять только строки модуля.
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ProductPageShell", () => ({ ProductPageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));
vi.mock("@/components/PageTracking", () => ({ PageTracking: () => null }));
vi.mock("@/components/MvpConceptBoard", () => ({
  default: (p: { sectionTitle: string; sectionHint: string; fields: Array<{ label: string; placeholder?: string }> }) => (
    <section>
      <h3>{p.sectionTitle}</h3>
      <p>{p.sectionHint}</p>
      {p.fields.map((f) => (
        <input key={f.label} aria-label={f.label} placeholder={f.placeholder} />
      ))}
    </section>
  ),
}));

import { ServerLangProvider } from "@/lib/serverLangContext";
import StartupExchangePage from "../page";
import ListingDetailPage from "../[id]/page";
import OffersPage from "../[id]/offers/page";
import { ListingCard } from "../components/ListingCard";
import { SX_TEXT, sx } from "../sxText";
import { BAND_STYLE, BUILD_BY_LABEL, INTENT_LABEL, dealHeadline, humanError } from "../lib";

const CYR = /[А-Яа-яЁё]/;

const ASSESSMENT = {
  version: 3,
  tier: "idea",
  score: 62,
  band: "mixed",
  headline: "Clear problem, thin evidence",
  factors: [{ key: "clarity", label: "Clarity", weight: 0.4, score: 70, rationale: "Well explained", basis: "text-only" }],
  redFlags: [{ severity: "high", message: "The ask is above the market" }],
  blindSpots: ["Nobody checked the team"],
  deal: {
    band: { low: 100000, base: 200000, high: 300000, basis: "stage band", method: "stage-band" },
    implied: { postMoneyUsd: 600000, ratioToBandHigh: 2.4, formula: "30000 / 5%" },
    ticket: { low: 5000, high: 50000, note: "typical" },
  },
  sector: { id: "logistics", label: "Logistics / Supply Chain", tamUsdBn: 10, cagr: 8, origin: "detected" },
  sources: [{ publisher: "Source Co", year: 2026, claim: "A claim", url: "https://example.com/s" }],
  evidenceCoverage: 0.3,
  disclaimer: "This is not advice.",
  generatedAt: "2026-11-02T10:00:00Z",
};

const LISTING = {
  id: 1,
  title: "Backhaul loads",
  description: "Small carriers lose a third of their trips to empty mileage.",
  tier: "idea",
  tierLabel: "Только идея",
  stage: "idea",
  sector: "logistics",
  geography: "KZ",
  demo_url: "https://example.com/demo",
  repo_url: null,
  deal: { intent: "raise", askUsd: 30000, equityOfferedPct: 5, buildBy: "founder", notes: "Open to talk" },
  metrics: { mrrUsd: 1000, users: 40, growthMomPct: 8, teamSize: 2, monthsInDevelopment: 6, payingCustomers: 3, churnMonthlyPct: 2, grossMarginPct: 70, arrUsd: 12000 },
  assessment: ASSESSMENT,
  assessment_score: 62,
  contact_method: "@founder",
  content_hash: "abcdef0123456789abcdef",
  qright_protected: true,
  views: 3,
  removed_reason: null,
  visibility: "public",
  created_at: "2026-11-01T10:00:00Z",
  interest_count: 2,
};

const TIERS = [
  { id: "idea", label: "Только идея", offer: "Ничего не построено. Основатель отдаёт долю, инвестор финансирует разработку.", intents: ["raise"], ticketUsd: { low: 5000, high: 50000 }, minDescription: 120, requiresDemoUrl: false },
  { id: "mvp", label: "Идея + MVP", offer: "Рабочий прототип есть. Основатель отдаёт долю, инвестор финансирует доработку.", intents: ["raise", "sell_stake"], ticketUsd: { low: 25000, high: 250000 }, minDescription: 200, requiresDemoUrl: true },
  { id: "product", label: "Готовый продукт", offer: "Приложение работает. Разговор о покупке целиком или о выкупе доли.", intents: ["sell_full", "sell_stake", "raise"], ticketUsd: { low: 50000, high: 2000000 }, minDescription: 200, requiresDemoUrl: true },
];

let emptyFeed = false;

function ok(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) } as unknown as Response;
}

beforeEach(() => {
  emptyFeed = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/tiers")) return ok({ tiers: TIERS, intents: ["raise", "sell_stake", "sell_full"], sectors: [{ id: "logistics", label: "Logistics / Supply Chain" }], sources: [], assessmentVersion: 3, disclaimer: "x" });
      if (url.includes("/stats")) return ok({ total: 5, byTier: { idea: 3 }, recentCount: 2, assessed: 4, avgScore: 55 });
      if (url.includes("/assess")) return ok({ assessment: ASSESSMENT, stored: false });
      if (url.includes("/offers")) {
        return ok({
          listing: LISTING,
          offers: [{ id: 9, investorEmail: "inv@example.com", message: "Interested", intent: "raise", ticketUsd: 30000, equityPct: 10, createdAt: "2026-11-02T08:00:00Z" }],
        });
      }
      if (/\/ideas\/\d+/.test(url)) return ok(LISTING);
      if (url.includes("/ideas?")) return ok({ listings: emptyFeed ? [] : [LISTING], total: emptyFeed ? 0 : 1 });
      return ok({});
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Всё, что человек или читалка экрана получает со страницы: текст + атрибуты. */
function visibleStrings(): string[] {
  const out: string[] = [document.body.textContent ?? ""];
  document.querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach((el) => {
    for (const a of ["placeholder", "aria-label", "title", "alt"]) {
      const v = el.getAttribute(a);
      if (v) out.push(v);
    }
  });
  document.querySelectorAll("input,textarea").forEach((el) => {
    const v = (el as HTMLInputElement).value;
    if (v) out.push(v);
  });
  return out;
}

function cyrillicLeft(): string[] {
  return visibleStrings().flatMap((s) => s.match(/[^\s]*[А-Яа-яЁё][^\s]*/g) ?? []);
}

function renderIn(node: React.ReactElement, l: "en" | "ru") {
  lang.value = l;
  return render(<ServerLangProvider lang={l}>{node}</ServerLangProvider>);
}

describe("биржа на английском: кириллицы в отрисованном нет", () => {
  it("лента: герой, уровни, поиск, сортировка, карточка, доска", async () => {
    renderIn(<StartupExchangePage />, "en");
    await screen.findByText("Backhaul loads");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/An idea, an MVP or a finished product/);
    expect(screen.getByText("Newest first".toLowerCase())).toBeTruthy();
    expect(screen.getByText("Propose a deal")).toBeTruthy();
    expect(screen.getAllByText("Idea only").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Finished product").length).toBeGreaterThan(0);
    expect(cyrillicLeft(), "кириллица на ленте /en").toEqual([]);
  });

  it("пустая лента: пример заявки и призыв", async () => {
    emptyFeed = true;
    renderIn(<StartupExchangePage />, "en");
    await screen.findByText("Be the first");
    await screen.findByText(/Backhaul loads for small carriers/);
    expect(cyrillicLeft(), "кириллица в пустой ленте /en").toEqual([]);
  });

  it("мастер до шага условий: форма, каркас, анализ, условия, взнос", async () => {
    renderIn(<StartupExchangePage />, "en");
    await screen.findByText("Backhaul loads");
    fireEvent.click(screen.getByText("Describe your project — I'll show a free analysis"));
    await screen.findByText("Describe it — I'll do the rest");
    expect(cyrillicLeft(), "кириллица в мастере /en").toEqual([]);
    fireEvent.click(screen.getByText("Insert an outline"));
    const area = screen.getByLabelText(/Project description/) as HTMLTextAreaElement;
    expect(area.value).toBe("Problem: \nFor whom: \nWhat we build: \nRevenue model: \nUnlike: ");
    fireEvent.change(area, { target: { value: "Small carriers lose a third of their trips to empty mileage; we match loads." } });
    fireEvent.click(screen.getByText("Show the free analysis"));
    await screen.findByText("Publish on the exchange");
    expect(screen.getByLabelText("Your email (not published)")).toBeTruthy();
    expect(cyrillicLeft(), "кириллица на шаге условий /en").toEqual([]);
  });

  it("карточка отдельно и модалка отклика", async () => {
    renderIn(<ListingCard listing={LISTING as never} onInterest={() => {}} />, "en");
    expect(screen.getByText("Idea only")).toBeTruthy();
    expect(screen.getByText("Propose a deal")).toBeTruthy();
    expect(cyrillicLeft(), "кириллица в карточке /en").toEqual([]);
    cleanup();
    renderIn(<StartupExchangePage />, "en");
    await screen.findByText("Backhaul loads");
    fireEvent.click(screen.getByText("Propose a deal"));
    await screen.findByRole("dialog");
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Offer on the listing “Backhaul loads”");
    expect(cyrillicLeft(), "кириллица в модалке /en").toEqual([]);
  });

  it("страница заявки", async () => {
    renderIn(<ListingDetailPage />, "en");
    await screen.findByText("Figures from the founder");
    expect(cyrillicLeft(), "кириллица на странице заявки /en").toEqual([]);
  });

  it("кабинет основателя: предложения, правка условий, снятие с публикации", async () => {
    renderIn(<OffersPage />, "en");
    await screen.findByText("Save and recompute");
    expect(screen.getByText("Withdraw the listing")).toBeTruthy();
    expect(cyrillicLeft(), "кириллица в кабинете /en").toEqual([]);
    fireEvent.click(screen.getByText("Withdraw the listing"));
    expect(screen.getByText("Really withdraw? Click once more")).toBeTruthy();
    expect(cyrillicLeft(), "кириллица после первого клика /en").toEqual([]);
  });

  it("ошибки сервера, которые собирает lib.ts, тоже читаются", () => {
    expect(sx("en", humanError("rate_limited", 429))).toMatch(/Too many requests/);
    expect(sx("en", humanError(undefined, 500))).toBe("Error 500. Please try again.");
    expect(dealHeadline(LISTING.deal as never, "en")).toBe("$30K for 5%");
  });
});

describe("биржа на русском: русский остался как был", () => {
  it("лента и карточка", async () => {
    renderIn(<StartupExchangePage />, "ru");
    await screen.findByText("Backhaul loads");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Идея, MVP или готовый продукт — с ценой, долей и бесплатным разбором");
    expect(screen.getByText("Предложить сделку")).toBeTruthy();
    expect(screen.getByText("сначала новые")).toBeTruthy();
    expect(screen.getAllByText("Только идея").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Поиск по заявкам")).toBeTruthy();
  });

  it("мастер: каркас и подписи", async () => {
    renderIn(<StartupExchangePage />, "ru");
    await screen.findByText("Backhaul loads");
    fireEvent.click(screen.getByText("Опишите проект — покажу бесплатный разбор"));
    await screen.findByText("Опишите — остальное сделаю я");
    fireEvent.click(screen.getByText("Вставить каркас"));
    expect((screen.getByLabelText(/Описание проекта/) as HTMLTextAreaElement).value).toBe("Проблема: \nДля кого: \nМы делаем: \nМодель заработка: \nВ отличие от: ");
  });

  it("кабинет и lib: прежние строки", async () => {
    renderIn(<OffersPage />, "ru");
    await screen.findByText("Сохранить и пересчитать");
    fireEvent.click(screen.getByText("Снять заявку с публикации"));
    expect(screen.getByText("Точно снять? Нажмите ещё раз")).toBeTruthy();
    expect(dealHeadline(LISTING.deal as never)).toBe("$30K за 5%");
    expect(dealHeadline(null)).toBe("Условия сделки не указаны");
    expect(humanError(undefined, 500)).toBe("Ошибка 500. Попробуйте ещё раз.");
  });
});

describe("словарь полон", () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (n === "__tests__" || n === "node_modules") return [];
      if (statSync(p).isDirectory()) return sources(p);
      return /\.tsx?$/.test(n) && !/\.test\./.test(n) && !/^(sxText|opengraph-image)/.test(n) ? [p] : [];
    });
  }
  const root = join(__dirname, "..");

  it("каждая строка, поданная в t()/tr()/sx(), есть в словаре с английским", () => {
    const missing: string[] = [];
    for (const f of sources(root)) {
      const text = readFileSync(f, "utf8");
      const re = /\b(?:t|tr)\(\s*"((?:[^"\\]|\\.)*)"|\bsx\(\s*\w+\s*,\s*"((?:[^"\\]|\\.)*)"/g;
      for (const m of text.matchAll(re)) {
        const key = (m[1] ?? m[2]).replace(/\\"/g, '"');
        if (CYR.test(key) && !SX_TEXT[key]?.en) missing.push(`${f.slice(root.length)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("подписи из lib.ts, ошибки сервера и подписи уровней переводятся", () => {
    const labels = [
      ...Object.values(BAND_STYLE).map((b) => b.label),
      ...Object.values(INTENT_LABEL),
      ...Object.values(BUILD_BY_LABEL),
      ...TIERS.flatMap((t) => [t.label, t.offer]),
    ];
    for (const code of ["free_quota_exceeded", "rate_limited", "daily_publish_limit", "validation_failed", "assessment_failed", "database_unavailable", "not_found", "invalid_id", "invalid_token", "forbidden", "update_failed", "withdraw_failed", "offers_unavailable", "report_failed", "reason_required", "reason_invalid"]) {
      labels.push(humanError(code, 400));
    }
    const untranslated = labels.filter((s) => CYR.test(sx("en", s)));
    expect(untranslated).toEqual([]);
  });
});
