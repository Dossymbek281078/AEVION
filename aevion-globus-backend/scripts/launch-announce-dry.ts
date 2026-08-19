/**
 * Сухой прогон рассылки на запуск: КОМУ уйдёт письмо и КАК оно выглядит.
 *
 * Ничего не отправляет. Ни одного письма, ни одной записи — только читает
 * выгрузку подписчиков и печатает план. Отправку выполняет владелец, потому что
 * разослать письма живым людям нельзя повторить «уже правильно».
 *
 * Использование:
 *   AEVION_ADMIN_TOKEN=<токен> npx tsx scripts/launch-announce-dry.ts devhub
 *   AEVION_ADMIN_TOKEN=<токен> BASE=https://api.aevion.app npx tsx scripts/launch-announce-dry.ts cyberchess
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

function fail(msg: string, code: 1 | 2): never {
  console.error(msg);
  process.exit(code);
}

if (!slug) {
  fail(
    `Нужен модуль: npx tsx scripts/launch-announce-dry.ts <модуль>\n` +
      `Известные: ${Object.keys(LAUNCH_MODULES).join(", ")}`,
    1,
  );
}
if (!LAUNCH_MODULES[slug]) {
  fail(
    `Неизвестный модуль «${slug}». Известные: ${Object.keys(LAUNCH_MODULES).join(", ")}\n` +
      `Даты и состав решаются в scripts/launch-readiness.mjs и src/lib/launchAnnounce.ts.`,
    1,
  );
}
if (!TOKEN) {
  fail(
    `Нет AEVION_ADMIN_TOKEN. Выгрузка подписчиков закрыта админским доступом —\n` +
      `это персональные данные, и открывать их скрипту без токена нельзя.`,
    2,
  );
}

type Row = { email: string; source: string };

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
  const body = (await res.json()) as {
    rows?: Row[];
    subscribers?: Row[];
    source?: string;
    truncated?: boolean;
    dbQueryFailed?: boolean;
  };
  const rows = body.rows ?? body.subscribers ?? [];
  // Выгрузка сама говорит, откуда список и не обрезан ли он — используем это,
  // иначе план мог бы строиться по неполным данным и выглядеть полным.
  return {
    rows,
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
    console.log(`  • метка источника перезаписана более поздней подпиской — известный`);
    console.log(`    дефект, разбор в ОДИН-АДРЕС-ОДИН-ИНТЕРЕС-19-08.md.`);
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

void main();
