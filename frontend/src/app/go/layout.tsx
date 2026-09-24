import { разметкаТоваров } from "@/lib/shopJsonLd";

/**
 * `/go` — страница, на которую ведут описания и комментарии роликов YouTube:
 * единственный живой канал (88 роликов, 9 091 просмотр на 23.09.2026). Она
 * продаёт те же разовые товары, что и витрина, но поисковику до сих пор
 * отдавала только Organization и WebSite — без цены и наличия.
 *
 * Разметка строится тем же помощником, что и на `/shop`: второй способ делать
 * то же самое разошёлся бы с каталогом при первой правке цены.
 */
export default function GoLayout({ children }: { children: React.ReactNode }) {
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
