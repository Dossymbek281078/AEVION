import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { rateLimit } from "../lib/rateLimit";
import { getQSignSecret } from "../lib/qsignSecret";
import { makeServiceCapture } from "../lib/sentry/platform";
import { safeErrorText } from "../lib/safeError";

const captureQsignError = makeServiceCapture("qsign");

export const qsignRouter = Router();

/**
 * QSign v1 — legacy HMAC-SHA256 signing API.
 *
 * Production traffic should migrate to /api/qsign/v2 which has canonicalization,
 * rotatable keys, audit log, Ed25519 + ML-DSA-65, and structured webhooks.
 *
 * v1 is kept alive because the bank smoke page (frontend/src/app/bank/smoke/page.tsx)
 * and the public API pricing page (frontend/src/app/bank/api/page.tsx) still
 * reference these paths. New integrations MUST use v2.
 */

// QSign secret resolution moved to lib/qsignSecret.ts so planetCompliance and
// other call sites share the same fail-closed gate.

const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KB — enough for invoices/receipts

/**
 * Разделение домена подписи. Читать до любой правки ниже.
 *
 * Замер 11.10.2026: /sign открыт анониму (200 на проде, и через прокси сайта
 * тоже — им пользуются кнопки /constitution), а подписывал он РОВНО
 * `JSON.stringify(тело)` тем же секретом, которым routes/pipeline.ts:84-95
 * подписывает сертификат QRight по четырём полям objectId/title/contentHash/
 * signedAt. Ключ там тот же: HMAC_KEY_VERSION не задан (по умолчанию 1),
 * QSIGN_SECRET_V1 не задан, и config/qright.ts:60-69 законно откатывается на
 * legacy QSIGN_SECRET. То есть любой желающий получал от нас подпись строки
 * той же формы, что подписывает наш сертификат.
 *
 * Префикс делает подписываемую строку непересекающейся с любой другой: подпись
 * v1 больше не годится ни для чего, кроме v1. Пара /sign + /verify остаётся
 * согласованной (обе зовут эту функцию), поэтому публичный поток цел и форма
 * ответа не меняется — обещания /bank/api и /developers в силе.
 *
 * Про «цену» правки: оркестратор принял её, считая, что выданные подписи нигде
 * не хранятся. Замер 11.10 говорит иначе — frontend/src/app/bank/_lib/
 * signatures.ts держит пары (payload, signature) в localStorage
 * «aevion_bank_signatures_v1» ИМЕННО чтобы посетитель мог перепроверить их
 * когда угодно, а /bank/settings это обещает словами. Строгая проверка
 * показала бы человеку его собственные старые чеки как подделанные.
 * Поэтому ПОДПИСЫВАЕМ строго по домену, а ПРОВЕРЯЕМ и домен, и прежнюю форму:
 * выдать подпись без домена больше нельзя (дыра закрыта — она была именно в
 * выдаче), а старый чек по-прежнему сходится. Снять прежнюю форму можно после
 * заката v1 (31.12.2026).
 */
const ДОМЕН_V1 = "qsign-v1:";

function signPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  // Предел считается по ТЕЛУ, а не по строке с префиксом: обещанные 256 КБ
  // должны остаться ровно про тело запроса.
  if (json.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload too large (max ${MAX_PAYLOAD_BYTES} bytes)`);
  }
  return crypto.createHmac("sha256", getQSignSecret()).update(ДОМЕН_V1 + json).digest("hex");
}

/**
 * Constant-time equality for hex strings of equal length. Falls back to false
 * on length mismatch (timingSafeEqual itself throws on mismatch). Prevents
 * the trivial timing oracle that `===` exposes.
 */
/** Подпись в прежней форме — только для проверки старых чеков, не для выдачи. */
function legacySignPayload(payload: unknown): string {
  return crypto.createHmac("sha256", getQSignSecret()).update(JSON.stringify(payload)).digest("hex");
}

function timingSafeEqHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

const signLimiter = rateLimit({ windowMs: 60_000, max: 60 });
const verifyLimiter = rateLimit({ windowMs: 60_000, max: 240 });

function deprecation(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Deprecation", "true");
  res.setHeader("Link", '</api/qsign/v2/openapi.json>; rel="successor-version"');
  res.setHeader("Sunset", "2026-12-31");
  next();
}

qsignRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "qsign-legacy",
    note: "v1 HMAC stub; production traffic should use /api/qsign/v2",
    deprecated: true,
    sunset: "2026-12-31",
    timestamp: new Date().toISOString(),
  });
});

qsignRouter.post(
  "/sign",
  signLimiter as unknown as (req: Request, res: Response, next: NextFunction) => void,
  deprecation,
  (req, res) => {
    try {
      const payload = req.body;
      if (payload === undefined || payload === null) {
        return res.status(400).json({ error: "payload is required" });
      }
      const signature = signPayload(payload);
      res.json({
        payload,
        signature,
        algo: "HMAC-SHA256",
        createdAt: new Date().toISOString(),
      });
    } catch (e: unknown) {
      captureQsignError(e, { route: "sign" });
      const msg = e instanceof Error ? e.message : "sign_failed"; // только для журнала
      const msgPublic = safeErrorText(e, "sign_failed", "qsign");
      const code = msg.startsWith("QSIGN_SECRET") ? 500 : 400;
      res.status(code).json({ error: msgPublic });
    }
  },
);

qsignRouter.post(
  "/verify",
  verifyLimiter as unknown as (req: Request, res: Response, next: NextFunction) => void,
  deprecation,
  (req, res) => {
    try {
      const { payload, signature } = req.body || {};
      if (!payload || typeof signature !== "string" || !signature) {
        return res.status(400).json({ error: "payload and signature are required" });
      }
      const expected = signPayload(payload);
      // Прежняя форма (без домена) принимается только ПРИ ПРОВЕРКЕ — ради чеков,
      // выданных до 11.10.2026 и лежащих у посетителя в браузере. Выдать такую
      // подпись больше нельзя: signPayload всегда ставит домен.
      const expectedLegacy = legacySignPayload(payload);
      const valid =
        timingSafeEqHex(expected, signature) || timingSafeEqHex(expectedLegacy, signature);
      // Never echo `expected` — that's a forgery oracle. Just yes/no + algo.
      res.json({ valid, algo: "HMAC-SHA256" });
    } catch (e: unknown) {
      captureQsignError(e, { route: "verify" });
      const msg = e instanceof Error ? e.message : "verify_failed"; // только для журнала
      const msgPublic = safeErrorText(e, "verify_failed", "qsign");
      const code = msg.startsWith("QSIGN_SECRET") ? 500 : 400;
      res.status(code).json({ error: msgPublic });
    }
  },
);
