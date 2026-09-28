/**
 * Разметка каталога приложений для поисковика.
 *
 * 🔴 ЗАЧЕМ. Замер 23.09.2026 по боевому сайту: `/apps` отдаёт роботу 67 598
 * знаков и НИ ОДНОГО блока `Product` — только Organization и WebSite. Значит в
 * выдаче нет ни цены, ни наличия. Поиск — единственный канал, который заводится
 * без чужих логинов и без публикаций, и цена в строке выдачи как раз и делает
 * её кликабельной.
 *
 * 🔴 ПОЧЕМУ РАЗМЕТКА СПРАШИВАЕТ КАССУ, А НЕ ТОЛЬКО КАТАЛОГ. Тем же замером:
 * из девяти приложений витрины оплатить можно ПЯТЬ — у QRight, QSign,
 * Startup Exchange и QSkyway не заведено ни одного платёжного варианта
 * (`/api/pricing/checkout/healthz`: настроено 30 из 50). Пообещать поисковику
 * «в наличии» то, что нельзя купить, — это ровно то расхождение «витрина
 * обещает больше продукта», за которое мы уже платили. Поэтому источник
 * наличия — касса, а не наш список.
 *
 * Не смогли спросить кассу — разметки НЕТ вовсе. Отказ в сторону молчания:
 * пустая выдача дешевле ложного обещания.
 */
import { apiUrl } from "@/lib/apiBase";
import { STANDALONE_APPS, fromPricePerMonth, type StandaloneApp } from "@/lib/termPricing";

const САЙТ = "https://aevion.app";

/** Ссылки вида `app_<slug>_<ступень>` → множество slug, у которых касса готова. */
export function slugиИзКассы(настроено: string[]): Set<string> {
  const out = new Set<string>();
  for (const ссылка of настроено) {
    const m = /^app_(.+)_(lite|medium|pro|full|max)$/.exec(ссылка);
    if (m) out.add(m[1]);
  }
  return out;
}

export function товарПриложения(app: StandaloneApp) {
  return {
    "@type": "Product",
    sku: app.slug,
    name: `AEVION ${app.name}`,
    url: `${САЙТ}/pricing?app=${encodeURIComponent(app.slug)}#apps`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      // Честная «вилка»: самый длинный срок даёт самый дешёвый месяц,
      // самый короткий — самый дорогой. Одна цена здесь соврала бы.
      lowPrice: fromPricePerMonth(app.baseMonthly).toFixed(2),
      highPrice: app.baseMonthly.toFixed(2),
      offerCount: 5,
      availability: "https://schema.org/InStock",
      url: `${САЙТ}/pricing?app=${encodeURIComponent(app.slug)}#apps`,
    },
  };
}

export async function разметкаПриложений(): Promise<Record<string, unknown> | null> {
  let настроено: string[];
  try {
    const r = await fetch(apiUrl("/api/pricing/checkout/healthz"), {
      next: { revalidate: 3600 },
    });
    if (!r.ok) {
      console.warn(`[apps/разметка] касса ответила ${r.status} — разметки не будет`);
      return null;
    }
    const j = (await r.json()) as {
      providers?: { lemonsqueezy?: { sellable?: { configured?: unknown } } };
    };
    const список = j?.providers?.lemonsqueezy?.sellable?.configured;
    if (!Array.isArray(список)) {
      console.warn("[apps/разметка] в ответе кассы нет списка настроенного — разметки не будет");
      return null;
    }
    настроено = список.filter((x): x is string => typeof x === "string");
  } catch (e) {
    console.warn(`[apps/разметка] кассу спросить не удалось (${e instanceof Error ? e.message : String(e)}) — разметки не будет`);
    return null;
  }

  const готовые = slugиИзКассы(настроено);
  const товары = STANDALONE_APPS.filter((a) => готовые.has(a.slug));
  if (!товары.length) {
    console.warn("[apps/разметка] ни одного оплачиваемого приложения — разметки не будет");
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Приложения AEVION",
    itemListElement: товары.map((app, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: товарПриложения(app),
    })),
  };
}
