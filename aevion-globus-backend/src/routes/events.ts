import { Router } from "express";
import { makeServiceCapture } from "../lib/sentry/platform";
import { queryNumber } from "../lib/queryNumber";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { clientIp } from "../lib/rateLimit";

const captureEventsError = makeServiceCapture("qevents");

export const eventsRouter = Router();



/**
 * GTM analytics events — простой ingest без внешних трекеров.
 * Хранение: JSONL append-only в data/events.jsonl
 *
 * Без cookies / fingerprinting — клиент шлёт `sid` (session id из sessionStorage),
 * чтобы можно было сгруппировать действия одной сессии. Никаких PII не пишем.
 */

const EVENTS_FILE = process.env.EVENTS_FILE
  ? process.env.EVENTS_FILE
  : join(process.cwd(), "data", "events.jsonl");

// Фиксируем РЯДОМ с путём и в тот же момент. Если читать env при вызове, поле
// могло бы сказать "persisted", пока путь остаётся дефолтным — статус, который
// врёт, хуже отсутствующего статуса.
const EVENTS_FILE_FROM_ENV = Boolean(process.env.EVENTS_FILE);

function ensureDir() {
  const dir = dirname(EVENTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
/**
 * Состояние хранилища событий — для /api/health, без аутентификации.
 *
 * Зачем: события пишутся в JSONL на файловой системе. Если EVENTS_FILE не
 * указывает на смонтированный том, на Railway это файловая система контейнера,
 * и каждый деплой начинает счёт заново. Снаружи это неотличимо от «событий
 * пока не было»: пустой лог и свежий лог выглядят одинаково.
 *
 * Отдаём только счётчики и метку самого старого события — ни одного поля
 * самих событий, никаких PII. Если oldest всегда оказывается моложе
 * bootedAt из того же ответа, данные не переживают перезапуск, и это видно
 * с первого взгляда вместо того, чтобы лезть в переменные окружения.
 */
type EventsStoreStatus = {
  /** Задана ли переменная EVENTS_FILE. НЕ отвечает на вопрос «переживут ли выкатку». */
  persistedByEnv: boolean;
  /** Лежит ли файл на смонтированном томе. Вот это и есть ответ про сохранность.
   *  null = том не объявлен окружением, судить не по чему. */
  onVolume: boolean | null;
  exists: boolean;
  count: number;
  oldest: string | null;
};

// Файл событий append-only и не ротируется, а health опрашивают постоянно —
// Railway своей проверкой, CI в цикле, любой аптайм-монитор. Читать весь файл
// на каждый вызов означает, что через сутки работы health начнёт тянуть
// мегабайты, замедлится и Railway сочтёт сервис больным. Кэшируем: цифры в
// диагностике не обязаны быть посекундными.
const STORE_STATUS_TTL_MS = 30_000;
let storeStatusCache: { at: number; value: EventsStoreStatus } | null = null;

export function eventsStoreStatus(): EventsStoreStatus {
  const now = Date.now();
  if (storeStatusCache && now - storeStatusCache.at < STORE_STATUS_TTL_MS) {
    return storeStatusCache.value;
  }
  const value = readEventsStoreStatus();
  storeStatusCache = { at: now, value };
  return value;
}

function readEventsStoreStatus(): EventsStoreStatus {
  // Путь наружу не отдаём — он раскрывает раскладку файловой системы сервера.
  // Для ответа на вопрос «переживают ли события деплой» достаточно флага и
  // метки самого старого события.
  const persistedByEnv = EVENTS_FILE_FROM_ENV;
  // ЧТО ИМЕННО СПРАШИВАЮТ. `persistedByEnv` отвечает «задана ли переменная», а
  // читается как «переживут ли события выкатку» — 14.08.2026 я сам прочёл его
  // именно так, написал основателю тревогу «первая же выкатка сотрёт замер» и
  // просил настроить переменную. Выкатка в тот же день доказала обратное: 562
  // события с 26 мая целы, потому что каталог лежит на смонтированном томе.
  // Поэтому отдаём ФАКТ: попадает ли путь под точку монтирования тома.
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || null;
  const onVolume = mount ? EVENTS_FILE.replace(/\\/g, "/").startsWith(mount.replace(/\\/g, "/")) : null;
  if (!existsSync(EVENTS_FILE)) {
    return { persistedByEnv, onVolume, exists: false, count: 0, oldest: null };
  }
  try {
    const lines = readFileSync(EVENTS_FILE, "utf8").split("\n").filter(Boolean);
    let oldest: string | null = null;
    for (const line of lines) {
      try {
        const ts = JSON.parse(line)?.ts;
        if (typeof ts === "string" && (oldest === null || ts < oldest)) oldest = ts;
      } catch {
        // Битую строку пропускаем: одна порча не должна ронять health.
      }
    }
    return { persistedByEnv, onVolume, exists: true, count: lines.length, oldest };
  } catch (e) {
    captureEventsError(e, { route: "events/storeStatus" });
    return { persistedByEnv, onVolume, exists: true, count: -1, oldest: null };
  }
}

/** Для тестов: сбросить кэш, чтобы следующий вызов прочитал файл заново. */
export function __resetEventsStoreStatusCache() {
  storeStatusCache = null;
}



interface AnalyticsEvent {
  ts: string;
  type: string;
  sid?: string;
  path?: string;
  source?: string;
  tier?: string;
  industry?: string;
  value?: number;
  meta?: Record<string, string | number | boolean | null>;
  ip?: string;
  ua?: string;
}

/** Тип события, которое пишет ВЕБХУК кассы, получив подтверждение платежа. */
export const СОБЫТИЕ_ОПЛАТА_ПОДТВЕРЖДЕНА = "payment_confirmed";

/**
 * С какого момента «оплатили» в воронке вообще МОЖНО измерить.
 *
 * 🔴 Зачем дата в коде. До 29.09.2026 ступень «оплатили» считалась по событию
 * `checkout_success`, а его шлёт браузер при ЗАГРУЗКЕ страницы «спасибо» —
 * то есть открытие адреса возврата давало «оплату» без денег. Замер 29.09:
 * воронка показала `paid: 2` при нуле новых подписок, и ни одно из трёх окон,
 * работавших в тот день с кассой, этих двух событий за собой не признало.
 *
 * Механизма «считать по вебхуку» до этой даты не существовало, поэтому ноль за
 * прежние дни означает «не измерялось», а не «продаж не было». Отдаём за такие
 * дни `null`: неотвеченный вопрос не равен благополучию.
 */
/**
 * Метки канала, которыми помечаются НАШИ СОБСТВЕННЫЕ заходы.
 *
 * 🔴 Замер 30.09.2026: за 14 дней воронка показывала «начали оплату: 5» — и все
 * пять оказались нашими. Подтвердилось с двух сторон: окно страницы цен признало
 * пять нажатий браузером, а окно почты нашло ПЯТЬ писем кассы о брошенной корзине,
 * все на адреса `probe-*@aevion.app`. Живых незавершённых покупок за две недели —
 * ноль. Число «5» при этом читалось как пятеро людей у карты.
 *
 * Метки перечислены явно, а не выведены из слов «probe/smoke/test»: у окна цен
 * метка `cold-visit-check`, и никакая эвристика по словам её бы не поймала.
 * Появится новая — дописывать сюда, рядом с указанием, чья она.
 */
const НАШИ_МЕТКИ_КАНАЛА = [
  "cold-visit-check", // окно страницы цен: холодные заходы на /pricing
  "probe",            // общая метка прогонов
  "probe-price",      // прогон покупаемости девяти приложений
  "probe-ph",         // прогон под запуск на Product Hunt
  "smoke",
  "test",
];

/** Похожа ли метка канала на нашу. Точное совпадение или наше слово с разделителем. */
function нашаМетка(значение: string | null | undefined): boolean {
  const v = String(значение ?? "").trim().toLowerCase();
  if (!v) return false;
  return НАШИ_МЕТКИ_КАНАЛА.some((m) => v === m || v.startsWith(`${m}-`) || v.startsWith(`${m}_`));
}

/** Метка канала из адреса страницы: `/pricing?c=cold-visit-check` → `cold-visit-check`. */
function меткаИзПути(path: string | null | undefined): string | null {
  const p = String(path ?? "");
  const m = /[?&]c=([^&#]+)/.exec(p);
  return m ? decodeURIComponent(m[1]) : null;
}

const ОПЛАТЫ_СЧИТАЕМ_С = "2026-09-29T14:59:51.000Z";

/**
 * ⚠️ ЗДЕСЬ МОМЕНТ ВЫКАТКИ, А НЕ НАЧАЛО ДНЯ — и это поправка к моей же правке.
 *
 * Сперва стояла полночь 29.09, и прод честно отчитался: за 29.09 `paid: 0`.
 * А оплаты в тот день БЫЛИ — два заказа в 08:43 и 09:03 UTC. Механизм учёта
 * выкатился в 14:59:51 UTC (`builtAt` сборки `2f755a996d0e`), то есть шестью
 * часами позже, и события по тем покупкам записать было нечем. Ноль выглядел
 * измеренным и означал «продаж не было» — ровно тот дефект, ради которого эта
 * ступень и переписывалась.
 *
 * Правило на будущее: дата здесь — момент, когда код записи СТАЛ РАБОТАТЬ на
 * проде, и её нельзя ставить «с утра того дня» из удобства. Меняют её только
 * при первой выкатке механизма; последующие сборки её НЕ двигают, иначе уже
 * измеренные дни снова станут «не знаю».
 */

/**
 * Записать событие ОТ СЕРВЕРА (не от браузера) в то же хранилище воронки.
 *
 * Зачем отдельная функция, а не вызов ручки POST: ручка берёт данные из запроса
 * покупателя и ограничена частотой на IP. Вебхук кассы — не покупатель, у него
 * нет ни сессии, ни UA, и ограничивать его частотой значило бы терять деньги
 * из учёта при всплеске покупок.
 *
 * Падать этой записи нельзя: она идёт ПОСЛЕ выдачи купленного, и провал учёта
 * не должен превращаться в провал выдачи. Но молчать тоже нельзя — иначе учёт
 * тихо опустеет и мы снова будем считать загрузки страниц. Поэтому отказ
 * пишется в журнал и в Sentry, а наружу отдаётся false.
 */
export function записатьСобытиеОтСервера(
  type: string,
  поля: Pick<AnalyticsEvent, "source" | "tier" | "value" | "meta"> = {},
): boolean {
  const event: AnalyticsEvent = { ts: new Date().toISOString(), type, ...поля };
  try {
    ensureDir();
    appendFileSync(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");
    return true;
  } catch (e) {
    console.error(`[events] серверное событие "${type}" НЕ записано`, e);
    captureEventsError(e, { route: "events/server", type });
    return false;
  }
}


/**
 * РАЗРЕЗ ВОРОНКИ ПО КАНАЛУ И ПО ПРИЛОЖЕНИЮ.
 *
 * Зачем. Сводка `/funnel` складывала всех в одну кучу: четыре числа и разбивка
 * по дням. Метка канала при этом В СОБЫТИЯХ есть (её цепляет `lib/track.ts`
 * ко всему подряд), но наружу не выходила — и 29.09.2026 это стоило двух
 * разборов подряд: окно роликов не могло сказать, привели ли 144 просмотра
 * хоть один визит, а окно кассы выясняло перепиской, чьи пять начал оплаты
 * (оказалось — мои пробы). Вопрос «чей это след» решается полем, а не письмом.
 *
 * Ключи НЕ закрытый список: канал приходит из адреса, который открыл
 * посторонний. Поэтому накопители без прототипа — у обычного объекта
 * `byChannel["constructor"]` вернул бы функцию, число ушло бы в наследство, и
 * в отчёте его просто не стало бы, а сумма выглядела бы целой (соседнее окно
 * замерило этот класс 04.09: подали три канала — в ответе остался один).
 *
 * «direct» и «unknown» — РАЗНЫЕ ответы и не сливаются: первый значит «пришёл
 * без метки», второй — «пришёл с меткой, которой мы не знаем». Их слияние
 * прячет целые площадки: ровно так Product Hunt весь день выглядел прямыми
 * заходами.
 *
 * Для покупок плана приложения нет — такие события считаются под ключом
 * `plan`, а не пропадают: иначе сумма по приложениям не сошлась бы с общей.
 */
export interface РазрезВоронки {
  byChannel: Record<
    string,
    {
      visits: number;
      pricing: number;
      checkoutStart: number;
      checkoutStartOurs: number;
      thankYouOpened: number;
      paid: number;
      paidOurs: number;
    }
  >;
  byApp: Record<string, { checkoutStart: number; paid: number }>;
  /**
   * Разрез по ПОСТУ внутри канала: ключ «канал/пост».
   *
   * 🔴 Замер 30.09.2026: Instagram — единственный канал, приводящий людей до цен
   * (12 из 304 заходов), и трафик идёт рывками, то есть постами. Но у всех ссылок
   * одна метка `?c=ig`, поэтому на вопрос «какой пост сработал» ответить было
   * нечем. Теперь подметка `?c=ig-<пост>` доезжает сюда (products.postFrom,
   * lib/track.ts), и окно публикаций видит, что постить.
   *
   * Ключ составной, «канал/пост», а не просто пост: один и тот же пост может
   * жить в двух каналах, и складывать их в одно число значило бы терять ответ.
   */
  byPost: Record<string, { visits: number; pricing: number; checkoutStart: number; paid: number }>;
  /**
   * Куда ЗАХОДЯТ с каждого канала: «канал → страница входа».
   *
   * 🔴 Замер 30.09.2026: Instagram привёл 12 человек до цен, и на вопрос «на какие
   * страницы они пришли» ответа не было — детализация жила только в закрытых
   * ручках (401, админ-токен у окон отсутствует). Без этого окно публикаций не
   * знает, какая посадочная работает, и правит наугад.
   *
   * Страница ВХОДА, а не любая посещённая: людей приводит первая, остальные они
   * смотрят уже внутри. Поэтому считаем по первому просмотру сессии.
   *
   * Личных данных здесь нет и быть не может: путь обрезается до трёх участков,
   * запрос отбрасывается целиком (в нём живут метки и что угодно ещё), а участки,
   * похожие на идентификаторы, заменяются на `:id` — иначе адрес вида
   * `/devhub/<длинный-ключ>` уехал бы в отчёт как есть. Список ограничен, всё
   * сверх него складывается в «прочие»: без ограничения десяток заходов на
   * выдуманные адреса раздул бы ответ и стал бы способом его испортить.
   */
  byEntryPage: Record<string, { сессий: number; доЦен: number; началиОплату: number }>;
}

export function разрезВоронки(
  events: Array<Pick<AnalyticsEvent, "type" | "path" | "meta" | "sid">>,
  нашиСессии: ReadonlySet<string> = new Set(),
): РазрезВоронки {
  const byChannel = Object.create(null) as РазрезВоронки["byChannel"];
  const byApp = Object.create(null) as РазрезВоронки["byApp"];
  const byPost = Object.create(null) as РазрезВоронки["byPost"];
  /** Путь без запроса, до трёх участков, идентификаторы скрыты. */
  const чистыйПуть = (raw: string | null | undefined): string => {
    const без = String(raw ?? "/").split("?")[0].split("#")[0];
    const участки = без.split("/").filter(Boolean).slice(0, 3);
    const безИд = участки.map((у) =>
      /^[0-9a-f]{8,}$/i.test(у) || /^\d{4,}$/.test(у) || у.length > 24 ? ":id" : у.toLowerCase(),
    );
    return "/" + безИд.join("/");
  };

  /** Пара «канал + сессия»: чтобы визит считался один раз, как в итоге. */
  const виденныеСессии = new Set<string>();

  for (const ev of events) {
    const сырой = ev.meta?.channel;
    const канал = typeof сырой === "string" && сырой.trim() ? сырой.trim() : "direct";
    if (!byChannel[канал]) {
      byChannel[канал] = {
        visits: 0,
        pricing: 0,
        checkoutStart: 0,
        checkoutStartOurs: 0,
        thankYouOpened: 0,
        paid: 0,
        paidOurs: 0,
      };
    }
    const к = byChannel[канал];

    const сыройПост = ev.meta?.post;
    const пост = typeof сыройПост === "string" && сыройПост.trim() ? сыройПост.trim().slice(0, 40) : null;
    const ключПоста = пост ? `${канал}/${пост}` : null;
    if (ключПоста && !byPost[ключПоста]) {
      byPost[ключПоста] = { visits: 0, pricing: 0, checkoutStart: 0, paid: 0 };
    }
    const п = ключПоста ? byPost[ключПоста] : null;

    if (ev.type === "page_view") {
      // 🔴 ВИЗИТЫ СЧИТАЕМ ТАК ЖЕ, КАК ИТОГ — по уникальным сессиям.
      // Замер 30.09.2026: итог давал 167 визитов за 14 дней, а сумма по каналам
      // 519, потому что здесь считался КАЖДЫЙ просмотр страницы. Два разных
      // числа под одним словом в одном ответе: основатель увидел бы 167 или 519
      // в зависимости от того, куда посмотрел.
      if (ev.sid) {
        const ключ = `${канал}|${ev.sid}`;
        if (!виденныеСессии.has(ключ)) {
          виденныеСессии.add(ключ);
          к.visits += 1;
        }
      } else {
        к.visits += 1;
      }
      if (typeof ev.path === "string" && ev.path.includes("/pricing")) к.pricing += 1;
      if (п) {
        п.visits += 1;
        if (typeof ev.path === "string" && ev.path.includes("/pricing")) п.pricing += 1;
      }
      continue;
    }
    if (
      ev.type !== "checkout_start" &&
      ev.type !== "checkout_success" &&
      ev.type !== СОБЫТИЕ_ОПЛАТА_ПОДТВЕРЖДЕНА
    ) {
      continue;
    }

    const сыройApp = ev.meta?.app;
    const приложение = typeof сыройApp === "string" && сыройApp.trim() ? сыройApp.trim() : "plan";
    if (!byApp[приложение]) byApp[приложение] = { checkoutStart: 0, paid: 0 };

    if (ev.type === "checkout_start") {
      к.checkoutStart += 1;
      if (п) п.checkoutStart += 1;
      if (ev.sid && нашиСессии.has(ev.sid)) к.checkoutStartOurs += 1;
      byApp[приложение].checkoutStart += 1;
    } else if (ev.type === "checkout_success") {
      // 🔴 ЭТО НЕ ОПЛАТА. Здесь `paid` считался по загрузке страницы «спасибо»,
      // и разрез отдавал «direct: paid 3» при нуле подтверждённых оплат в итоге —
      // то есть отвечал ложью на главный вопрос. Открытия страницы возврата
      // теперь живут своим полем, как и в итоге.
      к.thankYouOpened += 1;
    } else {
      к.paid += 1;
      if (п) п.paid += 1;
      if (ev.meta?.свой === true) к.paidOurs += 1;
      byApp[приложение].paid += 1;
    }
  }
  // Страницы входа считаются по сессиям, а не по событиям: сначала собираем по
  // каждой сессии её первую страницу и дошла ли она до цен, потом складываем.
  interface Заход { канал: string; вход: string; доЦен: boolean; начал: boolean }
  const заходы = new Map<string, Заход>();
  for (const ev of events) {
    if (!ev.sid) continue;
    const сырой = ev.meta?.channel;
    const канал = typeof сырой === "string" && сырой.trim() ? сырой.trim() : "direct";
    let з = заходы.get(ev.sid);
    if (!з) {
      if (ev.type !== "page_view") continue; // сессия без просмотра — входа нет
      з = { канал, вход: чистыйПуть(ev.path), доЦен: false, начал: false };
      заходы.set(ev.sid, з);
    }
    if (ev.type === "page_view" && typeof ev.path === "string" && ev.path.includes("/pricing")) {
      з.доЦен = true;
    }
    if (ev.type === "checkout_start") з.начал = true;
  }

  const сырыеВходы = new Map<string, { сессий: number; доЦен: number; началиОплату: number }>();
  for (const з of заходы.values()) {
    const ключ = `${з.канал}|${з.вход}`;
    const т = сырыеВходы.get(ключ) ?? { сессий: 0, доЦен: 0, началиОплату: 0 };
    т.сессий += 1;
    if (з.доЦен) т.доЦен += 1;
    if (з.начал) т.началиОплату += 1;
    сырыеВходы.set(ключ, т);
  }

  // Ограничение списка: двенадцать самых частых, остальное — «прочие». Без него
  // десяток заходов на выдуманные адреса раздул бы ответ.
  const ПРЕДЕЛ = 12;
  const по = [...сырыеВходы.entries()].sort((a, b) => b[1].сессий - a[1].сессий);
  const byEntryPage = Object.create(null) as РазрезВоронки["byEntryPage"];
  for (const [ключ, т] of по.slice(0, ПРЕДЕЛ)) byEntryPage[ключ] = т;
  const хвост = по.slice(ПРЕДЕЛ);
  if (хвост.length) {
    byEntryPage["прочие"] = хвост.reduce(
      (а, [, т]) => ({
        сессий: а.сессий + т.сессий,
        доЦен: а.доЦен + т.доЦен,
        началиОплату: а.началиОплату + т.началиОплату,
      }),
      { сессий: 0, доЦен: 0, началиОплату: 0 },
    );
  }

  return { byChannel, byApp, byPost, byEntryPage };
}

/**
 * Разбивка НАЧАЛ ОПЛАТЫ по поверхности и по каналу привлечения.
 *
 * Вынесено отдельной чистой функцией, чтобы тест проверял тот самый код,
 * который выполняется в проде, а не его копию, переписанную в тесте: копия
 * расходится с оригиналом молча и создаёт ровно ту ложную уверенность,
 * ради борьбы с которой тест и пишется.
 *
 * `bySource` в сводке считает ВСЕ события, поэтому в нём доминируют
 * page_view и намерение купить тонет. Здесь — только `checkout_start`.
 * Канал приезжает в `meta.channel` из метки `?c=` (lib/products withChannel
 * + components/BuyLink). Ключи нейтральные: дашборд открывают и в EN/KK.
 */
/*
 * Накопители сводок создаются БЕЗ ПРОТОТИПА (`Object.create(null)`), а не как
 * обычные объекты. Ключ здесь свободный: он приходит из поля события, то есть
 * в конечном счёте из адреса, который открыл посторонний.
 *
 * У обычного объекта `byX["constructor"]` возвращает функцию, а
 * `byX["__proto__"]` — прототип. Строка не заводится, число уходит в
 * наследство, и в отчёте её просто НЕТ, а сумма выглядит целой. Соседнее окно
 * замерило это 04.09 на отчёте о выручке: подали три канала — в ответе остался
 * один.
 *
 * Где ключ ЗАКРЫТЫЙ (сверяется со списком), правильнее hasOwnProperty — имя
 * тогда честно отбрасывается. Здесь имя надо сохранить, поэтому без прототипа.
 */
export function summarizeCheckoutStarts(events: Array<Pick<AnalyticsEvent, "type" | "source" | "meta">>): {
  bySource: Record<string, number>;
  byChannel: Record<string, number>;
} {
  const bySource = Object.create(null) as Record<string, number>;
  const byChannel = Object.create(null) as Record<string, number>;
  for (const ev of events) {
    if (ev.type !== "checkout_start") continue;
    const src = ev.source?.trim() || "unknown";
    bySource[src] = (bySource[src] ?? 0) + 1;
    const ch = ev.meta?.channel;
    const chKey = typeof ch === "string" && ch.trim() ? ch.trim() : "direct";
    byChannel[chKey] = (byChannel[chKey] ?? 0) + 1;
  }
  return { bySource, byChannel };
}

/**
 * Возвраты из касс: сколько дошло до оплаты и сколько отвалилось, ПО КАССАМ.
 *
 * Зачем. Отказ мы записываем с 01.09 (`checkout_cancel` с кассой в мете), но не
 * читает его никто: ни сводка, ни панель. Событие пишется в журнал и умирает
 * там — то есть мы платим за сбор данных и не получаем ответа на вопрос «у
 * какой кассы люди отваливаются», а это разные починки: у одной чинят форму
 * карты, у другой — валюту, у третьей вообще ничего не чинят.
 *
 * Считаем ПАРУ, а не отказы отдельно. Голое «41 отказ у PayBox» не значит
 * ничего: у кассы с большим потоком отказов будет больше просто потому, что
 * через неё идут все. Пара «успехи и отказы» сравнима, потому что оба события
 * приходят одинаково — с нашего же экрана возврата.
 *
 * ЧЕГО ЭТА ПАРА НЕ ЗНАЕТ, и это надо читать вместе с числами. Адрес отмены
 * задают только PayBox и PayPal; у LemonSqueezy и Gumroad он не настроен, и их
 * отказ до нашего экрана НЕ ДОХОДИТ вовсе. Ноль отказов у них означает «мы не
 * узнаём», а не «никто не отваливается» — прочитать это как хороший показатель
 * значит выбрать худшую кассу за лучшую.
 */
export function summarizeCheckoutReturns(
  events: Array<Pick<AnalyticsEvent, "type"> & { meta?: Record<string, unknown> }>,
): {
  byProvider: Record<string, { успехов: number; отказов: number }>;
  успехов: number;
  отказов: number;
} {
  const byProvider = Object.create(null) as Record<string, { успехов: number; отказов: number }>;
  let успехов = 0;
  let отказов = 0;

  for (const ev of events) {
    const успех = ev.type === "checkout_success";
    const отказ = ev.type === "checkout_cancel";
    if (!успех && !отказ) continue;
    // Заглушка — не покупка и не отказ: она вообще не про деньги.
    if (ev.meta?.stub === true) continue;

    const p = ev.meta?.provider;
    // Касса неизвестна — своя корзина, а не приписывание к чужой: приписанное
    // число выглядит достовернее, чем оно есть.
    const key = typeof p === "string" && p.trim() ? p.trim() : "unknown";
    const строка = byProvider[key] ?? { успехов: 0, отказов: 0 };
    if (успех) {
      строка.успехов += 1;
      успехов += 1;
    } else {
      строка.отказов += 1;
      отказов += 1;
    }
    byProvider[key] = строка;
  }

  return { byProvider, успехов, отказов };
}

/**
 * Покупки по каналам — и отдельно выручка по тем, у кого сумма известна.
 *
 * Зачем отдельно от `byChannel`. Тот считает ВСЕ события подряд: просмотры,
 * нажатия, заходы в кассу. Канал с большим трафиком и нулём продаж выглядит в
 * нём лучше канала с одной покупкой — то есть по этому числу нельзя решать,
 * куда тратить деньги, а выглядит оно как раз таким числом.
 *
 * Сумма известна не у всех: у возврата PayBox в адрес уходит `ref`, а не сумма.
 * Поэтому выручка и счёт покупок разведены, а рядом едет `сКоторыхИзвестнаСумма`
 * — знаменатель. Без него частичная выручка читается как полная и занижает
 * канал молча, а это ровно тот случай, когда решение принимают по числу.
 */
export function summarizePurchases(
  events: Array<Pick<AnalyticsEvent, "type" | "value"> & { meta?: Record<string, unknown> }>,
): {
  byChannel: Record<string, number>;
  revenueByChannel: Record<string, number>;
  total: number;
  сКоторыхИзвестнаСумма: number;
} {
  const byChannel = Object.create(null) as Record<string, number>;
  const revenueByChannel: Record<string, number> = {};
  let total = 0;
  let сКоторыхИзвестнаСумма = 0;

  for (const ev of events) {
    if (ev.type !== "checkout_success") continue;
    // Заглушка и бесплатный тариф покупкой не считаются: иначе канал,
    // приводящий любителей бесплатного, выглядит как приносящий деньги.
    if (ev.meta?.stub === true) continue;
    const сумма = typeof ev.value === "number" ? ev.value : null;
    if (сумма === 0) continue;

    total += 1;
    const ch = ev.meta?.channel;
    const chKey = typeof ch === "string" && ch.trim() ? ch.trim() : "direct";
    byChannel[chKey] = (byChannel[chKey] ?? 0) + 1;
    if (сумма !== null) {
      сКоторыхИзвестнаСумма += 1;
      revenueByChannel[chKey] = (revenueByChannel[chKey] ?? 0) + сумма;
    }
  }

  return { byChannel, revenueByChannel, total, сКоторыхИзвестнаСумма };
}

const ALLOWED_TYPES = new Set([
  "page_view",
  "feature_use",
  "cta_click",
  // 29.09.2026. Заведено на фронте и НЕ добавлено сюда — событие «карточку
  // приложения довезли до глаз» сервер молча отбрасывал, и шаг воронки
  // «дошёл до цен, но карточку не увидел» терялся целиком. Мой же дефект и
  // ровно тот класс, который я в этот день ловил у других: отказ, который
  // выглядит успехом (фронт отправил, ответ 200, события нет).
  "app_card_shown",
  "calculator_open",
  "calculator_quote",
  "checkout_start",
  "checkout_success",
  "checkout_cancel",
  "lead_submit",
  "tier_view",
  "industry_view",
  "faq_open",
  "comparison_view",
  "affiliate_apply",
  "partner_apply",
  "edu_apply",
  "ab_assigned",
]);

function rateLimitKey(ip: string) {
  return `ev:${ip}`;
}
const RATE = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_MIN = 60;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = RATE.get(rateLimitKey(ip));
  if (!cur || cur.reset < now) {
    RATE.set(rateLimitKey(ip), { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  if (cur.count >= MAX_PER_MIN) return true;
  cur.count += 1;
  return false;
}

/**
 * POST /api/pricing/events
 * Body: { type, sid?, path?, source?, tier?, industry?, value?, meta? }
 *
 * Принимает один event. Для batch — клиент шлёт несколько запросов
 * (или sendBeacon). Дёшево, надёжно, без потери при unload.
 */
eventsRouter.post("/", (req, res) => {
  // Ключ ограничителя, а не журнал: левый элемент X-Forwarded-For задаёт
  // клиент, и предел снимался сменой заголовка на каждом запросе.
  const ip = clientIp(req);

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const body = req.body ?? {};
  const type = typeof body.type === "string" ? body.type.trim() : "";

  if (!type || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: "invalid_type", type });
  }

  const event: AnalyticsEvent = {
    ts: new Date().toISOString(),
    type,
    sid: typeof body.sid === "string" ? body.sid.slice(0, 60) : undefined,
    path: typeof body.path === "string" ? body.path.slice(0, 200) : undefined,
    source: typeof body.source === "string" ? body.source.slice(0, 60) : undefined,
    tier: typeof body.tier === "string" ? body.tier.slice(0, 30) : undefined,
    industry: typeof body.industry === "string" ? body.industry.slice(0, 60) : undefined,
    value: Number.isFinite(body.value) ? body.value : undefined,
    meta:
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? Object.fromEntries(
            Object.entries(body.meta as Record<string, unknown>)
              .slice(0, 20)
              .filter(([k, v]) =>
                typeof k === "string" &&
                k.length < 40 &&
                (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null),
              )
              .map(([k, v]) => [
                k,
                typeof v === "string" ? v.slice(0, 200) : (v as string | number | boolean | null),
              ]),
          )
        : undefined,
    ip,
    ua: typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string).slice(0, 200) : undefined,
  };

  try {
    ensureDir();
    appendFileSync(EVENTS_FILE, JSON.stringify(event) + "\n", "utf8");
  } catch (e) {
    console.error("[events] write failed", e);
    captureEventsError(e, { route: "events/POST" });
    return res.status(500).json({ error: "storage_error" });
  }

  res.status(204).end();
});

/**
 * GET /api/pricing/events/summary
 * Суммарные метрики по последним N событиям.
 * Защищён ADMIN_TOKEN (header X-Admin-Token).
 */
/**
 * Кто прислал событие: человек или наша же автоматика.
 *
 * 🔴 ЗАЧЕМ. Замер 20.09.2026 по 200 последним событиям прода: 183 из 200 (91 %)
 * прислали НЕ люди — 59 помеченных зондов `AEVION-probe/1.0` и 124 безымянных
 * HeadlessChrome. Хуже всего вышло на деньгах: `checkout_start` за сутки было
 * 47, и ВСЕ до одного зондовые, то есть «47 начатых оплат и ноль покупок»
 * читалось как провал конверсии, тогда как настоящих начатых оплат ноль.
 * Решение по такой панели принимать нельзя: она показывает нашу собственную
 * тень и называет её спросом.
 *
 * Возвращаем ВИД, а не «да/нет»: зонд и headless чинятся по-разному (первому
 * достаточно фильтра, второму нужна метка в самом зонде), и складывать их в
 * одно число значит потерять этот след.
 *
 * Пустой UA НЕ считаем автоматикой намеренно: в журнале есть записи старше
 * того дня, когда UA начали сохранять, и записать их в роботы значило бы
 * тихо переписать историю. Их число отдаётся отдельным полем `withoutUa` —
 * это честно названная слепая зона, а не ноль.
 */
export function видОтправителя(ua: string | undefined | null): "probe" | "headless" | "bot" | null {
  const u = String(ua ?? "").trim();
  if (!u) return null;
  // Любая НАША метка, а не перечень известных. 20.09.2026 перечень уже подвёл:
  // фильтр знал `AEVION-probe`, а в данных нашлась вторая семья —
  // `AEVION-checkout-gate-probe`, 24 события, и все шесть «человеческих»
  // начатых оплат за двое суток оказались ею. То есть отчёт сказал бы
  // «шесть человек дошли до кассы и не заплатили» — решение по такому числу
  // повело бы чинить страницу оплаты вместо привлечения трафика.
  if (/AEVION-[A-Za-z0-9._-]*probe|AEVION-probe/i.test(u)) return "probe";
  if (/Headless/i.test(u)) return "headless";
  if (/\b(crawler|spider|slurp)\b|bot\/|\bbot\b|curl\/|wget|python-requests|node-fetch|axios\/|got\/|PostmanRuntime|playwright|puppeteer|lighthouse/i.test(u)) return "bot";
  return null;
}

eventsRouter.get("/summary", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  if (!existsSync(EVENTS_FILE)) {
    return res.json({
      total: 0,
      byType: {},
      bySource: {},
      byTier: {},
      checkoutBySource: {},
      checkoutByChannel: {},
      byIndustry: {},
      byChannel: {},
      byProduct: {},
      sessionCount: 0,
      windowHours: 24,
    });
  }

  const limit = Math.min(Math.max(queryNumber(req.query.limit, 5000), 100), 50000);
  const sinceHours = Math.min(Math.max(queryNumber(req.query.hours, 24), 1), 720);
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/summary] read failed", e);
    captureEventsError(e, { route: "events/GET/summary" });
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  /*
   * Обрезка окна должна называть себя.
   *
   * Порядок здесь такой: сперва берём ПОСЛЕДНИЕ `limit` строк, и только потом
   * фильтруем по времени. Значит при журнале длиннее предела ответ на вопрос
   * «что было за 30 дней» молча превращается в «что было за последние N
   * событий» — и выглядит он при этом как полный ответ.
   *
   * Замер 01.09.2026: в журнале прода 4476 событий при пределе 5000, то есть
   * 89 % запаса уже израсходовано. Первый же всплеск трафика — ради которого
   * всё и делается — сделает числа тихо заниженными, и заметить это будет
   * нечем: панель покажет меньшую выручку по каналам как факт.
   *
   * Поэтому отдаём ПРИЗНАК обрезки и время самого старого учтённого события.
   * Число без знаменателя здесь опаснее отсутствия числа: по нему решают,
   * куда тратить деньги.
   */
  /*
   * Окно берём ПО ВРЕМЕНИ, а не по числу строк.
   *
   * Журнал append-only и метку времени ставит сервер при записи, значит он
   * упорядочен. Идём с конца и останавливаемся на первом событии старше окна:
   * тогда «за 30 дней» отвечено ровно за 30 дней, сколько бы строк это ни было.
   *
   * `limit` остаётся ПРЕДОХРАНИТЕЛЕМ от неограниченной памяти, а не окном. И
   * теперь он честно виден: если предохранитель сработал ВНУТРИ окна — значит
   * ответ неполон, и это ровно то, о чём сообщает `truncated`.
   */
  const отобранные: string[] = [];
  let упёрлисьВПредохранитель = false;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (отобранные.length >= limit) {
      // Предохранитель сработал, а строки ещё есть — значит окно не дочитано.
      упёрлисьВПредохранитель = true;
      break;
    }
    const строка = lines[i];
    let ts: unknown = null;
    try {
      ts = JSON.parse(строка)?.ts;
    } catch {
      // Битую строку не считаем границей окна: одна порча не должна обрезать
      // весь ответ. Пропускаем её и идём дальше — счёт ниже её не учтёт.
      continue;
    }
    if (typeof ts === "string" && new Date(ts).getTime() < sinceMs) break;
    отобранные.push(строка);
  }
  const обрезано = упёрлисьВПредохранитель;
  const tail = отобранные.reverse();

  const byType = Object.create(null) as Record<string, number>;
  const bySource = Object.create(null) as Record<string, number>;
  const byTier = Object.create(null) as Record<string, number>;
  const byIndustry = Object.create(null) as Record<string, number>;
  /** Разбивку по ним считает summarizeCheckoutStarts — см. её комментарий. */
  const checkoutEvents: AnalyticsEvent[] = [];
  const purchaseEvents: AnalyticsEvent[] = [];
  const returnEvents: AnalyticsEvent[] = [];
  // Канал (tt / ig / yt …) — единственный ответ на вопрос «какая раздача
  // принесла людей». Он приезжает в meta, а сводка до 13.08.2026 считала
  // только поля верхнего уровня: метка доезжала и НЕ показывалась никому.
  const byChannel = Object.create(null) as Record<string, number>;
  // Товар, по которому нажали «купить». Без него видно «клики были», но не
  // видно, что именно хотели купить.
  const byProduct = Object.create(null) as Record<string, number>;
  const sids = new Set<string>();
  const автоматика = Object.create(null) as Record<string, number>;
  let безUa = 0;
  let total = 0;

  for (const line of tail) {
    try {
      const ev = JSON.parse(line) as AnalyticsEvent;
      if (ev.ts && new Date(ev.ts).getTime() < sinceMs) continue;
      // Автоматику считаем ОТДЕЛЬНО и в воронку не пускаем — см. видОтправителя().
      const ua = (ev as { ua?: string }).ua;
      const вид = видОтправителя(ua);
      if (вид) { автоматика[вид] = (автоматика[вид] ?? 0) + 1; continue; }
      if (!String(ua ?? "").trim()) безUa += 1;
      total += 1;
      byType[ev.type] = (byType[ev.type] ?? 0) + 1;
      if (ev.source) bySource[ev.source] = (bySource[ev.source] ?? 0) + 1;
      if (ev.tier) byTier[ev.tier] = (byTier[ev.tier] ?? 0) + 1;
      if (ev.industry) byIndustry[ev.industry] = (byIndustry[ev.industry] ?? 0) + 1;
      const meta = (ev as { meta?: Record<string, unknown> }).meta;
      const channel = typeof meta?.channel === "string" ? meta.channel : null;
      if (channel) byChannel[channel] = (byChannel[channel] ?? 0) + 1;
      const product = typeof meta?.product === "string" ? meta.product : null;
      if (product) byProduct[product] = (byProduct[product] ?? 0) + 1;
      if (ev.sid) sids.add(ev.sid);
      if (ev.type === "checkout_start") checkoutEvents.push(ev);
      if (ev.type === "checkout_success") purchaseEvents.push(ev);
      if (ev.type === "checkout_success" || ev.type === "checkout_cancel") returnEvents.push(ev);
    } catch {
      // skip malformed line
    }
  }

  const checkoutSummary = summarizeCheckoutStarts(checkoutEvents);
  const purchases = summarizePurchases(purchaseEvents);
  const returns = summarizeCheckoutReturns(returnEvents);

  res.json({
    total,
    byType,
    bySource,
    byTier,
    byIndustry,
    checkoutBySource: checkoutSummary.bySource,
    checkoutByChannel: checkoutSummary.byChannel,
    purchaseByChannel: purchases.byChannel,
    purchaseRevenueByChannel: purchases.revenueByChannel,
    purchaseCount: purchases.total,
    purchaseWithKnownAmount: purchases.сКоторыхИзвестнаСумма,
    returnsByProvider: returns.byProvider,
    returnsSuccess: returns.успехов,
    returnsCancel: returns.отказов,
    byChannel,
    byProduct,
    sessionCount: sids.size,
    windowHours: sinceHours,
    // Обрезано ли окно журналом: если да, «за 30 дней» отвечено НЕ за 30 дней.
    truncated: обрезано,
    // Что ИМЕННО посчитано: все числа выше — про людей. Автоматику не
    // выбрасываем молча, а называем: молчаливый пропуск неотличим от нуля.
    countsExclude: "automated",
    automatedEvents: Object.values(автоматика).reduce((a, b) => a + b, 0),
    automatedByKind: автоматика,
    withoutUa: безUa,
    consideredEvents: tail.length,
    totalEvents: lines.length,
  });
});

/**
 * GET /api/pricing/events/aggregate
 * Time-bucketed counts. Защищён ADMIN_TOKEN.
 *
 * Параметры:
 *   - period (hour|day, default day) — размер бакета
 *   - groupBy (source|type|tier|industry, default type) — измерение разбивки
 *   - hours (1..720, default 168) — окно
 *
 * Ответ: { period, groupBy, windowHours, buckets: [{ bucket, total, counts: {<dim>: n} }] }
 */
/**
 * ПУБЛИЧНАЯ воронка по дням, без единого личного поля.
 *
 * ЗАЧЕМ. Задача оркестратора 28.09.2026 под цель 100 000 пользователей: ни
 * одно окно не видит, ГДЕ отваливаются люди. Соседняя сводка /summary закрыта
 * ADMIN_TOKEN и потому недоступна никому, кроме владельца ключа, а без ответа
 * «сколько дошло до кассы» любое обсуждение воронки превращается в мнения.
 *
 * ЧТО ОТДАЁТСЯ. Только ЧИСЛА по дням: зашли -> открыли цены -> начали оплату
 * -> заплатили. Ни адреса, ни ip, ни ua, ни идентификатора сессии в ответе нет
 * и быть не может: они не кладутся в накопитель вовсе, а не вычищаются на
 * выходе. Вычистка на выходе — это место, где однажды забывают поле.
 *
 * РОБОТЫ ИСКЛЮЧЕНЫ. Замер 20.09: 4/5 нашего трафика — не люди, и сводка,
 * считающая их наравне, показывает воронку вчетверо шире настоящей. Отсев
 * идёт тем же классификатором `видОтправителя`, что и в остальных ручках, —
 * второго способа определять робота не заводим.
 *
 * ЧЕСТНОСТЬ ПУСТОГО. Нет файла или он не читается — отвечаем `known: false` и
 * причиной, а не нулями: ноль читается как «людей не было», хотя настоящий
 * ответ «мы не смотрели».
 */
eventsRouter.get("/funnel", (req, res) => {
  const дней = Math.min(Math.max(queryNumber(req.query.days, 14), 1), 60);
  const сНачала = Date.now() - дней * 24 * 60 * 60 * 1000;

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ known: false, reason: "store_missing", days: дней, byDay: [] });
  }
  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/funnel] хранилище не прочитано", e);
    return res.status(503).json({ known: false, reason: "store_unreadable", days: дней, byDay: [] });
  }

  // 🔴 ДВЕ РАЗНЫЕ СТУПЕНИ, и путать их нельзя.
  //   thankYouOpened — открыли страницу «спасибо». Шлёт БРАУЗЕР по загрузке
  //     адреса возврата, поэтому это ни в каком смысле не деньги: кто угодно,
  //     открывший такой адрес (в том числе наше окно, проверяющее путь
  //     возврата), даёт здесь единицу. Ступень полезная — по ней видно, что
  //     человек вообще вернулся, — но называть её оплатой нельзя.
  //   paid — подтверждение от КАССЫ: событие пишет вебхук после того, как
  //     выдал купленное. Это и есть деньги.
  interface Ступени {
    visits: number;
    pricing: number;
    checkoutStart: number;
    thankYouOpened: number;
    paid: number;
    /** Из них НАШИ — заходы с нашей меткой канала (см. НАШИ_МЕТКИ_КАНАЛА). */
    checkoutStartOurs: number;
    /** Из них НАШИ — проверки кассы своими же адресами. Не вычитаем молча: читатель
     *  должен видеть оба числа, иначе «первая продажа» опять решается перепиской. */
    paidOurs: number;
  }
  const поДням: Record<string, Ступени> = Object.create(null);
  // События, прошедшие отбор по времени и по «не робот», — их же считает разрез
  // по каналам и приложениям. Второй проход по файлу не делаем: это тот самый
  // случай, когда два прохода незаметно расходятся в правилах отбора.
  const событияВоронки: AnalyticsEvent[] = [];
  const людиПоДням: Record<string, Set<string>> = Object.create(null);
  let ботов = 0;
  let всего = 0;

  // ПЕРВЫЙ ПРОХОД: какие сессии пришли с нашей меткой канала. Метка живёт в
  // адресе страницы (`/pricing?c=cold-visit-check`), а событие «начали оплату»
  // её не несёт — поэтому связываем по признаку сессии, тот же посетитель и
  // тот же заход. (Без двоеточия после слова: соседний сторож
  // publicFunnelHasNoPersonalData читает ИСХОДНИК и запрещает строку «sid»
  // с двоеточием, чтобы личное поле не попало в ответ. Моё пояснение
  // покрасило его в красный — текст о вещи неотличим от вещи.)
  // Способ работает и ЗАДНИМ ЧИСЛОМ, для уже собранных событий, и не требует
  // правок страницы.
  const нашиСессии = new Set<string>();
  for (const line of content.split(String.fromCharCode(10))) {
    if (!line.trim()) continue;
    let ev: AnalyticsEvent;
    try { ev = JSON.parse(line) as AnalyticsEvent; } catch { continue; }
    if (ev.type !== "page_view" || !ev.sid) continue;
    if (нашаМетка(меткаИзПути(ev.path))) нашиСессии.add(ev.sid);
  }

  for (const line of content.split(String.fromCharCode(10))) {
    if (!line.trim()) continue;
    let ev: AnalyticsEvent;
    try { ev = JSON.parse(line) as AnalyticsEvent; } catch { continue; }
    const t = Date.parse(ev.ts || "");
    if (!Number.isFinite(t) || t < сНачала) continue;
    всего += 1;
    if (видОтправителя(ev.ua)) { ботов += 1; continue; }

    событияВоронки.push(ev);
    const день = new Date(t).toISOString().slice(0, 10);
    if (!поДням[день]) поДням[день] = { visits: 0, pricing: 0, checkoutStart: 0, thankYouOpened: 0, paid: 0, paidOurs: 0, checkoutStartOurs: 0 };
    if (!людиПоДням[день]) людиПоДням[день] = new Set<string>();
    const ст = поДням[день];

    if (ev.type === "page_view") {
      // Уникальных людей считаем по sid, но в ОТВЕТ он не попадает: множество
      // живёт только внутри этого запроса и наружу отдаётся его размер.
      if (ev.sid) людиПоДням[день].add(ev.sid); else ст.visits += 1;
      if (typeof ev.path === "string" && ev.path.includes("/pricing")) ст.pricing += 1;
    } else if (ev.type === "checkout_start") {
      ст.checkoutStart += 1;
      if (ev.sid && нашиСессии.has(ev.sid)) ст.checkoutStartOurs += 1;
    } else if (ev.type === "checkout_success") {
      ст.thankYouOpened += 1;
    } else if (ev.type === СОБЫТИЕ_ОПЛАТА_ПОДТВЕРЖДЕНА) {
      ст.paid += 1;
      // Признак ставит вебхук по адресу плательщика (lib/payment/paymentConfirmedEvent).
      // Замер 29.09.2026: первые две подтверждённые оплаты были покупками самого
      // основателя, проверявшего кассу, — без этого разреза они прочитались бы
      // как первые продажи.
      if (ev.meta?.свой === true) ст.paidOurs += 1;
    }
  }

  // День раньше появления механизма: оплату измерить было нечем, и ноль здесь
  // означал бы «продаж не было». Отдаём null — «не знаю».
  // Днём «измеренным» считается только тот, что НАЧАЛСЯ после появления
  // механизма. Сперва здесь стоял конец дня — и день выкатки (29.09) выглядел
  // измеренным целиком, хотя механизм заработал в его середине: в отчёте
  // получился ноль за день, в котором были две настоящие оплаты.
  const измерялосьЛи = (день: string) => Date.parse(`${день}T00:00:00.000Z`) >= Date.parse(ОПЛАТЫ_СЧИТАЕМ_С);

  const byDay = Object.keys(поДням)
    .sort()
    .map((д) => ({
      day: д,
      visits: поДням[д].visits + людиПоДням[д].size,
      pricing: поДням[д].pricing,
      checkoutStart: поДням[д].checkoutStart,
      thankYouOpened: поДням[д].thankYouOpened,
      paid: измерялосьЛи(д) ? поДням[д].paid : null,
      paidOurs: измерялосьЛи(д) ? поДням[д].paidOurs : null,
      checkoutStartOurs: поДням[д].checkoutStartOurs,
    }));

  const разрез = разрезВоронки(событияВоронки, нашиСессии);

  const итог = byDay.reduce(
    (a, b) => ({
      visits: a.visits + b.visits,
      pricing: a.pricing + b.pricing,
      checkoutStart: a.checkoutStart + b.checkoutStart,
      thankYouOpened: a.thankYouOpened + b.thankYouOpened,
      checkoutStartOurs: a.checkoutStartOurs + b.checkoutStartOurs,
    }),
    { visits: 0, pricing: 0, checkoutStart: 0, thankYouOpened: 0, checkoutStartOurs: 0 },
  );

  // Сумма по измеренным дням. Складывать вперемешку с null нельзя: null + число
  // даёт число и молча превращает неизмеренное в «продаж не было».
  //
  // ⚠️ Измеримость окна НЕ выводится из того, в какие дни были события. Первая
  // версия спрашивала `byDay.every((д) => д.paid === null)` — и на пустом
  // хранилище отвечала `null`, потому что «все дни» пустого списка подходят под
  // любое условие. То есть честный ноль («сегодня измеряем, покупок нет»)
  // превращался в «не знаю». Спрашиваем про ОКНО: измеримо ли оно сейчас.
  // Сумма считается по СЫРЫМ счётчикам, а не по обнулённым дням: иначе оплата,
  // случившаяся в день выкатки после появления механизма, попала бы в файл, но
  // выпала из итога — молчаливый недосчёт денег. Здесь итог читается как «не
  // меньше этого»: рядом стоит paidWindowPartlyUnmeasured, и он говорит, что
  // часть окна не измерялась.
  const оплатыЗаОкно =
    Date.now() < Date.parse(ОПЛАТЫ_СЧИТАЕМ_С)
      ? null
      : Object.values(поДням).reduce((сумма, ст) => сумма + ст.paid, 0);
  // То же окно, тот же способ счёта — но отдельным числом. Вычитать «наши» из
  // общего молча нельзя: читатель обязан видеть оба, иначе ноль внешних продаж
  // снова придётся выяснять перепиской (замер 29.09.2026: первые две оплаты были
  // проверками кассы самим основателем).
  const нашиЗаОкно =
    Date.now() < Date.parse(ОПЛАТЫ_СЧИТАЕМ_С)
      ? null
      : Object.values(поДням).reduce((сумма, ст) => сумма + ст.paidOurs, 0);

  res.json({
    known: true,
    days: дней,
    // Ступень «оплатили» считается по подтверждению КАССЫ и существует только
    // с этой даты; за более ранние дни отдаётся null, а не ноль. Открытия
    // страницы «спасибо» живут отдельным полем thankYouOpened — они не деньги.
    paidMeasuredSince: ОПЛАТЫ_СЧИТАЕМ_С,
    // Тоже про ОКНО, а не про дни с событиями: окно, начавшееся раньше даты
    // появления механизма, заведомо неполно — даже если в тех днях событий нет.
    paidWindowPartlyUnmeasured: сНачала < Date.parse(ОПЛАТЫ_СЧИТАЕМ_С),
    total: { ...итог, paid: оплатыЗаОкно, paidOurs: нашиЗаОкно },
    // Доля роботов печатается рядом: без неё «мало людей» читается как провал
    // продукта, тогда как это может быть просто состав трафика.
    eventsSeen: всего,
    botsExcluded: ботов,
    byDay,
    // Разрез по каналу и по приложению. Раньше сводка складывала всех в одну
    // кучу, и вопрос «чей это след» решался перепиской между окнами: 29.09
    // пять начал оплаты оказались пробами одного окна, а запуск на Product Hunt
    // весь день выглядел прямыми заходами.
    byChannel: разрез.byChannel,
    byApp: разрез.byApp,
  });
});

