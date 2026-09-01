/**
 * Constitution — Zod schemas and validation middleware factory.
 *
 * Usage:
 *   router.post("/foo", validate(FooSchema), async (req, res) => {
 *     const body = req.body as z.infer<typeof FooSchema>;
 *     ...
 *   });
 *
 * On validation failure returns 400 with:
 *   { error: "validation_failed", fields: [{field, message_ru}] }
 */

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

/* ───── Human-readable RU messages ─────────────────────────────── */

/**
 * Сообщение Zod → человеческий русский текст.
 *
 * ⚠️ 19.08.2026: прежняя версия была написана под формулировки Zod v3, при том
 * что в зависимостях стоит v4 (комментарий утверждал обратное). Разошлись они
 * молча — тип возврата остался строкой, ничего не падало, — и наружу поехал
 * сырой английский в поле, которое НАЗЫВАЕТСЯ message_ru:
 *
 *   POST /api/constitution/waitlist/subscribe  {}
 *   → {"field":"email","message_ru":"Invalid input: expected string, received undefined"}
 *
 * Проверено на живом проде. Ловушек было две: v4 сменил формулировку
 * («Required» → «Invalid input: expected …»), а проверка искала слово
 * «Expected» с большой буквы, тогда как в v4 оно строчное. Поэтому теперь
 * сравнение регистронезависимое, и разбор идёт по КОДУ ошибки, а не по её
 * тексту: код — часть контракта библиотеки, текст меняется от версии к версии.
 *
 * Это форма подписки на /go — единственной ссылке из соцсетей. Английская
 * ошибка в русской форме отпугивает ровно того человека, ради которого
 * снимается ролик.
 */
function zodErrorToRu(iss: z.ZodIssue): string {
  const code = iss.code;
  const msg = (iss.message ?? "").toLowerCase();

  // Разбор по коду — устойчив к смене формулировок в новых версиях Zod.
  if (code === "invalid_type") {
    const received = (iss as { received?: unknown }).received;
    if (received === "undefined" || received === undefined) return "обязательное поле";
    return "неверный тип данных";
  }
  if (code === "too_small") {
    const min = (iss as { minimum?: number | bigint }).minimum;
    return min === undefined ? "значение слишком маленькое" : `минимум ${String(min)}`;
  }
  if (code === "too_big") {
    const max = (iss as { maximum?: number | bigint }).maximum;
    return max === undefined ? "значение слишком большое" : `максимум ${String(max)}`;
  }
  if (code === "invalid_format") {
    const fmt = (iss as { format?: string }).format;
    if (fmt === "email") return "неверный формат email";
    if (fmt === "url") return "неверная ссылка";
    return "неверный формат";
  }
  if (code === "invalid_value") return "недопустимое значение";
  if (code === "unrecognized_keys") return "лишнее поле";

  // Запасной разбор по тексту — на случай кодов, которых мы ещё не знаем.
  // Регистронезависимо: в v4 слова пишутся со строчной.
  if (msg.includes("invalid email")) return "неверный формат email";
  if (msg.includes("required")) return "обязательное поле";
  if (msg.includes("expected") && msg.includes("received")) return "неверный тип данных";

  // Последний рубеж: наружу не должен уйти английский текст библиотеки.
  // Лучше общее русское сообщение, чем developer-facing строка в форме.
  return "неверное значение";
}

export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data;
      next();
      return;
    }
    const fields = result.error.issues.map((iss) => ({
      field: iss.path.join(".") || "body",
      message_ru: zodErrorToRu(iss),
    }));
    res.status(400).json({ error: "validation_failed", fields });
  };
}

/* ───── Slider schema ─────────────────────────────────────────── */

export const SliderValue = z.number().int().min(0).max(100);

export const SlidersSchema = z.object({
  floor:          SliderValue,
  ruleOfLaw:      SliderValue,
  rotation:       SliderValue,
  transparency:   SliderValue,
  multiStatus:    SliderValue,
  skinInGame:     SliderValue,
  polycentricity: SliderValue,
  positiveSum:    SliderValue,
});

/* ───── Endpoint schemas ─────────────────────────────────────── */

export const ScenarioCreateSchema = z.object({
  title:   z.string().min(1).max(160),
  sliders: SlidersSchema,
  regime:  z.string().max(120).optional(),
  metrics: z.record(z.string(), z.number()).optional(),
  tags:    z.array(z.string().max(40)).max(20).optional(),
});

export const AiSuggestSchema = z.object({
  description: z.string().min(8, "описание слишком короткое (мин. 8 символов)").max(4000),
});

export const WaitlistSubscribeSchema = z.object({
  email:  z.string().email("неверный формат email").max(120),
  source: z.string().max(60).optional(),
  /*
   * Канал привлечения — ОТДЕЛЬНО от source.
   *
   * source отвечает «с какой страницы», channel — «кто привёл». Раньше был
   * только первый, и на вопрос «какой канал приносит подписчиков» ответить
   * было нечем, хотя у покупок такой ответ с 30.08 есть. Список для запуска —
   * главный наш актив, и знать, чем он набран, важнее, чем по покупкам.
   *
   * Дописывать канал в source нельзя: его разбирает рассылка (метки через
   * запятую), и лишнее значение развело бы письма не туда.
   */
  channel: z.string().max(24).regex(/^[a-z0-9-]+$/, "канал: только строчные латиница, цифры и дефис").optional(),
});

export const VoteSchema = z.object({
  vote: z.union([z.literal(1), z.literal(-1)]),
});

export const CommentCreateSchema = z.object({
  text:       z.string().min(1, "текст обязателен").max(800, "максимум 800 символов"),
  authorName: z.string().max(60).optional(),
});

const EnvelopeBase = z.object({
  spec:      z.string().optional(),
  algo:      z.string().optional(),
  signedAt:  z.string().optional(),
  signature: z.string().min(8),
  payload:   z.object({
    title:    z.string().min(1).max(160).optional(),
    sliders:  SlidersSchema.optional(),
    regime:   z.object({ id: z.string(), name: z.string(), era: z.string().optional() }).optional(),
    metrics:  z.record(z.string(), z.number()).optional(),
    issuedAt: z.string().optional(),
  }).passthrough(),
}).passthrough();

export const ArtifactPublishSchema = z.union([
  z.object({ envelope: EnvelopeBase }).passthrough(),
  EnvelopeBase,
]);
