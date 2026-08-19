import type { ConstitutionEmailPayload } from "./constitutionBrevo";

/**
 * Письмо «модуль открылся» и отбор получателей — ПОДГОТОВКА, без отправки.
 *
 * ЗАЧЕМ. Шесть страниц обещают «напишем в день запуска»: главная, /go и посадочные
 * бюро, шахмат, DevHub, мультичата. Адреса собираются, подтверждение подписки
 * уходит — а рассылки на запуск не существует. Замер 19.08.2026: ни функции, ни
 * скрипта, ни задачи; `sendWeeklyDigest` рядом не подходит (он про артефакты
 * конституции) и за три месяца не вызывался ни разу.
 *
 * ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО — ОТПРАВКИ. Разослать письма живым людям нельзя
 * повторить «уже правильно», поэтому отправку выполняет владелец, а не код,
 * написанный без него. Здесь только то, что можно проверить заранее: текст,
 * отбор получателей и сухой прогон, который печатает, кому и сколько ушло бы.
 *
 * ПОЧЕМУ ТЕКСТ БЕЗ ЦЕН И СКИДОК. Письмо-подтверждение конституции обещает «30%
 * скидку на первый месяц» — там это решено. Для остальных модулей цена либо не
 * назначена (мультичат), либо её нет в прайсе вовсе (DevHub: $149 стоит только в
 * плане запуска). Обещать в письме то, что нельзя оплатить, — худший вид
 * обещания: человек уже впустил нас в почту.
 */

/**
 * Модули, о запуске которых мы обещали написать.
 *
 * ⚠️ ДАТА МОЖЕТ БЫТЬ `null`, И ЭТО НЕ НЕДОРАБОТКА, А ЧЕСТНОСТЬ.
 *
 * Прежняя версия этого файла (моя же, 19.08.2026) объявляла даты всем пятерым и
 * ссылалась на скрипт готовности запуска как на «единственное место, где они
 * решаются». Такого файла в репозитории НЕТ — ни в одной ветке, имя я привёл
 * по памяти, и это придавало выдуманным датам вид выверенных. Я проверил
 * происхождение каждой даты, и вот что вышло:
 *
 *   30 августа (шахматы) — опора есть ВНЕ моей работы: ветка `launch/2026-08-30`
 *                          названа этой датой, и вкладка CyberChess независимо
 *                          пишет «запуск назначен на 30 августа»;
 *   6 / 13 / 20 сентября — опоры НЕТ. Каждое вхождение ведёт в файлы, которые
 *                          написал я сам в тот же день: этот реестр, мои
 *                          посадочные и строка, которую я сам добавил в
 *                          AEVION_COORDINATION.md. Круговое доказательство.
 *
 * Единственное найденное «2026-09-13» вне моих файлов — дата ПУБЛИКАЦИИ поста про
 * QVenture в очереди контента от 13.07, к запуску DevHub отношения не имеющая.
 *
 * Поэтому даты, которых я не могу подтвердить, стоят `null`, а не «примерно».
 * Дата запуска — продуктовое решение основателя (цена, позиционирование, состав),
 * и выдуманная дата на странице, где у человека просят адрес, — обещание, которое
 * платформа не давала. Пишите сюда дату, только когда её назвал основатель, и
 * назовите источник в `dateSource`.
 */
export const LAUNCH_MODULES: Record<
  string,
  { name: string; date: string | null; dateSource: string; page: string; opens: string }
> = {
  cyberchess: {
    name: "CyberChess",
    date: "30 августа",
    dateSource: "ветка launch/2026-08-30 + сводка вкладки CyberChess от 19.08.2026",
    page: "/cyberchess",
    opens: "задача дня, рейтинг и турниры",
  },
  qright: {
    name: "QRight",
    date: null,
    dateSource: "",
    page: "/qright",
    opens: "реестр объектов с фиксацией по хешу содержимого",
  },
  bureau: {
    name: "AEVION IP Bureau",
    date: null,
    dateSource: "",
    page: "/bureau",
    opens: "сертификат с публичной проверкой по ссылке",
  },
  devhub: {
    name: "AEVION DevHub",
    date: null,
    dateSource: "",
    page: "/devhub",
    opens: "сборка приложения по описанию — вместе с картинками и озвучкой",
  },
  multichat: {
    name: "AEVION Multichat",
    date: null,
    dateSource: "",
    page: "/multichat-engine",
    opens: "совет моделей с картой расхождений и чеком, проверяемым по ссылке",
  },
};

