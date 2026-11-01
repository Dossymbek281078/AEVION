import type { RequestHandler } from "express";
import { анонимБезВхода } from "./qcoreAnonRunGate";
import { адресСайтаДоверен } from "./siteProxyAddress";
import { остатокОбщий, засчитатьОбщий } from "./multichatGuestPass";

/**
 * Общий суточный потолок на анонимные запросы с НЕДОВЕРЕННЫМ адресом: /chat, /chat-stream,
 * /multi-agent, /smart, /batch.
 *
 * 🔴 Замер 1.11.2026 на проде (после выкатки норм анонима): через aevion.app/api-backend 36 запросов
 * с разными x-aevion-device — все 200, потолок 30 на адрес не держит. У /api/qcoreai/* нет своего
 * прокси-обработчика сайта (guestIpProxy), /health: guestIpFromSite accepted 0, noKey 1039 — бэк видит
 * адрес узла Vercel, а не гостя, и «разные устройства» — это разные личные счета без общей крыши.
 * Прокси-функцию сайту не ставим (Оркестратор: у платящих могут оборваться длинные потоки), поэтому
 * ограничиваем расход: ANON_PLATFORM_PER_DAY (300) анонимных запросов в сутки на всю платформу.
 *
 * Считаются только аноним без токена И без доверенного адреса от сайта. Вошедший и гость с доверенным
 * адресом идут мимо. Сверх потолка — 402 guest_quota_exhausted «войдите по почте». Списание — после
 * ответа и не за 4xx/5xx, как в остальных гостевых слоях.
 */

const МЕТКА = "anon-untrusted";

export function потолокПлатформыВСутки(): number {
  const raw = Number(process.env.ANON_PLATFORM_PER_DAY ?? "300");
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 300;
}

const ТЕКСТ = {
  ru: "Сегодня бесплатные сообщения без входа на сайте кончились — войдите по почте, и всё продолжится.",
  en: "Today's free messages without signing in are used up site-wide — sign in by email and carry on.",
} as const;

export const анонимныйПотолокПлатформы: RequestHandler = (req, res, next) => {
  if (!анонимБезВхода(req) || адресСайтаДоверен(req)) return next();
  const лимит = потолокПлатформыВСутки();
  остатокОбщий(МЕТКА, лимит)
    .then((осталось) => {
      if (осталось <= 0) {
        const ru = /^ru|^kk/i.test(String(req.get("accept-language") || ""));
        res.status(402).json({
          error: "guest_quota_exhausted",
          message: ТЕКСТ[ru ? "ru" : "en"],
          loginUrl: "/auth?next=/qcoreai",
          scope: "platform",
          limit: лимит,
          remaining: 0,
        });
        return;
      }
      let списано = false;
      const списать = () => {
        if (списано) return;
        списано = true;
        if (res.statusCode >= 400) return;
        засчитатьОбщий(МЕТКА).catch((err: unknown) => {
          console.error(
            "[qcoreai] списание общего потолка анонимов не удалось: " + (err instanceof Error ? err.message : String(err)),
          );
        });
      };
      res.on("finish", списать);
      res.on("close", списать);
      next();
    })
    .catch(next);
};
