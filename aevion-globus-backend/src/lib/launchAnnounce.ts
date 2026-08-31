import type { ConstitutionEmailPayload } from "./constitutionBrevo";
import { unsubscribeUrl, unsubContact } from "./waitlistUnsubToken";

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
    // Перенесено основателем 29.08.2026 на 30 сентября. Дата живёт в ТРЁХ
    // местах — здесь, в списке планов подтверждения и в записи о том,
    // с какого дня модуль считается открытым. 30.08 две из трёх остались
    // прежними, и письмо обещало запуск в день, когда его не было.
    date: "30 сентября",
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

/**
 * Метки ОБЩЕЙ очереди: люди, подписавшиеся не на конкретный модуль, а на
 * «следующий запуск».
 *
 * Найдено 28.08.2026, за два дня до запуска шахмат. `/go` — единственная
 * кликабельная ссылка в шапках соцсетей, то есть главный вход всей воронки.
 * Её форма обещает дословно: «Написать вам, когда выйдет следующее. Модули
 * выходят по одному. Оставьте адрес — придёт письмо в день запуска и условия
 * раннего доступа», а рядом на той же странице написано «30 августа · шахматы».
 * Пишет она метку `go` (или `go-<канал>`), а отбор шёл ТОЛЬКО по метке модуля —
 * значит эти люди не получили бы ничего. Обещание расходилось с продуктом
 * ровно там, где мы собираем аудиторию.
 *
 * Почему не расширили `matchesModule`: она отвечает на вопрос «это метка
 * ЭТОГО модуля», и её строгость намеренная (иначе «olddevhub» притянулся бы к
 * «devhub»). Общая очередь — другой вопрос, поэтому и функция другая.
 *
 * `en-go` сюда НЕ входит осознанно: письмо существует только по-русски, и
 * отправить его человеку, которому обещали английскую страницу, — хуже, чем
 * не отправить. Появится английское письмо — добавить метку сюда.
 */
