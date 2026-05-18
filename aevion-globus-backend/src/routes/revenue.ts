/**
 * AEVION Revenue Hub — /api/revenue/*
 *
 * Централизованная точка сбора метрик монетизации по всем приложениям.
 *
 * Архитектура:
 *   - Stripe: один аккаунт, attribution через metadata.app_id
 *   - PayBox: orderId prefix = {appId}-{ts}
 *   - YouTube Analytics API (read-only, ключ в ENV)
 *   - Twitch Helix API (client-credentials, ключи в ENV)
 *
 * Все источники graceful-stub при отсутствии ключей.
 */

import { Router } from "express";
import { REVENUE_APPS, getLiveRevenueApps, getRevenueApp } from "../data/revenueApps";

export const revenueRouter = Router();

// ─── ENV helpers ────────────────────────────────────────────────────────────

const STRIPE_KEY = () => process.env.STRIPE_SECRET_KEY?.trim() || "";
const YT_API_KEY = () => process.env.YOUTUBE_API_KEY?.trim() || "";
const TWITCH_CLIENT_ID = () => process.env.TWITCH_CLIENT_ID?.trim() || "";
const TWITCH_CLIENT_SECRET = () => process.env.TWITCH_CLIENT_SECRET?.trim() || "";

// ─── Twitch OAuth token (cached in-process) ───────────────────────────────

let twitchToken: string | null = null;
let twitchTokenExpiry = 0;

