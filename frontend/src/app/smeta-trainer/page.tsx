import { cookies } from "next/headers";
import { englishUrlWithChannel } from "@/lib/englishPages";
import { redirect } from "next/navigation";
import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import SmetaTrainerPage from "./_client";

import type { Metadata } from "next";
import { языки } from "@/lib/hreflang";

/*
 * canonical и языковая пара — 06.10.2026, НА СТРАНИЦЕ, а не в макете.
 *
 * Сначала я положил их в smeta-trainer/layout.tsx — и сторож
 * layoutCanonicalDoesNotHideChildren показал 383 уводящих canonical против
 * известных 102. Причина: под этим макетом 349 дочерних страниц, и каждая
 * унаследовала бы canonical раздела, то есть сказала бы поисковику «я копия
 * /smeta-trainer». Метаданные СТРАНИЦЫ детям не достаются — поэтому место
 * им здесь.
 *
 * Пара объявлена по замеру того же дня: /smeta-trainer — кириллицы 2260,
 * латиницы 581; /en/smeta-trainer — кириллицы 9, латиницы 955; оба 200.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/smeta-trainer", languages: языки("/smeta-trainer") },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ app?: string | string[]; c?: string | string[] }>;
}) {
  // Языковая маршрутизация — четвёртый случай приёма (образцы /longevity,
  // /go, /shop; мутации у сторожей пойманы там). Замер EN-свипа 06.09.2026:
  // под cookie en страница отдавала 84 % кириллицы — худшая строка
  // антирейтинга. en-посетителю — честная английская посадочная
  // /en/smeta-trainer (продукт русскоязычен по предмету, посадочная это
  // прямо говорит). Редирект до платной стены.
  //
  // 14.09.2026: `?app` — вход в само приложение. Без него кнопка на
  // /en/smeta-trainer вела сюда же, и редирект возвращал на посадочную: круг
  // (прод: cookie en → 307 /en/smeta-trainer). Сторож — enModuleLandings.guard.
  const язык = (await cookies()).get("aevion_lang_v1")?.value;
  const входВПриложение = (await searchParams).app !== undefined;

  // 🔴 01.10.2026: уводим ТОЛЬКО если английская страница есть. Замер прода:
  // с кукой aevion_lang_v1=en было 6 шагов и снова 307 — бесконечный круг,
  // потому что /en/smeta-trainer своей страницы не имеет и middleware возвращал
  // гостя сюда. Список английских страниц один на всех: lib/englishPages.
  const enUrl = englishUrlWithChannel("/smeta-trainer", (await searchParams).c);
  if (язык === "en" && !входВПриложение && enUrl) {
    redirect(enUrl);
  }

  const r = await fetchOrPaywall("/api/smeta-trainer/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return <SmetaTrainerPage />;
}
