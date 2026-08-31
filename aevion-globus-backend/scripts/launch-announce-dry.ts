/**
 * Сухой прогон рассылки на запуск: КОМУ уйдёт письмо и КАК оно выглядит.
 *
 * Ничего не отправляет. Ни одного письма, ни одной записи — только читает
 * выгрузку подписчиков и печатает план. Отправку выполняет владелец, потому что
 * разослать письма живым людям нельзя повторить «уже правильно».
 *
 * Использование (запускать ИЗ каталога aevion-globus-backend):
 *   AEVION_ADMIN_TOKEN=<токен> npm run launch:dry -- cyberchess
 *   AEVION_ADMIN_TOKEN=<токен> BASE=https://api.aevion.app npm run launch:dry -- devhub
 *
 * Раньше здесь стояло `npx tsx`, а tsx в проекте НЕ установлен: npx полез бы
 * за ним в сеть прямо в утро запуска. Рабочий запуск лежит в package.json
 * (`launch:dry` на ts-node), и сторож в tests/launchAnnounce.test.ts следит,
 * чтобы эта строка снова не разошлась с действительностью.
 *
 * Токен берётся ТОЛЬКО из переменной окружения и нигде не сохраняется: выгрузка
 * подписчиков — персональные данные, и путь к ним не должен оставаться в файлах
 * репозитория.
 *
 * Коды выхода: 0 — план построен; 1 — получателей ноль (см. вывод, причины
 * разные); 2 — не смог прочитать список (это НЕ «никто не подписан»).
 */

import { LAUNCH_MODULES, planLaunchAnnounce } from "../src/lib/launchAnnounce";

const BASE = (process.env.BASE || "https://api.aevion.app").replace(/\/+$/, "");
const TOKEN = process.env.AEVION_ADMIN_TOKEN?.trim();
const slug = (process.argv[2] || "").trim();

/**
 * Запущен ли файл КАК КОМАНДА, а не подключён из теста.
 *
 * Без этого признака `extractRows` экспортировался «ради теста», но воспользоваться
 * им было нельзя: при импорте срабатывали проверки ниже и звали process.exit, убивая
 * прогон. Экспорт был декоративным — тот самый класс «код обещает то, чего не делает».
 */
const INVOKED_DIRECTLY = /launch-announce-dry(\.[cm]?[jt]s)?$/.test(process.argv[1] || "");

function fail(msg: string, code: 1 | 2): never {
  console.error(msg);
  process.exit(code);
}

if (INVOKED_DIRECTLY && !slug) {
  fail(
    `Нужен модуль: npx tsx scripts/launch-announce-dry.ts <модуль>\n` +
      `Известные: ${Object.keys(LAUNCH_MODULES).join(", ")}`,
    1,
  );
}
if (INVOKED_DIRECTLY && !LAUNCH_MODULES[slug]) {
  fail(
    `Неизвестный модуль «${slug}». Известные: ${Object.keys(LAUNCH_MODULES).join(", ")}\n` +
      `Состав и даты — в src/lib/launchAnnounce.ts. Дата там может быть null: у
` +
      `четырёх модулей из пяти она не подтверждена, и подставлять её нельзя.`,
    1,
  );
}
if (INVOKED_DIRECTLY && !TOKEN) {
  fail(
    `Нет AEVION_ADMIN_TOKEN. Выгрузка подписчиков закрыта админским доступом —\n` +
      `это персональные данные, и открывать их скрипту без токена нельзя.`,
    2,
  );
}

type Row = { email: string; source: string; channel?: string | null };

/**
 * Достаёт список подписчиков из ответа выгрузки.
 *
 * Поле называется `items` — и это ровно то место, где я уже ошибся: скрипт читал
 * `rows`, ручка отдавала `items`, и сухой прогон печатал «получателей нет» при
 * живых подписчиках, да ещё убедительно объяснял это двумя причинами. Молчаливый
 * ноль хуже ошибки.
 *
 * Поэтому: перечисляем известные имена, а при неизвестном формате возвращаем null
 * — вызывающий обязан сказать «формат не распознан», а не «никого нет».
 * Пустой массив от отсутствия поля отличается намеренно.
 */
export function extractRows(body: Record<string, unknown>): Row[] | null {
  for (const key of ["items", "rows", "subscribers"]) {
    const v = body[key];
    if (Array.isArray(v)) {
      return v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({ email: String(x.email ?? ""), source: String(x.source ?? "") }))
        .filter((r) => r.email);
    }
  }
  return null;
}


