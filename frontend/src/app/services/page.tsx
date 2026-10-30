import type { Metadata } from "next";
import { getServerLang } from "@/lib/i18n-server";
import ServicesClient from "./ServicesClient";

// Метаданные зависят от языка посетителя (?lang, кука aevion_lang_v1, Accept-Language): cookies() в
// generateMetadata требует рендера на запрос, иначе SSG зафиксирует один язык.
export const dynamic = "force-dynamic";

/** Язык метатегов: явный ?lang=en|ru главнее; иначе язык сервера, всё кроме en считаем ru (у страницы два словаря). */
export function языкМетатегов(langParam: string | string[] | undefined, серверный: string): "ru" | "en" {
  const q = Array.isArray(langParam) ? langParam[0] : langParam;
  if (q === "en") return "en";
  if (q === "ru") return "ru";
  return серверный === "en" ? "en" : "ru";
}

const RU: Metadata = {
  title: { absolute: "Услуги AEVION — ИИ-ролики, фото товаров, перевод и озвучка" },
  description:
    "Три услуги с образцами и ценами: ИИ-ролики для бизнеса от $49 за 3 ролика, ИИ-фото товаров для маркетплейсов от $15, перевод и озвучка роликов с подгонкой губ — проба 60 секунд за $19.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Услуги AEVION — ИИ-ролики, фото товаров, перевод и озвучка",
    description: "Образцы и цены. Готово до 3 рабочих дней.",
    url: "https://aevion.app/services",
    siteName: "AEVION",
    type: "website",
    locale: "ru_RU",
  },
};

const EN: Metadata = {
  title: { absolute: "AEVION services — AI videos, product photos, translation and dubbing" },
  description:
    "Three services with samples and prices: AI videos for business from $49 for 3 videos, AI product photos for marketplaces from $15, video translation and dubbing with lip sync — 60-second trial for $19.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "AEVION services — AI videos, product photos, translation and dubbing",
    description: "Samples and prices. Ready within 3 business days.",
    url: "https://aevion.app/services",
    siteName: "AEVION",
    type: "website",
    locale: "en_US",
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = Array.isArray(sp?.lang) ? sp.lang[0] : sp?.lang;
  const серверный = q === "en" || q === "ru" ? q : await getServerLang();
  return языкМетатегов(sp?.lang, серверный) === "en" ? EN : RU;
}

export default function ServicesPage() {
  return <ServicesClient />;
}
