import { describe, test, expect } from "vitest";
import { clampTemperature, publicErrorCategory } from "../src/routes/qcoreai";

// QCoreAI Tier 3 hardening — 2026-05-09.
//
// /api/qcoreai/chat is anonymous + had no rate limit. Anyone could loop it
// to burn our Anthropic / OpenAI bill (we pay per token; users don't).
// Plus temperature was unbounded (negative or huge values either error out
// upstream or burn extra tokens) and provider error messages were echoed
// back to the wire — risk of leaking partial API keys, internal URLs, etc.
//
// Fixed:
//   - chatLimiter: 30 req/min per IP (tested at the route level via prod
//     smoke; not unit-testable without spinning up Express).
//   - clampTemperature: number → [0, 2], anything else → fallback.
//   - publicErrorCategory: maps upstream error message to a stable string
//     and never echoes raw provider error text. Server log keeps the
//     full message; the wire response only sees the category.

describe("clampTemperature", () => {
  test("normal value passes through", () => {
    expect(clampTemperature(0.6)).toBe(0.6);
    expect(clampTemperature(1.5)).toBe(1.5);
  });

  test("clamps below 0 to 0", () => {
    expect(clampTemperature(-0.5)).toBe(0);
    expect(clampTemperature(-1000)).toBe(0);
  });

  test("clamps above 2 to 2", () => {
    expect(clampTemperature(2.5)).toBe(2);
    expect(clampTemperature(1e9)).toBe(2);
  });

  test("non-number falls back", () => {
    expect(clampTemperature("0.6")).toBe(0.6);
    expect(clampTemperature(null)).toBe(0.6);
    expect(clampTemperature(undefined)).toBe(0.6);
    expect(clampTemperature({})).toBe(0.6);
  });

  test("non-finite falls back", () => {
    expect(clampTemperature(NaN)).toBe(0.6);
    expect(clampTemperature(Infinity)).toBe(0.6);
    expect(clampTemperature(-Infinity)).toBe(0.6);
  });

  test("custom fallback respected", () => {
    expect(clampTemperature(undefined, 0.2)).toBe(0.2);
    expect(clampTemperature(NaN, 1.0)).toBe(1.0);
  });

  test("boundary values exact", () => {
    expect(clampTemperature(0)).toBe(0);
    expect(clampTemperature(2)).toBe(2);
  });
});

describe("publicErrorCategory — upstream message stripping", () => {
  test("API-key-related → provider_auth_failed (never echoes the key itself)", () => {
    expect(publicErrorCategory("Invalid API key: sk-ant-api03-xyz123")).toBe("provider_auth_failed");
    expect(publicErrorCategory("Authentication failed: api_key not recognized")).toBe("provider_auth_failed");
    expect(publicErrorCategory("OpenAI: incorrect apikey")).toBe("provider_auth_failed");
  });

  test("rate limit → provider_rate_limited", () => {
    expect(publicErrorCategory("OpenAI rate_limit_exceeded")).toBe("provider_rate_limited");
    expect(publicErrorCategory("HTTP 429 too many requests")).toBe("provider_rate_limited");
  });

  test("timeout → provider_timeout", () => {
    expect(publicErrorCategory("Request timed out after 30s")).toBe("provider_timeout");
    expect(publicErrorCategory("ETIMEDOUT")).toBe("provider_timeout");
  });

  test("model unknown → model_not_found", () => {
    expect(publicErrorCategory("model claude-99 does not exist")).toBe("model_not_found");
    expect(publicErrorCategory("Model gpt-7 not found")).toBe("model_not_found");
  });

  test("billing/quota → provider_quota_exceeded", () => {
    expect(publicErrorCategory("Billing limit reached")).toBe("provider_quota_exceeded");
    expect(publicErrorCategory("monthly quota exceeded")).toBe("provider_quota_exceeded");
  });

  test("generic → chat_failed (no leak)", () => {
    expect(publicErrorCategory("ENOENT some/internal/path")).toBe("chat_failed");
    expect(publicErrorCategory("undefined is not a function")).toBe("chat_failed");
  });

  test("category strings are never the raw message", () => {
    const raw = "OpenAI auth failed: api_key=sk-proj-secret-leak";
    const cat = publicErrorCategory(raw);
    expect(cat).not.toContain("sk-proj");
    expect(cat).not.toContain("api_key=");
    // category itself is short and stable
    expect(cat.length).toBeLessThan(50);
  });
});
