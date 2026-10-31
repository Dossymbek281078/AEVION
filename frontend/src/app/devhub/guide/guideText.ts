// Тексты и метаданные /devhub/guide — страница для разработчиков из поиска («AI app builder»).
// Всё сказанное сверено с кодом: devhub/page.tsx (поле «опиши», режимы «страница» / «приложение с базой
// и входом», СТЕКИ_БЕЗ_ПУБЛИКАЦИИ, даннымНуженСервер), devhub/[id]/page.tsx (вкладки, правка кликами,
// откат правки ИИ, ZIP, выкладка на Cloudflare Pages), devhub/examples.ts (живая витрина), бэк
// routes/devhub.ts (TIER_LIMITS.free: generate 30, deploy 10, image 10, video 3, music 5; registered ×3).
// Число минут не обещаем — не замерено: в замерах окон срок до живого адреса расходился (о нём честно сказано в тексте).
// kk — ЧЕРНОВИК, нужен носитель.
import type { Metadata } from "next";

export type GuideLang = "en" | "ru" | "kk";

const SITE = "https://aevion.app";
export const GUIDE_PATH = "/devhub/guide";
export const GUIDE_CANONICAL = SITE + GUIDE_PATH;
export const GUIDE_CHANNEL = "seo-devhub";
export const GUIDE_STUDIO_HREF = `/devhub?c=${GUIDE_CHANNEL}`;
export const GUIDE_PRICING_HREF = `/pricing?c=${GUIDE_CHANNEL}`;

/** Язык страницы из языка посетителя: остальные языки платформы читают английский. */
export function guideLang(lang: string | null | undefined): GuideLang {
  return lang === "ru" || lang === "kk" ? lang : "en";
}

/** Один адрес на все языки (язык выбирает serverLang); hreflang различаются параметром ?lang=. */
export const GUIDE_LANGUAGES: Record<string, string> = {
  en: `${GUIDE_CANONICAL}?lang=en`,
  ru: `${GUIDE_CANONICAL}?lang=ru`,
  kk: `${GUIDE_CANONICAL}?lang=kk`,
  "x-default": GUIDE_CANONICAL,
};

/** Живые примеры витрины DevHub (devhub/examples.ts); проверено curl 31.10.2026: все три — 200. Страницы по-русски: собраны из русской фразы. */
export const GUIDE_EXAMPLES = [
  { url: "https://aevion-project-7760cf.pages.dev" },
  { url: "https://aevion-example-avtomoyka-tarify-1762a7.pages.dev" },
  { url: "https://aevion-project-b85b54.pages.dev" },
] as const;

export type GuideText = {
  title: string;
  description: string;
  locale: string;
  h1: string;
  lead: string;
  stepsH: string;
  steps: { h: string; p: string }[];
  limitsH: string;
  limits: string[];
  examplesH: string;
  examplesLead: string;
  examples: { t: string; p: string }[];
  faqH: string;
  faq: { q: string; a: string }[];
  ctaH: string;
  ctaMain: string;
  ctaSecond: string;
  ctaNote: string;
};