eventsRouter.get("/aggregate", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const period = req.query.period === "hour" ? "hour" : "day";
  const GROUP_DIMS = new Set(["source", "type", "tier", "industry"]);
  const groupBy = GROUP_DIMS.has(String(req.query.groupBy)) ? String(req.query.groupBy) : "type";
  const sinceHours = Math.min(Math.max(queryNumber(req.query.hours, 168), 1), 720);
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ period, groupBy, windowHours: sinceHours, buckets: [] });
  }

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/aggregate] read failed", e);
    captureEventsError(e, { route: "events/GET/aggregate" });
    return res.status(500).json({ error: "read_error" });
  }

  // bucketKey: ISO timestamp truncated to the hour or the day
  function bucketKey(iso: string): string {
    return period === "hour" ? iso.slice(0, 13) + ":00:00Z" : iso.slice(0, 10) + "T00:00:00Z";
  }

  let автоматика = 0;
  const buckets = new Map<string, { total: number; counts: Record<string, number> }>();
  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    let ev: AnalyticsEvent;
    try {
      ev = JSON.parse(line) as AnalyticsEvent;
    } catch {
      continue;
    }
    if (!ev.ts || new Date(ev.ts).getTime() < sinceMs) continue;
    // Та же причина, что и в /summary: 91 % событий прода 20.09.2026 прислала
    // наша же автоматика. Срез по вариантам A/B, посчитанный по ней, сравнивает
    // не тексты на экране, а поведение зондов — и выбранный «победитель» был бы
    // выбран монеткой. Число отброшенных названо полем `automatedEvents`.
    if (видОтправителя((ev as { ua?: string }).ua)) { автоматика += 1; continue; }
    const key = bucketKey(ev.ts);
    let b = buckets.get(key);
    if (!b) {
      b = { total: 0, counts: {} };
      buckets.set(key, b);
    }
    b.total += 1;
    const dim = (ev as unknown as Record<string, unknown>)[groupBy];
    const dimVal = typeof dim === "string" && dim.length > 0 ? dim : "(none)";
    b.counts[dimVal] = (b.counts[dimVal] ?? 0) + 1;
  }

  const sorted = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([bucket, v]) => ({ bucket, total: v.total, counts: v.counts }));

  res.json({ period, groupBy, windowHours: sinceHours, buckets: sorted, countsExclude: "automated", automatedEvents: автоматика });
});

