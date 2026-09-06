/**
 * Provisioning после оплаты: создание subscription + welcome-email.
 *
 * Хранение подписок: data/subscriptions.jsonl (append-only).
 * Email: Resend SDK с graceful stub-fallback (как Stripe).
 *
 * В реальном AEVION провайдинг должен вызывать AccountService и
 * QRightRegistry — но эти системы в отдельном scope. Здесь —
 * GTM-уровень: запись подписки + welcome-email.
 */

import { Router } from "express";
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join, dirname } from "path";
import type { TierId, BillingPeriod } from "../data/pricing";
import { projects } from "../data/projects";
import { makeServiceCapture } from "../lib/sentry/platform";
import { degraded } from "../lib/degradedResponse";
import { rateLimit } from "../lib/rateLimit";

const capture = makeServiceCapture("provisioning");

/**
 * Файл-хранилище подписок. Считается ПРИ КАЖДОМ обращении, а не один раз при
 * импорте, и привязан к каталогу пакета, а не к текущему каталогу процесса.
 *
 * Обе поправки закрывают один инцидент (10.08.2026). Было
 * `join(process.cwd(), "data", ...)`, вычисленное на импорте:
 *
 *  • Из-за cwd прогон тестов НЕ из каталога бэкенда писал подписки в
 *    `data/subscriptions.jsonl` в КОРНЕ репозитория. Корневой путь не покрыт
 *    `.gitignore` (там закрыт `data/subscriptions.jsonl` внутри пакета — как
 *    PII), поэтому записи попадали в коммиты: 3 строки в 0ff550de6 и ещё 6 в
 *    7b292af6e. Здесь это оказались синтетические адреса `@test.aevion.dev`,
 *    но защита от PII не должна зависеть от того, из какой папки запустили.
 *  • Из-за вычисления на импорте `SUBSCRIPTIONS_FILE`, выставленный тестом до
 *    импорта, применялся только если тест успевал импортировать модуль ПЕРВЫМ
 *    в своём воркере. Иначе тест читал и писал общий файл, накопивший записи
 *    прошлых прогонов, — и `paywallProvisionFlow` падал на «покупатель должен
 *    быть отклонён ДО покупки»: он уже был оплачен, неделю назад, чужим
 *    прогоном. Это числилось хронической нестабильностью набора.
 *
 * В проде поведение не меняется: сервис стартует из каталога пакета, то есть
 * тот же `aevion-globus-backend/data/subscriptions.jsonl`.
 */
const PACKAGE_ROOT = join(__dirname, "..", "..");

/**
 * Единственное место, где вычисляется путь к хранилищу подписок.
 *
 * Экспортируется намеренно: 30.08.2026 нашлась ВТОРАЯ реализация — ручка
 * «моя подписка» в routes/pricing.ts считала путь сама и брала за основу
 * `process.cwd()`, тогда как записи платежей идут от каталога ПАКЕТА. Совпадут
 * они или нет, зависит от того, откуда запущен процесс: запусти сервис из
 * корня репозитория — и человек, только что заплативший, спросит свою
 * подписку и получит «нет».
 *
 * Тот же класс, что копия записи прав в вебхуке: две реализации одного,
 * расходятся молча, и разницу видно только при сравнении.
 */
export function subsFile(): string {
  const fromEnv = process.env.SUBSCRIPTIONS_FILE?.trim();
  if (fromEnv) return fromEnv;
  return join(PACKAGE_ROOT, "data", "subscriptions.jsonl");
}

const RESEND_KEY = process.env.RESEND_API_KEY?.trim();
// ⚠️ 19.08.2026: запасным стоял "AEVION <hello@aevion.io>" — ЧУЖОЙ домен
// (aevion.io принадлежит другой компании с тем же названием). Переменная
// FROM_EMAIL на проде не задана, то есть письма о покупке уходили от их имени;
// /health показывал ровно это: from "AEVION <hello@aevion.io>", mode "real".
// Отправитель теперь наш. Домен нужно верифицировать в Resend — если он там
// не подтверждён, отправка отвергается, и это видно по ok:false из sendEmail.
const FROM_EMAIL = process.env.FROM_EMAIL?.trim() || "AEVION <noreply@aevion.app>";
const FRONTEND_URL = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";

export interface Subscription {
  id: string;
  ts: string;
  email: string;
  tierId: TierId;
  period: BillingPeriod;
  seats: number;
  modules: string[];
  trialDays: number;
  /** ISO дата окончания триала или подписки */
  validUntil?: string;
  amountUsd?: number;
  promoCode?: string;
  stripeSessionId?: string;
  /**
   * Идентификатор платежа У ПРОВАЙДЕРА (sale_id у Gumroad, pg_payment_id у
   * PayBox, id ордера у PayPal, id подписки у LemonSqueezy).
   *
   * Заведено 03.09.2026. До этого связать платёж с выдачей можно было только
   * у paybox и paypal — там идентификатор зашит в номер подписки. У Gumroad
   * (главная касса) и LemonSqueezy он не сохранялся вовсе, поэтому на вопрос
   * «человек заплатил, выдали ли мы» ответа не было ни у поддержки, ни у
   * страницы успеха, которая показывает тариф ИЗ АДРЕСНОЙ СТРОКИ.
   */
  providerPaymentId?: string;
  /** Кто провёл платёж: "gumroad" | "lemonsqueezy" | "stripe" и т.п. */
  source?: string;
  /**
   * Маркетинговый канал покупки — метка из ссылки (`/go?c=ig`).
   *
   * Отдельным полем, а не суффиксом к `source`: это разные оси. `source`
   * отвечает «через какую кассу прошли деньги» и по нему уже сравнивают
   * дословно (страница /revenue рисует бейдж провайдера через
   * `s.source === "gumroad"`). Подмешать туда канал значило бы сломать
   * чужой экран ради своей метки — тот же дефект, что «две оси в одной
   * таблице». Добавлено 19.08.2026.
   */
  channel?: string;
}

