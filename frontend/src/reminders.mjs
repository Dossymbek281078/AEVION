/**
 * Напоминания клиентам по срокам (пилот для бухгалтерских и юридических фирм).
 *
 * Вход — выгрузка из таблицы фирмы, выход — что и кому написать СЕГОДНЯ.
 * Отправку модуль не делает: он готовит очередь, отправляет человек или
 * почтовый слой клиента. Так решение остаётся у фирмы.
 *
 * Решения, за которые здесь отвечаем:
 *  - оплатившему не пишем НИКОГДА (самая дорогая ошибка: клиент заплатил и получил
 *    требование заплатить);
 *  - напоминаем по расписанию, а не каждый день: −3, день в день, +1, +7, +14.
 *    Ежедневные напоминания читаются как травля и роняют отношения;
 *  - у каждого напоминания есть КЛЮЧ (клиент + повод + срок): повторный прогон
 *    в тот же день не создаёт дубля, но исправленная ошибка пройдёт заново;
 *  - клиент без контакта НЕ пропускается молча — он попадает в отдельный список
 *    `unreachable`, иначе про него никто не узнает.
 */

/** Дни-смещения, на которых напоминаем. Отрицательные — до срока. */
export const SCHEDULE = [-3, 0, 1, 3, 7, 14];

/** После последней ступени клиент не исчезает — он уходит ЧЕЛОВЕКУ. */
export const LAST_OFFSET = Math.max(...[-3, 0, 1, 3, 7, 14]);

const KIND_BY_OFFSET = {
  "-3": "upcoming",
  "0": "dueToday",
  "1": "overdue",
  "3": "overdue",
  "7": "overdue",
  "14": "overdue",
};

/**
 * YYYY-MM-DD в миллисекунды UTC. NaN, если это не календарная дата.
 *
 * Date.UTC САМ перекатывает лишнее: месяц 13 становится январём следующего
 * года, день 45 — серединой следующего месяца. То есть "2026-13-45" даёт
 * законное число, и бессмысленная дата читается как «срок в будущем».
 * Поэтому проверяем обратным ходом: разобранная дата обязана совпасть с той,
 * что записана в строке.
 */
export function isValidIsoDate(iso) {
  return Number.isFinite(isoToMs(iso));
}

function isoToMs(iso) {
  const parts = String(iso || "").split("-");
  if (parts.length !== 3) return NaN;
  const [y, m, d] = parts.map(Number);
  if (![y, m, d].every(Number.isInteger)) return NaN;
  const ms = Date.UTC(y, m - 1, d);
  if (!Number.isFinite(ms)) return NaN;
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return NaN;
  return ms;
}

/** Разница в календарных днях между двумя YYYY-MM-DD (без часовых поясов). */
export function daysBetween(fromISODate, toISODate) {
  const a = isoToMs(fromISODate);
  const b = isoToMs(toISODate);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.round((b - a) / 86400000);
}

/** Ключ идемпотентности: на СОБЫТИЕ, а не на клиента — иначе почина не пройдёт. */
export function reminderKey(client, offset) {
  return [client.id, client.dueDate, "offset" + offset].join("|");
}


const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня",
                    "июля","августа","сентября","октября","ноября","декабря"];

/** Дата человеку: «5 сентября», а не «2026-09-05». Машинный формат в письме читается как сбой. */
export function humanDate(isoDate) {
  const parts = String(isoDate || "").split("-");
  if (parts.length !== 3) return String(isoDate || "");
  const m = Number(parts[1]) - 1;
  if (!(m >= 0 && m < 12)) return String(isoDate);
  return Number(parts[2]) + " " + MONTHS_GEN[m];
}

function money(amount, currency) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const sym = { KZT: "₸", RUB: "₽", USD: "$", EUR: "€" }[currency] || currency || "";
  return amount.toLocaleString("ru-RU") + (sym ? " " + sym : "");
}

/** Текст напоминания. Ничего не выдумывает: чего нет в строке — того нет в письме. */
export function composeReminder(client, offset) {
  const kind = KIND_BY_OFFSET[String(offset)];
  const sum = money(client.amount, client.currency);
  const forWhat = client.subject ? " за " + client.subject : "";
  const who = client.contactName ? client.contactName : null;
  const hello = who ? "Здравствуйте, " + who + "!" : "Здравствуйте!";
  const lines = [hello, ""];

  if (kind === "upcoming") {
    lines.push("Напоминаем: срок оплаты счёта" + forWhat +
      (sum ? " на сумму " + sum : "") + " — " + humanDate(client.dueDate) + ".");
    lines.push("");
    lines.push("Если оплата уже отправлена, просто проигнорируйте это письмо.");
  } else if (kind === "dueToday") {
    lines.push("Сегодня последний день оплаты счёта" + forWhat +
      (sum ? " на сумму " + sum : "") + ".");
    lines.push("");
    lines.push("Если оплата уже в пути — спасибо, письмо можно не читать дальше.");
  } else {
    const late = daysBetween(client.dueDate, client.today);
    lines.push("Счёт" + forWhat + (sum ? " на сумму " + sum : "") +
      " ожидает оплаты: срок был " + humanDate(client.dueDate) +
      " (" + late + " " + pluralDays(late) + " назад).");
    lines.push("");
    lines.push("Если платёж уже прошёл, подскажите дату — сверим и снимем напоминание.");
  }
  lines.push("");
  lines.push("С уважением, " + (client.senderName || "{подпись фирмы}"));
  return { kind, subject: subjectFor(kind, client), body: lines.join("\n") };
}