export function isGeneralWaitlist(source: string): boolean {
  const parts = String(source || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parts.some((p) => p === "go" || p.startsWith("go-"));
}

/**
 * Ссылка отписки берётся из ОБЩЕГО помощника, а не строится здесь.
 *
 * Своя копия и была дефектом: 21.08 выяснилось, что адрес, который она собирала,
 * отдаёт 404 — страницы отписки не существовало вовсе. Второй способ делать то же
 * самое означает, что чинить придётся дважды, а забудут — один раз.
 */
/** Готовая ссылка-якорь для HTML-подвала: либо ссылка, либо живой адрес почты. */
function unsubHtml(email: string, color = "#5d5f66"): string {
  const url = unsubscribeUrl(email);
  return url
    ? `<a href="${url}" style="color:${color}">Отписаться</a>`
    : `Отписаться: напишите на <a href="mailto:${unsubContact()}" style="color:${color}">${unsubContact()}</a>`;
}

function unsubLine(email: string): string {
  const url = unsubscribeUrl(email);
  return url ? `Отписаться: ${url}` : `Отписаться: напишите на ${unsubContact()}`;
}

export function buildLaunchEmail(moduleSlug: string, email: string): ConstitutionEmailPayload {
  const m = LAUNCH_MODULES[moduleSlug];
  if (!m) throw new Error(`launchAnnounce: неизвестный модуль «${moduleSlug}»`);

  const url = `https://aevion.app${m.page}`;
  const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;padding:28px;background:#f7f6f2;color:#16161a">
      <!-- Прехедер: строка, которую почтовый клиент показывает в СПИСКЕ писем
           рядом с темой. Без него туда попадает начало письма, а оно повторяло
           тему («CyberChess открыт») — вторая строка в ящике не добавляла
           ничего. Здесь она говорит, ЧТО внутри: человек решает открывать по
           двум строкам, и вторая должна нести новое.
           Приём стандартный: скрытый блок плюс неразрывные пробелы, чтобы
           клиент не подтянул в предпросмотр следующий текст. -->
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px">
        ${m.opens.charAt(0).toUpperCase()}${m.opens.slice(1)}. Начать можно за минуту.
        &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
      </div>
      ${m.name.startsWith("AEVION") ? "" : `<div style="font-family:monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#a9781a">AEVION</div>`}
      <h1 style="font-size:26px;line-height:1.2;margin:10px 0 14px">${m.name} открыт</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
        Вы оставляли адрес, чтобы узнать о запуске — он состоялся${m.date ? ` ${m.date}` : ""}.
        Доступно: ${m.opens}.
      </p>
      <!-- Кнопка, а не текстовая ссылка. Замер 28.08.2026: ссылка при
           font-size 15px даёт цель касания ~20px по высоте, тогда как палец
           уверенно попадает в 44. Это ЕДИНСТВЕННОЕ нажатие всего запуска, и
           большинство откроет письмо с телефона. Вёрстка почты: padding на
           <a>, никаких flex и grid — почтовые клиенты их не поддерживают,
           а inline-block с padding понимает даже Outlook. -->
      <p style="margin:0 0 22px">
        <a href="${url}" style="display:inline-block;padding:14px 26px;background:#a9781a;color:#ffffff;font-weight:700;font-size:16px;line-height:1.2;border-radius:6px;text-decoration:none">Открыть ${m.name} &rarr;</a>
      </p>
      <p style="margin:0 0 22px;font-size:12.5px;line-height:1.5;color:#5d5f66">
        Кнопка не нажимается? Откройте прямо: <a href="${url}" style="color:#a9781a">${url}</a>
      </p>
      <hr style="border:none;border-top:1px solid rgba(22,22,26,0.12);margin:0 0 14px">
      <p style="color:#5d5f66;font-size:11.5px;line-height:1.5;margin:0">
        Это письмо пришло потому, что вы подписались на странице запуска ${m.name}.
        Одно письмо на модуль, больше ничего.<br>
        ${unsubHtml(email)}
      </p>
    </div>
  `;
  return {
    to: [{ email }],
    // Без даты в теме, если даты нет. Шаблонная строка напечатала бы «null»
    // прямо в теме письма живому человеку — молча и убедительно.
    subject: m.date ? `${m.name} открыт — ${m.date}` : `${m.name} открыт`,
    htmlContent: html,
    textContent: `${m.name} открыт. Доступно: ${m.opens}. Открыть: ${url}\n\nВы подписались на странице запуска ${m.name}. ${unsubLine(email)}`,
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
    // Получают и подписчики модуля, и общая очередь «напишите о следующем».
    if (!matchesModule(r.source, moduleSlug) && !isGeneralWaitlist(r.source)) continue;
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

/**
 * Что отправлять ПРЯМО СЕЙЧАС из готового плана.
 *
 * Отправка рассылки — единственное действие на платформе, которое нельзя
 * отменить: письмо ушло живым людям. Поэтому решение «кому именно сейчас»
 * вынесено сюда, в чистую функцию без ввода-вывода: её можно прогнать на
 * любых списках и проверить без единого настоящего письма.
 *
 * Три правила, и каждое куплено чужой болью:
 *
 *   уже получил   повтор рассылки после обрыва не должен слать второй раз;
 *                 список отправленных ведётся снаружи и передаётся сюда;
 *   потолок суток у Brevo на нашем плане 300 писем в сутки, и он ЖЁСТКИЙ:
 *                 291-е письмо просто не уйдёт, а мы об этом не узнаем;
 *   остаток       сколько осталось на завтра — чтобы человек видел, что
 *                 рассылка не закончена, а не решил, что все получили.
 */
export type SendBatch = {
  /** Кому слать в этот заход. */
  toSend: string[];
  /** Уже получили раньше — пропущены. */
  alreadySent: number;
  /** Не влезли в сегодняшний потолок; их надо доотправить завтра. */
  postponed: number;
};

export function planSendBatch(input: {
  recipients: string[];
  alreadySent: Iterable<string>;
  /** Сколько писем сегодня уже ушло ЛЮБЫМ каналом. */
  usedToday: number;
  /** Потолок провайдера на сутки. */
  dailyCap: number;
}): SendBatch {
  const было = new Set(
    [...input.alreadySent].map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  const свежие = input.recipients
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .filter((e) => !было.has(e));

  const остатокСуток = Math.max(0, input.dailyCap - Math.max(0, input.usedToday));
  const toSend = свежие.slice(0, остатокСуток);

  return {
    toSend,
    alreadySent: input.recipients.length - свежие.length,
    postponed: свежие.length - toSend.length,
  };
}
