import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientProviders } from "@/components/ClientProviders";
import { getSiteUrl } from "@/lib/siteUrl";
import { MODULE_NODES } from "@/data/pitchFacts";
import "./globals.css";
import { DevHubGuestIdentity } from "@/components/DevHubGuestIdentity";

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
      {/* Личность посетителя DevHub ставится ГЛОБАЛЬНО, а не в макете
          модуля. Замер 29.08.2026: /studio, /acquire и /compare зовут API
          модуля из браузера, а подмена запросов жила только под /devhub —
          значит заголовок гостя оттуда не уходил, и человек видел тариф и
          расход общей «анонимной» личности вместо своих. На странице,
          которая продаёт Studio Pro, это худшее место для такой ошибки.

          Ставить глобально безопасно: подмена проверяет адрес и трогает
          только запросы к /api/devhub/, остальные проходят нетронутыми. */}
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

          `data-lang-src="cookie"` ставится, чтобы второй скрипт (в конце
          тела, определяет язык по содержимому) не перебил ВЫБОР человека
          своей догадкой. Выбор всегда старше догадки.
        */}
        <script dangerouslySetInnerHTML={{ __html: "try{var c=document.cookie.split('; ');for(var i=0;i<c.length;i++){var p=c[i].split('=');if(p[0]==='aevion_lang_v1'){var l=decodeURIComponent(p[1]||'');if(l==='ru'||l==='kk'||l==='en'){document.documentElement.lang=l;document.documentElement.setAttribute('data-lang-src','cookie');}break;}}}catch(e){}" }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <ClientProviders>
          <DevHubGuestIdentity />
          {children}
        </ClientProviders>
        {/*
          Если языка выбора нет, объявляем язык ПО СОДЕРЖИМОМУ страницы.

          Замер 23.08.2026 на проде, запрос с Accept-Language ru:

            /cyberchess   кириллицы 246, латиницы в тексте 20
            /go           кириллицы 1318, латиницы 56

          То есть две страницы, на которые ведут все ссылки к запуску 30.08,
          отдаются по-русски под `lang="en"`. Chrome в таком случае предлагает —
          а при включённой настройке молча делает — машинный перевод НАШЕЙ
          страницы, и первое, что видит пришедший из соцсети человек, это наш
          текст, пропущенный через переводчик.

          🔴 ДВЕ ПОЧИНКИ 27.08.2026 — первая версия этого скрипта НЕ РАБОТАЛА
          на проде ни на одной странице. Замер по выкаченному HTML:

            страница      видимый текст        document.body.textContent
            /cyberchess   кир 16   лат 2       кир 235   лат 9507
            /go           кир 1157 лат 44      кир 2365  лат 14083

          1. `textContent` тела включает текст ВНУТРИ <script>, а Next.js
             кладёт туда свой payload — тысячи латинских знаков. Порог не
             проходил никогда. Теперь считается только то, что видит человек:
             обход текстовых узлов мимо script/style/noscript/template.
          2. У страниц, которые рисуются на клиенте, в момент разбора тела
             текста почти нет (16 знаков при пороге 40). Поэтому решение
             перепроверяется на DOMContentLoaded и на load — до этих событий
             браузер решения о переводе не принимает.

          Мой тест не поймал ни того, ни другого: он клал чистый текст прямо в
          `document.body.textContent`, то есть проверял форму входа, которой в
          жизни не бывает. Теперь в тесте настоящая разметка со <script>.

          Почему по содержимому, а не по `navigator.language`. Язык страницы —
          свойство СТРАНИЦЫ, а не посетителя: у нас есть и английские страницы
          (/pitch, /investor). Объявить их русскими из-за настроек браузера
          значило бы соврать в другую сторону.

          Почему не в корневом макете значением `lang`. `cookies()` там
          переводит ВЕСЬ сайт на динамическую отрисовку; цена несоразмерна.

          Порог намеренно НЕ «кириллицы больше»: у русской страницы в тексте
          всегда есть латиница — названия модулей, AEVION, CyberChess. Выбор
          языка человеком стоит ВЫШЕ: скрипт выше ставит `data-lang-src`, и
          этот тогда молчит.
        */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var d=document.documentElement;function seen(){var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),s='',n,t;while((n=w.nextNode())){t=n.parentNode&&n.parentNode.nodeName;if(t==='SCRIPT'||t==='STYLE'||t==='NOSCRIPT'||t==='TEMPLATE')continue;s+=n.nodeValue;if(s.length>20000)break;}return s;}function decide(){if(d.getAttribute('data-lang-src'))return true;if(location.pathname==='/en'||location.pathname.indexOf('/en/')===0){d.setAttribute('data-lang-src','path');return true;}var t=seen(),c=0,l=0,i,k;for(i=0;i<t.length;i++){k=t.charCodeAt(i);if((k>=1040&&k<=1103)||k===1025||k===1105)c++;else if((k>=65&&k<=90)||(k>=97&&k<=122))l++;}if(c>l*0.5&&c>40){d.lang='ru';d.setAttribute('data-lang-src','content');return true;}return false;}if(decide())return;document.addEventListener('DOMContentLoaded',decide);window.addEventListener('load',decide);}catch(e){}})()" }} />
      </body>
    </html>
  );
}