async function getTwitchToken(): Promise<string | null> {
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;
  const cid = TWITCH_CLIENT_ID();
  const secret = TWITCH_CLIENT_SECRET();
  if (!cid || !secret) return null;
  try {
    const r = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${cid}&client_secret=${secret}&grant_type=client_credentials`,
      { method: "POST" },
    );
    if (!r.ok) return null;
    const d = await r.json() as { access_token: string; expires_in: number };
    twitchToken = d.access_token;
    twitchTokenExpiry = Date.now() + (d.expires_in - 60) * 1000;
    return twitchToken;
  } catch { return null; }
}

// ─── Stripe helpers ───────────────────────────────────────────────────────

async function stripeGet(path: string): Promise<unknown | null> {
  const key = STRIPE_KEY();
  if (!key) return null;
  try {
    const r = await fetch(`https://api.stripe.com/v1${path}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ─── YouTube helpers ──────────────────────────────────────────────────────

async function youtubeChannelStats(channelId: string): Promise<{
  subscribers: number; views: number; videoCount: number;
} | null> {
  const key = YT_API_KEY();
  if (!key || !channelId) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json() as { items?: { statistics: { subscriberCount: string; viewCount: string; videoCount: string } }[] };
    const s = d.items?.[0]?.statistics;
    if (!s) return null;
    return {
      subscribers: parseInt(s.subscriberCount || "0"),
      views: parseInt(s.viewCount || "0"),
      videoCount: parseInt(s.videoCount || "0"),
    };
  } catch { return null; }
}

// ─── Twitch helpers ───────────────────────────────────────────────────────

async function twitchChannelStats(login: string): Promise<{
  followers: number; viewerCount: number; isLive: boolean; displayName: string;
} | null> {
  const token = await getTwitchToken();
  const cid = TWITCH_CLIENT_ID();
  if (!token || !cid || !login) return null;
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Client-Id": cid,
    };
    // Get user info
    const ur = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, { headers });
    if (!ur.ok) return null;
    const ud = await ur.json() as { data?: { id: string; display_name: string }[] };
    const user = ud.data?.[0];
    if (!user) return null;

    // Get stream (live check)
    const sr = await fetch(`https://api.twitch.tv/helix/streams?user_login=${login}`, { headers });
    const sd = sr.ok ? await sr.json() as { data?: { viewer_count: number }[] } : { data: [] };
    const stream = sd.data?.[0];

    // Get followers count
    const fr = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`, { headers });
    const fd = fr.ok ? await fr.json() as { total?: number } : {};

    return {
      followers: fd.total ?? 0,
      viewerCount: stream?.viewer_count ?? 0,
      isLive: !!stream,
      displayName: user.display_name,
    };
  } catch { return null; }
}

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/revenue/health
 * Проверяет, какие провайдеры настроены.
 */
revenueRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    providers: {
      stripe: { configured: Boolean(STRIPE_KEY()), testMode: STRIPE_KEY().startsWith("sk_test_") },
      youtube: { configured: Boolean(YT_API_KEY()) },
      twitch: { configured: Boolean(TWITCH_CLIENT_ID() && TWITCH_CLIENT_SECRET()) },
    },
    appsTotal: REVENUE_APPS.length,
    appsLive: getLiveRevenueApps().length,
  });
});

/**
 * GET /api/revenue/apps
 * Реестр всех приложений с описанием каналов монетизации.
 */
revenueRouter.get("/apps", (_req, res) => {
  res.json({
    apps: REVENUE_APPS.map((a) => ({
      appId: a.appId,
      appName: a.appName,
      channels: a.channels,
      color: a.color,
      description: a.description,
      live: a.live,
      hasYoutube: Boolean(a.youtubeChannelEnvKey && process.env[a.youtubeChannelEnvKey]),
      hasTwitch: Boolean(a.twitchChannelEnvKey && process.env[a.twitchChannelEnvKey]),
    })),
  });
});

/**
 * GET /api/revenue/apps/:appId
 * Агрегированные данные по конкретному приложению (Stripe + YouTube + Twitch).
 */
revenueRouter.get("/apps/:appId", async (req, res) => {
  const app = getRevenueApp(req.params.appId);
  if (!app) return res.status(404).json({ error: "app_not_found" });

  const result: Record<string, unknown> = {
    appId: app.appId,
    appName: app.appName,
    channels: app.channels,
    color: app.color,
    live: app.live,
  };

  // YouTube stats
  if (app.youtubeChannelEnvKey) {
    const channelId = process.env[app.youtubeChannelEnvKey];
    if (channelId && YT_API_KEY()) {
      result.youtube = await youtubeChannelStats(channelId);
    } else {
      result.youtube = channelId
        ? { stub: true, message: "YOUTUBE_API_KEY not set" }
        : { stub: true, message: `ENV ${app.youtubeChannelEnvKey} not set` };
    }
  }

  // Twitch stats
  if (app.twitchChannelEnvKey) {
    const channel = process.env[app.twitchChannelEnvKey];
    if (channel && TWITCH_CLIENT_ID()) {
      result.twitch = await twitchChannelStats(channel);
    } else {
      result.twitch = channel
        ? { stub: true, message: "TWITCH_CLIENT_ID/SECRET not set" }
        : { stub: true, message: `ENV ${app.twitchChannelEnvKey} not set` };
    }
  }

  // Stripe: последние 10 платежей с этим app_id в metadata
  if (STRIPE_KEY() && app.channels.some((c) => c.startsWith("stripe"))) {
    const data = await stripeGet(
      `/payment_intents?limit=10&expand[]=data.metadata&metadata[app_id]=${app.appId}`,
    ) as { data?: { id: string; amount: number; currency: string; status: string; created: number; metadata: Record<string, string> }[] } | null;
    result.stripe = data
      ? {
          recentPayments: (data.data ?? []).map((pi) => ({
            id: pi.id,
            amountUsd: pi.amount / 100,
            currency: pi.currency,
            status: pi.status,
            date: new Date(pi.created * 1000).toISOString(),
          })),
          total: (data.data ?? []).reduce((s, pi) => s + (pi.status === "succeeded" ? pi.amount : 0), 0) / 100,
        }
      : { stub: true, message: "No Stripe key" };
  }

  res.json(result);
});

/**
 * GET /api/revenue/overview
 * Агрегированная сводка по всем приложениям (без тяжёлых API-вызовов).
 */
revenueRouter.get("/overview", (_req, res) => {
  const live = getLiveRevenueApps();
  const channelMap: Record<string, number> = {};
  for (const app of live) {
    for (const ch of app.channels) {
      channelMap[ch] = (channelMap[ch] || 0) + 1;
    }
  }

  res.json({
    totalApps: REVENUE_APPS.length,
    liveApps: live.length,
    channelCoverage: channelMap,
    providers: {
      stripe: { configured: Boolean(STRIPE_KEY()) },
      youtube: { configured: Boolean(YT_API_KEY()) },
      twitch: { configured: Boolean(TWITCH_CLIENT_ID() && TWITCH_CLIENT_SECRET()) },
    },
    apps: live.map((a) => ({
      appId: a.appId,
      appName: a.appName,
      channels: a.channels,
      color: a.color,
    })),
  });
});

/**
 * GET /api/revenue/youtube/:channelId
 * Прямой запрос статистики YouTube-канала по ID.
 */
revenueRouter.get("/youtube/:channelId", async (req, res) => {
  if (!YT_API_KEY()) {
    return res.status(503).json({ error: "YOUTUBE_API_KEY not configured" });
  }
  const stats = await youtubeChannelStats(req.params.channelId);
  if (!stats) return res.status(404).json({ error: "channel_not_found_or_api_error" });
  res.json(stats);
});

/**
 * GET /api/revenue/twitch/:login
 * Прямой запрос статистики Twitch-канала по логину.
 */
revenueRouter.get("/twitch/:login", async (req, res) => {
  if (!TWITCH_CLIENT_ID() || !TWITCH_CLIENT_SECRET()) {
    return res.status(503).json({ error: "TWITCH_CLIENT_ID/SECRET not configured" });
  }
  const stats = await twitchChannelStats(req.params.login);
  if (!stats) return res.status(404).json({ error: "channel_not_found_or_api_error" });
  res.json(stats);
});

/**
 * GET /api/revenue/stripe/balance
 * Текущий баланс Stripe-аккаунта.
 */
revenueRouter.get("/stripe/balance", async (_req, res) => {
  if (!STRIPE_KEY()) {
    return res.json({ stub: true, available: [], pending: [], message: "STRIPE_SECRET_KEY not set" });
  }
  const data = await stripeGet("/balance");
  if (!data) return res.status(502).json({ error: "stripe_api_error" });
  res.json(data);
});

/**
 * GET /api/revenue/stripe/recent
 * Последние 20 платежей по всем приложениям с разбивкой по app_id.
 */
revenueRouter.get("/stripe/recent", async (_req, res) => {
  if (!STRIPE_KEY()) {
    return res.json({ stub: true, payments: [], message: "STRIPE_SECRET_KEY not set" });
  }
  const data = await stripeGet("/payment_intents?limit=20") as {
    data?: { id: string; amount: number; currency: string; status: string; created: number; metadata: Record<string, string> }[]
  } | null;
  if (!data) return res.status(502).json({ error: "stripe_api_error" });

  const payments = (data.data ?? []).map((pi) => ({
    id: pi.id,
    appId: pi.metadata?.app_id || "platform",
    amountUsd: pi.amount / 100,
    currency: pi.currency,
    status: pi.status,
    date: new Date(pi.created * 1000).toISOString(),
  }));

  // Группируем по app_id
  const byApp: Record<string, { count: number; totalUsd: number }> = {};
  for (const p of payments) {
    if (p.status === "succeeded") {
      if (!byApp[p.appId]) byApp[p.appId] = { count: 0, totalUsd: 0 };
      byApp[p.appId].count++;
      byApp[p.appId].totalUsd += p.amountUsd;
    }
  }

  res.json({ payments, byApp });
});

/**
 * GET /api/revenue/env-guide
 * Инструкция по настройке ENV-переменных для монетизации.
 */
revenueRouter.get("/env-guide", (_req, res) => {
  const guide = {
    global: [
      { key: "STRIPE_SECRET_KEY", required: true, example: "sk_live_...", note: "Stripe secret key. Получить: dashboard.stripe.com → Developers → API keys" },
      { key: "STRIPE_WEBHOOK_SECRET", required: false, example: "whsec_...", note: "Для webhook signature verification. dashboard.stripe.com → Webhooks" },
      { key: "YOUTUBE_API_KEY", required: false, example: "AIzaSy...", note: "Google Cloud Console → APIs → YouTube Data API v3 → Credentials → API Key" },
      { key: "TWITCH_CLIENT_ID", required: false, example: "abc123...", note: "dev.twitch.tv/console → Register Your Application → Client ID" },
      { key: "TWITCH_CLIENT_SECRET", required: false, example: "xyz789...", note: "dev.twitch.tv/console → Register Your Application → New Secret" },
      { key: "PAYBOX_MERCHANT_ID", required: false, example: "123456", note: "paybox.money → Личный кабинет → Мерчанты → ID" },
      { key: "PAYBOX_SECRET_KEY", required: false, example: "secret123", note: "paybox.money → Личный кабинет → Мерчанты → Ключ" },
    ],
    perApp: REVENUE_APPS
      .filter((a) => a.youtubeChannelEnvKey || a.twitchChannelEnvKey)
      .map((a) => ({
        appId: a.appId,
        appName: a.appName,
        vars: [
          ...(a.youtubeChannelEnvKey ? [{
            key: a.youtubeChannelEnvKey,
            required: false,
            example: "UCxxxxxx",
            note: `YouTube Channel ID для ${a.appName}. Найти: откройте канал → URL или youtube.com/account_advanced`,
          }] : []),
          ...(a.twitchChannelEnvKey ? [{
            key: a.twitchChannelEnvKey,
            required: false,
            example: "yourchannel",
            note: `Twitch login канала для ${a.appName} (без @)`,
          }] : []),
        ],
      })),
  };
  res.json(guide);
});
