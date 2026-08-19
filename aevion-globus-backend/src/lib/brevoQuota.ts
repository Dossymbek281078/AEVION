import { captureException } from "./sentry";

/**
 * Сколько писем ушло за сутки — чтобы исчерпание квоты перестало быть НЕВИДИМЫМ.
 *
 * У Brevo на текущем плане потолок 300 писем в сутки (CLAUDE.md окна запуска).
 * Публичная подписка шлёт письмо на каждый запрос, и предела «10 в минуту на адрес»
 * хватало, чтобы выбрать суточную квоту с одного адреса за полчаса. После этого
 * подтверждения не приходят НИКОМУ, а снаружи это выглядит как «письма задерживаются».
 *
 * Здесь намеренно СЧЁТЧИК И ТРЕВОГА, а не запрет: запрет никого не спасает — упёрлись
 * мы сами или посторонний, подписчик всё равно останется без письма. Спасает то, что
 * основатель узнаёт об исчерпании до того, как воронка тихо умрёт.
 *
 * Счётчик в памяти процесса: при перезапуске обнуляется, при нескольких экземплярах
 * недосчитывает. Это осознанно — он ПОРОГОВЫЙ сигнал, а не учёт для биллинга, и
 * недосчёт здесь означает «сообщим позже», а не «пропустим навсегда».
 */
const DAILY_SOFT_CAP = Number(process.env.BREVO_DAILY_SOFT_CAP) || 300;
let sentDay = "";
let sentCount = 0;
const warnedAt = new Set<number>();

/** Отмечает отправку и поднимает тревогу на 2/3 и на 9/10 квоты. Только читает наружу. */
export function noteEmailSent(): { day: string; count: number } {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== sentDay) {
    sentDay = today;
    sentCount = 0;
    warnedAt.clear();
  }
  sentCount += 1;
  for (const share of [2 / 3, 9 / 10]) {
    const mark = Math.floor(DAILY_SOFT_CAP * share);
    if (sentCount >= mark && !warnedAt.has(mark)) {
      warnedAt.add(mark);
      const msg =
        `[Brevo] за сутки отправлено ${sentCount} писем из ${DAILY_SOFT_CAP} — ` +
        `при исчерпании подтверждения подписки перестанут приходить всем`;
      console.warn(msg);
      captureException(new Error(msg), { where: "brevo.dailyQuota", sent: sentCount, cap: DAILY_SOFT_CAP });
    }
  }
  return { day: sentDay, count: sentCount };
}

/** Для проверок: текущее состояние счётчика без побочных действий. */
export function __emailCounter(): { day: string; count: number; cap: number } {
  return { day: sentDay, count: sentCount, cap: DAILY_SOFT_CAP };
}

/** Для проверок: обнулить счётчик между случаями. */
export function __resetEmailCounter(): void {
  sentDay = "";
  sentCount = 0;
  warnedAt.clear();
}
