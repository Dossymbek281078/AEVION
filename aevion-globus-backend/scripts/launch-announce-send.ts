/**
 * ОТПРАВКА рассылки на запуск. В отличие от соседнего launch-announce-dry.ts,
 * этот файл письма ШЛЁТ.
 *
 * Отправка — единственное необратимое действие платформы: письмо ушло живым
 * людям, «уже» не отменяется. Поэтому охрана здесь избыточна намеренно.
 *
 * ЧТОБЫ ОТПРАВИТЬ, нужны три независимых жеста — случайно их не совершить:
 *
 *   1. флаг --send                        (осознанный запуск не того скрипта)
 *   2. LAUNCH_ANNOUNCE_CONFIRM=<модуль>   (совпадает с аргументом; защита от
 *                                          «стрелка вверх» в терминале)
 *   3. AEVION_ADMIN_TOKEN                 (доступ к списку подписчиков)
 *
 * Без --send скрипт ведёт себя как сухой прогон: печатает, кому ушло бы, и
 * выходит. Это режим по умолчанию, а не запасной.
 *
 * ЧЕГО СКРИПТ НЕ СДЕЛАЕТ:
 *   • не отправит письмо про модуль, день запуска которого ещё не наступил —
 *     «открылось» до открытия хуже молчания;
 *   • не отправит второй раз тому, кто уже получил: список отправленных
 *     ведётся в data/launch-sent-<модуль>.jsonl и дописывается ПОСЛЕ каждого
 *     успешного письма, а не в конце — обрыв на середине не теряет след;
 *   • не превысит суточный потолок провайдера (у Brevo 300 на нашем плане);
 *     остаток честно называется в отчёте, а не молча теряется.
 *
 * Использование (из каталога aevion-globus-backend):
 *   AEVION_ADMIN_TOKEN=<токен> npm run launch:send -- devhub
 *   AEVION_ADMIN_TOKEN=<токен> LAUNCH_ANNOUNCE_CONFIRM=devhub \
 *     npm run launch:send -- devhub --send
 *
 * Коды выхода: 0 — сделано (или сухой прогон прошёл); 1 — отправлять некому
 * или день не наступил; 2 — не смог прочитать список или отправка сломалась.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  LAUNCH_MODULES,
  buildLaunchEmail,
  isLiveNow,
  planLaunchAnnounce,
  planSendBatch,
  checkSendGate,
} from "../src/lib/launchAnnounce";
import { sendBrevoEmail } from "../src/lib/constitutionBrevo";
import { extractRows } from "./launch-announce-dry";

const BASE = (process.env.BASE || "https://api.aevion.app").replace(/\/+$/, "");
const TOKEN = process.env.AEVION_ADMIN_TOKEN?.trim();
const slug = (process.argv[2] || "").trim();
const ЖИВОЙ = process.argv.includes("--send");
const ПОДТВЕРЖДЕНИЕ = (process.env.LAUNCH_ANNOUNCE_CONFIRM || "").trim();
const DAILY_CAP = Number(process.env.BREVO_DAILY_SOFT_CAP) || 300;

function стоп(code: number, ...msg: unknown[]): never {
  console.error(...msg);
  process.exit(code);
}

const файлОтправленных = join(
  process.cwd(),
  "data",
  `launch-sent-${slug || "unknown"}.jsonl`,
);

function ужеОтправлено(): string[] {
  if (!existsSync(файлОтправленных)) return [];
  return readFileSync(файлОтправленных, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return String((JSON.parse(l) as { email?: string }).email ?? "");
      } catch {
        // Битая строка — НЕ повод считать, что человек письма не получал:
        // тогда он получит второе. Пустая строка просто не совпадёт ни с кем,
        // а о повреждении скажем вслух ниже.
        return "";
      }
    })
    .filter(Boolean);
}

function записатьОтправку(email: string): void {
  mkdirSync(dirname(файлОтправленных), { recursive: true });
  appendFileSync(
    файлОтправленных,
    JSON.stringify({ email, at: new Date().toISOString() }) + "\n",
    "utf8",
  );
}

async function читатьПодписчиков(): Promise<Array<{ email: string; source: string }>> {
  const res = await fetch(`${BASE}/api/constitution/waitlist/list`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) стоп(2, `Список подписчиков не отдан: HTTP ${res.status}`);
  const rows = extractRows((await res.json()) as Record<string, unknown>);
  if (!rows) стоп(2, "Ответ есть, а списка в нём нет — формат изменился.");
  return rows;
}

/**
 * Расход писем за сутки. Источник один — ручка состояния сервера; своего
 * счётчика здесь нет намеренно, иначе их стало бы два и они разошлись бы.
 */