function ensureDir(file: string) {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function writeSubscription(sub: Subscription): void {
  try {
    const file = subsFile();
    ensureDir(file);
    appendFileSync(file, JSON.stringify(sub) + "\n", "utf8");
  } catch (e) {
    capture(e);
    console.error("[provisioning] writeSubscription failed", e);
    // Ошибку НЕ глотаем, и это не косметика.
    //
    // Раньше отказ записи возвращался как успех: выдача продолжалась, человеку
    // уходило письмо «доступ открыт», вебхук отвечал кассе 200 activated —
    // касса считала доставку успешной и БОЛЬШЕ НЕ ПОВТОРЯЛА. Человек получил
    // письмо, доступа не получил, и восстановить это было нечем: тарифный
    // доступ решает именно файл подписок, а записи в нём нет.
    //
    // Тот же разбор давно сделан для второго хранилища в lemonSqueezyWebhook;
    // здесь оставалось по-старому.
    //
    // Все шесть вызывающих стоят внутри try/catch: четыре пути возврата, смена
    // выбранного модуля и основная выдача. Значит бросок даёт честный 5xx и
    // повторную доставку, а не упавший запрос.
    //
    // ⚠️ 01.09.2026 эта строка ИСЧЕЗЛА при сведении: я взял чужую сторону файла
    // ради того, что в журнал идёт домен, а не адрес человека, — и вместе с ней
    // взял версию ДО починки. Поймал их же тест. Разрешая конфликт «по
    // существу», надо спрашивать не только про то, ради чего берёшь сторону,
    // но и про то, что на ней могло устареть.
    throw e;
  }
}

/**
 * Remove every subscription record matching this email (case-insensitive)
 * from the store. Rewrites the JSONL atomically via .tmp + rename so a crash
 * mid-rewrite can't leave a half-truncated file. Returns counts of removed
 * vs. kept records. No-op (0/0) when the file doesn't exist.
 *
 * Used by the admin purge endpoint for GDPR removal and to clear test
 * records left by verify pings.
 */
/**
 * ⚠️ ГОНКА С ЗАПИСЬЮ ОПЛАТЫ — известна и принята осознанно (01.09.2026).
 *
 * Здесь файл читается целиком, а затем ЗАМЕНЯЕТСЯ (tmp + rename). Запись
 * оплаты, случившаяся между чтением и заменой, пропадёт молча: rename положит
 * содержимое, которое старше этой оплаты. Атомарность tmp+rename защищает от
 * обрыва посреди записи, но НЕ от параллельного дописывания.
 *
 * Почему не чиню блокировкой: ручка закрыта админским токеном (и при
 * незаданном токене отвечает 401), то есть нужно, чтобы человек осознанно
 * чистил подписки ровно в миллисекунду оплаты. Цена механизма блокировок выше
 * этого риска.
 *
 * Но окно НЕЛЬЗЯ расширять. Если когда-нибудь захочется сделать очистку
 * фоновой, отложенной или пакетной — сперва блокировка, потом перенос:
 * из миллисекунд окно станет секундами, и «редко» превратится в «регулярно».
 */
export function purgeSubscriptions(email: string): { removed: number; remaining: number } {
  const target = email.trim().toLowerCase();
  if (!target) return { removed: 0, remaining: 0 };
  const file = subsFile();
  if (!existsSync(file)) return { removed: 0, remaining: 0 };
  const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim().length > 0);
  const kept: string[] = [];
  let removed = 0;
  for (const line of lines) {
    try {
      const sub = JSON.parse(line) as Subscription;
      if (sub.email?.toLowerCase() === target) {
        removed += 1;
        continue;
      }
    } catch {
      // keep malformed lines — they were already in the store and we don't
      // want to silently drop unparseable data during a purge by email
    }
    kept.push(line);
  }
  const tmp = file + ".tmp";
  const out = kept.length === 0 ? "" : kept.join("\n") + "\n";
  ensureDir(file);
  writeFileSync(tmp, out, "utf8");
  renameSync(tmp, file);
  return { removed, remaining: kept.length };
}

export function countSubscriptions(): { ok: boolean; total: number } {
  try {
    const file = subsFile();
    // Файла нет — это ЧЕСТНЫЙ ноль: подписок ещё не было.
    if (!existsSync(file)) return { ok: true, total: 0 };
    const content = readFileSync(file, "utf8");
    const n = content.split(String.fromCharCode(10)).filter((l) => l.trim().length > 0).length;
    return { ok: true, total: n };
  } catch {
    // А СБОЙ ЧТЕНИЯ нулём быть не должен: это «не знаю».
    //
    // Число уходит в ответ ручки и дальше в ежедневный отчёт основателю.
    // Ноль при нечитаемом файле выглядит как «никто не купил» или «мы
    // потеряли всех подписчиков» — ложная тревога, отличить которую от
    // правды было нечем.
    return { ok: false, total: 0 };
  }
}

/**
 * Latest subscription record for an email (case-insensitive). The store is
 * append-only and latest-wins, so a later "free" downgrade record (written by
 * the LS subscription webhook on cancel/expire) correctly supersedes an
 * earlier paid record. Returns null if the email has no records.
 */
/**
 * Не удалось ПРОЧИТАТЬ хранилище подписок — в отличие от «записей нет».
 *
 * Разные вещи, а отвечали одинаково: и то и другое давало `null`, а выше по
 * стеку превращалось в «tierId: free». То есть при пропаже или порче файла
 * каждый заплативший тихо становился бесплатным, и снаружи это неотличимо от
 * «человек не платил»: ни строки в журнале, ни признака в ответе.
 *
 * Три исхода вместо двух (правило из разбора сторожей 18.08):
 *   файла нет вовсе      — честный ноль, до первой покупки он законно отсутствует;
 *   файл прочитан        — настоящее значение;
 *   файл есть, но не читается — НЕ ЗНАЮ, и об этом должно быть слышно.
 *
 * Поведение намеренно НЕ меняется: отказ чтения по-прежнему не роняет запрос и
 * даёт «free». Меняется одно — он перестаёт быть невидимым.
 */
let warnedUnreadableStore = false;

/** Видел ли процесс нечитаемое хранилище подписок. Для ручек состояния. */
export function subscriptionStoreUnreadable(): boolean {
  return warnedUnreadableStore;
}

/** Только для тестов: вернуть признак в исходное состояние. */
export function resetSubscriptionStoreWarning(): void {
  warnedUnreadableStore = false;
}

/**
 * Найти подписку по идентификатору платежа у провайдера.
 *
 * Нужна странице успеха: сразу после оплаты она должна СПРОСИТЬ, состоялась
 * ли выдача, а не верить адресной строке.
 *
 * ТРИ ИСХОДА, а не два — это главное в этой функции:
 *   • подписка найдена  → { найдено: true, подписка }
 *   • не найдена        → { найдено: false }
 *   • ПРОЧИТАТЬ НЕ УДАЛОСЬ → бросаем.
 *
 * Третий нельзя схлопывать во второй: сбой чтения, выданный за «ещё не
 * готово», сказал бы заплатившему человеку «ждите» навсегда.
 *
 * Старые записи paybox и paypal идентификатора в отдельном поле не имеют —
 * там он зашит в номер подписки (`sub_paybox_<id>`), поэтому смотрим и туда.
 */
export function findSubscriptionByPaymentId(
  paymentId: string
): { найдено: true; подписка: Subscription } | { найдено: false } {
  const цель = paymentId.trim();
  if (!цель) return { найдено: false };
  const file = subsFile();
  if (!existsSync(file)) return { найдено: false };
  // Ошибку чтения НЕ глотаем: см. комментарий выше.
  const content = readFileSync(file, "utf8");
  let найденная: Subscription | null = null;
  for (const line of content.split(String.fromCharCode(10))) {
    if (!line.trim()) continue;
    try {
      const sub = JSON.parse(line) as Subscription;
      // Точное совпадение по полю — без ограничений: это наш собственный
      // идентификатор платежа.
      //
      // Запасной путь (номер подписки вида `sub_paybox_<id>`) намеренно
      // ограничен длиной. Идентификатор приходит из АДРЕСНОЙ СТРОКИ, то есть
      // подделывается: без ограничения запрос `?intentId=1` совпал бы с любой
      // подпиской, чей номер кончается на `_1`, и показал бы чужой тариф.
      // Настоящие идентификаторы платежей длинные, так что живые случаи это
      // не задевает. Найдено вычиткой собственного дифа 04.09.2026.
      const точное = sub.providerPaymentId === цель;
      const поНомеру = цель.length >= 8 && (sub.id ?? "").endsWith(`_${цель}`);
      if (точное || поНомеру) найденная = sub;
    } catch {
      // битую строку пропускаем: одна запись не должна прятать остальные
    }
  }
  return найденная ? { найдено: true, подписка: найденная } : { найдено: false };
}

