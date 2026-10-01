import { cookies } from "next/headers";
import { englishVersionFor } from "@/lib/englishPages";
import { redirect } from "next/navigation";
import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import SmetaTrainerPage from "./_client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ app?: string | string[] }>;
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
  const enUrl = englishVersionFor("/smeta-trainer");
  if (язык === "en" && !входВПриложение && enUrl) {
    redirect(enUrl);
  }

  const r = await fetchOrPaywall("/api/smeta-trainer/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return <SmetaTrainerPage />;
}
