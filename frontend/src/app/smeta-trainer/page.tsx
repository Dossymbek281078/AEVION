import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchOrPaywall } from "@/lib/paywall";
import { PaywallScreen } from "@/components/PaywallScreen";
import SmetaTrainerPage from "./_client";

export default async function Page() {
  // Языковая маршрутизация — четвёртый случай приёма (образцы /longevity,
  // /go, /shop; мутации у сторожей пойманы там). Замер EN-свипа 06.09.2026:
  // под cookie en страница отдавала 84 % кириллицы — худшая строка
  // антирейтинга. en-посетителю — честная английская посадочная
  // /en/smeta-trainer (продукт русскоязычен по предмету, посадочная это
  // прямо говорит). Редирект до платной стены.
  const язык = (await cookies()).get("aevion_lang_v1")?.value;
  if (язык === "en") {
    redirect("/en/smeta-trainer");
  }

  const r = await fetchOrPaywall("/api/smeta-trainer/health");
  if ("paywall" in r) return <PaywallScreen payload={r.paywall} backHref="/modules" />;
  return <SmetaTrainerPage />;
}
