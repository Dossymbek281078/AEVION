// Тексты и метаданные /bureau/guide — страница для патентных бюро и поверенных из поиска.
// Всё сказанное сверено с кодом: qright/page.tsx (хеш файла в браузере, подпись Ed25519,
// поле «Бюро / организация»), verify/[id] (строка «Запись сделана через … · проверка AEVION»),
// verifyI18n.ts («1–6 часов» до блока Bitcoin), pipeline.ts (в хеш входят title, description,
// kind, country, city). Число минут не обещаем — оно не замерено.
// kk — ЧЕРНОВИК, нужен носитель.
import type { Metadata } from "next";

export type GuideLang = "en" | "ru" | "kk";

const SITE = "https://aevion.app";
export const GUIDE_PATH = "/bureau/guide";
export const GUIDE_CANONICAL = SITE + GUIDE_PATH;
export const GUIDE_CHANNEL = "seo-bureau";
export const GUIDE_CONTACT_HREF = `/pricing/contact?topic=bureau&app=ip_bureau&c=${GUIDE_CHANNEL}`;
export const GUIDE_QRIGHT_HREF = `/qright?c=${GUIDE_CHANNEL}`;

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

/** Живые публичные записи прода (проверено curl 31.10.2026: все три — 200). */
export const GUIDE_EXAMPLES = [
  { id: "cert-c6b05b8930357a03" },
  { id: "cert-9913a1d205a1bf95" },
  { id: "cert-9c0df215c5d330e7" },
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
  examples: string[];
  faqH: string;
  faq: { q: string; a: string }[];
  ctaH: string;
  ctaMain: string;
  ctaSecond: string;
  ctaNote: string;
};

