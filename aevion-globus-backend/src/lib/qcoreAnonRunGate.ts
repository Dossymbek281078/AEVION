import type { Request, RequestHandler } from "express";
import { verifyBearerOptional } from "./authJwt";
import { остатокГостя, засчитатьГостю } from "./multichatGuestPass";

/**
 * Анонимный запуск мультиагента — по счёту, как консилиум на /multichat-engine.
 *
 * 🔴 Замер 1.11.2026 (прод, чистый браузер, ?c=probe-apps): гость без входа на
 * /qcoreai/multi запустил настоящий совет (claude-opus-4-8, claude-fable-5, Haiku 4.5,
 * $0.0152 за один запуск) — без счёта. Единственный ограничитель — 20 запусков в минуту
 * с адреса (multiAgentLimiter) и «аноним не метрируется» в qcoreQuota. Один скрипт с одного
 * адреса — до 1200 запусков в час на дорогих моделях, а потолок стоимости запуска
 * (maxCostUsd) гость называл сам, до $50. Бесплатная норма на главной Мультичата (2 в сутки)
 * закрывала только соседний вход.
 *
 * Правило: аноним тратит ту же суточную норму гостя (multichatGuestPass), что и консилиум на
 * главной. Нормы нет — 402 с человеческим текстом и ссылкой на вход. Списание — после ответа
 * и не за отказы (как в гостевом слое Мультичата): запрос с ошибкой 4xx/5xx норму не съедает.
 * Вошедший (есть разобранный токен) проходит как раньше — его считает qcoreQuota.
 */

/** Аноним — тот, у кого нет разобранного токена. Токен разбираем сами: лимитер стоит до разбора req.auth. */
export function анонимБезВхода(req: Request): boolean {
  return !verifyBearerOptional(req)?.sub;
}

export const анонимныйЗапускМультиагента: RequestHandler = (req, res, next) => {
  if (!анонимБезВхода(req)) return next();
  остатокГостя(req)
    .then((о) => {
      if (о.осталось <= 0) {
        res.status(402).json({
          error: "guest_quota_exhausted",
          message:
            "Бесплатные запросы без входа на сегодня кончились — войдите по почте, и норма продолжится. / " +
            "Free guest runs for today are used up — sign in to continue.",
          loginUrl: "/auth?next=/qcoreai/multi",
          limit: о.лимит,
          used: о.использовано,
          remaining: 0,
        });
        return;
      }
      let списано = false;
      const списать = () => {
        if (списано) return;
        списано = true;
        if (res.statusCode >= 400) return;
        засчитатьГостю(req).catch((err: unknown) => {
          console.error(
            "[qcoreai] списание нормы анонима не удалось: " + (err instanceof Error ? err.message : String(err)),
          );
        });
      };
      res.on("finish", списать);
      res.on("close", списать);
      next();
    })
    .catch(next);
};
