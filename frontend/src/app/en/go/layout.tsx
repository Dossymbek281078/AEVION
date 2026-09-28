import { разметкаТоваров } from "@/lib/shopJsonLd";

/**
 * Английский двойник `/go`. Разметку строит тот же помощник: товары и цены у
 * страниц общие, расходиться им нельзя. Объяснение — в `@/lib/shopJsonLd`.
 */
export default function EnGoLayout({ children }: { children: React.ReactNode }) {
  const разметка = разметкаТоваров();
  return (
    <>
      {разметка ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(разметка) }}
        />
      ) : null}
      {children}
    </>
  );
}
