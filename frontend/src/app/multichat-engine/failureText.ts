// Человеческий текст для отказа агента.
//
// Зачем отдельный модуль: карточка агента рисовала `r.error` как есть, а бэкенд
// присылает туда технические английские строки. Самая частая из них —
// `rate_limit_exceeded: max 30 chat requests per minute per IP` — не просто
// непонятна, она ВВОДИТ В ЗАБЛУЖДЕНИЕ: этот предел общий для всех, кто в эту
// минуту пользуется сервисом (отправка ходит к своему же API по внутренней
// петле, и адрес у всех получается один), а человек читает «per IP» как «это я
// слишком часто нажимал» и уходит.
//
// Правило модуля: показать человеку понятную причину и НЕ спрятать настоящую.
// Поэтому возвращаются две строки — `human` для глаза и `technical` для мелкого
// шрифта рядом, чтобы отчёт об ошибке от пользователя оставался полезным.

export type AgentFailure = {
  /** Понятная причина по-русски. */
  human: string;
  /** Исходная строка сервера, если она добавляет что-то к human. */
  technical: string | null;
};

/** Сколько ждать, если сервер сказал. */
export function retryHint(retryAfterSec: unknown): string {
  const n = typeof retryAfterSec === "number" && Number.isFinite(retryAfterSec) ? Math.ceil(retryAfterSec) : null;
  if (n === null || n <= 0) return "";
  if (n < 60) return ` Повторите через ${n} с.`;
  const min = Math.ceil(n / 60);
  return ` Повторите через ${min} мин.`;
}

export function agentFailure(raw: unknown): AgentFailure {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { human: "Агент не ответил.", technical: null };
  const low = s.toLowerCase();

  // Предел частоты. Общий, а не персональный — так и сказано.
  if (low.includes("rate_limit") || low.includes("too many requests") || low.includes("429")) {
    return {
      human: "Сервис отвечает не всем сразу: предел запросов в минуту сейчас исчерпан. Это общий предел, а не ваш личный — попробуйте снова через минуту.",
      technical: s,
    };
  }

  // Кончились деньги/квота у провайдера — это НЕ то же самое, что предел частоты:
  // ожиданием не лечится, и обещать «через минуту» было бы неправдой.
  if (low.includes("quota") || low.includes("billing") || low.includes("insufficient")) {
    return {
      human: "У провайдера модели закончился оплаченный объём. Ожидание не поможет — нужен другой провайдер или пополнение.",
      technical: s,
    };
  }

  if (low.includes("empty reply")) {
    return {
      human: "Провайдер вернул пустой ответ. Это сбой на его стороне, а не ваш вопрос — попробуйте ещё раз.",
      technical: s,
    };
  }

  if (low.includes("timeout") || low.includes("etimedout") || low.includes("aborted")) {
    return { human: "Провайдер не ответил вовремя. Попробуйте ещё раз.", technical: s };
  }

  if (low.includes("unauthorized") || low.includes("401") || low.includes("token")) {
    return { human: "Сессия истекла — войдите заново.", technical: s };
  }

  if (low.startsWith("upstream ") || /\b5\d\d\b/.test(s)) {
    return { human: "Сервис моделей ответил ошибкой. Попробуйте ещё раз.", technical: s };
  }

  // Неизвестная причина: не выдумываем объяснение и не прячем строку.
  return { human: "Агент не ответил.", technical: s };
}

/**
 * Короткое имя роли для заголовка карточки.
 *
 * Роли приходят в виде «Аналитик — только факты и цифры, без оценок»: целиком в
 * заголовок не влезает, а `agentId` («analyst») в русском интерфейсе выглядит
 * как утечка внутреннего кода. Берём часть до тире.
 */
export function agentTitle(role: string | undefined, agentId: string): string {
  const name = (role || "").split("—")[0].trim();
  return name || agentId;
}
