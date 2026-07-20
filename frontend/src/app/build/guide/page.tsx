import type { Metadata } from "next";
import Link from "next/link";
import styles from "./guide.module.css";

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
        Укажите название компании или бригады, город и коротко о себе. Профиль — это
        лицо на витрине: чем полнее, тем выше доверие кандидата к вашим вакансиям.
        Значок <span className={styles.accent}>✓ Verified</span> можно запросить
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
        <ul>
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
    <main className={styles.guide}>
      <div className={styles.sheet}>
        <div className={styles.topRule} />
        <div className={styles.folio}>
          <Link href="/build" className={styles.back}>
            ← QBuild
          </Link>
          <span className={styles.live}>Портал живой</span>
          <span>Издание для стройки · Астана</span>
        </div>

        <div className={styles.nameplate}>
          <div className={styles.kicker}>Гид работодателя</div>
          <h1>Как нанимать на QBuild</h1>
          <div className={styles.subhead}>
            От регистрации до первого найма — и как устроена оплата
          </div>
        </div>
        <div className={styles.ruleDouble} />

        <div className={styles.ledeBand}>
          <div className={styles.dateline}>
            <div className={styles.place}>
              <span>АСТАНА</span> — площадка найма для стройки
            </div>
            <p className={styles.lede}>
              Разместить проект и вакансию — <b>бесплатно</b>, без аванса агентству.
              AI помогает отсеять отклики, а пробное задание проверяет навык в деле, а
              не на словах. Платите <b>только за найм</b>: комиссия начинается с 12% и
              снижается до 4% по мере того, как вы нанимаете, плюс кэшбэк в токенах AEV.
              Ниже — весь путь по шагам, от профиля до оплаты.
            </p>
          </div>
          <div className={styles.numbers}>
            <div className={styles.cap}>Условия коротко</div>
            <div className={styles.row}>
              <span>Публикация вакансии</span>
              <span className={styles.free}>0&#8202;₽</span>
            </div>
            <div className={styles.row}>
              <span>Hire-fee, база</span>
              <span>12%</span>
            </div>
            <div className={styles.row}>
              <span>Hire-fee, минимум</span>
              <span className={styles.free}>4%</span>
            </div>
            <div className={styles.row}>
              <span>AEV-кэшбэк, до</span>
              <span>5%</span>
            </div>
          </div>
        </div>

        <div className={styles.stepsHead}>
          <span className={styles.mark}>№</span>
          <h2>Шесть шагов до найма</h2>
        </div>
        <ol className={styles.steps}>
          {STEPS.map((s) => (
            <li key={s.n}>
              <h3>{s.title}</h3>
              <div className={styles.body}>
                {s.body}
                {s.cta && (
                  <Link href={s.cta.href} className={styles.stepCta}>
                    {s.cta.label}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className={styles.ratesBand}>
          <div className={styles.ratesCap}>Лояльность</div>
          <p className={styles.ratesSub}>
            Чем больше наймов — тем дешевле. Уровень поднимается автоматически.
          </p>
          <div className={styles.tblWrap}>
            <table className={styles.rates}>
              <thead>
                <tr>
                  <th>Уровень</th>
                  <th>Наймов</th>
                  <th>Hire-fee</th>
                  <th>AEV-кэшбэк</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr key={t.tier}>
                    <th>{t.tier}</th>
                    <td className={styles.num}>{t.hires}</td>
                    <td className={styles.fee}>{t.fee}</td>
                    <td className={styles.num}>{t.cashback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.cta}>
          <div className={styles.lead}>Начните нанимать за две минуты</div>
          <div className={styles.btns}>
            <Link href="/build/create-project" className={`${styles.btn} ${styles.btnPrimary}`}>
              Создать проект →
            </Link>
            <Link href="/build/onboarding" className={`${styles.btn} ${styles.btnGhost}`}>
              Интерактивный чек-лист
            </Link>
            <Link href="/build/help" className={`${styles.btn} ${styles.btnGhost}`}>
              FAQ и помощь
            </Link>
          </div>
        </div>

        <div className={styles.colophon}>
          <span>AEVION QBuild · площадка найма для стройки</span>
          <Link href="/build">aevion.vercel.app/build</Link>
        </div>
      </div>
    </main>
  );
}