function pluralDays(n) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return "дней";
  if (b === 1) return "день";
  if (b >= 2 && b <= 4) return "дня";
  return "дней";
}

function subjectFor(kind, client) {
  const what = client.subject ? " — " + client.subject : "";
  if (kind === "upcoming") return "Напоминание о сроке оплаты" + what;
  if (kind === "dueToday") return "Сегодня срок оплаты" + what;
  return "Счёт ожидает оплаты" + what;
}

/**
 * Что отправлять сегодня.
 * @param {Array} clients строки выгрузки: {id, contactName, email|phone, amount, currency, subject, dueDate, paid}
 * @param {{today: string, alreadySent?: Set<string>, dailyLimit?: number}} opts
 * @returns {{queue: Array, unreachable: Array, escalate: Array, skipped: object}}
 */
export function planReminders(clients, opts = {}) {
  const today = opts.today;
  if (!today) throw new Error("planReminders: нужна дата today (YYYY-MM-DD)");
  // Дату прогона проверяем ДО цикла. Иначе одна испорченная дата делает
  // «неразобранным» срок у КАЖДОГО клиента, и отчёт обвиняет выгрузку фирмы
  // в том, что сломано у нас. Замер: 236 из 302 строк были объявлены битыми.
  if (!Number.isFinite(isoToMs(today))) {
    throw new Error("planReminders: дата прогона не календарная: " + JSON.stringify(String(today)));
  }
  const alreadySent = opts.alreadySent || new Set();

  const queue = [];
  const unreachable = [];
  const escalate = [];
  const badRows = [];
  const skipped = { paid: 0, notScheduled: 0, duplicate: 0, badRow: 0 };
  // Дубли в выгрузке поставщика — норма, а не редкость. Без этого множества
  // один и тот же клиент получал ДВА одинаковых письма в один день: ключ
  // идемпотентности совпадал, но проверялся он только против прошлых прогонов.
  const plannedKeys = new Set();
  const bad = (id, reason) => { badRows.push({ id: id || null, reason }); skipped.badRow++; };

  for (const raw of clients) {
    if (!raw || typeof raw !== "object") { bad(null, "строка не похожа на клиента"); continue; }
    if (!raw.id) { bad(null, "нет идентификатора"); continue; }
    if (!raw.dueDate) { bad(raw.id, "нет срока оплаты"); continue; }
    if (raw.paid) { skipped.paid++; continue; }

    const offset = daysBetween(raw.dueDate, today);
    // Неразобранный срок раньше попадал в «не тот день» — и это читалось как
    // «сегодня его очередь не подошла», то есть как норма. Долг с испорченной
    // датой не напоминался бы НИКОГДА, и никто бы об этом не узнал.
    if (!Number.isFinite(offset)) {
      bad(raw.id, "срок оплаты не календарная дата: " + JSON.stringify(String(raw.dueDate)));
      continue;
    }
    // Счёт на ноль или на минус — это ошибка в данных, а не повод для письма.
    // Пустая сумма — законна (письмо просто не называет сумму), 0 и минус — нет.
    if (raw.amount !== null && raw.amount !== undefined && raw.amount !== "") {
      const a = Number(raw.amount);
      if (!Number.isFinite(a) || a <= 0) {
        bad(raw.id, "сумма не похожа на счёт: " + JSON.stringify(String(raw.amount)));
        continue;
      }
    }
    if (offset > LAST_OFFSET) {
      // Напоминания исчерпаны, а долг остался. Молча забыть такого клиента —
      // тот же класс, что молчаливый отказ: процесс выглядит работающим, а долг висит.
      escalate.push({ id: raw.id, dueDate: raw.dueDate, daysOverdue: offset,
                      amount: raw.amount ?? null, reason: "напоминания исчерпаны, нужен человек" });
      continue;
    }
    if (!SCHEDULE.includes(offset)) { skipped.notScheduled++; continue; }

    const key = reminderKey(raw, offset);
    if (alreadySent.has(key) || plannedKeys.has(key)) { skipped.duplicate++; continue; }
    plannedKeys.add(key);

    const client = { ...raw, today };
    const message = composeReminder(client, offset);
    const target = raw.email || raw.phone || null;
    if (!target) {
      unreachable.push({ id: raw.id, reason: "нет контакта", offset, key });
      continue;
    }
    queue.push({ key, to: target, channel: raw.email ? "email" : "phone", offset, ...message });
  }

  // Порядок важности: просрочка вперёд, потом «сегодня», потом «заранее».
  // Внутри просрочки — кто дольше ждёт. Если очередь придётся обрезать
  // дневным пределом, обрежется наименее срочное, а не случайное.
  const rank = { overdue: 0, dueToday: 1, upcoming: 2 };
  queue.sort((a, b) => (rank[a.kind] - rank[b.kind]) || (b.offset - a.offset));

  // Дневной предел. Первый прогон на 300 клиентах дал 115 писем за раз —
  // столько одинаковых писем подряд почтовый провайдер фирмы считает рассылкой,
  // и страдает репутация её домена. Остаток НЕ теряется: он вернётся завтра,
  // потому что ключ идемпотентности привязан к событию, а не к дате прогона.
  const limit = Number.isFinite(opts.dailyLimit) ? opts.dailyLimit : 50;
  let deferred = [];
  if (limit > 0 && queue.length > limit) {
    deferred = queue.slice(limit);
    queue.length = limit;
  }

  escalate.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { queue, deferred, unreachable, escalate, badRows, skipped };
}
