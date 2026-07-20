import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "QBuild — гайд для соискателя",
  description:
    "Как найти работу на AEVION QBuild: заполнить профиль, найти вакансии, откликнуться, пройти оплачиваемое пробное задание и получить найм — бесплатно для соискателя.",
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
    title: "Заполните профиль",
    body: (
      <>
        Минимум: должность, короткое summary и <b>2+ навыка</b> — тогда вы
        попадаете в рекомендации и поиск работодателей. Хотите больше доверия —
        запросите значок <span className="text-emerald-300">✓ Verified</span> в
        профиле (ссылка на LinkedIn/портфолио/сертификаты, проверяем 1–2 рабочих
        дня). Ваш публичный профиль — <code className="text-slate-400">/build/u/…</code>.
      </>
    ),
    cta: { label: "К профилю →", href: "/build/profile" },
  },
  {
    n: 2,
    title: "Найдите вакансии",
    body: (
      <>
        В разделе «Вакансии» — фильтры по городу, навыку и зарплате. Для соискателя
        всё <b>бесплатно</b>: ни платы за отклик, ни премиум-стены на контакты.
      </>
    ),
    cta: { label: "К вакансиям →", href: "/build/vacancies" },
  },
  {
    n: 3,
    title: "Откликнитесь",
    body: (
      <>
        Кнопка <b>«Quick apply»</b> прямо из списка, либо откройте вакансию для
        полной формы с вопросами. Если работодатель добавил вопросы — отвечайте
        вдумчиво: <b>AI оценивает ответы по 100-балльной шкале</b>, и хороший балл
        поднимает вас в его списке.
      </>
    ),
  },
  {
    n: 4,
    title: "Запишите видеорезюме (по желанию)",
    body: (
      <>
        Короткое видео выделяет вас: работодатель видит вас «вживую» ещё до звонка.
        Особенно помогает, если опыт сложно уместить в текст.
      </>
    ),
  },
  {
    n: 5,
    title: "Пройдите пробное задание (Trial)",
    body: (
      <>
        После одобрения отклика работодатель может предложить <b>Trial</b> —
        небольшую <i>оплачиваемую</i> задачу, чтобы проверить навык в деле. Выполнили —
        получили оплату, и работодатель убедился в вас без долгих собеседований.
      </>
    ),
  },
  {
    n: 6,
    title: "Общайтесь и получайте найм",
    body: (
      <>
        Прямые сообщения с работодателем — без премиум-стены с обеих сторон.
        Договорились — вас нанимают. После завершения работы обе стороны оставляют
        отзывы: репутация растёт и открывает лучшие заказы.
      </>
    ),
    cta: { label: "Сообщения →", href: "/build/messages" },
  },
];

export default function WorkerGuidePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/build" className="text-xs text-slate-400 hover:underline">
          ← QBuild
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold text-white">
          Гайд для соискателя
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          От профиля до найма — и почему для вас это бесплатно.
        </p>

        {/* How it works in 30 seconds */}
        <section className="mt-6 rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-emerald-400/5 to-transparent p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-200">
            Как это работает за 30 секунд
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            Для соискателя QBuild <b>бесплатен</b>: заполняете профиль, откликаетесь
            на вакансии, при желании — видеорезюме и оплачиваемое пробное задание.
            За оплаченные заказы (например Trial) капает <b>2% AEV-кэшбэка</b>.
            Никакой платы за «открыть контакт».
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

        {/* Job alerts tip */}
        <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="text-base font-semibold text-white">💡 Совет: Job Alerts</h2>
          <p className="mt-1 text-sm text-slate-300">
            В профиле → «Job alerts» задайте ключевые слова и навыки. Как появится
            подходящая вакансия — придёт письмо, и вы откликнетесь первым.
          </p>
        </section>

        {/* CTA */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/build/vacancies"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            Найти вакансии →
          </Link>
          <Link
            href="/build/profile"
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
          >
            Заполнить профиль
          </Link>
        </div>

        <p className="mt-8 text-[11px] text-slate-500">
          Вы работодатель? Смотрите{" "}
          <Link href="/build/guide" className="text-emerald-300 underline">
            гайд для работодателя
          </Link>
          . Частые вопросы —{" "}
          <Link href="/build/help" className="text-emerald-300 underline">
            /build/help
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