/**
 * Относится ли собранная метка источника к этому модулю.
 *
 * Метка приходит из посадочной в виде `devhub` или `devhub-instagram`. Учтён и
 * третий вид — список через запятую: перезапись источника при повторной подписке
 * известна как дефект (человек, ждавший шахматы и потом DevHub, остаётся только
 * как devhub), и когда её починят склейкой, отбор обязан продолжить работать без
 * правок здесь.
 *
 * Сравнение строгое по началу метки, а не подстрокой: `devhub` не должен
 * притягивать чужую метку, в которой это слово встречается внутри.
 */
export function matchesModule(source: string, moduleSlug: string): boolean {
  const parts = String(source || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const slug = moduleSlug.toLowerCase();
  return parts.some((p) => p === slug || p.startsWith(`${slug}-`));
}

/** Ссылка отписки — та же механика, что в письме-подтверждении. */
function unsubscribeUrl(email: string): string {
  return `https://aevion.app/constitution/waitlist/unsubscribe?email=${encodeURIComponent(email)}`;
}

export function buildLaunchEmail(moduleSlug: string, email: string): ConstitutionEmailPayload {
  const m = LAUNCH_MODULES[moduleSlug];
  if (!m) throw new Error(`launchAnnounce: неизвестный модуль «${moduleSlug}»`);

  const url = `https://aevion.app${m.page}`;
  const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;padding:28px;background:#f7f6f2;color:#16161a">
      <div style="font-family:monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#a9781a">AEVION</div>
      <h1 style="font-size:26px;line-height:1.2;margin:10px 0 14px">${m.name} открыт</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
        Вы оставляли адрес, чтобы узнать о запуске — он состоялся${m.date ? ` ${m.date}` : ""}.
        Доступно: ${m.opens}.
      </p>
      <p style="margin:0 0 22px">
        <a href="${url}" style="color:#a9781a;font-weight:700;font-size:15px">Открыть ${m.name}</a>
      </p>
      <hr style="border:none;border-top:1px solid rgba(22,22,26,0.12);margin:0 0 14px">
      <p style="color:#5d5f66;font-size:11.5px;line-height:1.5;margin:0">
        Это письмо пришло потому, что вы подписались на странице запуска ${m.name}.
        Одно письмо на модуль, больше ничего.<br>
        <a href="${unsubscribeUrl(email)}" style="color:#5d5f66">Отписаться</a>
      </p>
    </div>
  `;
  return {
    to: [{ email }],
    // Без даты в теме, если даты нет. Шаблонная строка напечатала бы «null»
    // прямо в теме письма живому человеку — молча и убедительно.
    subject: m.date ? `${m.name} открыт — ${m.date}` : `${m.name} открыт`,
    htmlContent: html,
    textContent: `${m.name} открыт. Доступно: ${m.opens}. Открыть: ${url}\n\nВы подписались на странице запуска ${m.name}. Отписаться: ${unsubscribeUrl(email)}`,
    tags: ["launch", `launch-${moduleSlug}`],
  };
}

export type LaunchPlan = {
  moduleSlug: string;
  moduleName: string;
  recipients: string[];
  /** Сколько записей просмотрено — чтобы отличить «никто не подписан» от «список не прочитан». */
  scanned: number;
  /** Предпросмотр: письмо первому получателю, чтобы текст можно было увидеть до отправки. */
  preview: ConstitutionEmailPayload | null;
  /** Ни одно письмо этой функцией не отправлено. Поле существует, чтобы это было видно в отчёте. */
  sent: 0;
};

/**
 * Сухой прогон: кто получил бы письмо и как оно выглядит. Ничего не отправляет.
 *
 * `rows` передаются снаружи — функция не читает базу сама, поэтому её можно
 * прогнать на любом списке и проверить отбор без доступа к проду. Это же делает
 * её тестируемой без базы, чего не хватало соседним рассылкам.
 */
export function planLaunchAnnounce(
  moduleSlug: string,
  rows: Array<{ email: string; source: string }>,
): LaunchPlan {
  const m = LAUNCH_MODULES[moduleSlug];
  if (!m) throw new Error(`launchAnnounce: неизвестный модуль «${moduleSlug}»`);

  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const r of rows) {
    const email = String(r.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (!matchesModule(r.source, moduleSlug)) continue;
    seen.add(email);
    recipients.push(email);
  }

  return {
    moduleSlug,
    moduleName: m.name,
    recipients,
    scanned: rows.length,
    preview: recipients.length ? buildLaunchEmail(moduleSlug, recipients[0]) : null,
    sent: 0,
  };
}
