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

function zodErrorToRu(iss: z.ZodIssue): string {
  const msg = iss.message ?? "";
  // Map common Zod v4 messages to Russian
  if (msg.includes("Invalid email")) return "неверный формат email";
  if (msg.includes("String must contain at least"))
    return msg.replace("String must contain at least", "минимум").replace("character(s)", "символов");
  if (msg.includes("String must contain at most"))
    return msg.replace("String must contain at most", "максимум").replace("character(s)", "символов");
  if (msg.includes("Number must be greater than or equal to"))
    return msg.replace("Number must be greater than or equal to", "минимум");
  if (msg.includes("Number must be less than or equal to"))
    return msg.replace("Number must be less than or equal to", "максимум");
  if (msg.includes("Required")) return "обязательное поле";
  if (msg.includes("Expected") && msg.includes("received")) {
    return "неверный тип данных";
  }
  return msg || "неверное значение";
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