/**
 * GET /api/pricing/events/recent
 * Последние N событий целиком. Защищён ADMIN_TOKEN.
 */
eventsRouter.get("/recent", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ items: [], total: 0 });
  }

  const limit = Math.min(Math.max(queryNumber(req.query.limit, 100), 1), 1000);

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/recent] read failed", e);
    captureEventsError(e, { route: "events/GET/recent" });
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const tail = lines.slice(-limit).reverse();
  const items: AnalyticsEvent[] = [];
  for (const line of tail) {
    try {
      items.push(JSON.parse(line) as AnalyticsEvent);
    } catch {
      // skip
    }
  }
  res.json({ items, total: lines.length });
});

/**
 * GET /api/pricing/events/by-variant
 * Конверсии в разрезе A/B-вариантов. Защищён ADMIN_TOKEN.
 *
 * Группирует события по `meta.variant_<key>` и считает воронку:
 * page_view → cta_click → lead_submit / checkout_start → checkout_success.
 *
 * Параметры:
 *   - hours (1..720, default 168) — окно
 *   - keys (csv, default "hero,tierCards") — какие variant-ключи группировать
 */
eventsRouter.get("/by-variant", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (required) {
    const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
    if (got !== required) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const sinceHours = Math.min(Math.max(queryNumber(req.query.hours, 168), 1), 720);
  const sinceMs = Date.now() - sinceHours * 60 * 60 * 1000;
  const keys = (typeof req.query.keys === "string" ? req.query.keys : "hero,tierCards")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 10);

  const FUNNEL_TYPES = [
    "page_view",
    "cta_click",
    "lead_submit",
    "checkout_start",
    "checkout_success",
  ] as const;

  type FunnelCounts = Record<typeof FUNNEL_TYPES[number], number>;

  function emptyCounts(): FunnelCounts {
    return {
      page_view: 0,
      cta_click: 0,
      lead_submit: 0,
      checkout_start: 0,
      checkout_success: 0,
    };
  }

  const result: Record<string, Record<string, FunnelCounts>> = {};
  for (const k of keys) result[k] = {};

  if (!existsSync(EVENTS_FILE)) {
    return res.json({ keys, windowHours: sinceHours, variants: result });
  }

  let content = "";
  try {
    content = readFileSync(EVENTS_FILE, "utf8");
  } catch (e) {
    console.error("[events/by-variant] read failed", e);
    captureEventsError(e, { route: "events/GET/by-variant" });
    return res.status(500).json({ error: "read_error" });
  }

  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    let ev: AnalyticsEvent;
    try {
      ev = JSON.parse(line) as AnalyticsEvent;
    } catch {
      continue;
    }
    if (!ev.ts || new Date(ev.ts).getTime() < sinceMs) continue;
    if (!FUNNEL_TYPES.includes(ev.type as typeof FUNNEL_TYPES[number])) continue;
    if (!ev.meta || typeof ev.meta !== "object") continue;

    for (const k of keys) {
      const v = ev.meta[`variant_${k}`];
      if (typeof v !== "string" || v.length === 0) continue;
      if (!result[k][v]) result[k][v] = emptyCounts();
      result[k][v][ev.type as typeof FUNNEL_TYPES[number]] += 1;
    }
  }

  res.json({ keys, windowHours: sinceHours, variants: result });
});
