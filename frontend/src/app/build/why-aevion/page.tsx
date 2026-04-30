import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import { LeadForm } from "@/components/build/LeadForm";

export const dynamic = "force-dynamic";

type Lang = "ru" | "en";

type Counters = {
  vacancies: number;
  candidates: number;
  projects: number;
};

type Search = { lang?: string };

type CopyT = {
  metaTitle: string;
  metaDesc: string;
  eyebrow: string;
  heroTitleA: string;
  heroTitleB: string;
  heroBody: string;
  heroCtaPrimary: string;
  heroCtaSecondary: string;
  heroNote: string;
  countersA: string;
  countersB: string;
  countersC: string;
  countersFooter: string;
  killerEyebrow: string;
  killerTitle: string;
  features: [string, string, string][];
  compareEyebrow: string;
  compareTitle: string;
  compareCols: string[];
  compareRows: string[][];
  loyaltyEyebrow: string;
  loyaltyTitle: string;
  loyaltyBody: string;
  loyaltyTiers: string[][];
  workflowEyebrow: string;
  workflowTitle: string;
  steps: [string, string, string][];
  founderEyebrow: string;
  founderText: string;
  founderName: string;
  ctaTitle: string;
  ctaBody: string;
  ctaPrimary: string;
  ctaSecondary: string;
  leadTitle: string;
  leadBody: string;
  leadEmailPh: string;
  leadCityPh: string;
  leadSubmit: string;
  leadDone: string;
  leadAlready: string;
  footerLine: string;
  footerPricing: string;
  footerHome: string;
};
const COPY: Record<Lang, CopyT> = {
  ru: {
    metaTitle: "AEVION QBuild — лучше HeadHunter для строительной отрасли",
    metaDesc:
      "Платите за результат, а не за паки. Pay-per-Hire от 6%. AI-коуч, видео-резюме, проверенные подрядчики. Найм в стройке без скрытых платежей.",
    eyebrow: "AEVION · QBuild",
    heroTitleA: "Найм в стройке —",
    heroTitleB: "без паков, ghosting и комиссий 25%",
    heroBody:
      "QBuild — это HeadHunter, переделанный под отрасль. AI-коуч пишет резюме. Claude скорит ответы кандидатов. Trial Jobs заменяет звонки и собеседования.",
    heroCtaPrimary: "Начать бесплатно →",
    heroCtaSecondary: "Сравнить тарифы",
    heroNote: "Free Forever — навсегда. Подписку можно отменить в один клик.",
    countersA: "Открытых вакансий",
    countersB: "Кандидатов в базе",
    countersC: "Активных проектов",
    countersFooter:
      "Цифры обновляются в реальном времени. Рост от частных лиц и небольших СМР-команд.",
    killerEyebrow: "8 киллер-фич, которых нет у HH",
    killerTitle: "Платформа сделана под стройку — не «универсальный сайт работы»",
    features: [
      ["🧠", "AI Coach", "Claude пишет ваше резюме под отрасль, отвечает на вопросы про найм, подбирает вакансии за минуту."],
      ["✨", "AI-скоринг ответов", "Работодатель задаёт 5 коротких вопросов в вакансии. Claude оценивает каждый ответ 0–100 + находит red flags."],
      ["🎬", "30-секундное видео", "Вместо стены текста — лицо и голос кандидата. Запоминается в 10 раз лучше, скриним в 10 раз быстрее."],
      ["🎯", "Trial Jobs", "Вместо ghosting — оплачиваемое микро-задание. Проверка реального скилла, оплата при сдаче."],
      ["🛠", "Стройка-специфика", "Медкомиссия, ТБ, водительские, своя оснастка, готов от даты — встроены в профиль и в фильтры поиска."],
      ["📞", "Прямые DM", "Никаких посредников и платных контактов. Открыли отклик — пишете кандидату напрямую."],
      ["🔍", "Match-score кандидатов", "Алгоритм считает overlap с required-скиллами вакансии и сортирует список по релевантности."],
      ["💎", "AEV cashback", "2% от каждого PAID-заказа возвращается в AEV-кошелёк. Накапливается, тратится на платформе."],
    ] as [string, string, string][],
    compareEyebrow: "QBuild vs HeadHunter",
    compareTitle: "Считайте сами",
    compareCols: ["Фича", "HeadHunter", "AEVION QBuild"],
    compareRows: [
      ["Публикация вакансии", "от 4 990 ₽", "0 ₽"],
      ["Доступ к базе резюме", "от 50 000 ₽/мес", "включён во всех тарифах"],
      ["Комиссия с найма", "15–25% (агентство)", "12% → 6% по loyalty"],
      ["AI-помощь кандидату", "—", "Claude Coach + резюме-парсер"],
      ["AI-скоринг отклика", "—", "Claude оценивает каждый ответ"],
      ["Видео-резюме", "—", "YouTube / Vimeo / mp4 embed"],
      ["Trial Jobs (тестовое с оплатой)", "—", "встроено в платформу"],
      ["Прямые сообщения", "только по премиум", "всегда"],
      ["Скрытые платежи", "паки, бусты, продление", "нет"],
      ["Cashback в нативном токене", "—", "2% AEV на любой PAID"],
    ],
    loyaltyEyebrow: "Loyalty — оплата по результату",
    loyaltyTitle: "Чем больше нанимаете — тем меньше комиссия",
    loyaltyBody:
      "Pay-per-Hire начинается с 12% и опускается до 6% — это значимо ниже агентских 15–25% даже на первом найме. Trial Jobs тоже считаются.",
    loyaltyTiers: [
      ["Default", "С первого найма"],
      ["Bronze", "с 3 наймов"],
      ["Silver", "с 10 наймов"],
      ["Gold", "с 25 наймов"],
    ],
    workflowEyebrow: "Как это выглядит",
    workflowTitle: "От «нужна работа» до first day — за 72 часа",
    steps: [
      ["01", "Загрузите резюме голосом или фото", "Claude разберёт PDF, скан или речь и превратит в структурированный профиль за секунду."],
      ["02", "Получите AI-подсказки", "Coach подскажет каких полей не хватает, что улучшить, на какие из открытых вакансий вы подходите."],
      ["03", "Откликнитесь — Claude поможет", "На вопросы работодателя отвечаете — Claude параллельно скорит ответы и помогает рекрутеру решать."],
      ["04", "Trial → Hire", "Вместо «созвонимся когда-нибудь» — оплачиваемое тестовое за 1–3 дня. Сдали — наняты."],
    ] as [string, string, string][],
    founderEyebrow: "От основателя",
    founderText:
      "QBuild появился потому, что мы устали смотреть как стройка теряет недели на переписку «вы откликнулись — мы посмотрим». Мы взяли стек AEVION (Claude API, AEV токен, AI-skoring) и собрали платформу, где найм занимает дни, а не месяцы. У нас нет VC-давления продавать паки — мы зарабатываем когда вы реально нанимаете. Если что-то идёт не так — пишите напрямую, я лично читаю каждое сообщение.",
    founderName: "— Dossymbek, AEVION founder",
    ctaTitle: "Готовы попробовать?",
    ctaBody: "5 минут на профиль. Pay-only-when-you-hire — без подписки на старте.",
    ctaPrimary: "Создать профиль",
    ctaSecondary: "Смотреть вакансии",
    leadTitle: "Получайте обновления QBuild",
    leadBody:
      "Мы запускаемся в новых городах раз в 2 недели. Оставьте email — мы напишем, когда будем у вас.",
    leadEmailPh: "you@email.com",
    leadCityPh: "Город (опционально)",
    leadSubmit: "Подписаться",
    leadDone: "Готово — мы написали вам письмо подтверждения.",
    leadAlready: "Этот email уже в списке.",
    footerLine: "AEVION QBuild · часть платформы AEVION · ",
    footerPricing: "Тарифы",
    footerHome: "AEVION home",
  },
  en: {
    metaTitle: "AEVION QBuild — better than HeadHunter for construction hiring",
    metaDesc:
      "Pay for results, not for plans. Pay-per-Hire from 6%. AI coach, video resumes, vetted contractors. Construction hiring without hidden fees.",
    eyebrow: "AEVION · QBuild",
    heroTitleA: "Construction hiring —",
    heroTitleB: "no packs, no ghosting, no 25% agency cuts",
    heroBody:
      "QBuild is HeadHunter rebuilt for the construction industry. The AI coach writes resumes. Claude scores candidate answers. Trial Jobs replace screening calls.",
    heroCtaPrimary: "Start free →",
    heroCtaSecondary: "Compare plans",
    heroNote: "Free Forever — really forever. Cancel any subscription in one click.",
    countersA: "Open vacancies",
    countersB: "Candidates in the pool",
    countersC: "Active projects",
    countersFooter:
      "Numbers update in real time. Growth driven by independent crews and small construction firms.",
    killerEyebrow: "8 killer features HeadHunter doesn't have",
    killerTitle: "Built for construction — not a generic job site",
    features: [
      ["🧠", "AI Coach", "Claude writes your resume in industry voice, answers hiring questions, and finds matching vacancies in a minute."],
      ["✨", "AI answer scoring", "Recruiter posts 5 short questions per vacancy. Claude scores every answer 0–100 and surfaces red flags."],
      ["🎬", "30-second video intro", "Face and voice instead of a wall of text. 10× more memorable, 10× faster to screen."],
      ["🎯", "Trial Jobs", "Instead of ghosting — a paid micro-task. Real skill check, real payment on delivery."],
      ["🛠", "Industry-specific signals", "Medical check, safety training, driver's license, owned tools, ready-from-date — built into the profile and the search filters."],
      ["📞", "Direct DMs", "No middlemen, no paid contacts. Open an application and message the candidate directly."],
      ["🔍", "Candidate match-score", "Algorithm computes overlap against required vacancy skills and sorts the list by relevance."],
      ["💎", "AEV cashback", "2% of every PAID order returns to your AEV wallet. Stacks across orders, spends on the platform."],
    ] as [string, string, string][],
    compareEyebrow: "QBuild vs HeadHunter",
    compareTitle: "Do the math",
    compareCols: ["Feature", "HeadHunter", "AEVION QBuild"],
    compareRows: [
      ["Posting a vacancy", "from 4,990 ₽", "0 ₽"],
      ["Resume database access", "from 50,000 ₽/mo", "included in every tier"],
      ["Hire commission", "15–25% (agency)", "12% → 6% via loyalty"],
      ["AI help for candidates", "—", "Claude Coach + resume parser"],
      ["AI scoring of answers", "—", "Claude scores every reply"],
      ["Video resume", "—", "YouTube / Vimeo / mp4 embed"],
      ["Paid trial jobs", "—", "built into the platform"],
      ["Direct messaging", "premium-only", "always"],
      ["Hidden charges", "packs, boosts, renewals", "none"],
      ["Native-token cashback", "—", "2% AEV on every PAID order"],
    ],
    loyaltyEyebrow: "Loyalty — pay by results",
    loyaltyTitle: "More hires → lower commission",
    loyaltyBody:
      "Pay-per-Hire starts at 12% and drops to 6% — already meaningfully below the 15–25% agency take, even on your first hire. Trial Jobs count too.",
    loyaltyTiers: [
      ["Default", "From the first hire"],
      ["Bronze", "from 3 hires"],
      ["Silver", "from 10 hires"],
      ["Gold", "from 25 hires"],
    ],
    workflowEyebrow: "How it looks",
    workflowTitle: "From “need a job” to first day — in 72 hours",
    steps: [
      ["01", "Upload your resume by voice or photo", "Claude parses a PDF, scan, or voice transcript into a structured profile in seconds."],
      ["02", "Get AI guidance", "Coach flags missing fields, suggests improvements, and matches you to currently open vacancies."],
      ["03", "Apply — Claude helps", "You answer the recruiter's questions; Claude scores each answer in parallel so the recruiter can decide fast."],
      ["04", "Trial → Hire", "Instead of “we'll call you” — a paid 1-to-3 day trial. Deliver it, get hired."],
    ] as [string, string, string][],
    founderEyebrow: "From the founder",
    founderText:
      "QBuild exists because we got tired of watching construction lose weeks on “you applied — we'll get back to you.” We took the AEVION stack (Claude API, AEV token, AI scoring) and built a platform where hiring takes days, not months. We have no VC pressure to sell packs — we earn when you actually hire. Hit a wall? Email me — I read every message.",
    founderName: "— Dossymbek, AEVION founder",
    ctaTitle: "Ready to try?",
    ctaBody: "5 minutes for a profile. Pay-only-when-you-hire — no subscription needed to start.",
    ctaPrimary: "Create profile",
    ctaSecondary: "Browse vacancies",
    leadTitle: "Get QBuild updates",
    leadBody:
      "We launch in new cities every 2 weeks. Drop your email — we'll write when we land near you.",
    leadEmailPh: "you@email.com",
    leadCityPh: "City (optional)",
    leadSubmit: "Subscribe",
    leadDone: "Done — confirmation email is on the way.",
    leadAlready: "This email is already on the list.",
    footerLine: "AEVION QBuild · part of the AEVION platform · ",
    footerPricing: "Pricing",
    footerHome: "AEVION home",
  },
};

