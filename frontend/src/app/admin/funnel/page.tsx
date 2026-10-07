import type { Metadata } from "next";
import { FunnelAdminClient } from "./_client";

/**
 * `/admin/funnel` — отдельная страница по решению оркестратора 06.10.2026:
 * не раздел на странице цен, а свой прибор. Из поиска скрыта: числа публичные,
 * но страница служебная, в выдаче ей не место.
 */
export const metadata: Metadata = {
  // Без хвоста «| AEVION»: шаблон раскладки добавляет бренд сам, и сторож
  // titleSuffixNotDoubled краснеет на удвоении. Нашли независимо двое
  // 07.10.2026: приёмка при сборке волны 24 и окно 98 полным прогоном —
  // своим сторожем страницы этого было не видно.
  title: "Воронка — прибор",
  robots: { index: false, follow: false },
};

export default function Страница() {
  return <FunnelAdminClient />;
}
