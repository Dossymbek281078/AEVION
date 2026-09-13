import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { AutoTranslate } from "@/components/AutoTranslate";

const SITE = getSiteUrl();
// 13.09.2026: явная ссылка на og.svg убрана. Она перебивала файловое
// соглашение Next (opengraph-image.tsx рядом) и подставляла SVG с СЫРОГО
// домена Railway, а SVG как превью не рисует ни одна крупная площадка —
// ссылка уходила в мессенджер голой. Теперь картинку даёт соседний
// opengraph-image.tsx: PNG 1200x630 с нашего домена, как у qsign и qskyway.
// Ручка /api/<модуль>/og.svg на сервере жива и не тронута: у неё могут
// быть другие потребители, здесь она просто больше не источник превью.

export const metadata: Metadata = {
  // 13.09.2026: absolute, потому что имя платформы уже стоит В САМОМ
  // заголовке, а корневой шаблон добавлял второе. Замер на живом сайте:
  // «... · AEVION» у 14 страниц из 14 в выборке. Вкладка и выдача поиска
  // режут около шестидесяти знаков — второй бренд выталкивал оттуда
  // нужные слова. Страницам БЕЗ имени в заголовке шаблон по-прежнему нужен,
  // поэтому корневой файл не тронут.
  title: { absolute: "AEVION QRight — author rights & royalty rail · права автора и роялти" },
  description:
    "QRight is the AEVION authorship layer: register a work, get a content-hashed receipt with HMAC + Ed25519 signatures, threshold-shard the secret across Quantum Shield. Verify offline; route royalties through Bank. Слой авторства AEVION: регистрация работы, подписанный чек с хешем содержимого, проверка без доверия серверу, роялти через Bank.",
  openGraph: {
    // 13.09.2026: превью было англоязычным, а подписчик у волны 20 сентября
    // русский — по ссылке из письма он видел бы текст на чужом языке раньше
    // самой страницы. Перевод, а не новый текст: утверждения те же, и они
    // проверены 09.09 по ручке /api/pipeline/protect (Ed25519 + доли Шамира
    // 2 из 3). Английский остался в title/description и в JSON-LD — их читают
    // поиск и внешние интеграторы.
    title: "AEVION QRight — рельс авторства: регистрация, подпись, роялти",
    description:
      "Зарегистрируйте, подпишите, разделите ключ на пороговые доли. Публичная страница проверки для каждого объекта, встраиваемый значок, отчисления роялти в Банк.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QRight — рельс авторства",
    description: "Регистрация, подпись Ed25519, доли ключа по Шамиру, роялти через Банк.",
  },
  alternates: { canonical: "/qright" },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "QRight — proof-of-authorship rail of AEVION",
  name: "AEVION QRight",
  description:
    "Register works, hash content canonically, dual-sign (HMAC + Ed25519), threshold-shard the secret on Quantum Shield. Public verification page + embeddable badge + Bank royalty payouts.",
  inLanguage: ["en", "ru", "kk"],
  about: ["AEVION QRight", "Proof of Authorship", "Ed25519", "Shamir Secret Sharing", "Royalties"],
  publisher: { "@type": "Organization", name: "AEVION", url: SITE },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/qright` },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "AEVION", item: SITE },
    { "@type": "ListItem", position: 2, name: "QRight", item: `${SITE}/qright` },
  ],
};

export default function QRightLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* QRight is an app-shell (global AutoTranslate runs observe=false), so
          re-enable a live observer scoped here — async-loaded registry records,
          verification results and error toasts translate into all 11 languages
          when the user switches via the app-shell pill. Mirrors build/layout. */}
      <AutoTranslate observe>{children}</AutoTranslate>
    </>
  );
}
