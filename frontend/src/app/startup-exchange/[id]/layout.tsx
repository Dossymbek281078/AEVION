import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";
// Один форматтер денег на модуль: локальная копия здесь разошлась с карточкой
// ("$30.0K" против "$30K") ровно в тот момент, когда формат поменяли в одном месте.
import { usd } from "../lib";
import { serverLang } from "@/lib/serverLang";
import { tabTitleLang } from "@/lib/tabTitles";
import { sx } from "../sxText";

/**
 * Link preview for a single listing.
 *
 * The listing page itself renders on the client, so a shared link used to
 * preview as the generic exchange title — a founder sending their idea to an
 * investor got a card that said nothing about the idea. This resolves the real
 * title, tier and asking terms on the server so the link carries them.
 *
 * Never throws: a listing page must open even when the backend is unreachable,
 * so a failed lookup falls back to the generic title instead of an error.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://aevion.app";

const TIER_LABEL: Record<string, string> = {
  idea: "Только идея",
  mvp: "Идея + MVP",
  product: "Готовый продукт",
};

interface DealTerms {
  intent?: string;
  askUsd?: number;
  equityOfferedPct?: number;
  askingPriceUsd?: number;
  stakeForSalePct?: number;
  stakePriceUsd?: number;
}

/** The one line an investor should see in the preview: what is on offer. */
function dealLine(deal: DealTerms | null | undefined, lang: string): string | null {
  if (!deal) return null;
  if (deal.intent === "raise" && deal.askUsd && deal.equityOfferedPct) {
    return sx(lang, "{price} за {pct}%", { price: usd(deal.askUsd), pct: deal.equityOfferedPct });
  }
  if (deal.intent === "sell_stake" && deal.stakePriceUsd && deal.stakeForSalePct) {
    return sx(lang, "{pct}% за {price}", { pct: deal.stakeForSalePct, price: usd(deal.stakePriceUsd) });
  }
  if (deal.intent === "sell_full" && deal.askingPriceUsd) {
    return sx(lang, "Продажа целиком — {price}", { price: usd(deal.askingPriceUsd) });
  }
  return null;
}

/** Trim to a whole word, with an ellipsis only when something was cut. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—–-]+$/, "")}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lang = tabTitleLang(await serverLang("ru"));
  const url = `${SITE}/startup-exchange/${id}`;
  const fallback: Metadata = {
    title: sx(lang, "Заявка на бирже стартапов · AEVION"),
    // canonical записан литералом, а не переменной: сторож
    // layoutCanonicalDoesNotHideChildren читает исходник текстом и
    // переменную не видит — страница числилась бы спрятанной.
    alternates: { canonical: `${SITE}/startup-exchange/${id}` },
    robots: { index: true, follow: true },
  };

  try {
    const resp = await fetch(apiUrl(`/api/startupx/ideas/${encodeURIComponent(id)}${lang === "en" ? "?lang=en" : ""}`), {
      // 2.11.2026: был час — снятая заявка ещё час отдавала 200 со старым названием и описанием
      // (пробы 25 и 27 после DELETE). Минута: превью почти не отстаёт, бэкенд не дёргается на каждом обходе.
      next: { revalidate: 60 },
    });
    if (!resp.ok) return fallback;
    const body = (await resp.json()) as { success?: boolean; data?: Record<string, unknown> };
    const l = body?.data;
    if (!body?.success || !l || typeof l.title !== "string") return fallback;

    // hasOwnProperty, not `?? `: TIER_LABEL["constructor"] is a function, and a
    // function interpolated into a <title> renders as its source code.
    const tierKey = String(l.tier);
    const tier = Object.prototype.hasOwnProperty.call(TIER_LABEL, tierKey) ? sx(lang, TIER_LABEL[tierKey]) : sx(lang, "Заявка");
    const deal = dealLine(l.deal as DealTerms | null, lang);
    const score = typeof l.assessment_score === "number" ? `${l.assessment_score}/100` : null;
    // Обрезка по границе слова: "…транспортные компании. М" в превью выглядит
    // как сломанная страница, а не как сокращённый текст.
    const summary = typeof l.description === "string" ? clip(l.description.replace(/\s+/g, " "), 180) : "";

    const title = `${l.title} — ${tier}${deal ? `, ${deal}` : ""} · ${sx(lang, "Биржа стартапов AEVION")}`;
    const description = [deal, score ? `${sx(lang, "балл разбора")} ${score}` : null, summary]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 300);

    return {
      title,
      description,
      alternates: { canonical: `${SITE}/startup-exchange/${id}` },
      openGraph: { type: "article", url, title, description, siteName: "AEVION" },
      robots: { index: true, follow: true },
    };
  } catch {
    return fallback;
  }
}

/**
 * 27.10.2026: честный 404 для несуществующей заявки. Сторож мягких 404 (soft404-2026-10-27.md):
 * `/startup-exchange/qqq-no-such-987` отвечал 200 — страница клиентская и сама рисует «Заявка не
 * найдена», но статус уже 200. Нечисловой id и 404 от бэкенда → `notFound()`; бэкенд не ответил —
 * пропускаем к странице (она покажет свой отказ), чтобы наша сеть не превращала живую заявку в 404.
 * 2.11.2026: запрос без кэша — снятая заявка (DELETE) сразу 404, а не через час.
 */
export const dynamic = "force-dynamic";

export default async function ListingLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9][0-9]{0,12}$/.test(id)) notFound();
  let status = 0;
  try {
    // Решение «есть ли заявка» — только по живому ответу: из кэша снятая заявка открывалась бы ещё час.
    const resp = await fetch(apiUrl(`/api/startupx/ideas/${encodeURIComponent(id)}`), { cache: "no-store" });
    status = resp.status;
  } catch {
    status = 0;
  }
  if (status === 404) notFound();
  return <>{children}</>;
}
