/**
 * Paddle Price IDs — production live keys.
 * Эти ID берутся из Paddle dashboard → Catalog → Products → Prices.
 * Не секретные — можно хранить в коде.
 */

export const PADDLE_PRICES = {
  pro_monthly:     "pri_01krzxq0t2rmy9erdv54c9ny3w",
  pro_annual:      "pri_01krzyf5trnvptmpwdxz570mpf",
  business_monthly:"pri_01krzy7zgqn32xc52qjbkfhvz0",
} as const;

export type PaddlePriceKey = keyof typeof PADDLE_PRICES;

export interface PaddlePlanInfo {
  priceId: string;
  name: string;
  amountUsd: number;
  period: "monthly" | "annual";
  tierId: "pro" | "business";
  trialDays: number;
  highlight?: boolean;
}

export const PADDLE_PLANS: PaddlePlanInfo[] = [
  {
    priceId: PADDLE_PRICES.pro_monthly,
    name: "Pro",
    amountUsd: 19,
    period: "monthly",
    tierId: "pro",
    trialDays: 14,
    highlight: true,
  },
  {
    priceId: PADDLE_PRICES.pro_annual,
    name: "Pro Annual",
    amountUsd: 192,
    period: "annual",
    tierId: "pro",
    trialDays: 14,
  },
  {
    priceId: PADDLE_PRICES.business_monthly,
    name: "Business",
    amountUsd: 49,
    period: "monthly",
    tierId: "business",
    trialDays: 14,
  },
];

export function getPaddlePlan(priceId: string): PaddlePlanInfo | undefined {
  return PADDLE_PLANS.find((p) => p.priceId === priceId);
}