/**
 * Касается ли возврат/отмена ДЕЙСТВУЮЩЕЙ подписки.
 *
 * Ворота платного доступа читают последнюю записанную строку по адресу, а
 * ветки возврата писали понижение до `free` безусловно. Отсюда сценарий,
 * бьющий по заплатившему: купил дешёвый тариф, обновился до дорогого,
 * пришёл возврат за ПЕРВЫЙ платёж — и человек потерял второй, оплаченный.
 *
 * Место общее, потому что правило одно на все четыре кассы. Сперва я
 * написал его дважды, в paybox и paypal, — то есть повторил ровно ту
 * ошибку, из-за которой годовой период у одной кассы из четырёх зашивался
 * месячным: пока копий несколько, отставшая ничем себя не выдаёт.
 *
 * НАПРАВЛЕНИЕ ОТКАЗА осознанное: сомневаемся — ОТЗЫВАЕМ. Не отозвать
 * возвращённое хуже, чем понизить лишний раз: первое отдаёт платное даром и
 * не видно никому, второе человек заметит и напишет.
 */
export function возвратКасаетсяДействующей(
  действующая: Subscription | null,
  идентификаторПлатежа: string
): boolean {
  if (!действующая) return true;                     // отзывать нечего
  if (действующая.tierId === "free") return true;    // уже бесплатная
  if (!идентификаторПлатежа) return true;            // не знаем, за что возврат
  if (действующая.providerPaymentId) {
    return действующая.providerPaymentId === идентификаторПлатежа;
  }
  // Давние записи без поля: идентификатор зашит в номер подписки. Длину
  // требуем, иначе короткий идентификатор совпал бы с чужой записью.
  return идентификаторПлатежа.length >= 8
    ? (действующая.id ?? "").endsWith(`_${идентификаторПлатежа}`)
    : true;
}

export function readLatestSubscription(email: string): Subscription | null {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const file = subsFile();
  // Отсутствие файла — законный ноль: до первой покупки его нет. Шуметь тут
  // нельзя, иначе журнал забьётся на пустой системе и предупреждение ниже
  // потеряется среди него.
  if (!existsSync(file)) return null;
  try {
    const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim().length > 0);
    let latest: Subscription | null = null;
    for (const line of lines) {
      try {
        const sub = JSON.parse(line) as Subscription;
        if (sub.email?.toLowerCase() === target) latest = sub;
      } catch {
        // skip malformed
      }
    }
    return latest;
  } catch (err) {
    // Файл ЕСТЬ, а прочитать не вышло: права, порча, диск. Поведение НЕ
    // меняем (null = ворота считают «подписки нет»); меняем видимость.
    // Мерж 06.09, две видимости с РАЗНЫМ периодом: консоль — раз-на-процесс
    // (иначе журнал забьётся и предупреждение потеряется), Sentry — КАЖДЫЙ
    // сбой (дедупликацию делает сам Sentry, а флаг тут прятал бы длящуюся
    // поломку: один след при часах отказов; это охраняет
    // gateReadFailureLeavesATrace).
    if (!warnedUnreadableStore) {
      warnedUnreadableStore = true;
      console.error(
        `[provisioning] хранилище подписок НЕ ЧИТАЕТСЯ (${file}): ${
          err instanceof Error ? err.message : String(err)
        }. Пока так, каждый заплативший отвечает как бесплатный.`,
      );
    }
    capture(err, { route: "provisioning/readLatestSubscription", email: target });
    return null;
  }
}

export interface ActivePlan {
  /** Latest subscription tier for the email, or "free" if none/expired. */
  tierId: TierId;
  validUntil: string | null;
  /** true when tierId is a paid tier AND validUntil hasn't passed. */
  active: boolean;
  source: string | null;
}

/**
 * Resolves the effective plan for an email from the subscription store.
 * Single source of truth for "what has this user paid for" — used by the
 * pricing self-service endpoint and the Constitution Pro server gate.
 */