export const GUIDE: Record<GuideLang, GuideText> = {
  en: {
    title: "How a patent bureau records an author and a date with a public check link | AEVION",
    description:
      "Steps for patent bureaus and attorneys: hash the file in the browser, sign it, get a Bitcoin timestamp via OpenTimestamps and a public /verify link that shows your bureau. Honest limits included.",
    locale: "en_US",
    h1: "How a bureau records the author and the date in a few minutes",
    lead: "A short guide for patent bureaus and patent attorneys: what happens when you record a work in AEVION, what the client gets, and what this does not replace.",
    stepsH: "The path, step by step",
    steps: [
      {
        h: "Sign in with your work email",
        p: "Create an account or sign in with the bureau's work email. Records made under the same email appear in your dashboard.",
      },
      {
        h: "Open QRight and add the file",
        p: "On the QRight page enter a neutral title and description, choose the kind, and drop the file. Its SHA-256 fingerprint is computed in your browser: the file itself is not uploaded, only the hash is sent. In the extra fields, put your bureau name in “Bureau / organisation”.",
      },
      {
        h: "The record is signed",
        p: "Where the browser supports Ed25519, it signs the record with a key held only in that browser; AEVION adds its own HMAC-SHA256 signature on the server.",
      },
      {
        h: "The time stamp goes into a Bitcoin block",
        p: "The hash is sent to the OpenTimestamps calendars right away. Confirmation by a Bitcoin block usually takes a few hours (the verification page says 1–6 hours). Until then the record shows “pending confirmation”.",
      },
      {
        h: "A public link to check the record",
        p: "Every record gets a public page /verify/<id> that anyone can open without signing in. If you filled in the bureau name, a line under the verdict reads “Record made via <your bureau> · verification by AEVION”. The bureau name is shown there but is not part of the signature.",
      },
    ],
    limitsH: "Honest limits",
    limits: [
      "This is not a registration at a patent office and does not replace one. It records that this exact content existed at the time of the stamp.",
      "It does not certify the author's identity: the name is what was typed in. Identity checks and the notary option are still in demo mode.",
      "The title and description of a record are public and are part of the signed hash (together with the kind, country and city). Write them neutrally and keep the substance of the invention out of them.",
    ],
    examplesH: "Three live records",
    examplesLead: "Public demonstration records created by AEVION (not clients' works). Open one to see the verdict, the signature checks and the Bitcoin status.",
    examples: ["Bureau brand demo: a sample record for partners", "Demo record: proof of a work's creation date", "Author co-signature demo: a sample record for partners"],
    faqH: "Questions and answers",
    faq: [
      { q: "Does this replace registration at a patent office?", a: "No. It is a dated, signed record of content with a public check link. Filing with the patent office is a separate legal step." },
      { q: "Is my client's file uploaded to AEVION?", a: "No. The SHA-256 fingerprint is computed in the browser and only the hash is sent. The title and description you type are stored and public." },
      { q: "What may I write in the title and description?", a: "Something neutral, such as “Draft specification, version 3”. Both fields are public and enter the signed hash, so do not describe the invention itself." },
      { q: "How long until the Bitcoin confirmation?", a: "Usually a few hours; the verification page gives 1–6 hours. Until the block arrives the record is marked “pending confirmation”." },
      { q: "Who can check a record?", a: "Anyone who has the /verify/<id> link, without an account. The page shows the integrity checks and the Bitcoin anchor status." },
      { q: "Will the client see our bureau on the check page?", a: "Yes, if you fill in the “Bureau / organisation” field: the line “Record made via <bureau> · verification by AEVION” appears under the verdict. It is not part of the signature." },
      { q: "Does the record prove who the author is?", a: "No. It shows that the content existed at that time under that hash. Identity verification is not offered yet." },
    ],
    ctaH: "Try it on your bureau's work",
    ctaMain: "Tell us about your bureau",
    ctaSecond: "Record a work now",
    ctaNote: "The first button opens a short request for a bureau set-up; the second goes straight to QRight.",
  },
  ru: {
    title: "Как бюро фиксирует автора и дату с публичной ссылкой проверки | AEVION",
    description:
      "Шаги для патентных бюро и поверенных: отпечаток файла в браузере, подпись, метка времени в блоке Bitcoin (OpenTimestamps) и публичная ссылка /verify с названием вашего бюро. Честные пределы — в тексте.",
    locale: "ru_RU",
    h1: "Как бюро фиксирует автора и дату за несколько минут",
    lead: "Короткая инструкция для патентных бюро и патентных поверенных: что происходит, когда вы записываете работу в AEVION, что получает клиент и чего это не заменяет.",
    stepsH: "Путь по шагам",
    steps: [
      {
        h: "Войдите рабочей почтой",
        p: "Создайте аккаунт или войдите по рабочей почте бюро. Записи, сделанные на эту почту, видны в вашем кабинете.",
      },
      {
        h: "Откройте QRight и добавьте файл",
        p: "На странице QRight укажите нейтральное название и описание, выберите вид работы и перетащите файл. Отпечаток SHA-256 считается в вашем браузере: сам файл не загружается, уходит только хеш. В дополнительных полях впишите название бюро в «Бюро или организация».",
      },
      {
        h: "Запись подписывается",
        p: "Если браузер поддерживает Ed25519, он подписывает запись ключом, который хранится только в этом браузере; AEVION добавляет свою подпись HMAC-SHA256 на сервере.",
      },
      {
        h: "Метка времени попадает в блок Bitcoin",
        p: "Хеш сразу уходит в календари OpenTimestamps. Подтверждение блоком Bitcoin обычно приходит через несколько часов (на странице проверки указано 1–6 часов). До этого у записи статус «ждёт подтверждения».",
      },
      {
        h: "Публичная ссылка для проверки",
        p: "У каждой записи есть публичная страница /verify/<id>, её открывает любой человек без входа. Если вы заполнили название бюро, под вердиктом стоит строка «Запись сделана через <ваше бюро> · проверку обеспечивает AEVION». Название бюро там показано, но в подпись не входит.",
      },
    ],
    limitsH: "Честные пределы",
    limits: [
      "Это не регистрация в патентном ведомстве и не замена ей. Запись фиксирует, что именно этот материал существовал на момент метки времени.",
      "Это не удостоверение личности автора: имя таково, каким его ввели. Проверка личности и нотариус пока работают в демо-режиме.",
      "Название и описание записи публичны и входят в подписанный хеш (вместе с видом работы, страной и городом). Пишите нейтрально, без сути изобретения.",
    ],
    examplesH: "Три живые записи",
    examplesLead: "Публичные демонстрационные записи, созданные AEVION (это не работы клиентов). Откройте любую: там видны вердикт, проверки подписи и статус Bitcoin.",
    examples: ["Демонстрация бренда бюро: пример записи для партнёров", "Демонстрационная запись: подтверждение даты создания работы", "Демонстрация со-подписи автора: пример записи для партнёров"],
    faqH: "Вопросы и ответы",
    faq: [
      { q: "Это заменяет регистрацию в патентном ведомстве?", a: "Нет. Это датированная подписанная запись материала с публичной ссылкой проверки. Подача заявки в ведомство — отдельный юридический шаг." },
      { q: "Файл клиента загружается в AEVION?", a: "Нет. Отпечаток SHA-256 считается в браузере, отправляется только хеш. Название и описание, которые вы вводите, сохраняются и публичны." },
      { q: "Что писать в названии и описании?", a: "Что-то нейтральное, например «Черновик описания, версия 3». Оба поля публичны и входят в подписанный хеш, поэтому суть изобретения в них не описывайте." },
      { q: "Сколько ждать подтверждения Bitcoin?", a: "Обычно несколько часов; на странице проверки указано 1–6 часов. Пока блока нет, у записи статус «ждёт подтверждения»." },
      { q: "Кто может проверить запись?", a: "Любой, у кого есть ссылка /verify/<id>, без аккаунта. Страница показывает проверки целостности и статус якоря в Bitcoin." },
      { q: "Увидит ли клиент наше бюро на странице проверки?", a: "Да, если заполнить поле «Бюро или организация»: под вердиктом появится строка «Запись сделана через <бюро> · проверку обеспечивает AEVION». В подпись она не входит." },
      { q: "Доказывает ли запись, кто автор?", a: "Нет. Она показывает, что материал с таким хешем существовал в это время. Проверки личности пока нет." },
    ],
    ctaH: "Попробуйте на работе вашего бюро",
    ctaMain: "Рассказать о нашем бюро",
    ctaSecond: "Записать работу сейчас",
    ctaNote: "Первая кнопка открывает короткую заявку на подключение бюро, вторая ведёт сразу в QRight.",
  },
  kk: {
    title: "Бюро авторды мен күнді жария тексеру сілтемесімен қалай тіркейді | AEVION",
    description:
      "Патенттік бюро мен сенім білдірілген өкілдерге арналған қадамдар: файл ізі браузерде есептеледі, қол қойылады, Bitcoin блогындағы уақыт белгісі (OpenTimestamps) және бюроңыздың атауы бар жария /verify сілтемесі.",
    locale: "kk_KZ",
    h1: "Бюро авторды мен күнді бірнеше минутта қалай тіркейді",
    lead: "Патенттік бюро мен патенттік өкілдерге арналған қысқа нұсқаулық: жұмысты AEVION-да тіркегенде не болады, клиент не алады және бұл нені алмастырмайды.",
    stepsH: "Жол қадам-қадаммен",
    steps: [
      {
        h: "Жұмыс поштасымен кіріңіз",
        p: "Бюроның жұмыс поштасымен аккаунт ашыңыз немесе кіріңіз. Осы поштаға жасалған жазбалар кабинетіңізде көрінеді.",
      },
      {
        h: "QRight-ты ашып, файлды қосыңыз",
        p: "QRight бетінде бейтарап атау мен сипаттама жазып, жұмыс түрін таңдаңыз да, файлды сүйреп апарыңыз. SHA-256 ізі браузеріңізде есептеледі: файлдың өзі жүктелмейді, тек хеш жіберіледі. Қосымша өрістерде «Бюро немесе ұйым» жолына бюроңыздың атауын жазыңыз.",
      },
      {
        h: "Жазбаға қол қойылады",
        p: "Браузер Ed25519-ты қолдаса, ол жазбаға тек сол браузерде сақталатын кілтпен қол қояды; AEVION серверде өзінің HMAC-SHA256 қолтаңбасын қосады.",
      },
      {
        h: "Уақыт белгісі Bitcoin блогына түседі",
        p: "Хеш бірден OpenTimestamps күнтізбелеріне жіберіледі. Bitcoin блогымен растау әдетте бірнеше сағаттан кейін келеді (тексеру бетінде 1–6 сағат делінген). Оған дейін жазба «растауды күтуде» күйінде тұрады.",
      },
      {
        h: "Тексеруге арналған жария сілтеме",
        p: "Әр жазбаның жария беті бар: /verify/<id>, оны кез келген адам кірмей-ақ ашады. Бюро атауын толтырсаңыз, үкімнің астында «Жазба <сіздің бюроңыз> арқылы жасалды · тексеруді AEVION қамтамасыз етеді» жолы тұрады. Бюро атауы онда көрсетіледі, бірақ қолтаңбаға кірмейді.",
      },
    ],
    limitsH: "Ашық шектеулер",
    limits: [
      "Бұл патенттік ведомствода тіркеу емес және оның орнын баспайды. Жазба дәл осы материалдың уақыт белгісі кезінде болғанын тіркейді.",
      "Бұл автордың тұлғасын куәландыру емес: аты қалай енгізілсе, солай тұрады. Тұлғаны тексеру мен нотариус әзірге демо режимінде.",
      "Жазбаның атауы мен сипаттамасы жария және қол қойылған хешке кіреді (жұмыс түрімен, елмен және қаламен бірге). Бейтарап жазыңыз, өнертабыстың мәнін көрсетпеңіз.",
    ],
    examplesH: "Үш тірі жазба",
    examplesLead: "AEVION жасаған жария демонстрациялық жазбалар (клиенттердің жұмыстары емес). Кез келгенін ашыңыз: онда үкім, қолтаңба тексерулері және Bitcoin күйі көрінеді.",
    examples: ["Бюро брендінің демонстрациясы: серіктестерге арналған жазба үлгісі", "Демонстрациялық жазба: жұмыстың жасалған күнін растау", "Автордың бірлескен қолтаңбасының демонстрациясы: серіктестерге арналған жазба үлгісі"],
    faqH: "Сұрақтар мен жауаптар",
    faq: [
      { q: "Бұл патенттік ведомстводағы тіркеуді алмастыра ма?", a: "Жоқ. Бұл жария тексеру сілтемесі бар, күні қойылған, қол қойылған материал жазбасы. Ведомствоға өтінім беру — бөлек құқықтық қадам." },
      { q: "Клиенттің файлы AEVION-ға жүктеле ме?", a: "Жоқ. SHA-256 ізі браузерде есептеледі, тек хеш жіберіледі. Сіз енгізген атау мен сипаттама сақталады және жария болады." },
      { q: "Атау мен сипаттамаға не жазу керек?", a: "Бейтарап нәрсе, мысалы «Сипаттама жобасы, 3-нұсқа». Екі өріс те жария және қол қойылған хешке кіреді, сондықтан өнертабыстың мәнін жазбаңыз." },
      { q: "Bitcoin растауын қанша күту керек?", a: "Әдетте бірнеше сағат; тексеру бетінде 1–6 сағат делінген. Блок келгенше жазба «растауды күтуде» күйінде тұрады." },
      { q: "Жазбаны кім тексере алады?", a: "/verify/<id> сілтемесі бар кез келген адам, аккаунтсыз. Бетте тұтастық тексерулері мен Bitcoin бекітуінің күйі көрсетіледі." },
      { q: "Клиент тексеру бетінде біздің бюроны көре ме?", a: "Иә, «Бюро немесе ұйым» өрісін толтырсаңыз: үкімнің астында «Жазба <бюро> арқылы жасалды · тексеруді AEVION қамтамасыз етеді» жолы шығады. Ол қолтаңбаға кірмейді." },
      { q: "Жазба автордың кім екенін дәлелдей ме?", a: "Жоқ. Ол осындай хеші бар материалдың сол уақытта болғанын көрсетеді. Тұлғаны тексеру әзірге жоқ." },
    ],
    ctaH: "Бюроңыздың жұмысында байқап көріңіз",
    ctaMain: "Бюроңыз туралы жазу",
    ctaSecond: "Жұмысты қазір тіркеу",
    ctaNote: "Бірінші батырма бюроны қосуға арналған қысқа өтінімді ашады, екіншісі тікелей QRight-қа апарады.",
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
