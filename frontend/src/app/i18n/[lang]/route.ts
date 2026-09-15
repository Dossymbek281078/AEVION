import { NextResponse } from "next/server";
import { LANGS, type Lang } from "@/lib/i18n-data";

/**
 * Словарь языка как статический JSON — чтобы браузер мог начать качать его
 * ПАРАЛЛЕЛЬНО основному коду сайта, а не после него.
 *
 * Замер 15.09.2026 (телефон 390 px, Slow 4G, /pricing, ru без куки): текст на
 * экране в 9,7 с, русский — в 18,7 с. Словарь шёл после основного JS (~1 МБ),
 * потому что запросить его мог только сам код переводов, а он исполняется
 * последним. Ранний старт внутри модуля (2723627e7) ничего не дал — модуль всё
 * равно ждёт основной JS. Отсюда этот маршрут: инлайн-скрипт в корневом макете
 * начинает fetch с первого байта HTML, loadDict подхватывает начатый запрос.
 *
 * Отдаётся при сборке (force-static), кэш вечный: адрес версионирован
 * коммитом сборки (`?v=<commit>` в макете), новая выкатка — новый адрес.
 * Английский не отдаём: он встроен в код и качать его незачем.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

// Расписано по одному, как в lib/i18n.tsx: путь с переменной без расширения
// Vite (юнит-тесты) не принимает.
const LOADERS: Partial<Record<Lang, () => Promise<{ default: Record<string, string> }>>> = {
  ru: () => import("@/lib/i18n-lang/ru"),
  kk: () => import("@/lib/i18n-lang/kk"),
  de: () => import("@/lib/i18n-lang/de"),
  fr: () => import("@/lib/i18n-lang/fr"),
  es: () => import("@/lib/i18n-lang/es"),
  zh: () => import("@/lib/i18n-lang/zh"),
  ja: () => import("@/lib/i18n-lang/ja"),
  ar: () => import("@/lib/i18n-lang/ar"),
  pt: () => import("@/lib/i18n-lang/pt"),
  tr: () => import("@/lib/i18n-lang/tr"),
};

export function generateStaticParams() {
  return (LANGS as readonly string[]).filter((l) => l !== "en").map((lang) => ({ lang }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ lang: string }> }) {
  const { lang } = await ctx.params;
  const load = LOADERS[lang as Lang];
  if (!load) return NextResponse.json({ error: "unknown language" }, { status: 404 });
  const dict = (await load()).default;
  return NextResponse.json(dict, {
    headers: { "cache-control": "public, max-age=31536000, immutable" },
  });
}