async function readSubscribers(): Promise<{ rows: Row[]; source: string; truncated: boolean }> {
  const url = `${BASE}/api/constitution/waitlist/list`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  } catch (e) {
    fail(`Не смог обратиться к ${url}: ${e instanceof Error ? e.message : e}`, 2);
  }
  if (!res.ok) {
    fail(
      `Список не прочитан: HTTP ${res.status}. Это НЕ «никто не подписан» —\n` +
        `при 403 проверьте токен, при 5xx повторите позже.`,
      2,
    );
  }
  const body = (await res.json()) as Record<string, unknown>;
  const parsed = extractRows(body);
  if (!parsed) {
    fail(
      [
        "Ответ получен, но список подписчиков в нём не найден.",
        `Известные поля: ${Object.keys(body).join(", ") || "(пусто)"}`,
        "Это НЕ «никто не подписан» — формат ответа изменился, и печатать ноль",
        "получателей здесь было бы ложью.",
      ].join("\n"),
      2,
    );
  }
  // Выгрузка сама говорит, откуда список и не обрезан ли он — используем это,
  // иначе план мог бы строиться по неполным данным и выглядеть полным.
  return {
    rows: parsed,
    source: String(body.source ?? "unknown"),
    truncated: Boolean(body.truncated),
  };
}

async function main(): Promise<void> {
  const { rows, source, truncated } = await readSubscribers();
  const plan = planLaunchAnnounce(slug, rows);
  const m = LAUNCH_MODULES[slug];

  console.log(`Сухой прогон рассылки · ${m.name} · запуск ${m.date}`);
  console.log(`  источник списка : ${source}${truncated ? " (ОБРЕЗАН)" : ""}`);
  console.log(`  просмотрено     : ${plan.scanned}`);
  console.log(`  получателей     : ${plan.recipients.length}`);
  console.log(`  отправлено      : ${plan.sent}  ← этот скрипт не отправляет`);

  /*
   * Откуда пришли эти люди.
   *
   * Метка канала у подписчиков появилась 31.08.2026; до неё в списке хранилась
   * только страница. Ответ печатается здесь, потому что подписчиков не видно
   * НИГДЕ БОЛЬШЕ: экрана со списком нет, и единственный читатель этой выгрузки —
   * два скрипта рассылки.
   *
   * «не знаем» показывается отдельной строкой и не сливается с прямыми
   * заходами: подписавшиеся до 31.08 и пришедшие без метки — это незнание, а не
   * прямой трафик, и смешивать их значит завышать долю прямых.
   */
  const поКаналам = new Map<string, number>();
  for (const r of rows) {
    const k = r.channel && String(r.channel).trim() ? String(r.channel) : "не знаем";
    поКаналам.set(k, (поКаналам.get(k) ?? 0) + 1);
  }
  if (поКаналам.size) {
    console.log("");
    console.log("  откуда пришли (по всему списку, не только получатели):");
    for (const [k, v] of [...поКаналам.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(12)} ${v}`);
    }
  }

  if (source !== "postgres") {
    console.log("");
    console.log("⚠️  Список НЕ из базы, а из памяти сервера — он почти наверняка неполный.");
    console.log("   Планировать рассылку по нему нельзя: часть подписчиков в него не попадёт.");
  }
  if (truncated) {
    console.log("");
    console.log("⚠️  Выгрузка обрезана по предельному числу строк — получателей больше, чем видно.");
  }

  if (!plan.recipients.length) {
    console.log("");
    console.log(`Получателей нет. Возможных причин две, и они разные:`);
    console.log(`  • на посадочной ${m.name} действительно никто не оставил адрес;`);
    console.log(`  • подписки есть, но старше 19.08.2026 — до этой даты метка источника`);
    console.log(`    ПЕРЕЗАПИСЫВАЛАСЬ последней подпиской, и у таких записей интерес к`);
    console.log(`    ${m.name} мог быть затёрт. Новые подписки метки накапливают.`);
    console.log(`Просмотрено записей: ${plan.scanned} — если это ноль, список не прочитан.`);
    process.exit(1);
  }

  console.log("");
  console.log("Первые адреса (до десяти):");
  for (const e of plan.recipients.slice(0, 10)) console.log(`  ${e}`);
  if (plan.recipients.length > 10) console.log(`  … и ещё ${plan.recipients.length - 10}`);

  console.log("");
  console.log("Письмо, которое они получат:");
  console.log(`  тема: ${plan.preview?.subject}`);
  console.log("");
  console.log((plan.preview?.textContent ?? "").split("\n").map((l) => `  ${l}`).join("\n"));
  console.log("");
  console.log("Ни одно письмо не отправлено. Отправка — отдельным решением владельца.");
}

if (INVOKED_DIRECTLY) void main();
