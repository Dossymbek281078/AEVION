import { разметкаТоваров } from "@/lib/shopJsonLd";

/**
 * Витрина магазина отдаёт поисковику список товаров с ценами.
 * Построение разметки и объяснение — в `@/lib/shopJsonLd`, чтобы её можно было
 * проверить тестом, а не только глазами на проде.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
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