export function getActivePlan(email: string): ActivePlan {
  const sub = readLatestSubscription(email);
  if (!sub) return { tierId: "free", validUntil: null, active: false, source: null };
  const expired = sub.validUntil ? new Date(sub.validUntil).getTime() < Date.now() : false;
  const active = sub.tierId !== "free" && !expired;
  return { tierId: sub.tierId, validUntil: sub.validUntil ?? null, active, source: sub.source ?? null };
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Состояние отправки писем — для `/api/health`, без секретов.
 *
 * Зачем. Без `RESEND_API_KEY` функция ниже возвращает `{ok: true, mode:"stub"}`
 * и просто пишет в лог: провижининг «успешен», а покупатель не получает от нас
 * НИЧЕГО — ни что он купил, ни как этим пользоваться. Снаружи это неотличимо
 * от исправной отправки: тот же 200, та же запись в журнале подписок.
 *
 * Отдаём только признак и адрес отправителя (он и так виден в любом письме).
 * Ключ не покидает процесс.
 */
/**
 * Исход ПОСЛЕДНЕЙ настоящей отправки.
 *
 * ⚠️ Находка соседнего окна 02.09.2026, проверена в этом файле. До неё
 * состояние отвечало `configured` и `mode`, выведенные из ОДНОГО факта —
 * задан ли ключ. То есть «настроены ли мы отправлять», а не «доходит ли».
 *
 * Разница описана строкой 72 этого же файла: домен отправителя нужно
 * подтвердить у поставщика, иначе КАЖДОЕ письмо отвергается. При этом
 * `configured` остаётся true, `mode` остаётся "real", и снаружи это
 * неотличимо от исправной отправки.
 *
 * Доказательств поломки нет: за неделю ни одной ошибки прода про письма. Но
 * покупок почти не было, значит и отправок почти не было, и ноль отказов
 * означает «не проверялось», а не «работает». Поэтому вопрос закрывается
 * прибором, а не наблюдением: одна настоящая отправка — и мы знаем правду.
 *
 * ПЕРСОНАЛЬНЫХ ДАННЫХ ЗДЕСЬ НЕТ И БЫТЬ НЕ ДОЛЖНО. Ни адреса получателя, ни
 * текста ошибки поставщика: в сообщениях Resend встречается адрес, а это
 * публичная ручка состояния. Хватает признака и кода ответа.
 *
 * Живёт в памяти процесса и обнуляется при перезапуске — осознанно: таблица
 * ради диагностики завела бы ещё одну сущность на денежном пути.
 */
type ИсходОтправки = { ok: boolean; httpStatus: number | null; when: string };
let последняяОтправка: ИсходОтправки | null = null;

function записатьИсход(ok: boolean, httpStatus: number | null): void {
  последняяОтправка = { ok, httpStatus, when: new Date().toISOString() };
}

export function emailSenderStatus(): {
  configured: boolean;
  from: string;
  mode: "real" | "stub";
  lastSend: ИсходОтправки | null;
  /** Явными словами, потому что `null` читают как «всё хорошо». */
  lastSendMeaning: string;
} {
  return {
    configured: Boolean(RESEND_KEY),
    from: FROM_EMAIL,
    mode: RESEND_KEY ? "real" : "stub",
    lastSend: последняяОтправка,
    lastSendMeaning: последняяОтправка
      ? (последняяОтправка.ok ? "последняя отправка прошла" : "последняя отправка ОТКЛОНЕНА поставщиком")
      : "настоящих отправок с момента запуска ещё не было — это НЕ подтверждение работоспособности",
  };
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; mode: "real" | "stub"; id?: string; error?: string; degraded?: boolean; degradedReason?: string }> {
  if (!RESEND_KEY) {
    console.log(`[email/STUB] To: ${payload.to} | Subject: ${payload.subject}`);
    return { ok: true, mode: "stub" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      /*
       * Отказ поставщика — самый тихий провал на денежном пути.
       *
       * Ниже по цепочке признак `emailSent` возвращается вызывающему, но
       * замер 01.09.2026: его не читает НИ ОДНА из четырёх касс (gumroad,
       * lemonSqueezy, paybox, paypal). Значит человек заплатил, письмо с
       * доступом не ушло — и об этом не знает никто: ни журнал, ни Sentry.
       * Соседние ветки этой же функции при отказе капчурят (исключение,
       * пустой id, вырожденный режим), а эта — единственная — молчала.
       * Непоследовательность внутри одной функции почти всегда недосмотр.
       *
       * Отправку по-прежнему НЕ роняем: письмо не должно валить выдачу
       * доступа, ради которой оно шлётся. Меняется одно — отказ перестаёт
       * быть невидимым.
       *
       * Адрес получателя не пишем целиком: это персональные данные, а для
       * разбора хватает домена и темы. Домен и есть главное: отказы вида
       * «домен отправителя не подтверждён» и «получатель отвергнут» по нему
       * и различаются.
       */
      const причина = j.message ?? `HTTP ${r.status}`;
      const доменПолучателя = String(payload.to).split("@").pop() ?? "?";
      /*
       * След в журнале контейнера, а не только в Sentry.
       *
       * 01.09.2026: два окна независимо сделали ПРАВИЛЬНОЕ и несовместимое.
       * Одно писало в журнал полный адрес покупателя — чтобы отказ было видно
       * и можно было понять, КОМУ не ушло. Другое заменило адрес доменом —
       * чтобы почта человека не попадала в логи, которые читают и пересылают.
       *
       * Разрешено в пользу приватности, но НЕ ценой видимости: адрес человека
       * в журнал не пишем, а сам отказ обязан быть виден. Домена и кода ответа
       * хватает, чтобы понять, что сломалось и у какого получателя.
       *
       * Только Sentry было мало: в контейнере не остаётся ничего, и человек,
       * читающий журнал прода, видит тишину на месте несостоявшегося письма.
       */
      console.warn(
        `[provisioning] письмо НЕ отправлено: получатель @${доменПолучателя}, ` +
          `код ${r.status}, причина: ${причина}`,
      );
      capture(new Error(`sendEmail rejected: ${причина}`), {
        route: "provisioning/sendEmail",
        subject: payload.subject,
        recipientDomain: доменПолучателя,
        status: String(r.status),
      });
      записатьИсход(false, r.status);
      return { ok: false, mode: "real", error: причина };
    }
    if (!j.id) {
      // Resend returned 2xx but no message id — not the documented success shape.
      // Report it as ok (HTTP-level it was) but flag it so callers don't silently
      // over-count "email sent" for a payment-confirmation email that may not
      // actually have been queued.
      const { degradedReason } = degraded("Resend returned 2xx with no message id — delivery not confirmed");
      capture(new Error(`sendEmail degraded: ${degradedReason}`), { route: "provisioning/sendEmail", to: payload.to });
      return { ok: true, mode: "real", degraded: true, degradedReason };
    }
    записатьИсход(true, r.status);
    return { ok: true, mode: "real", id: j.id };
  } catch (e) {
    capture(e);
    записатьИсход(false, null);
    return { ok: false, mode: "real", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Сколько модулей мы реально отдаём — СЧИТАЕТСЯ из реестра, не пишется рукой.
 *
 * В письме покупателю стояло «Все 27 модулей AEVION». Число пришло из
 * документации апреля 2026 и с тех пор устарело: в `data/projects.ts` сейчас
 * 41 запись, из них 36 со статусом live. То есть письмо, которое человек
 * получает СРАЗУ ПОСЛЕ ОПЛАТЫ, занижало продукт на девять живых модулей.
 *
 * Занижение опаснее завышения ровно тем, что его никто не поймает: на
 * завышение приходит жалоба, на заниженное обещание — тишина.
 */
export const LIVE_MODULE_COUNT = projects.filter((p) => String(p.status) === "live").length;

/**
 * Что написать в блоке «Что входит».
 *
 * Пустой `modules` значит РАЗНОЕ у разных тарифов, и прежний текст этого не
 * различал: у `full` пустой список это «всё», а у `lite` — «модуль ещё не
 * выбран». Подписчику Lite уходило «Все N модулей», то есть обещание,
 * которого его тариф не даёт.
 */
export function includedLine(sub: Subscription): string {
  if (sub.modules.length > 0) return sub.modules.join(" · ");
  if (sub.tierId === "lite") {
    return "Один модуль на ваш выбор — выберите его в кабинете";
  }
  if (sub.tierId === "free") return "Бесплатный доступ к открытым модулям";
  return `Все модули AEVION (сейчас ${LIVE_MODULE_COUNT} в работе)`;
}

/**
 * Куда вести из письма.
 *
 * Раньше здесь был зашитый QRight — и кнопку «Открыть QRight» получал каждый,
 * включая того, кто только что купил CyberChess. Ведём в купленный модуль,
 * когда он один и известен, иначе в кабинет, где человек видит свою подписку.
 */
export function ctaFor(sub: Subscription): { href: string; label: string } {
  if (sub.modules.length === 1 && isKnownModule(sub.modules[0])) {
    return { href: `/${sub.modules[0]}`, label: "Открыть модуль" };
  }
  return { href: "/account", label: "Открыть кабинет" };
}

/**
 * Слаг модуля — из реестра, а не «любая строка».
 *
 * Нашёл вычиткой СВОЕЙ ЖЕ правки, зелёные тесты этого не показывали. У тарифа
 * Lite покупатель выбирает один продукт, и слаг приезжает так:
 *
 *   webhook -> payload.meta.custom_data.module -> sub.modules[0] -> ссылка
 *
 * Подпись вебхука доказывает, что данные пришли от Lemon Squeezy, но НЕ то,
 * что значение осмысленно: адрес чекаута с `checkout[custom][module]=…`
 * собирается на стороне покупателя. То есть в письмо попадала бы любая
 * строка, а мой же `href="${FRONTEND_URL}/${slug}"` превращал бы её в ссылку —
 * `//чужой-сайт` увёл бы человека наружу прямо из нашего письма о покупке.
 *
 * Сверяем с реестром: неизвестный слаг ведёт в кабинет, где человек видит,
 * что у него на самом деле есть. Ссылка в письме о покупке обязана вести
 * туда, куда мы намеревались, а не туда, что прислали.
 */
function isKnownModule(slug: string): boolean {
  if (typeof slug !== "string" || slug.length === 0) return false;
  return projects.some((p) => String((p as { id?: unknown }).id ?? "") === slug);
}

const TIER_DISPLAY: Record<TierId, string> = {
  free: "Free",
  lite: "Lite",
  medium: "Medium",
  full: "Full",
  enterprise: "Enterprise",
  // ⚠️ 01.09.2026: здесь стояла ОТСТАВНАЯ цена. Она не совпадала ни с каталогом,
  // ни с продом — у Universe сейчас $149. Комментарий утверждал состояние,
  // которое изменилось, и делал это увереннее кода: читающий верит пояснению,
  // потому что оно написано человеком для человека.
  //
  // Поймал сторож отставных цен. Соседнее окно сочло его срабатывание ложным —
  // «споткнулся о комментарий». Он и правда споткнулся о комментарий, но
  // комментарий был неверен: тревога настоящая. Прежде чем звать красное
  // ложным, стоит проверить утверждение, о которое споткнулись.
  //
  // `pro` НЕ устаревший псевдоним — это живой тариф Universe ($149 в
  // data/pricing.ts), and lib/planGate.ts normalizes it to `full` access.
  // This map still called it "Lite", so someone who had just paid for Universe
  // got a welcome email headlined "Добро пожаловать в AEVION Lite". Same
  // mistaken assumption that once gated a Universe customer at Lite access
  // (fixed in planGate on 2026-07-22); this was the last copy of it.
  pro: "Universe",
  // business — genuinely deprecated, kept so old Gumroad webhooks resolve.
  business: "Full",
};


/**
 * Экранирование для HTML-версии письма.
 *
 * В блок «Что входит» попадает слаг модуля из `custom_data` чекаута, то есть
 * строка, которую собрал покупатель. В текстовой версии это безвредно, а в
 * HTML — вставка в разметку письма, которое мы же и отправляем. Экранируем в
 * МЕСТЕ ВСТАВКИ, а не внутри includedLine: тогда текстовая версия остаётся
 * читаемой, без &amp; вместо амперсанда.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function welcomeHtml(sub: Subscription): string {
  const tierName = TIER_DISPLAY[sub.tierId];
  const cta = ctaFor(sub);
  const trialBlock = sub.trialDays > 0
    ? `<div style="margin:16px 0;padding:14px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;color:#78350f">
         <strong>Триал-период активен до ${срокИзПодписки(sub).toLocaleDateString("ru-RU")}.</strong>
         Карта не списывается до окончания.
       </div>`
    : "";
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(15,23,42,0.06)">
        <tr><td>
          <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;color:#0d9488;margin-bottom:8px">AEVION · WELCOME</div>
          <h1 style="font-size:28px;font-weight:900;color:#0f172a;margin:0 0 12px;letter-spacing:-0.02em">
            Добро пожаловать в AEVION ${tierName}!
          </h1>
          <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 16px">
            Ваша подписка активна. Можете сразу зарегистрировать первую идею в QRight, подписать документ через QSign или открыть аналитику в Globus.
          </p>
          ${trialBlock}
          <p style="font-size:13px;color:#64748b;line-height:1.5;margin:16px 0">
            <strong>Что входит:</strong><br/>
            ${escapeHtml(includedLine(sub))}
          </p>
          <div style="margin:24px 0;text-align:center">
            <a href="${FRONTEND_URL}${cta.href}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#0d9488,#0ea5e9);color:#fff;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px">
              ${cta.label}
            </a>
          </div>
          <!--
            Поддержка ведёт на ФОРМУ, а не на почтовый адрес.

            Замер 01.09.2026 (контроль пройден: у gmail.com запись MX находится,
            у чужого aevion.io тоже): у домена aevion.app записи MX НЕТ. Значит
            письмо на любой адрес этого домена — а такой стоял здесь — не доходит, и
            человек узнаёт об этом отлупом, а мы не узнаём вовсе. Хуже места для
            мёртвого адреса нет: это письмо получает тот, кто уже ЗАПЛАТИЛ.

            Форма /pricing/contact проверена по всей цепочке: пишет в файл,
            каталог лежит на постоянном томе (события с 26 мая целы), читается
            защищённой ручкой /api/pricing/leads, ADMIN_TOKEN на проде задан.
            То есть обращение доходит до человека, а адрес — нет.

            Когда у домена появится почта, сюда можно вернуть адрес — но тогда
            уже проверенный, а не обещанный.
          -->
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="font-size:12px;color:#94a3b8;line-height:1.5;margin:0">
            ID подписки: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${sub.id}</code><br/>
            Поддержка: <a href="${FRONTEND_URL}/pricing/contact?topic=purchase" style="color:#0d9488">${FRONTEND_URL.replace(/^https?:\/\//, "")}/pricing/contact</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function welcomeText(sub: Subscription): string {
  const tierName = TIER_DISPLAY[sub.tierId];
  const trial = sub.trialDays > 0
    ? `\nТриал-период активен до ${срокИзПодписки(sub).toLocaleDateString("ru-RU")}. Карта не списывается до окончания.\n`
    : "";
  return `Добро пожаловать в AEVION ${tierName}!

Ваша подписка активна.${trial}
Что входит:
${includedLine(sub)}

${ctaFor(sub).label}: ${FRONTEND_URL}${ctaFor(sub).href}

ID подписки: ${sub.id}
Поддержка: ${FRONTEND_URL}/pricing/contact?topic=purchase
`;
}

/**
 * Главная provisioning-функция: вызывается из webhook после успешной оплаты
 * и из stub-checkout (для smoke-теста UX без реального Stripe).
 */
/**
 * До какого момента действует оплаченный доступ.
 *
 * ПОЧЕМУ НЕ «30 ДНЕЙ». Так было до 03.09.2026, и это расходилось с тем, как
 * списывает касса: она берёт деньги в ТО ЖЕ ЧИСЛО следующего месяца. В месяцах
 * из 31 дня доступ гас на сутки РАНЬШЕ продления — то есть заплативший человек
 * видел «Free, оформите подписку», хотя платёж был в силе. Семь месяцев в году
 * длиной 31 день. Отсрочки в коде нет, ни один тест это правило не закреплял.
 *
 * Годовой срок по той же причине не 365 дней: в високосном году это давало те
 * же сутки разрыва.
 *
 * ЗАЖИМ КОНЦА МЕСЯЦА обязателен: 31 января плюс месяц — это 28 (или 29)
 * февраля, а не 3 марта. Без зажима JS сам переносит остаток на следующий
 * месяц и выдаёт человеку лишние дни, а на годовой границе — лишний день
 * 29 февраля.
 *
 * Пробный период остаётся В ДНЯХ: он и продаётся днями, календарь тут ни при чём.
 */
/**
 * Дата окончания ДЛЯ ПИСЬМА — из самой подписки, а не пересчитанная.
 *
 * До 03.09.2026 письмо считало её заново: `Date.now() + trialDays * 86400000`.
 * Это второй источник правды об одном факте. Сегодня оба ответа совпадали с
 * точностью до миллисекунд, но:
 *   • перерисуют письмо позже (повтор, дайджест) — дата уедет вперёд, а ворота
 *     останутся прежними, и человеку названа НЕ та дата;
 *   • изменят правило срока — письмо молча продолжит считать по-старому.
 *     Ровно это случилось бы сегодня: месячный срок переехал на календарь.
 *
 * Запасной путь оставлен намеренно: у старых записей поля может не быть, и
 * письмо из-за этого падать не должно.
 */
function срокИзПодписки(sub: Subscription): Date {
  const из = sub.validUntil ? new Date(sub.validUntil) : null;
  if (из && !Number.isNaN(из.getTime())) return из;
  return new Date(Date.now() + sub.trialDays * 86400000);
}

export function вычислитьСрок(от: Date, period: BillingPeriod, trialDays: number): string {
  if (trialDays > 0) return new Date(от.getTime() + trialDays * 86400000).toISOString();
  const месяцев = period === "annual" ? 12 : 1;
  const год = от.getUTCFullYear();
  const месяц = от.getUTCMonth();
  const день = от.getUTCDate();
  const цель = new Date(
    Date.UTC(год, месяц + месяцев, 1, от.getUTCHours(), от.getUTCMinutes(), от.getUTCSeconds(), от.getUTCMilliseconds())
  );
  const последний = new Date(Date.UTC(цель.getUTCFullYear(), цель.getUTCMonth() + 1, 0)).getUTCDate();
  цель.setUTCDate(Math.min(день, последний));
  return цель.toISOString();
}

export async function provisionSubscription(input: {
  email: string;
  tierId: TierId;
  period?: BillingPeriod;
  seats?: number;
  modules?: string[];
  trialDays?: number;
  amountUsd?: number;
  promoCode?: string;
  stripeSessionId?: string;
  providerPaymentId?: string;
  paddleTransactionId?: string;
  source?: string;
  channel?: string;
}): Promise<{ subscription: Subscription; emailSent: boolean; emailMode: "real" | "stub"; emailError?: string; emailDegraded?: boolean }> {
  const trialDays = input.trialDays ?? 0;
  const period: BillingPeriod = input.period ?? "monthly";
  const validUntil = вычислитьСрок(new Date(), period, trialDays);

  const subscription: Subscription = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    email: input.email.toLowerCase(),
    tierId: input.tierId,
    period,
    seats: input.seats ?? 1,
    modules: input.modules ?? [],
    trialDays,
    validUntil,
    amountUsd: input.amountUsd,
    promoCode: input.promoCode,
    stripeSessionId: input.stripeSessionId,
    providerPaymentId: input.providerPaymentId,
    source: input.source,
    channel: input.channel,
  };

  writeSubscription(subscription);

  const subjPrefix = trialDays > 0 ? "Триал активен" : "Подписка активна";
  const result = await sendEmail({
    to: subscription.email,
    subject: `[AEVION] ${subjPrefix} · ${TIER_DISPLAY[subscription.tierId]}`,
    html: welcomeHtml(subscription),
    text: welcomeText(subscription),
  });

  /*
   * Оплата прошла, письмо с доступом не ушло — и это обязано быть видно.
   *
   * Признак `emailSent` честно возвращается вызывающему уже давно. Замер
   * 01.09.2026 показал, что его не читает НИ ОДНА из четырёх касс; замер
   * 04.09.2026 повторил результат — по-прежнему ноль читателей на пяти
   * вызывающих (четыре вебхука и checkout.ts). Починка 31.08 закрыла молчание
   * ВНУТРИ отправщика и прямым текстом назвала эту половину незакрытой.
   *
   * Почему след ставится здесь, а не у пяти вызывающих: место одно, забыть его
   * нельзя, и новый шестой вызывающий получит видимость даром. Пять одинаковых
   * правок разошлись бы при первой же выкатке.
   *
   * Чего сознательно НЕ делаем: не роняем ответ кассе. Человек заплатил, доступ
   * записан строкой выше, и неудача письма не должна превращаться в отказ
   * вебхука — касса повторит доставку и выдаст доступ второй раз. Меняется
   * только видимость.
   *
   * Строка называет ПОКУПКУ, а не просто письмо: сам `sendEmail` пишет о своём
   * отказе, но не знает, что за ним стоит оплата. Именно эта связка и нужна,
   * чтобы человека можно было найти и написать ему руками.
   *
   * Адрес целиком не пишем — только домен: почта покупателя не должна лежать в
   * журналах. Идентификатора подписки хватает, чтобы найти запись в хранилище.
   */
  if (!result.ok || result.mode === "stub") {
    const доменПолучателя = subscription.email.split("@").pop() ?? "?";
    const причина = result.ok
      ? "отправка не настроена (режим заглушки) — письмо даже не пытались отправить"
      : (result.error ?? "причина не названа");
    const сообщение =
      `[provisioning] ОПЛАЧЕНО, письмо с доступом НЕ отправлено: ` +
      `подписка ${subscription.id}, тариф ${subscription.tierId}, ` +
      `получатель @${доменПолучателя} — ${причина}`;
    // Метод консоли не отрываем от объекта: `const у = console.warn; у(...)`
    // в Node работает, но это опора на то, что методы там связаны, — в другой
    // среде тот же код бросает. Развилка из двух строк дешевле такой опоры.
    if (result.ok) console.warn(сообщение);
    else console.error(сообщение);

    /*
     * В Sentry уходит ТОЛЬКО настоящий отказ отправки, и с привязкой к покупке.
     *
     * Зачем отдельно от строки выше: `sendEmail` уже заводит событие о своём
     * отказе, но оно не знает, что за письмом стоит оплата, — в нём есть тема и
     * домен, и нет ни подписки, ни тарифа. Читающий Sentry видит «письмо
     * отклонено» и не понимает, что человек заплатил. Строка в журнале
     * контейнера эту связку несёт, но журнал никто не читает без повода —
     * а повод и есть событие.
     *
     * Режим заглушки СЮДА НЕ ПОПАДАЕТ намеренно: это состояние настройки, а не
     * происшествие с конкретной покупкой. Заводить событие на каждую оплату,
     * пока ключ не задан, значит утопить настоящие отказы в шуме; про заглушку
     * честно отвечает `/health` полем `emailSender.mode`.
     */
    if (!result.ok) {
      capture(new Error("оплачено, письмо с доступом не отправлено"), {
        route: "provisioning/provisionSubscription",
        subscriptionId: subscription.id,
        tierId: subscription.tierId,
        recipientDomain: доменПолучателя,
        reason: причина,
      });
    }
  }

  return {
    subscription,
    emailSent: result.ok,
    emailMode: result.mode,
    emailError: result.error,
    emailDegraded: result.degraded,
  };
}

/* ── Ручки провижининга ────────────────────────────────────────────────────
 *
 * Возвращены 12.08.2026. Они были сделаны 14.05 вместе со страницей
 * `/pricing/provisioning`, а 15.05 коммит `e0f5a2327` — тот самый, чьей целью
 * было ВЕРНУТЬ два роутера, потерянных при squash-мерже, — заодно снял импорт
 * и монтирование этого:
 *     -import { provisioningRouter } from "./routes/provisioning";
 *     -app.use("/api/pricing/provisioning", provisioningRouter);
 *
 * Три месяца страница открывалась на проде (200) и молча ничего не показывала:
 * обе ручки, которые она зовёт, отдавали 404. Ошибки на экране нет, поэтому
 * никто и не заметил. Описание в openapi при этом продолжало их рекламировать.
 *
 * Что изменено против оригинала — намеренно, а не по невнимательности:
 *   - путь к хранилищу берётся из `subsFile()`, а не из константы `SUBS_FILE`:
 *     файл стал функцией, чтобы тесты могли подменить его через env;
 *   - `byTier` перечисляет ВСЕ семь текущих тарифов. В оригинале их было
 *     четыре (free/pro/business/enterprise) — с тех пор появились lite, medium
 *     и full. Дословный перенос дал бы сводку, молча теряющую три тарифа;
 *     `Record<TierId, number>` этого бы не простил, и tsc поймал бы, но
 *     проговариваю, потому что молчаливая потеря строки в отчёте о деньгах —
 *     ровно тот класс дефектов, ради которого страница и нужна.
 */

/** Все подписки с диска (JSONL → массив), новые первыми. Мусорные строки молча
 *  пропускаются: одна битая запись не должна прятать остальные. */
export function readSubscriptions(filter?: { email?: string; tierId?: TierId }): Subscription[] {
  const file = subsFile();
  if (!existsSync(file)) return [];
  // СБОЙ ЧТЕНИЯ НЕ ПРЕВРАЩАЕМ В ПУСТОЙ СПИСОК.
  //
  // Здесь стоял `catch { return [] }`, и это давало ровно тот дефект, от
  // которого соседняя функция countSubscriptions защищена с прошлой правки:
  // ноль при нечитаемом файле выглядит как «никто не купил». Замер 02.09.2026
  // пробой со сломанным хранилищем: /stats отвечал 200 и «всего 0» по ВСЕМ
  // тарифам — то есть панель показала бы «продаж нет» при целых продажах.
  //
  // Два читателя одного файла вели себя противоположно: countSubscriptions
  // честно возвращала ok:false, а эта — пустоту. Приводим к одной дисциплине.
  //
  // Ронять операцию здесь безопасно: обе зовущие ручки (/stats и /history)
  // читающие и обе уже ловят исключение, отвечая 500. «Не смогли прочитать»
  // честнее, чем «у вас ничего нет».
  //
  // Отсутствие файла по-прежнему ЧЕСТНЫЙ ноль — это обработано выше.
  const content = readFileSync(file, "utf8");
  const out: Subscription[] = [];
  const wantEmail = filter?.email?.toLowerCase().trim();
  const wantTier = filter?.tierId;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const sub = JSON.parse(line) as Subscription;
      if (wantEmail && sub.email?.toLowerCase() !== wantEmail) continue;
      if (wantTier && sub.tierId !== wantTier) continue;
      out.push(sub);
    } catch {
      // битая строка — пропускаем
    }
  }
  out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return out;
}

/** Сводка для страницы и для наблюдения: сколько всего, по тарифам, за 7 дней. */
export function aggregateSubscriptions(): {
  total: number;
  byTier: Record<TierId, number>;
  last7d: number;
  trialsActive: number;
  recent: Array<{ id: string; ts: string; tierId: TierId; period: BillingPeriod; trial: boolean }>;
} {
  const all = readSubscriptions();
  // Все семь тарифов перечислены явно: пропущенный ключ дал бы NaN в сводке.
  // Накопитель БЕЗ прототипа: ключ приходит из записи о покупке, то есть
  // в конечном счёте снаружи. У обычного `{}` имена `__proto__` и
  // `constructor` разрешаются в наследство, и строка с таким именем не просто
  // теряется из отчёта — присваивание уходит в `Object.prototype`, после чего
  // NaN наследует КАЖДЫЙ объект процесса. Проверено поведением: канал
  // `__proto__` исчезал из ответа, а `({}).count` становился NaN.
  const byTier: Record<TierId, number> = Object.assign(
    Object.create(null) as Record<TierId, number>,
    { free: 0, lite: 0, medium: 0, full: 0, enterprise: 0, pro: 0, business: 0 },
  );
  const cutoff7 = Date.now() - 7 * 86400000;
  const now = Date.now();
  let last7d = 0;
  let trialsActive = 0;
  for (const s of all) {
    byTier[s.tierId] = (byTier[s.tierId] ?? 0) + 1;
    const t = Date.parse(s.ts);
    if (!Number.isNaN(t) && t >= cutoff7) last7d++;
    if (s.trialDays > 0 && s.validUntil) {
      const v = Date.parse(s.validUntil);
      if (!Number.isNaN(v) && v >= now) trialsActive++;
    }
  }
  const recent = all.slice(0, 10).map((s) => ({
    id: s.id,
    ts: s.ts,
    tierId: s.tierId,
    period: s.period,
    trial: s.trialDays > 0,
  }));
  return { total: all.length, byTier, last7d, trialsActive, recent };
}

/** `joh***@example.com` — email наружу не отдаём целиком даже в своём кабинете. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  if (user.length <= 3) return `${user[0] ?? "*"}***@${domain}`;
  return `${user.slice(0, 3)}***@${domain}`;
}

export const provisioningRouter = Router();

/**
 * GET /api/pricing/provisioning/subscriptions/by-channel?hours=720
 *
 * Сколько денег ФАКТИЧЕСКИ пришло по каждому каналу привлечения.
 *
 * ЗАЧЕМ. Панель выручки до сих пор считает сумму из АДРЕСА ВОЗВРАТА — нашу
 * ожидаемую, а не списанную. Пока сверки не было, разница выглядела
 * теоретической; 01.09.2026 выяснилось, что кассы не смотрели на сумму вовсе, и
 * заплатить могли не столько, сколько обещала страница. Фактическая сумма
 * теперь пишется в запись подписки, эта ручка её складывает.
 *
 * ФОРМА ОТВЕТА ЗАДАНА ЧИТАТЕЛЕМ — окном, которое строит панель. Так поле не
 * окажется тем, что удобно отдать, вместо того, что нужно показать. Доводы
 * читателя, каждый со своей ценой ошибки:
 *
 *   amountUsdSum считается ТОЛЬКО по записям с суммой, и рядом обязателен
 *   withAmount — иначе частичная сумма прочтётся как полная выручка;
 *
 *   withChannel отдаётся ОТДЕЛЬНО от withAmount: у PayBox в адрес возврата
 *   уходит ссылка, а не сумма, а канал может быть неизвестен у другой покупки.
 *   Это разные пробелы, и одно число их смешает;
 *
 *   записи без канала идут в ключ "direct", а не выбрасываются: иначе сумма по
 *   каналам не сойдётся с общей и это будет выглядеть потерей денег;
 *
 *   ноль не выдумывается нигде — покупка без суммы в amountUsdSum просто не
 *   участвует, а не добавляет 0.
 *
 * ⚠️ ОТКАЗ В ЗАКРЫТУЮ, и это отличие от соседних админ-ручек намеренное. В
 * events.ts проверка вида `if (required) {...}` оставляет ручку ОТКРЫТОЙ, когда
 * ADMIN_TOKEN не задан. Для счётчиков событий это терпимо; здесь нет: у нас уже
 * был случай, когда /api/metrics оказался открыт на проде ровно потому, что
 * переменную не задали. Незаданный токен значит «закрыто», а не «свободно».
 *
 * ПЕРСОНАЛЬНЫХ ДАННЫХ НЕТ: только агрегаты. Адреса покупателей не уходят наружу
 * даже под админ-токеном — для вопроса «что окупилось» они не нужны, а утечь
 * могут.
 */
provisioningRouter.get("/subscriptions/by-channel", (req, res) => {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (!required) {
    return res.status(503).json({
      error: "admin_token_not_configured",
      hint: "ADMIN_TOKEN не задан — ручка закрыта намеренно: здесь деньги, а не счётчики",
    });
  }
  const got = (req.headers["x-admin-token"] as string | undefined)?.trim();
  if (got !== required) return res.status(401).json({ error: "unauthorized" });

  const hoursRaw = Number(req.query.hours);
  // Мусор в параметре не должен становиться пустым окном: NaN проходит сквозь
  // Math.min/Math.max и молча обнуляет выборку. Умолчание — 30 суток.
  const windowHours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(hoursRaw, 24 * 365) : 720;
  const since = Date.now() - windowHours * 3600_000;

  const subs = readSubscriptions().filter((s) => {
    const t = Date.parse(s.ts);
    return Number.isFinite(t) && t >= since;
  });

  // Накопитель БЕЗ прототипа: ключ приходит из записи о покупке, то есть
  // в конечном счёте снаружи. У обычного `{}` имена `__proto__` и
  // `constructor` разрешаются в наследство, и строка с таким именем не просто
  // теряется из отчёта — присваивание уходит в `Object.prototype`, после чего
  // NaN наследует КАЖДЫЙ объект процесса. Проверено поведением: канал
  // `__proto__` исчезал из ответа, а `({}).count` становился NaN.
  const byChannel: Record<string, { count: number; amountUsdSum: number; withAmount: number }> =
    Object.create(null);
  for (const s of subs) {
    const key = s.channel?.trim() || "direct";
    const row = (byChannel[key] ??= { count: 0, amountUsdSum: 0, withAmount: 0 });
    row.count += 1;
    if (typeof s.amountUsd === "number" && Number.isFinite(s.amountUsd)) {
      row.withAmount += 1;
      row.amountUsdSum = Math.round((row.amountUsdSum + s.amountUsd) * 100) / 100;
    }
  }

  // ⚠️ ОТКУДА ДАННЫЕ — вместе с самими данными.
  //
  // Записи о покупках лежат в файле. Если он НЕ на постоянном диске, контейнер
  // пересобирается при каждой выкатке, и сводка честно складывает всё, что
  // видит, — а видит она только покупки с последней выкатки. Снаружи это
  // неотличимо от «продаж было мало».
  //
  // Поэтому рядом с числами идёт происхождение: на диске ли файл и какая
  // запись самая старая. Читатель панели обязан подписать окно данных, а не
  // выдавать его за всю историю. Замер 01.09.2026: SUBSCRIPTIONS_FILE на проде
  // не задана, том подключён — то есть файл В КОНТЕЙНЕРЕ.
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || null;
  const file = subsFile().split(String.fromCharCode(92)).join("/");
  const onVolume = mount ? file.startsWith(mount.split(String.fromCharCode(92)).join("/")) : false;
  const all = readSubscriptions();
  const oldest = all.reduce<string | null>((acc, x) => {
    const t = Date.parse(x.ts);
    if (!Number.isFinite(t)) return acc;
    return acc === null || t < Date.parse(acc) ? x.ts : acc;
  }, null);

  // САМАЯ СВЕЖАЯ запись — тоже вообще, а не в окне.
  //
  // Замер на проде 01.09.2026: покупок всего 31, свежайшей 36 дней. При окне по
  // умолчанию (720 ч) сводка честно вернёт ноль — и панель покажет «выручка 0»,
  // что читается как «продаж нет». А правда другая: продаж не было ЗА МЕСЯЦ.
  //
  // Ноль без даты последней покупки неотличим от пустого хранилища. С ней
  // читатель может сказать «последняя покупка N дней назад» — и это уже
  // осмысленный ответ, а не пугающая цифра.
  const newest = all.reduce<string | null>((acc, x) => {
    const t = Date.parse(x.ts);
    if (!Number.isFinite(t)) return acc;
    return acc === null || t > Date.parse(acc) ? x.ts : acc;
  }, null);

  return res.json({
    byChannel,
    total: subs.length,
    withAmount: subs.filter((s) => typeof s.amountUsd === "number" && Number.isFinite(s.amountUsd)).length,
    withChannel: subs.filter((s) => Boolean(s.channel?.trim())).length,
    windowHours,
    storage: {
      // false означает «данные начинаются с последней выкатки», а не «мало продаж».
      onVolume,
      // Самая старая запись ВООБЩЕ, не в окне: по ней видно, с какого момента
      // история существует. null = записей нет совсем.
      oldestRecord: oldest,
      // Пара «самая старая — самая свежая» отвечает на два разных вопроса:
      // с какого момента история существует и когда была последняя покупка.
      newestRecord: newest,
      recordsTotal: all.length,
    },
  });
});

const HISTORY_LIMIT = 100;

provisioningRouter.get("/healthz", (_req, res) => {
  const file = subsFile();
  res.json({
    ok: true,
    storage: file,
    storageExists: existsSync(file),
    emailMode: RESEND_KEY ? "real" : "stub",
  });
});

provisioningRouter.get("/stats", (_req, res) => {
  try {
    res.json(aggregateSubscriptions());
  } catch (e) {
    console.error("[provisioning/stats] failed", e);
    res.status(500).json({ error: "stats_failed" });
  }
});


/**
 * Ограничитель на публичный поиск подписки по адресу.
 *
 * Ручка `/history` намеренно открыта: страница /pricing/provisioning даёт
 * человеку посмотреть свою подписку без входа. Цена этого решения в том, что
 * тем же запросом можно спросить про ЧУЖОЙ адрес и увидеть тариф, сумму
 * оплаты, промокод и модули (замер 28.08.2026 на проде: 200 без токена).
 *
 * Требовать вход здесь — значит убрать работающую функцию, и это решение
 * основателя, а не моё. Что можно сделать, ничего не ломая: сделать НЕВОЗМОЖНЫМ
 * перебор. Свой человек смотрит свою подписку раз-другой; тому, кто проверяет
 * список адресов, нужны тысячи запросов.
 *
 * keyPrefix задан явно: без него шесть вызовов этого помощника делили один
 * счётчик, и каждый сравнивал общую сумму со своим пределом.
 */
const historyLookupLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "provisioning-history-lookup",
  message: "Слишком много запросов. Подождите минуту и попробуйте снова.",
});

