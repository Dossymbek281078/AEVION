/**
 * Напоминание о закрытии окна веера.
 *
 * Механика веера держится на СРОКЕ: 14 дней от последней покупки, дальше
 * скидка исчезает. До 2026-07-27 срок истекал молча — покупатель узнавал об
 * этом, только вернувшись на сайт после закрытия. У Higgsfield, с которого
 * снята механика, дедлайн виден постоянно; счётчик в интерфейсе мы добавили,
 * письмо — вторая половина той же петли.
 *
 * ⚠️ ПО УМОЛЧАНИЮ НИЧЕГО НЕ ОТПРАВЛЯЕТ. Рассылка — необратимое действие во
 * внешний мир, её включает владелец, а не скрипт. Без `--send` выводится
 * ровно то, что было бы отправлено, и на этом всё.
 *
 * Запуск:
 *   npx tsx scripts/fan-window-reminder.ts            # сухой прогон (по умолчанию)
 *   npx tsx scripts/fan-window-reminder.ts --send     # реальная отправка
 *   REMIND_DAYS=5 npx tsx scripts/fan-window-reminder.ts
 *
 * Идемпотентность: отправленные напоминания пишутся в
 * `data/fan-reminders.jsonl` (email + дата закрытия окна). Повторный запуск в
 * тот же день ничего не задваивает — окно определяется парой (email, validUntil),
 * а не датой запуска.
 */
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { listSubscriptionEmails, sendEmail } from "../src/routes/provisioning";
import { readOwnedModules } from "../src/lib/ownedModules";
import { computeFan } from "../src/data/fanDiscounts";

const SEND = process.argv.includes("--send");
/** За сколько дней до закрытия напоминаем. */
const REMIND_DAYS = Math.max(0, Math.min(13, Number(process.env.REMIND_DAYS ?? 3)));
const LOG = process.env.FAN_REMINDER_LOG?.trim() || join(__dirname, "..", "data", "fan-reminders.jsonl");
const FRONTEND = process.env.FRONTEND_URL?.trim() || "https://aevion.vercel.app";

interface Sent {
  email: string;
  validUntil: string;
  ts: string;
}

function alreadyReminded(): Set<string> {
  const key = new Set<string>();
  if (!existsSync(LOG)) return key;
  for (const line of readFileSync(LOG, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as Sent;
      key.add(`${r.email}|${r.validUntil}`);
    } catch {
      /* битая строка не должна блокировать рассылку */
    }
  }
  return key;
}

function remember(rec: Sent): void {
  mkdirSync(dirname(LOG), { recursive: true });
  appendFileSync(LOG, JSON.stringify(rec) + "\n", "utf8");
}

function html(daysLeft: number, top: Array<{ module: string; discountPercent: number }>): string {
  const rows = top
    .map((o) => `<li><strong>${o.module}</strong> — −${o.discountPercent}%</li>`)
    .join("");
  const when = daysLeft <= 0 ? "сегодня" : `через ${daysLeft} дн.`;
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.6">
  <p>Ваш веер скидок AEVION закрывается <strong>${when}</strong>.</p>
  <p>Пока он открыт, эти модули стоят дешевле:</p>
  <ul>${rows}</ul>
  <p>Любая новая покупка открывает окно заново на 14 дней.</p>
  <p><a href="${FRONTEND}/pricing" style="color:#0d9488;font-weight:700">Посмотреть свой веер</a></p>
</div>`;
}

/**
 * Кому напоминать — правило отбора отдельно от рассылки.
 *
 * Вынесено из main(), чтобы его можно было проверить тестом, а не «прогоном на
 * проде». Скрипты в `scripts/` не покрываются `tsc` (в tsconfig только
 * `src/**`), поэтому единственная страховка здесь — тест.
 */
export function shouldRemind(
  fan: { status: string; daysLeft: number | null; validUntil: string | null; offers: Array<{ discountPercent: number }> },
  opts: { remindDays: number; alreadySent: Set<string>; email: string },
): { remind: boolean; reason: string } {
  if (fan.status !== "active") return { remind: false, reason: "окно не активно" };
  if (fan.daysLeft === null) return { remind: false, reason: "нет срока" };
  if (fan.daysLeft > opts.remindDays) return { remind: false, reason: "ещё рано" };
  if (opts.alreadySent.has(`${opts.email}|${fan.validUntil}`)) {
    return { remind: false, reason: "уже напоминали про это окно" };
  }
  if (!fan.offers.some((o) => o.discountPercent > 0)) {
    return { remind: false, reason: "нечего предложить со скидкой" };
  }
  return { remind: true, reason: "окно закрывается" };
}

async function main(): Promise<void> {
  const emails = listSubscriptionEmails();
  const done = alreadyReminded();
  const now = new Date();

  console.log(
    `Напоминание о закрытии окна · порог ${REMIND_DAYS} дн. · адресов в сторе: ${emails.length} · ` +
      `режим: ${SEND ? "ОТПРАВКА" : "сухой прогон (ничего не отправляется)"}`,
  );

  let matched = 0;
  let skipped = 0;
  let sent = 0;

  for (const email of emails) {
    const owned = await readOwnedModules(email);
    // Неполные данные — не повод писать «у вас ничего нет»: пропускаем молча,
    // напомним на следующем прогоне (тот же принцип, что в панели веера).
    if (owned.appsSource === "unavailable") {
      skipped++;
      continue;
    }
    const fan = computeFan({
      tierId: owned.tierId,
      owned: owned.modules,
      lastPurchaseAt: owned.fanAnchorAt ?? undefined,
      now,
    });
    const verdict = shouldRemind(fan, { remindDays: REMIND_DAYS, alreadySent: done, email });
    if (!verdict.remind) {
      if (verdict.reason === "уже напоминали про это окно") skipped++;
      continue;
    }

    const top = fan.offers
      .filter((o) => o.discountPercent > 0)
      .slice(0, 5)
      .map((o) => ({ module: o.module, discountPercent: o.discountPercent }));

    matched++;
    const subject = `Веер скидок закрывается ${fan.daysLeft <= 0 ? "сегодня" : `через ${fan.daysLeft} дн.`}`;
    console.log(
      `  ${SEND ? "→" : "(сухой)"} ${email} · осталось ${fan.daysLeft} дн. · до ${fan.validUntil} · ` +
        `модулей со скидкой: ${top.length} (${top.map((t) => `${t.module} −${t.discountPercent}%`).join(", ")})`,
    );

    if (!SEND) continue;
    const res = await sendEmail({ to: email, subject, html: html(fan.daysLeft, top) });
    if (res.ok) {
      sent++;
      remember({ email, validUntil: fan.validUntil!, ts: new Date().toISOString() });
    } else {
      console.error(`     ✗ не отправлено: ${res.error ?? "неизвестная ошибка"}`);
    }
  }

  console.log(
    `\nИтог: подходят под напоминание — ${matched}, пропущено (уже напомнили / нет данных) — ${skipped}` +
      (SEND ? `, отправлено — ${sent}` : `, отправлено — 0 (сухой прогон)`),
  );
  if (!SEND && matched > 0) {
    console.log("Чтобы отправить по-настоящему: тот же запуск с флагом --send.");
  }
}

main().catch((e) => {
  console.error("[fan-window-reminder] упал:", e);
  process.exit(1);
});