async function спроситьРасход(): Promise<{ count: number; cap: number; неизвестно: boolean }> {
  try {
    // Расход отдают только по админскому заголовку: наружу это число не
    // выкладывается. Токен у скрипта есть — тот же, которым он читает список.
    const r = await fetch(`${BASE}/api/health/channels`, {
      headers: process.env.ADMIN_TOKEN ? { "x-admin-token": process.env.ADMIN_TOKEN } : {},
    });
    const j = (await r.json()) as { mail?: { sentToday?: number; dailyCap?: number } };
    const count = j.mail?.sentToday;
    const cap = j.mail?.dailyCap ?? DAILY_CAP;
    if (typeof count === "number") return { count, cap, неизвестно: false };
  } catch {
    // ниже — общий запасной путь
  }
  // «Не знаю» — это не «ноль». Половина потолка выбрана как осторожная
  // середина: рассылка уйдёт частями, но провайдер не отсечёт её молча.
  return { count: Math.floor(DAILY_CAP / 2), cap: DAILY_CAP, неизвестно: true };
}

async function main(): Promise<void> {
  const модуль = LAUNCH_MODULES[slug];
  if (!модуль) стоп(1, `Неизвестный модуль «${slug}». Известны: ${Object.keys(LAUNCH_MODULES).join(", ")}`);
  if (!TOKEN) стоп(2, "Нет AEVION_ADMIN_TOKEN — список подписчиков закрыт админ-токеном.");

  // Решение вынесено в lib/launchAnnounce.ts и проверено там же: отправка
  // необратима, и охрана обязана быть прогоняемой без настоящих писем.
  const ворота = checkSendGate({
    slug,
    sendFlag: ЖИВОЙ,
    confirmEnv: ПОДТВЕРЖДЕНИЕ,
    isLive: isLiveNow(модуль.liveFromUtcMidnight),
  });
  if (!ворота.allowed && ворота.reason !== "dry") {
    const тексты: Record<string, string> = {
      "confirm-missing": `Отправка требует LAUNCH_ANNOUNCE_CONFIRM=${slug}. Это второй жест: он не повторяется стрелкой вверх в терминале.`,
      "confirm-mismatch": `LAUNCH_ANNOUNCE_CONFIRM не совпадает с модулем «${slug}» — похоже, отправляете не то.`,
      "not-live": `День запуска «${модуль.name}» ещё не наступил. Письмо «открылось» до открытия хуже молчания.`,
    };
    стоп(1, тексты[ворота.reason]);
  }

  const rows = await читатьПодписчиков();
  const план = planLaunchAnnounce(slug, rows);
  // Сколько писем ушло сегодня — спрашиваем СЕРВЕР: счётчик живёт в его
  // памяти, а этот скрипт отдельный процесс и сам по себе видел бы ноль.
  // Не ответил — считаем потолок исчерпанным наполовину и говорим об этом
  // вслух: пробить потолок молча хуже, чем отправить меньше.
  const ушлоСегодня = await спроситьРасход();
  const заход = planSendBatch({
    recipients: план.recipients,
    alreadySent: ужеОтправлено(),
    usedToday: ушлоСегодня.count,
    dailyCap: ушлоСегодня.cap,
  });
  if (ушлоСегодня.неизвестно) {
    console.warn(`⚠️  Расход за сутки спросить не удалось; считаю, что ушло ${ушлоСегодня.count} из ${ушлоСегодня.cap}.`);
  }

  console.log(`Модуль:            ${план.moduleName} (${slug})`);
  console.log(`Просмотрено:       ${план.scanned}`);
  console.log(`Подходят:          ${план.recipients.length}`);
  console.log(`Уже получили:      ${заход.alreadySent}`);
  console.log(`Отправить сейчас:  ${заход.toSend.length}`);
  console.log(`Останется на потом:${заход.postponed}`);

  if (!ЖИВОЙ) {
    console.log("\nЭто СУХОЙ прогон. Ни одного письма не отправлено.");
    console.log(`Отправить: LAUNCH_ANNOUNCE_CONFIRM=${slug} npm run launch:send -- ${slug} --send`);
    process.exit(заход.toSend.length > 0 ? 0 : 1);
  }

  let ушло = 0;
  const неУшло: string[] = [];
  for (const email of заход.toSend) {
    const письмо = buildLaunchEmail(slug, email);
    const r = await sendBrevoEmail(письмо);
    if (r.ok) {
      // Пишем СРАЗУ, а не в конце: обрыв на середине не должен приводить к
      // повторной отправке уже получившим.
      записатьОтправку(email);
      ушло++;
    } else {
      неУшло.push(`${email}: ${r.error ?? "неизвестная ошибка"}`);
    }
  }

  console.log(`\nОтправлено: ${ушло}`);
  if (неУшло.length) {
    console.error(`Не ушло: ${неУшло.length}`);
    неУшло.slice(0, 10).forEach((s) => console.error("  " + s));
  }
  if (заход.postponed > 0) {
    console.log(`\n⚠️  ${заход.postponed} адресов не влезли в суточный потолок (${DAILY_CAP}).`);
    console.log("   Запустите ту же команду завтра — уже получившие пропустятся.");
  }
  process.exit(неУшло.length ? 2 : 0);
}

main().catch((e) => стоп(2, "Сбой:", e instanceof Error ? e.message : e));
