import type { Request, RequestHandler } from "express";
import { getProviders, type Provider } from "../services/qcoreai/providers";
import { анонимБезВхода } from "./qcoreAnonRunGate";
import { остатокГостя, засчитатьГостю, type НормаГостя } from "./multichatGuestPass";

/**
 * Анонимный чат /api/qcoreai/chat и /chat-stream: 10 сообщений в сутки, одна дешёвая модель.
 *
 * 🔴 Решение Оркестратора 1.11.2026. Замер того же дня по коду: аноним без входа шёл по умолчанию на
 * claude-opus-4-8 (defaultModel Anthropic) и мог назвать любую другую модель; ограничителей два —
 * 30 в минуту с адреса и 120 в минуту на всю платформу, нормы нет. Худший случай — десятки долларов
 * в минуту на человека, которого мы ещё не знаем.
 *
 * Правило:
 *  — норма: ANON_CHAT_PER_DAY (10) в сутки на гостя, тот же счёт в базе, что у консилиума
 *    (multichatGuestPass), но своя область «chat». Сверх нормы — 402 guest_quota_exhausted.
 *  — модель: одна, самая дешёвая из рабочих — класс haiku, иначе дешёвый/бесплатный поставщик.
 *    Другая модель или другой поставщик в запросе аноним получает как 400 model_requires_sign_in,
 *    а не как тихую замену: человек должен видеть, что выбор модели — после входа.
 *  — не задал ни поставщика, ни модель — получает «свою» модель молча: так ходит гость без выбора.
 *  — вошедший проходит как раньше.
 * Списание — после ответа и не за отказы (4xx/5xx), как в остальных гостевых слоях.
 */

const ОБЛАСТЬ = "chat";

export function анонимныйЧатВСутки(): number {
  const raw = Number(process.env.ANON_CHAT_PER_DAY ?? "10");
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 10;
}

/** Крыша на адрес: за одним адресом — офис или оператор, но не тысяча сообщений. */
function потолокЧатаНаАдрес(): number {
  const raw = Number(process.env.ANON_CHAT_PER_IP_DAY ?? "30");
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 30;
}

export function нормаЧата(): НормаГостя {
  return { область: ОБЛАСТЬ, лимит: анонимныйЧатВСутки(), потолок: потолокЧатаНаАдрес() };
}

export type АнонимнаяМодель = { providerId: string; model: string };

/**
 * Одна дешёвая модель для анонима. Порядок: класс haiku у рабочего поставщика; затем рабочий
 * поставщик ярусов free/budget — его модель по умолчанию. Премиум-модель по умолчанию не берём
 * никогда: нет дешёвой — null, и аноним получает 503, а не opus.
 * Поставщиков принимает параметром, чтобы тест подставлял свой набор.
 */
export function анонимнаяМодель(providers: Provider[] = getProviders()): АнонимнаяМодель | null {
  const рабочие = providers.filter((p) => p.configured);
  for (const p of рабочие) {
    const haiku = p.models.find((m) => /haiku/i.test(m));
    if (haiku) return { providerId: p.id, model: haiku };
  }
  for (const p of рабочие) {
    if (p.tier === "free" || p.tier === "budget") return { providerId: p.id, model: p.defaultModel };
  }
  return null;
}

const ТЕКСТ = {
  ru: {
    needLogin: "Выбор модели — после входа. Без входа отвечает одна модель; войдите по почте, чтобы выбрать другую.",
    exhausted: (n: number) =>
      `Бесплатные сообщения без входа на сегодня кончились (${n} в сутки) — войдите по почте, и чат продолжится.`,
    noCheap: "Сейчас бесплатный чат без входа недоступен — войдите по почте.",
  },
  en: {
    needLogin: "Model choice is available after sign-in. Without signing in one model answers; sign in by email to pick another.",
    exhausted: (n: number) =>
      `Today's free messages without signing in are used up (${n} per day) — sign in by email to keep chatting.`,
    noCheap: "The free chat without sign-in is unavailable right now — please sign in by email.",
  },
} as const;

function язык(req: Request): "ru" | "en" {
  return /^ru|^kk/i.test(String(req.get("accept-language") || "")) ? "ru" : "en";
}

export const анонимныйЧат: RequestHandler = (req, res, next) => {
  if (!анонимБезВхода(req)) return next();
  const т = ТЕКСТ[язык(req)];
  const одна = анонимнаяМодель();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const просилПоставщика = typeof body.provider === "string" && body.provider.length > 0 ? body.provider : null;
  const просилМодель = typeof body.model === "string" && body.model.length > 0 ? body.model : null;

  if (!одна) {
    // Никто из рабочих не дешёвый. Если рабочих нет вовсе — это stub без расхода, пускаем как раньше.
    if (getProviders().some((p) => p.configured)) {
      res.status(503).json({ error: "guest_chat_unavailable", message: т.noCheap, loginUrl: "/auth?next=/qcoreai" });
      return;
    }
    return next();
  }

  if ((просилПоставщика && просилПоставщика !== одна.providerId) || (просилМодель && просилМодель !== одна.model)) {
    res.status(400).json({
      error: "model_requires_sign_in",
      message: т.needLogin,
      allowedProvider: одна.providerId,
      allowedModel: одна.model,
      loginUrl: "/auth?next=/qcoreai",
    });
    return;
  }

  const норма = нормаЧата();
  остатокГостя(req, норма)
    .then((о) => {
      if (о.осталось <= 0) {
        res.status(402).json({
          error: "guest_quota_exhausted",
          message: т.exhausted(о.лимит),
          loginUrl: "/auth?next=/qcoreai",
          limit: о.лимит,
          used: о.использовано,
          remaining: 0,
        });
        return;
      }
      // Ручка берёт поставщика и модель из тела: подставляем «свою», чтобы аноним без выбора
      // не уехал на premium-умолчание (opus) этой же ручки.
      req.body = { ...body, provider: одна.providerId, model: одна.model };
      let списано = false;
      const списать = () => {
        if (списано) return;
        списано = true;
        if (res.statusCode >= 400) return;
        засчитатьГостю(req, норма).catch((err: unknown) => {
          console.error(
            "[qcoreai] списание нормы анонима в чате не удалось: " + (err instanceof Error ? err.message : String(err)),
          );
        });
      };
      res.on("finish", списать);
      res.on("close", списать);
      next();
    })
    .catch(next);
};
