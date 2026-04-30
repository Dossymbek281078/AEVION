import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AEVION QBuild — лучше HeadHunter для строительной отрасли",
  description:
    "Платите за результат, а не за паки. Pay-per-Hire от 6%. AI-коуч, видео-резюме, проверенные подрядчики. Найм в стройке без скрытых платежей.",
  openGraph: {
    type: "website",
    title: "AEVION QBuild — лучше HeadHunter",
    description:
      "Pay-per-Hire от 6%. AI-коуч и AI-скоринг ответов. Видео-резюме. Trial Jobs вместо ghosting. Без паков и скрытых платежей.",
    siteName: "AEVION QBuild",
  },
  twitter: {
    card: "summary_large_image",
    title: "AEVION QBuild — лучше HeadHunter",
    description:
      "Pay-per-Hire от 6%. AI-коуч. Видео-резюме. Trial Jobs. Без паков.",
  },
};

type Counters = {
  vacancies: number;
  candidates: number;
  projects: number;
};

async function loadCounters(): Promise<Counters> {
  // Best-effort — landing must render even if backend is down.
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

export default async function WhyAevionPage() {
  const counters = await loadCounters();
  return (
    <main className="min-h-screen bg-[#06070b] text-white">
      <Hero />
      <Counters {...counters} />
      <KillerFeatures />
      <CompareTable />
      <Loyalty />
      <Workflow />
      <FounderNote />
      <CTA />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/5 px-6 pb-16 pt-20 sm:px-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(217,70,239,0.15),transparent_60%)]" />
      <div className="mx-auto max-w-5xl">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
          AEVION · QBuild
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Найм в стройке —{" "}
          <span className="bg-gradient-to-r from-emerald-300 to-fuchsia-300 bg-clip-text text-transparent">
            без паков, ghosting и комиссий 25%
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">
          QBuild — это HeadHunter, переделанный под отрасль. AI-коуч пишет резюме. Claude скорит ответы кандидатов. Trial Jobs заменяет звонки и собеседования. Pay-per-Hire от <span className="font-semibold text-emerald-200">6%</span> вместо агентских 15–25%.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/build"
            className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            Начать бесплатно →
          </Link>
          <Link
            href="/build/pricing"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
          >
            Сравнить тарифы
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Free Forever — навсегда. Подписку можно отменить в один клик.
        </p>
      </div>
    </section>
  );
}

