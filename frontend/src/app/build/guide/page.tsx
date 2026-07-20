import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "QBuild — гайд для работодателя",
  description:
    "Как нанимать на AEVION QBuild: разместить проект и вакансию бесплатно, отсмотреть отклики с AI-скорингом, дать пробное задание и заплатить только за найм.",
};

type Step = {
  n: number;
  title: string;
  body: React.ReactNode;
  cta?: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Заполните профиль работодателя",
    body: (
      <>
        Укажите название компании/бригады, город и коротко о себе. Профиль — это
        лицо на витрине: чем полнее, тем выше доверие кандидата к вашим вакансиям.
        Значок <span className="text-emerald-300">✓ Verified</span> можно запросить
        в профиле — проверяем за 1–2 рабочих дня.
      </>
    ),
    cta: { label: "К профилю →", href: "/build/profile" },
  },
  {
    n: 2,
    title: "Создайте проект",
    body: (
      <>
        Проект — это контейнер под одну или несколько вакансий (например «Отделка
        офиса 180 м²»). Указываете название, описание объёма работ, город и бюджет.
        Публикация проекта — <b>бесплатно</b>.
      </>
    ),
    cta: { label: "Создать проект →", href: "/build/create-project" },
  },
  {
    n: 3,
    title: "Опубликуйте вакансию",
    body: (
      <>
        Внутри проекта нажмите <b>«+ Добавить вакансию»</b>: роль, требования,
        зарплата, навыки. Можно добавить вопросы к кандидату — по ответам сработает
        AI-скоринг (шаг 4). Чем конкретнее описание, тем выше отклик. Публикация
        вакансии — <b>0 ₽ на любом тарифе</b>.
      </>
    ),
  },
  {
    n: 4,
    title: "Отсмотрите отклики",
    body: (
      <>
        По каждому отклику видно:
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
          <li>
            <b>AI-скоринг 0–100</b> — Claude оценивает ответы кандидата на ваши
            вопросы, показывает балл и красные флаги прямо на карточке.
          </li>
          <li>
            <b>Видеорезюме</b> — если кандидат его записал, смотрите до звонка.
          </li>
          <li>
            <b>Пробное задание (Trial)</b> — предложите небольшую <i>оплачиваемую</i>{" "}
            задачу, чтобы проверить навык в деле, а не на словах.
          </li>
          <li>
            Всю воронку заявок можно выгрузить в <b>CSV</b> (имя, город, AI-score,
            статус).
          </li>
        </ul>
      </>
    ),
    cta: { label: "Поиск кандидатов →", href: "/build/talent" },
  },
  {
    n: 5,
    title: "Общайтесь напрямую",
    body: (
      <>
        Прямые сообщения с кандидатом — <b>без премиум-стены</b>. Не нужно платить,
        чтобы «открыть контакт»: написать можно любому откликнувшемуся.
      </>
    ),
    cta: { label: "Сообщения →", href: "/build/messages" },
  },
  {
    n: 6,
    title: "Наймите — и заплатите только за найм",
    body: (
      <>
        Никакого аванса агентству. Комиссия <b>Pay-per-Hire</b> берётся только когда
        вы реально нанимаете. Базово это <b>12%</b>, и она <b>падает с ростом числа
        наймов</b> — до <b>4%</b> на верхнем уровне лояльности. Плюс на каждый
        оплаченный заказ начисляется <b>AEV-кэшбэк</b> (2% → 5% по тирам).
      </>
    ),
  },
];

const TIERS = [
  { tier: "Default", hires: "0", fee: "12%", cashback: "2%" },
  { tier: "Bronze", hires: "3", fee: "10%", cashback: "2.5%" },
  { tier: "Silver", hires: "10", fee: "8%", cashback: "3%" },
  { tier: "Gold", hires: "25", fee: "6%", cashback: "4%" },
  { tier: "Platinum", hires: "50", fee: "4%", cashback: "5%" },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/build" className="text-xs text-slate-400 hover:underline">
          ← QBuild
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold text-white">
          Гайд для работодателя
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          От регистрации до первого найма — и как устроена оплата.
        </p>

        {/* How it works in 30 seconds */}
        <section className="mt-6 rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-emerald-400/5 to-transparent p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-200">
            Как это работает за 30 секунд
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            Разместить проект и вакансию — <b>бесплатно</b>, без аванса агентству.
            AI помогает отсеять отклики, пробное задание проверяет навык в деле.
            Платите <b>только за найм</b>: комиссия начинается с 12% и снижается до
            4% по мере того, как вы нанимаете, плюс кэшбэк в токенах AEV.
          </p>
        </section>

        {/* Steps */}
        <ol className="mt-8 space-y-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950">
                  {s.n}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-white">{s.title}</h3>
                  <div className="mt-1 text-sm leading-relaxed text-slate-300">
                    {s.body}
                  </div>
                  {s.cta && (
                    <Link
                      href={s.cta.href}
                      className="mt-3 inline-flex rounded-md border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25"
                    >
                      {s.cta.label}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* Loyalty table */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-white">Лояльность: чем больше наймов, тем дешевле</h2>
          <p className="mt-1 text-sm text-slate-400">
            Уровень поднимается автоматически по числу успешных наймов.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="py-2 pr-4 font-medium">Уровень</th>
                  <th className="py-2 pr-4 font-medium">Наймов</th>
                  <th className="py-2 pr-4 font-medium">Hire-fee</th>
                  <th className="py-2 font-medium">AEV-кэшбэк</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr key={t.tier} className="border-b border-white/5">
                    <td className="py-2 pr-4 font-semibold text-white">{t.tier}</td>
                    <td className="py-2 pr-4 text-slate-300">{t.hires}</td>
                    <td className="py-2 pr-4 text-emerald-300">{t.fee}</td>
                    <td className="py-2 text-slate-300">{t.cashback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/build/onboarding"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            Интерактивный чек-лист →
          </Link>
          <Link
            href="/build/create-project"
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
          >
            Создать проект
          </Link>
        </div>

        <p className="mt-8 text-[11px] text-slate-500">
          Остались вопросы? Загляните в{" "}
          <Link href="/build/help" className="text-emerald-300 underline">
            /build/help
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
