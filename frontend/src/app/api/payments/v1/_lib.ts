import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";

export type Currency = "USD" | "EUR" | "KZT" | "AEC";

export type ApiLink = {
  id: string;
  amount: number;
  currency: Currency;
  title: string;
  description: string;
  settlement: "bank" | "aec";
  expires_in_days: number | null;
  status: "active" | "paid" | "expired";
  created: number;
  url: string;
  paid_at: number | null;
  paid_method?: string;
  paid_last4?: string;
};

export type ApiCheckout = {
  id: string;
  amount: number;
  currency: Currency;
  settlement: string;
  methods: string[];
  metadata: Record<string, string> | null;
  url: string;
  client_secret: string;
  status: "open" | "completed";
  created: number;
};

export type ApiSubscription = {
  id: string;
  customer: string;
  plan_name: string;
  amount: number;
  currency: Currency;
  interval: "weekly" | "monthly" | "quarterly" | "yearly";
  trial_days: number;
  status: "trialing" | "active" | "past_due" | "paused" | "canceled";
  current_period_start: number;
  current_period_end: number;
  created: number;
};

export type ApiWebhook = {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  created: number;
};

export type ApiSettlement = {
  id: string;
  amount: number;
  currency: Currency;
  status: "pending" | "scheduled" | "paid";
  target: "bank" | "aec";
  scheduled_for: number;
  paid_at: number | null;
  reference: string;
  payments: number;
  royalty: { party: string; share: number }[];
};

type Store = {
  links: Map<string, ApiLink>;
  checkouts: Map<string, ApiCheckout>;
  subscriptions: Map<string, ApiSubscription>;
  webhooks: Map<string, ApiWebhook>;
  settlements: Map<string, ApiSettlement>;
  idempotency: Map<string, { at: number; body: string }>;
};

const globalAny = globalThis as unknown as { __aevionPayStore?: Store };

if (!globalAny.__aevionPayStore) {
  globalAny.__aevionPayStore = {
    links: new Map(),
    checkouts: new Map(),
    subscriptions: new Map(),
    webhooks: new Map(),
    settlements: seedSettlements(),
    idempotency: new Map(),
  };
}

export const store = globalAny.__aevionPayStore;

function seedSettlements(): Map<string, ApiSettlement> {
  const map = new Map<string, ApiSettlement>();
  const samples: ApiSettlement[] = [
    {
      id: "st_q9w2k4",
      amount: 124500,
      currency: "USD",
      status: "paid",
      target: "bank",
      scheduled_for: Date.now() - 86400000,
      paid_at: Date.now() - 4 * 60 * 60 * 1000,
      reference: "AEV-2026-04-26-USD",
      payments: 47,
      royalty: [
        { party: "creator_pool", share: 0.7 },
        { party: "ip_holder", share: 0.15 },
        { party: "platform", share: 0.1 },
        { party: "treasury", share: 0.05 },
      ],
    },
    {
      id: "st_b8h5n2",
      amount: 38900,
      currency: "EUR",
      status: "scheduled",
      target: "bank",
      scheduled_for: Date.now() + 18 * 60 * 60 * 1000,
      paid_at: null,
      reference: "AEV-2026-04-28-EUR",
      payments: 22,
      royalty: [
        { party: "creator_pool", share: 0.7 },
        { party: "ip_holder", share: 0.15 },
        { party: "platform", share: 0.1 },
        { party: "treasury", share: 0.05 },
      ],
    },
  ];
  for (const s of samples) map.set(s.id, s);
  return map;
}

const PREFIX_RE = /^(sk_test_|sk_live_)[a-zA-Z0-9]{8,}$/;

export function authError(req: NextRequest):
  | { code: 401; body: { error: { type: string; message: string } } }
  | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m) {
    return {
      code: 401,
      body: {
        error: {
          type: "authentication_error",
          message: "Missing Authorization Bearer token.",
        },
      },
    };
  }
  if (!PREFIX_RE.test(m[1])) {
    return {
      code: 401,
      body: {
        error: {
          type: "authentication_error",
          message: "Token must look like sk_test_… or sk_live_…",
        },
      },
    };
  }
  return null;
}

export function genId(prefix: string) {
  const stamp = Date.now().toString(36).slice(-4);
  const rand = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${stamp}${rand}`;
}

export function genSecret() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return (
    "whsec_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function signHmac(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function badRequest(message: string, code = 400) {
  return Response.json(
    { error: { type: "invalid_request_error", message } },
    { status: code }
  );
}

export function withCors(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Idempotency-Key"
  );
  return res;
}

export function getOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "aevion.app";
  return `${proto}://${host}`;
}

export function checkIdempotency(req: NextRequest, body: string):
  | { hit: true; cachedBody: string }
  | { hit: false; cleanup: () => void } {
  const key = req.headers.get("idempotency-key");
  if (!key) {
    return { hit: false, cleanup: () => undefined };
  }
  const prior = store.idempotency.get(key);
  if (prior) return { hit: true, cachedBody: prior.body };
  return {
    hit: false,
    cleanup: () => {
      store.idempotency.set(key, { at: Date.now(), body });
      if (store.idempotency.size > 5000) {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        for (const [k, v] of store.idempotency.entries()) {
          if (v.at < cutoff) store.idempotency.delete(k);
        }
      }
    },
  };
}

export async function readJson<T = unknown>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
