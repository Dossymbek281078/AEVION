/**
 * QPayNet boundary validation — replaces ad-hoc `if (!x || x <= 0)` patterns
 * with a typed, throw-an-HttpError helper. No external dep (zod adds 50kB
 * and its own type-inference quirks); for the ~30 endpoints in this router
 * a hand-rolled validator is plenty.
 *
 * Each endpoint at the top of its handler does:
 *
 *   const body = parseBody(req.body, {
 *     walletId: "uuid",
 *     amount: { kind: "money", min: 1, max: MAX_TRANSFER_KZT },
 *     description: { kind: "string", optional: true, max: 200 },
 *   });
 *
 * On failure, throws ValidationError → caller returns 400 with the field name.
 */

export class ValidationError extends Error {
  constructor(public field: string, public reason: string) {
    super(`${field}: ${reason}`);
    this.name = "ValidationError";
  }
}

type RuleString = { kind: "string"; optional?: boolean; min?: number; max?: number; pattern?: RegExp };
type RuleUuid = "uuid" | { kind: "uuid"; optional?: boolean };
type RuleMoney = { kind: "money"; min?: number; max?: number; optional?: boolean };
type RuleInt = { kind: "int"; min?: number; max?: number; optional?: boolean };
type RuleEmail = { kind: "email"; optional?: boolean };
type RuleEnum<T extends string> = { kind: "enum"; values: readonly T[]; optional?: boolean };
type RuleBool = { kind: "bool"; optional?: boolean };
type RuleUrl = { kind: "url"; optional?: boolean; maxLen?: number };

export type Rule =
  | RuleString
  | RuleUuid
  | RuleMoney
  | RuleInt
  | RuleEmail
  | RuleBool
  | RuleUrl
  | RuleEnum<string>
  | "string"
  | "money"
  | "int"
  | "email"
  | "bool"
  | "url";

export type Schema = Record<string, Rule>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isOptional(rule: Rule): boolean {
  if (typeof rule === "string") return false;
  return rule.optional === true;
}

function checkValue(field: string, value: unknown, rule: Rule): unknown {
  // Normalise shorthand string rules.
  const r: Exclude<Rule, string> = typeof rule === "string" ? ({ kind: rule } as Exclude<Rule, string>) : rule;

  if (value === undefined || value === null || value === "") {
    if (r.optional) return undefined;
    throw new ValidationError(field, "required");
  }

  switch (r.kind) {
    case "uuid": {
      if (typeof value !== "string" || !UUID_RE.test(value)) {
        throw new ValidationError(field, "must be uuid");
      }
      return value;
    }
    case "string": {
      if (typeof value !== "string") throw new ValidationError(field, "must be string");
      const min = (r as RuleString).min ?? 0;
      const max = (r as RuleString).max ?? 10_000;
      if (value.length < min) throw new ValidationError(field, `min length ${min}`);
      if (value.length > max) throw new ValidationError(field, `max length ${max}`);
      const pat = (r as RuleString).pattern;
      if (pat && !pat.test(value)) throw new ValidationError(field, "format invalid");
      return value;
    }
    case "money": {
      const n = typeof value === "string" ? Number(value) : value;
      if (typeof n !== "number" || !Number.isFinite(n)) throw new ValidationError(field, "must be number");
      if (n <= 0) throw new ValidationError(field, "must be positive");
      // Money has 2 decimal places (KZT/tiin). Reject more precision to avoid
      // silent rounding bugs downstream (toTiin uses Math.round).
      const tiin = Math.round(n * 100);
      if (Math.abs(n * 100 - tiin) > 1e-6) {
        throw new ValidationError(field, "max 2 decimal places");
      }
      const mr = r as RuleMoney;
      if (mr.min !== undefined && n < mr.min) throw new ValidationError(field, `min ${mr.min}`);
      if (mr.max !== undefined && n > mr.max) throw new ValidationError(field, `max ${mr.max}`);
      return n;
    }
    case "int": {
      const n = typeof value === "string" ? Number(value) : value;
      if (typeof n !== "number" || !Number.isInteger(n)) throw new ValidationError(field, "must be integer");
      const ir = r as RuleInt;
      if (ir.min !== undefined && n < ir.min) throw new ValidationError(field, `min ${ir.min}`);
      if (ir.max !== undefined && n > ir.max) throw new ValidationError(field, `max ${ir.max}`);
      return n;
    }
    case "email": {
      if (typeof value !== "string" || !EMAIL_RE.test(value)) {
        throw new ValidationError(field, "must be email");
      }
      return value.toLowerCase().trim();
    }
    case "bool": {
      if (typeof value !== "boolean") throw new ValidationError(field, "must be boolean");
      return value;
    }
    case "url": {
      if (typeof value !== "string") throw new ValidationError(field, "must be string");
      const ur = r as RuleUrl;
      const max = ur.maxLen ?? 2000;
      if (value.length > max) throw new ValidationError(field, `max length ${max}`);
      try {
        const u = new URL(value);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          throw new ValidationError(field, "must be http(s) url");
        }
      } catch {
        throw new ValidationError(field, "must be valid url");
      }
      return value;
    }
    case "enum": {
      const er = r as RuleEnum<string>;
      if (typeof value !== "string" || !er.values.includes(value)) {
        throw new ValidationError(field, `must be one of ${er.values.join("|")}`);
      }
      return value;
    }
  }
  throw new ValidationError(field, "unknown rule");
}

/**
 * Parse + validate request body against a schema. Throws ValidationError on
 * first failure; returns a typed-ish dict on success.
 *
 * Unknown fields are silently dropped (defensive — clients sometimes ship
 * extra metadata, we don't echo it back).
 */
export function parseBody(body: unknown, schema: Schema): Record<string, unknown> {
  const src = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [field, rule] of Object.entries(schema)) {
    const v = checkValue(field, src[field], rule);
    if (v !== undefined) out[field] = v;
    else if (!isOptional(rule)) {
      // checkValue would have thrown; this branch unreachable but keeps TS happy.
      throw new ValidationError(field, "required");
    }
  }
  return out;
}

/** Convenience for top-of-handler usage; returns 400 response or parsed body. */
import type { Request, Response } from "express";
export function validateOr400(
  req: Request,
  res: Response,
  schema: Schema,
): Record<string, unknown> | null {
  try {
    return parseBody(req.body, schema);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: "validation_failed", field: err.field, reason: err.reason });
      return null;
    }
    throw err;
  }
}
