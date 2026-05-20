/**
 * AEVION Revenue Hub — /api/revenue/*
 *
 * Централизованная точка сбора метрик монетизации по всем приложениям.
 *
 * Архитектура:
 *   - Paddle Billing (основной): Merchant of Record, KZ-friendly → /api/paddle/*
 *   - PayBox: KZT локальные платежи
 *   - YouTube Analytics API (read-only)
 *   - Twitch Helix API (client-credentials)
 *
 * Все источники graceful-stub при отсутствии ключей.
 */

import { Router } from "express";
import { REVENUE_APPS, getLiveRevenueApps, getRevenueApp } from "../data/revenueApps";
import { PADDLE_KEY, IS_PADDLE_SANDBOX, paddleGet } from "../lib/paddleClient";

export const revenueRouter = Router();

// ─── ENV helpers ────────────────────────────────────────────────────────────

const PADDLE_SANDBOX = IS_PADDLE_SANDBOX;
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

// ─── Paddle helpers ───────────────────────────────────────────────────────

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
    const ur = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, { headers });
    if (!ur.ok) return null;
    const ud = await ur.json() as { data?: { id: string; display_name: string }[] };
    const user = ud.data?.[0];
    if (!user) return null;
    const sr = await fetch(`https://api.twitch.tv/helix/streams?user_login=${login}`, { headers });
    const sd = sr.ok ? await sr.json() as { data?: { viewer_count: number }[] } : { data: [] };
    const stream = sd.data?.[0];
    const fr = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`, { headers });
    const fd = fr.ok ? await fr.json() as { total?: number } : {};
    return {
      followers: (fd as { total?: number }).total ?? 0,
      viewerCount: stream?.viewer_count ?? 0,
      isLive: !!stream,
      displayName: user.display_name,
    };
  } catch { return null; }
}

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/revenue/health
 */
revenueRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    providers: {
      paddle: {
        configured: Boolean(PADDLE_KEY()),
        sandbox: PADDLE_SANDBOX(),
        setupGuide: "/api/paddle/setup-guide",
      },
      paybox: { configured: Boolean(process.env.PAYBOX_MERCHANT_ID) },
      youtube: { configured: Boolean(YT_API_KEY()) },
      twitch: { configured: Boolean(TWITCH_CLIENT_ID() && TWITCH_CLIENT_SECRET()) },
    },
    appsTotal: REVENUE_APPS.length,
    appsLive: getLiveRevenueApps().length,
  });
});

/**
 * GET /api/revenue/apps
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
    result.youtube = channelId && YT_API_KEY()
      ? await youtubeChannelStats(channelId)
      : { stub: true, message: channelId ? "YOUTUBE_API_KEY not set" : `ENV ${app.youtubeChannelEnvKey} not set` };
  }

  // Twitch stats
  if (app.twitchChannelEnvKey) {
    const channel = process.env[app.twitchChannelEnvKey];
    result.twitch = channel && TWITCH_CLIENT_ID()
      ? await twitchChannelStats(channel)
      : { stub: true, message: channel ? "TWITCH_CLIENT_ID/SECRET not set" : `ENV ${app.twitchChannelEnvKey} not set` };
  }

  // Paddle: recent transactions for this app
  if (PADDLE_KEY()) {
    const data = await paddleGet(
      `/transactions?per_page=10&order_by=id[DESC]`,
    ) as { data?: { id: string; status: string; custom_data?: Record<string, string>; total?: string; currency_code?: string; created_at?: string }[] } | null;
    const txs = (data?.data ?? []).filter((t) => t.custom_data?.app_id === app.appId);
    result.paddle = {
      recentTransactions: txs.map((t) => ({
        id: t.id,
        status: t.status,
        amountUsd: t.total ? parseFloat(t.total) / 100 : 0,
        currency: t.currency_code ?? "USD",
        date: t.created_at,
      })),
      total: txs.filter((t) => t.status === "completed")
        .reduce((s, t) => s + (t.total ? parseFloat(t.total) / 100 : 0), 0),
      sandbox: PADDLE_SANDBOX(),
    };
  } else {
    result.paddle = { stub: true, message: "PADDLE_API_KEY not set — visit /api/paddle/setup-guide" };
  }

  res.json(result);
});

/**
 * GET /api/revenue/overview
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
      paddle: { configured: Boolean(PADDLE_KEY()), sandbox: PADDLE_SANDBOX() },
      youtube: { configured: Boolean(YT_API_KEY()) },
      twitch: { configured: Boolean(TWITCH_CLIENT_ID() && TWITCH_CLIENT_SECRET()) },
    },
    apps: live.map((a) => ({ appId: a.appId, appName: a.appName, channels: a.channels, color: a.color })),
  });
});

/**
 * GET /api/revenue/youtube/:channelId
 */
revenueRouter.get("/youtube/:channelId", async (req, res) => {
  if (!YT_API_KEY()) return res.status(503).json({ error: "YOUTUBE_API_KEY not configured" });
  const stats = await youtubeChannelStats(req.params.channelId);
  if (!stats) return res.status(404).json({ error: "channel_not_found_or_api_error" });
  res.json(stats);
});

/**
 * GET /api/revenue/twitch/:login
 */
revenueRouter.get("/twitch/:login", async (req, res) => {
  if (!TWITCH_CLIENT_ID() || !TWITCH_CLIENT_SECRET())
    return res.status(503).json({ error: "TWITCH_CLIENT_ID/SECRET not configured" });
  const stats = await twitchChannelStats(req.params.login);
  if (!stats) return res.status(404).json({ error: "channel_not_found_or_api_error" });
  res.json(stats);
});

/**
 * GET /api/revenue/paddle/balance
 * Сводка баланса через Paddle transactions.
 */
revenueRouter.get("/paddle/balance", async (_req, res) => {
  if (!PADDLE_KEY()) {
    return res.json({ stub: true, message: "PADDLE_API_KEY not set", setupGuide: "/api/paddle/setup-guide" });
  }
  const data = await paddleGet("/transactions?per_page=50&status_equals=completed") as {
    data?: { total?: string; currency_code?: string; custom_data?: Record<string, string> }[];
  } | null;
  if (!data) return res.status(502).json({ error: "paddle_api_error" });

  const totalUsd = (data.data ?? []).reduce((s, t) => s + (t.total ? parseFloat(t.total) / 100 : 0), 0);
  res.json({ totalUsd, currency: "USD", sandbox: PADDLE_SANDBOX(), transactionCount: data.data?.length ?? 0 });
});

/**
 * GET /api/revenue/paddle/recent
 * Последние транзакции с разбивкой по app_id.
 */
revenueRouter.get("/paddle/recent", async (_req, res) => {
  if (!PADDLE_KEY()) {
    return res.json({ stub: true, transactions: [], message: "PADDLE_API_KEY not set", setupGuide: "/api/paddle/setup-guide" });
  }
  const data = await paddleGet("/transactions?per_page=20&order_by=id[DESC]") as {
    data?: { id: string; status: string; custom_data?: Record<string, string>; total?: string; currency_code?: string; created_at?: string }[];
  } | null;
  if (!data) return res.status(502).json({ error: "paddle_api_error" });

  const transactions = (data.data ?? []).map((t) => ({
    id: t.id,
    appId: t.custom_data?.app_id || "platform",
    status: t.status,
    amountUsd: t.total ? parseFloat(t.total) / 100 : 0,
    currency: t.currency_code ?? "USD",
    date: t.created_at,
  }));

  const byApp: Record<string, { count: number; totalUsd: number }> = {};
  for (const t of transactions) {
    if (t.status === "completed") {
      if (!byApp[t.appId]) byApp[t.appId] = { count: 0, totalUsd: 0 };
      byApp[t.appId].count++;
      byApp[t.appId].totalUsd += t.amountUsd;
    }
  }

  res.json({ transactions, byApp, sandbox: PADDLE_SANDBOX() });
});

/**
 * GET /api/revenue/env-guide
 */
revenueRouter.get("/env-guide", (_req, res) => {
  res.json({
    global: [
      { key: "PADDLE_API_KEY", required: true, example: "pdl_sdbx_...", note: "Paddle dashboard → Developer → Authentication → API Key. Для KZ можно регистрироваться как Individual." },
      { key: "PADDLE_WEBHOOK_SECRET", required: false, example: "pdl_ntfset_...", note: "Paddle dashboard → Notifications → endpoint → signing secret" },
      { key: "PADDLE_SANDBOX", required: false, example: "true", note: "true = sandbox тестирование (по умолчанию). false = production." },
      { key: "YOUTUBE_API_KEY", required: false, example: "AIzaSy...", note: "Google Cloud Console → APIs → YouTube Data API v3 → API Key" },
      { key: "TWITCH_CLIENT_ID", required: false, example: "abc123...", note: "dev.twitch.tv/console → Register App → Client ID" },
      { key: "TWITCH_CLIENT_SECRET", required: false, example: "xyz789...", note: "dev.twitch.tv/console → Register App → New Secret" },
      { key: "PAYBOX_MERCHANT_ID", required: false, example: "123456", note: "paybox.money → Личный кабинет → Мерчанты → ID (для KZT)" },
    ],
    perApp: REVENUE_APPS
      .filter((a) => a.youtubeChannelEnvKey || a.twitchChannelEnvKey)
      .map((a) => ({
        appId: a.appId,
        appName: a.appName,
        vars: [
          ...(a.youtubeChannelEnvKey ? [{ key: a.youtubeChannelEnvKey, example: "UCxxxxxx", note: `YouTube Channel ID для ${a.appName}` }] : []),
          ...(a.twitchChannelEnvKey ? [{ key: a.twitchChannelEnvKey, example: "yourchannel", note: `Twitch логин для ${a.appName}` }] : []),
        ],
      })),
    setupGuide: "/api/paddle/setup-guide",
  });
});
