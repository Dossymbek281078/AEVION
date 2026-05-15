/**
 * QCoreAI provider+model pricing table.
 *
 * Values are USD per 1,000,000 tokens (input / output). Prices move often and
 * vary by tier / region — the numbers below are representative list prices at
 * the time of writing and are used only for cost-dashboard display. Consumers
 * that need exact billing must read provider invoices, not this table.
 *
 * When a model is not in the table we return { input: 0, output: 0 } and the
 * UI renders a gentle "—" instead of a misleading zero cost.
 */

export type UsdPer1M = { input: number; output: number };

const TABLE: Record<string, Record<string, UsdPer1M>> = {
  anthropic: {
    "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
    "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  },
  openai: {
    "gpt-4o": { input: 2.5, output: 10.0 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4-turbo": { input: 10.0, output: 30.0 },
  },
  gemini: {
    "gemini-2.5-flash": { input: 0.15, output: 0.6 },
    "gemini-2.0-flash-001": { input: 0.075, output: 0.3 },
    "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  },
  deepseek: {
    "deepseek-chat": { input: 0.14, output: 0.28 },
    "deepseek-reasoner": { input: 0.55, output: 2.19 },
  },
  grok: {
    "grok-3": { input: 3.0, output: 15.0 },
    "grok-3-mini": { input: 0.3, output: 0.5 },
  },
};

export function getModelPrice(provider: string, model: string): UsdPer1M | null {
  const p = TABLE[provider];
  if (!p) return null;
  const m = p[model];
  if (!m) return null;
  return m;
}

/** Cost in USD for a single call. Returns 0 when tokens are unknown or model is unpriced. */
export function costUsd(
  provider: string,
  model: string,
  tokensIn?: number | null,
  tokensOut?: number | null
): number {
  const price = getModelPrice(provider, model);
  if (!price) return 0;
  const tin = typeof tokensIn === "number" && tokensIn > 0 ? tokensIn : 0;
  const tout = typeof tokensOut === "number" && tokensOut > 0 ? tokensOut : 0;
  return (tin * price.input + tout * price.output) / 1_000_000;
}

/** Public shape: flat list of {provider, model, input, output} for frontend mirroring. */
export function getPricingTable(): Array<{ provider: string; model: string; inputPer1M: number; outputPer1M: number }> {
  const out: Array<{ provider: string; model: string; inputPer1M: number; outputPer1M: number }> = [];
  for (const [provider, models] of Object.entries(TABLE)) {
    for (const [model, price] of Object.entries(models)) {
      out.push({ provider, model, inputPer1M: price.input, outputPer1M: price.output });
    }
  }
  return out;
}