provisioningRouter.get("/history", historyLookupLimiter, (req, res) => {
  try {
    const email = (req.query.email as string | undefined)?.trim();
    if (!email) return res.status(400).json({ error: "missing_email", hint: "use ?email=..." });
    if (!email.includes("@") || email.length < 5) {
      return res.status(400).json({ error: "invalid_email" });
    }
    const items = readSubscriptions({ email }).slice(0, HISTORY_LIMIT);
    const now = Date.now();
    const enriched = items.map((s) => {
      const validTs = s.validUntil ? Date.parse(s.validUntil) : null;
      const daysLeft =
        validTs && !Number.isNaN(validTs) ? Math.max(0, Math.ceil((validTs - now) / 86400000)) : null;
      const active = validTs ? validTs >= now : true;
      const status = !active
        ? "expired"
        : s.trialDays > 0 && validTs && validTs >= now
          ? "trial"
          : "active";
      return {
        id: s.id,
        ts: s.ts,
        tierId: s.tierId,
        period: s.period,
        seats: s.seats,
        modules: s.modules,
        trialDays: s.trialDays,
        validUntil: s.validUntil ?? null,
        amountUsd: s.amountUsd ?? null,
        promoCode: s.promoCode ?? null,
        source: s.source ?? null,
        daysLeft,
        status,
        emailMasked: maskEmail(s.email),
      };
    });
    res.json({
      email: maskEmail(email),
      count: enriched.length,
      truncated: items.length >= HISTORY_LIMIT,
      items: enriched,
    });
  } catch (e) {
    console.error("[provisioning/history] failed", e);
    res.status(500).json({ error: "history_failed" });
  }
});