export const GUIDE: Record<GuideLang, GuideText> = {
  en: {
    title: "AI app builder: describe an app, get a live address in a few minutes | AEVION DevHub",
    description:
      "How DevHub works: describe an app in one phrase, get code and a live preview, edit by chat or by clicking, publish to a public address. Real examples, free monthly norm and honest limits.",
    locale: "en_US",
    h1: "AI app builder: from one phrase to a live address in a few minutes",
    lead: "A short guide for developers: what you do in the DevHub studio, what you get at each step, what is free, and what the studio does not do.",
    stepsH: "The path, step by step",
    steps: [
      { h: "Describe what you need", p: "Open the studio and write one phrase in the box. Choose \"One page\" (data stays in the browser) or \"App with a database and sign-in\". The first project builds without sign-up." },
      { h: "AI writes the project and shows a preview", p: "AI creates the project, writes the code and shows a live preview. The files are listed next to it, so you can read the code." },
      { h: "Refine it", p: "Ask for changes in the chat and undo the last AI edit in one click. On a static project you can click an element in the preview and edit its text, color and size in place. Images and sound can be added from the Media tab." },
      { h: "Publish", p: "One click publishes a Static or React SPA project to Cloudflare Pages with a public *.pages.dev address. A deploy is marked live only after the backend has opened the page and got a 2xx." },
      { h: "Keep or take the code", p: "Download the whole project as a ZIP archive, or upload a ZIP to continue. Projects made without signing in live in this browser; sign in to keep them." },
    ],
    limitsH: "Honest limits",
    limits: [
      "We do not promise a number of minutes. In our own test runs the time from phrase to live address ranged from under a minute to more than two, and one run in six gave no address within two minutes.",
      "Publishing works for Static and React SPA projects. Next.js, Express and Python projects give you code only for now, with no live address.",
      "If your idea needs accounts, a database or payments, the first version is a browser version: data is kept in the browser, and the server side is added later in the project chat.",
      "The free norm is monthly and small (see the FAQ). Free sites carry an AEVION badge and the number of publishes per month is limited.",
    ],
    examplesH: "Three real examples",
    examplesLead: "These pages were built in DevHub from one phrase each. They are live; the sites themselves are in Russian because the original phrases were written in Russian (shown here in translation). Generation works in any language.",
    examples: [
      { t: "Coffee shop landing page", p: "Phrase: \"a coffee shop landing page with a menu, opening hours and a map\"" },
      { t: "Car wash: plans and booking", p: "Phrase: \"a car wash landing page: three plans with prices and what each includes, opening hours, address and phone, and a booking button\"" },
      { t: "Concert poster page", p: "Phrase: \"a concert poster page with the program and a directions map\"" },
    ],
    faqH: "Questions and answers",
    faq: [
      { q: "What is DevHub?", a: "An AI studio inside AEVION: you describe an app in a phrase, AI creates the project and code, shows a live preview, and you can edit and publish it from the same place." },
      { q: "Do I need to sign up to try it?", a: "No. The first project builds without sign-up. Without signing in, the project is tied to your browser: if you clear its storage you lose sight of it. Sign in to keep your projects." },
      { q: "How long does it take?", a: "A few minutes is typical, but we do not promise a number: the time varied in our test runs. A page is usually faster than an app with a database." },
      { q: "Is it free? What does it cost?", a: "There is a free monthly norm: for a visitor without sign-in it is 30 code generations, 10 publishes, 10 images, 5 music tracks and 3 videos; with sign-in the norm is three times larger. Unlimited publishes and no badge come with the AEVION Planet plan. Current prices and plans are on the pricing page." },
      { q: "Where does my app get published?", a: "On Cloudflare Pages at a public *.pages.dev address, for Static and React SPA projects. Free sites carry an \"AEVION\" badge." },
      { q: "Can it build a backend, a database or payments?", a: "In \"App with a database and sign-in\" mode the app gets its own database and user sign-in, and it takes longer to build. Next.js, Express and Python projects are code only for now, with no publishing to a live address." },
      { q: "Can I take my code with me?", a: "Yes: the whole project downloads as one ZIP archive, and a ZIP can be uploaded back." },
    ],
    ctaH: "Try it on your own idea",
    ctaMain: "Open the DevHub studio",
    ctaSecond: "See plans and the free norm",
    ctaNote: "The first button opens the studio with the phrase box. The second opens the pricing page.",
  },
  ru: {
    title: "AI-конструктор приложений: опишите идею и получите живой адрес за несколько минут | AEVION DevHub",
    description:
      "Как работает DevHub: опишите приложение одной фразой, получите код и живое превью, правьте чатом или кликами, публикуйте на публичный адрес. Живые примеры, бесплатная норма и честные пределы.",
    locale: "ru_RU",
    h1: "AI-конструктор приложений: от одной фразы до живого адреса за несколько минут",
    lead: "Короткий разбор для разработчиков: что вы делаете в студии DevHub, что получаете на каждом шаге, что бесплатно и чего студия не делает.",
    stepsH: "Путь по шагам",
    steps: [
      { h: "Опишите, что нужно", p: "Откройте студию и напишите одну фразу в поле. Выберите «Одна страница» (данные хранятся в браузере) или «Приложение с базой и входом». Первый проект собирается без регистрации." },
      { h: "ИИ пишет проект и показывает превью", p: "ИИ создаёт проект, пишет код и показывает живое превью. Рядом — список файлов, код можно прочитать." },
      { h: "Доработайте", p: "Просите правки в чате, последнюю правку ИИ откатывайте в один клик. В статическом проекте можно щёлкнуть элемент в превью и править его текст, цвет и размер на месте. Картинки и звук добавляются на вкладке «Медиа»." },
      { h: "Опубликуйте", p: "Один клик выкладывает проект Static или React SPA на Cloudflare Pages с публичным адресом *.pages.dev. Выкладка считается живой, только когда сервер сам открыл страницу и получил ответ 2xx." },
      { h: "Сохраните или заберите код", p: "Весь проект скачивается одним ZIP-архивом, а ZIP можно загрузить обратно. Проекты, созданные без входа, живут в этом браузере; чтобы не потерять их, войдите." },
    ],
    limitsH: "Честные пределы",
    limits: [
      "Число минут не обещаем. В наших замерах время от фразы до живого адреса расходилось от меньше минуты до больше двух, а один прогон из шести адреса за две минуты не дал.",
      "Публикация работает для проектов Static и React SPA. Проекты Next.js, Express и Python пока дают только код, без живого адреса.",
      "Если идее нужны аккаунты, база или оплата, первая версия — браузерная: данные хранятся в браузере, серверную часть добавляют позже в чате проекта.",
      "Бесплатная норма месячная и небольшая (см. вопросы ниже). На бесплатных сайтах стоит значок AEVION, число публикаций в месяц ограничено.",
    ],
    examplesH: "Три живых примера",
    examplesLead: "Эти страницы собраны в DevHub, каждая из одной фразы. Они работают сейчас. Сами страницы — по-русски: исходные фразы были русскими. Генерация идёт на любом языке.",
    examples: [
      { t: "Лендинг кофейни", p: "Фраза: «лендинг кофейни с меню, часами работы и картой проезда»" },
      { t: "Автомойка: тарифы и запись", p: "Фраза: «лендинг автомойки: три тарифа с ценами в тенге и списком работ, часы работы, адрес и телефон, кнопка „записаться“»" },
      { t: "Афиша концерта", p: "Фраза: «афиша концерта с программой и картой проезда»" },
    ],
    faqH: "Вопросы и ответы",
    faq: [
      { q: "Что такое DevHub?", a: "ИИ-студия внутри AEVION: вы описываете приложение фразой, ИИ создаёт проект и код, показывает живое превью, а править и публиковать можно там же." },
      { q: "Нужна ли регистрация, чтобы попробовать?", a: "Нет. Первый проект собирается без регистрации. Без входа проект привязан к вашему браузеру: очистите его хранилище — и потеряете проект из виду. Чтобы сохранить проекты, войдите." },
      { q: "Сколько это занимает?", a: "Обычно несколько минут, но число мы не обещаем: в замерах срок расходился. Страница обычно собирается быстрее, чем приложение с базой." },
      { q: "Это бесплатно? Сколько стоит?", a: "Есть бесплатная месячная норма: для посетителя без входа это 30 генераций кода, 10 публикаций, 10 картинок, 5 музыкальных треков и 3 видео; со входом норма втрое больше. Публикации без ограничений и сайт без значка входят в план «AEVION Планета». Актуальные цены и планы — на странице цен." },
      { q: "Где публикуется приложение?", a: "На Cloudflare Pages по публичному адресу *.pages.dev, для проектов Static и React SPA. На бесплатных сайтах стоит значок «AEVION»." },
      { q: "Может ли студия собрать бэкенд, базу или оплату?", a: "В режиме «Приложение с базой и входом» у приложения появляются своя база и вход пользователей, а собирается оно дольше. Проекты Next.js, Express и Python пока только код, без публикации на живой адрес." },
      { q: "Можно ли забрать свой код?", a: "Да: весь проект скачивается одним ZIP-архивом, а ZIP можно загрузить обратно." },
    ],
    ctaH: "Попробуйте на своей идее",
    ctaMain: "Открыть студию DevHub",
    ctaSecond: "Планы и бесплатная норма",
    ctaNote: "Первая кнопка открывает студию с полем для фразы, вторая — страницу цен.",
  },
  kk: {
    title: "ЖИ қолданба конструкторы: идеяны сипаттап, бірнеше минутта тірі мекенжай алыңыз | AEVION DevHub",
    description:
      "DevHub қалай жұмыс істейді: қолданбаны бір сөйлеммен сипаттаңыз, код пен тірі алдын ала көріністі алыңыз, чатпен немесе басумен өңдеңіз, жалпыға ортақ мекенжайға жариялаңыз. Нақты мысалдар, тегін норма және ашық шектеулер.",
    locale: "kk_KZ",
    h1: "ЖИ қолданба конструкторы: бір сөйлемнен тірі мекенжайға дейін бірнеше минутта",
    lead: "Әзірлеушілерге арналған қысқа шолу: DevHub студиясында не істейсіз, әр қадамда не аласыз, нелері тегін және студия нені істемейді.",
    stepsH: "Қадамдар бойынша жол",
    steps: [
      { h: "Не қажет екенін сипаттаңыз", p: "Студияны ашып, өріске бір сөйлем жазыңыз. «Бір бет» (деректер браузерде сақталады) немесе «Дерекқоры мен кіруі бар қолданба» режимін таңдаңыз. Алғашқы жоба тіркелусіз жиналады." },
      { h: "ЖИ жобаны жазып, алдын ала көріністі көрсетеді", p: "ЖИ жобаны жасайды, кодты жазады және тірі көріністі көрсетеді. Жанында файлдар тізімі тұр, кодты оқуға болады." },
      { h: "Жетілдіріңіз", p: "Өзгерістерді чатта сұраңыз, ЖИ-дің соңғы өзгерісін бір басумен қайтарыңыз. Статикалық жобада көріністегі элементті басып, мәтінін, түсін және өлшемін сол жерде өңдеуге болады. Суреттер мен дыбыс «Медиа» қойындысынан қосылады." },
      { h: "Жариялаңыз", p: "Бір басу Static немесе React SPA жобасын Cloudflare Pages-ке жалпыға ортақ *.pages.dev мекенжайымен жариялайды. Жариялау тек сервер бетті өзі ашып, 2xx жауап алғанда ғана тірі болып саналады." },
      { h: "Кодты сақтаңыз немесе алыңыз", p: "Бүкіл жоба бір ZIP мұрағатымен жүктеледі, ал ZIP-ті кері жүктеуге болады. Кірместен жасалған жобалар осы браузерде тұрады; жоғалтпау үшін кіріңіз." },
    ],
    limitsH: "Ашық шектеулер",
    limits: [
      "Минут санын уәде етпейміз. Біздің өлшеулерімізде сөйлемнен тірі мекенжайға дейінгі уақыт бір минуттан аз мөлшерден екі минуттан асатын мөлшерге дейін өзгерді, алты іске қосудың біреуі екі минутта мекенжай бермеді.",
      "Жариялау Static және React SPA жобаларына жұмыс істейді. Next.js, Express және Python жобалары әзірге тек код береді, тірі мекенжайсыз.",
      "Идеяға тіркелгілер, дерекқор немесе төлем керек болса, алғашқы нұсқа браузерлік болады: деректер браузерде сақталады, сервер бөлігі кейін жоба чатында қосылады.",
      "Тегін норма айлық және шағын (төмендегі сұрақтарды қараңыз). Тегін сайттарда AEVION белгісі тұрады, айына жариялау саны шектелген.",
    ],
    examplesH: "Үш нақты мысал",
    examplesLead: "Бұл беттер DevHub-та жиналған, әрқайсысы бір сөйлемнен. Олар қазір жұмыс істейді; сайттардың өзі орысша, өйткені бастапқы сөйлемдер орысша жазылған (мұнда аудармасы берілген). Генерация кез келген тілде жұмыс істейді.",
    examples: [
      { t: "Кофехана лендингі", p: "Сөйлем: «мәзірі, жұмыс уақыты және картасы бар кофехана лендингі»" },
      { t: "Автожуу: тарифтер және жазылу", p: "Сөйлем: «бағасы мен жұмыс тізімі бар үш тариф, жұмыс уақыты, мекенжайы мен телефоны, жазылу түймесі бар автожуу лендингі»" },
      { t: "Концерт афишасы", p: "Сөйлем: «бағдарламасы мен жол картасы бар концерт афишасы»" },
    ],
    faqH: "Сұрақтар мен жауаптар",
    faq: [
      { q: "DevHub дегеніміз не?", a: "AEVION ішіндегі ЖИ студиясы: қолданбаны бір сөйлеммен сипаттайсыз, ЖИ жоба мен кодты жасап, тірі көріністі көрсетеді, ал өңдеу мен жариялауды сол жерде жасауға болады." },
      { q: "Байқап көру үшін тіркелу керек пе?", a: "Жоқ. Алғашқы жоба тіркелусіз жиналады. Кірместен жоба браузеріңізге байланған: оның сақтауын тазаласаңыз, жобаны жоғалтасыз. Жобаларды сақтау үшін кіріңіз." },
      { q: "Бұл қанша уақыт алады?", a: "Әдетте бірнеше минут, бірақ санды уәде етпейміз: өлшеулерде уақыт әртүрлі болды. Бет әдетте дерекқорлы қолданбадан жылдам жиналады." },
      { q: "Тегін бе? Қанша тұрады?", a: "Тегін айлық норма бар: кірмеген келушіге ол 30 код генерациясы, 10 жариялау, 10 сурет, 5 музыка трегі және 3 бейне; кірген кезде норма үш есе көп. Шектеусіз жариялау және белгісіз сайт «AEVION Планета» жоспарына кіреді. Қазіргі бағалар мен жоспарлар баға бетінде." },
      { q: "Қолданба қайда жарияланады?", a: "Cloudflare Pages-те жалпыға ортақ *.pages.dev мекенжайында, Static және React SPA жобалары үшін. Тегін сайттарда «AEVION» белгісі тұрады." },
      { q: "Студия бэкенд, дерекқор немесе төлем жинай ала ма?", a: "«Дерекқоры мен кіруі бар қолданба» режимінде қолданбаға өз дерекқоры мен пайдаланушылардың кіруі қосылады, бірақ ол ұзағырақ жиналады. Next.js, Express және Python жобалары әзірге тек код, тірі мекенжайға жариялаусыз." },
      { q: "Кодымды өзіммен алып кете аламын ба?", a: "Иә: бүкіл жоба бір ZIP мұрағатымен жүктеледі, ал ZIP-ті кері жүктеуге болады." },
    ],
    ctaH: "Өз идеяңызбен байқап көріңіз",
    ctaMain: "DevHub студиясын ашу",
    ctaSecond: "Жоспарлар және тегін норма",
    ctaNote: "Бірінші батырма сөйлем өрісі бар студияны ашады, екіншісі баға бетін ашады.",
  },
};

export function guideMetadata(lang: GuideLang): Metadata {
  const t = GUIDE[lang];
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: { canonical: GUIDE_LANGUAGES[lang], languages: GUIDE_LANGUAGES },
    openGraph: { title: t.title, description: t.description, url: GUIDE_LANGUAGES[lang], type: "article", locale: t.locale, siteName: "AEVION" },
    twitter: { card: "summary", title: t.title, description: t.description },
  };
}

/** JSON-LD FAQPage на языке страницы. */
export function guideFaqJsonLd(lang: GuideLang) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang,
    mainEntity: GUIDE[lang].faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