function pickLang(searchLang: string | undefined): Lang {
  return searchLang === "en" ? "en" : "ru";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const lang = pickLang(sp?.lang);
  const t = COPY[lang];
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    openGraph: {
      type: "website",
      title: t.metaTitle,
      description: t.metaDesc,
      siteName: "AEVION QBuild",
      locale: lang === "en" ? "en_US" : "ru_RU",
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle,
      description: t.metaDesc,
    },
    alternates: {
      languages: {
        ru: "/build/why-aevion?lang=ru",
        en: "/build/why-aevion?lang=en",
      },
    },
  };
}

async function loadCounters(): Promise<Counters> {
  try {
    const r = await fetch(`${getApiBase()}/api/build/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return { vacancies: 0, candidates: 0, projects: 0 };
    const j = (await r.json()) as { success: boolean; data?: Counters };
    return j?.data || { vacancies: 0, candidates: 0, projects: 0 };
  } catch {
    return { vacancies: 0, candidates: 0, projects: 0 };
  }
}

export default async function WhyAevionPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const lang = pickLang(sp?.lang);
  const t = COPY[lang];
  const counters = await loadCounters();
  return (
    <main className="min-h-screen bg-[#06070b] text-white">
      <LangSwitcher lang={lang} />
      <Hero t={t} />
      <CountersBlock t={t} {...counters} lang={lang} />
      <KillerFeatures t={t} />
      <CompareTable t={t} />
      <Loyalty t={t} />
      <Workflow t={t} />
      <FounderNote t={t} />
      <LeadForm lang={lang} />
      <CTA t={t} />
      <Footer t={t} />
    </main>
  );
}

type T = CopyT;

function LangSwitcher({ lang }: { lang: Lang }) {
  return (
    <div className="absolute right-4 top-4 z-20 inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-xs backdrop-blur sm:right-8 sm:top-8">
      <Link
        href="/build/why-aevion?lang=ru"
        className={`rounded-full px-3 py-1 ${lang === "ru" ? "bg-emerald-500 text-emerald-950 font-semibold" : "text-slate-300 hover:text-white"}`}
      >
        RU
      </Link>
      <Link
        href="/build/why-aevion?lang=en"
        className={`rounded-full px-3 py-1 ${lang === "en" ? "bg-emerald-500 text-emerald-950 font-semibold" : "text-slate-300 hover:text-white"}`}
      >
        EN
      </Link>
    </div>
  );
}

function Hero({ t }: { t: T }) {
  return (
    <section className="relative overflow-hidden border-b border-white/5 px-6 pb-16 pt-20 sm:px-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(217,70,239,0.15),transparent_60%)]" />
      <div className="mx-auto max-w-5xl">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
          {t.eyebrow}
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">
          {t.heroTitleA}{" "}
          <span className="bg-gradient-to-r from-emerald-300 to-fuchsia-300 bg-clip-text text-transparent">
            {t.heroTitleB}
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">{t.heroBody}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/build"
            className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            {t.heroCtaPrimary}
          </Link>
          <Link
            href="/build/pricing"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
          >
            {t.heroCtaSecondary}
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t.heroNote}</p>
      </div>
    </section>
  );
}

function CountersBlock({
  t,
  vacancies,
  candidates,
  projects,
  lang,
}: {
  t: T;
  vacancies: number;
  candidates: number;
  projects: number;
  lang: Lang;
}) {
  const locale = lang === "en" ? "en-US" : "ru-RU";
  return (
    <section className="border-b border-white/5 px-6 py-10 sm:px-10">
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
        <Stat label={t.countersA} value={vacancies} accent="emerald" locale={locale} />
        <Stat label={t.countersB} value={candidates} accent="sky" locale={locale} />
        <Stat label={t.countersC} value={projects} accent="fuchsia" locale={locale} />
      </div>
      <p className="mx-auto mt-3 max-w-5xl text-center text-[11px] text-slate-500">
        {t.countersFooter}
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
  locale,
}: {
  label: string;
  value: number;
  accent: "emerald" | "sky" | "fuchsia";
  locale: string;
}) {
  const tone =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "sky"
        ? "text-sky-300"
        : "text-fuchsia-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <div className={`text-4xl font-bold ${tone}`}>{value.toLocaleString(locale)}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}

function KillerFeatures({ t }: { t: T }) {
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">
          {t.killerEyebrow}
        </h2>
        <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{t.killerTitle}</h3>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.features.map(([icon, title, body]) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-emerald-500/40 hover:bg-white/[0.05]"
            >
              <div className="text-3xl">{icon}</div>
              <div className="mt-3 text-base font-bold text-white">{title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompareTable({ t }: { t: T }) {
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
          {t.compareEyebrow}
        </h2>
        <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{t.compareTitle}</h3>
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-slate-400">
              <tr>
                {t.compareCols.map((c, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-left font-semibold ${i === 2 ? "text-emerald-200" : ""}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {t.compareRows.map(([f, hh, qb]) => (
                <tr key={f}>
                  <td className="px-4 py-3 text-slate-200">{f}</td>
                  <td className="px-4 py-3 text-slate-400">{hh}</td>
                  <td className="px-4 py-3 font-medium text-emerald-200">{qb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Loyalty({ t }: { t: T }) {
  const tiers = [
    { hires: 0, pct: 12 },
    { hires: 3, pct: 10 },
    { hires: 10, pct: 8 },
    { hires: 25, pct: 6 },
  ];
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">
          {t.loyaltyEyebrow}
        </h2>
        <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{t.loyaltyTitle}</h3>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">{t.loyaltyBody}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          {tiers.map((tier, i) => {
            const [label, hint] = t.loyaltyTiers[i];
            return (
              <div
                key={tier.hires}
                className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-5 text-center"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
                  {label}
                </div>
                <div className="mt-2 text-4xl font-bold text-white">{tier.pct}%</div>
                <div className="mt-1 text-xs text-slate-400">{hint}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Workflow({ t }: { t: T }) {
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
          {t.workflowEyebrow}
        </h2>
        <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{t.workflowTitle}</h3>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.map(([n, title, body]) => (
            <div key={n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs font-bold text-emerald-300">{n}</div>
              <div className="mt-2 text-base font-bold text-white">{title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FounderNote({ t }: { t: T }) {
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
          {t.founderEyebrow}
        </div>
        <p className="mt-4 text-base leading-relaxed text-slate-200">{t.founderText}</p>
        <div className="mt-4 text-xs text-slate-400">{t.founderName}</div>
      </div>
    </section>
  );
}

function CTA({ t }: { t: T }) {
  return (
    <section className="px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-10 text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">{t.ctaTitle}</h2>
        <p className="mt-3 text-sm text-slate-300">{t.ctaBody}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/build/profile"
            className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            {t.ctaPrimary}
          </Link>
          <Link
            href="/build"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
          >
            {t.ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer({ t }: { t: T }) {
  return (
    <footer className="border-t border-white/5 px-6 py-8 text-xs text-slate-500 sm:px-10">
      <div className="mx-auto max-w-5xl">
        {t.footerLine}
        <Link href="/build/pricing" className="hover:text-slate-300">
          {t.footerPricing}
        </Link>{" "}
        ·{" "}
        <Link href="/" className="hover:text-slate-300">
          {t.footerHome}
        </Link>
      </div>
    </footer>
  );
}

