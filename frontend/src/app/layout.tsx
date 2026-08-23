import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientProviders } from "@/components/ClientProviders";
import { getSiteUrl } from "@/lib/siteUrl";
import { MODULE_NODES } from "@/data/pitchFacts";
import "./globals.css";

const SITE = getSiteUrl();

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0f172a" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "AEVION — Trust infrastructure for digital assets & IP",
    template: "%s · AEVION",
  },
  description:
    `Global platform for IP registration (QRight), cryptographic signatures (QSign), authorship & prior-art bureau, compliance certification (Planet), awards, digital banking and more. ${MODULE_NODES} product nodes on interactive Globus map.`,
  openGraph: {
    title: "AEVION — Trust infrastructure & Globus",
    description:
      "Registry, signatures, bureau, compliance and product map. Live product environment.",
    type: "website",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION — Trust OS",
    description: `Registry · signatures · bureau · compliance · bank · awards · ${MODULE_NODES} nodes.`,
  },
  verification: {
    google: "IVmBbcLIbs_TR7SC3TrPQkFiQOhf1wVbzSB9Q5d9_d0",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AEVION",
  url: SITE,
  logo: `${SITE}/icon.png`,
  description:
    "Trust infrastructure for digital assets and intellectual property. IP registry (QRight), cryptographic signatures (QSign), authorship & prior-art bureau, compliance certification (Planet), awards, digital banking.",
  sameAs: [`${SITE}/pitch`],
  contactPoint: [
    { "@type": "ContactPoint", contactType: "investor relations", email: "yahiin1978@gmail.com", areaServed: "Worldwide" },
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AEVION",
  url: SITE,
  inLanguage: ["en", "ru", "kk"],
  publisher: { "@type": "Organization", name: "AEVION" },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE}/help?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        {/*
          Язык объявляется ДО отрисовки, из куки выбора языка.

          Зачем. В корневом макете стоит lang="en", и для холодной отрисовки
          это ВЕРНО: сервер отдаёт английский текст. Но страницы, которые
          рисуются через getServerT (например /awards), отдают русский —
          и объявление расходится с содержимым. Замер 21.08.2026 при
          Accept-Language ru: на /awards 1284 знака кириллицы под lang="en".

          Последствие не косметическое: браузер видит несоответствие и
          предлагает (а при включённой настройке — молча делает) машинный
          перевод НАШЕЙ страницы. Проверено на себе: Chrome показал
          «Наборы средств разработки программного обеспечения» там, где
          в исходнике стоит «SDK». Экранные читалки произносят русский
          текст по английским правилам.

          Почему не читать куку в самом макете. cookies() в корневом
          макете переводит ВЕСЬ сайт на динамическую отрисовку и отключает
          статику на всех страницах — цена несоразмерна поводу.

          Провайдер языка тоже ставит lang, но ПОСЛЕ гидрации; браузер к
          тому моменту уже принял решение о переводе. Этот скрипт
          выполняется раньше и стоит меньше килобайта.
        */}
        <script dangerouslySetInnerHTML={{ __html: "try{var c=document.cookie.split('; ');for(var i=0;i<c.length;i++){var p=c[i].split('=');if(p[0]==='aevion_lang_v1'){var l=decodeURIComponent(p[1]||'');if(l==='ru'||l==='kk'||l==='en'){document.documentElement.lang=l;}break;}}}catch(e){}" }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