function Counters({ vacancies, candidates, projects }: Counters) {
  return (
    <section className="border-b border-white/5 px-6 py-10 sm:px-10">
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
        <Stat label="Открытых вакансий" value={vacancies} accent="emerald" />
        <Stat label="Кандидатов в базе" value={candidates} accent="sky" />
        <Stat label="Активных проектов" value={projects} accent="fuchsia" />
      </div>
      <p className="mx-auto mt-3 max-w-5xl text-center text-[11px] text-slate-500">
        Цифры обновляются в реальном времени. Рост от частных лиц и небольших СМР-команд.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "emerald" | "sky" | "fuchsia";
}) {
  const tone =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "sky"
        ? "text-sky-300"
        : "text-fuchsia-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <div className={`text-4xl font-bold ${tone}`}>{value.toLocaleString("ru-RU")}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}

function KillerFeatures() {
  const features = [
    {
      icon: "🧠",
      title: "AI Coach",
      body: "Claude пишет ваше резюме под отрасль, отвечает на вопросы про найм, подбирает вакансии за минуту.",
    },
    {
      icon: "✨",
      title: "AI-скоринг ответов",
      body: "Работодатель задаёт 5 коротких вопросов в вакансии. Claude оценивает каждый ответ 0–100 + находит red flags.",
    },
    {
      icon: "🎬",
      title: "30-секундное видео",
      body: "Вместо стены текста — лицо и голос кандидата. Запоминается в 10 раз лучше, скриним в 10 раз быстрее.",
    },
    {
      icon: "🎯",
      title: "Trial Jobs",
      body: "Вместо ghosting — оплачиваемое микро-задание. Проверка реального скилла, оплата при сдаче.",
    },
    {
      icon: "🛠",
      title: "Стройка-специфика",
      body: "Медкомиссия, ТБ, водительские, своя оснастка, готов от даты — встроены в профиль и в фильтры поиска.",
    },
    {
      icon: "📞",
      title: "Прямые DM",
      body: "Никаких посредников и платных контактов. Открыли отклик — пишете кандидату напрямую.",
    },
    {
      icon: "🔍",
      title: "Match-score кандидатов",
      body: "Алгоритм считает overlap с required-скиллами вакансии и сортирует список по релевантности.",
    },
    {
      icon: "💎",
      title: "AEV cashback",
      body: "2% от каждого PAID-заказа возвращается в AEV-кошелёк. Накапливается, тратится на платформе.",
    },
  ];
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">
          8 киллер-фич, которых нет у HH
        </h2>
        <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
          Платформа сделана под стройку — не «универсальный сайт работы»
        </h3>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-emerald-500/40 hover:bg-white/[0.05]"
            >
              <div className="text-3xl">{f.icon}</div>
              <div className="mt-3 text-base font-bold text-white">{f.title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompareTable() {
  const rows = [
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
  ];
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
          QBuild vs HeadHunter
        </h2>
        <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
          Считайте сами
        </h3>
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Фича</th>
                <th className="px-4 py-3 text-left font-semibold">HeadHunter</th>
                <th className="px-4 py-3 text-left font-semibold text-emerald-200">AEVION QBuild</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(([f, hh, qb]) => (
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

function Loyalty() {
  const tiers = [
    { hires: 0, pct: 12, label: "Default" },
    { hires: 3, pct: 10, label: "Bronze" },
    { hires: 10, pct: 8, label: "Silver" },
    { hires: 25, pct: 6, label: "Gold" },
  ];
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">
          Loyalty — оплата по результату
        </h2>
        <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
          Чем больше нанимаете — тем меньше комиссия
        </h3>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Pay-per-Hire начинается с 12% и опускается до 6% — это значимо ниже агентских 15–25% даже на первом найме. Trial Jobs тоже считаются.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.hires}
              className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-5 text-center"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
                {t.label}
              </div>
              <div className="mt-2 text-4xl font-bold text-white">{t.pct}%</div>
              <div className="mt-1 text-xs text-slate-400">
                {t.hires === 0 ? "С первого найма" : `с ${t.hires} наймов`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    {
      n: "01",
      title: "Загрузите резюме голосом или фото",
      body: "Claude разберёт PDF, скан или речь и превратит в структурированный профиль за секунду.",
    },
    {
      n: "02",
      title: "Получите AI-подсказки",
      body: "Coach подскажет каких полей не хватает, что улучшить, на какие из открытых вакансий вы подходите.",
    },
    {
      n: "03",
      title: "Откликнитесь — Claude поможет",
      body: "На вопросы работодателя отвечаете — Claude параллельно скорит ответы и помогает рекрутеру решать.",
    },
    {
      n: "04",
      title: "Trial → Hire",
      body: "Вместо «созвонимся когда-нибудь» — оплачиваемое тестовое за 1–3 дня. Сдали — наняты.",
    },
  ];
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
          Как это выглядит
        </h2>
        <h3 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
          От «нужна работа» до first day — за 72 часа
        </h3>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs font-bold text-emerald-300">{s.n}</div>
              <div className="mt-2 text-base font-bold text-white">{s.title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FounderNote() {
  return (
    <section className="border-b border-white/5 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
          От основателя
        </div>
        <p className="mt-4 text-base leading-relaxed text-slate-200">
          QBuild появился потому, что мы устали смотреть как стройка теряет недели на переписку «вы откликнулись — мы посмотрим». Мы взяли стек AEVION (Claude API, AEV токен, AI-skoring) и собрали платформу, где найм занимает дни, а не месяцы. У нас нет VC-давления продавать паки — мы зарабатываем когда вы реально нанимаете. Если что-то идёт не так — пишите напрямую, я лично читаю каждое сообщение.
        </p>
        <div className="mt-4 text-xs text-slate-400">— Dossymbek, AEVION founder</div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-10 text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Готовы попробовать?
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          5 минут на профиль. Pay-only-when-you-hire — без подписки на старте.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/build/profile"
            className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            Создать профиль
          </Link>
          <Link
            href="/build"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
          >
            Смотреть вакансии
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-8 text-xs text-slate-500 sm:px-10">
      <div className="mx-auto max-w-5xl">
        AEVION QBuild · часть платформы AEVION ·{" "}
        <Link href="/build/pricing" className="hover:text-slate-300">
          Тарифы
        </Link>{" "}
        ·{" "}
        <Link href="/" className="hover:text-slate-300">
          AEVION home
        </Link>
      </div>
    </footer>
  );
}
