"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import { apiUrl, getBackendOrigin } from "@/lib/apiBase";
import { launchedModules } from "@/data/pitchModel";

/* ─────────────────────────────────────────────────────────────────
 * Static content (was in the server page before client conversion)
 * ────────────────────────────────────────────────────────────── */

const HERO_STATS: Array<{ label: string; value: string; hint: string }> = [
  { label: "Backend", value: "/api/qcoreai/chat", hint: "Single endpoint live" },
  { label: "Stage", value: "Beta MVP", hint: "Parallel agents shipped" },
  { label: "Providers", value: "5", hint: "via QCoreAI router" },
  { label: "B2B angle", value: "White-label", hint: "AEVION inside SaaS line" },
];

const VISION_BULLETS = [
  "One window, many agents — no more juggling 4 browser tabs for 4 different AIs.",
  "Each session inherits AEVION context: your IP portfolio (QRight), your wallet (Bank), your tier (Trust Score), your awards.",
  "Agents can cross-call each other through QCoreAI routing — Code agent hands off to Finance agent without losing context.",
  "Centralised model spend across the platform: predictable per-token economics, single biggest OPEX win in the company.",
];

/* ─────────────────────────────────────────────────────────────────
 * Multichat data model
 * ────────────────────────────────────────────────────────────── */

type Role =
  | "General"
  | "Code"
  | "Finance"
  | "IP/Legal"
  | "Compliance"
  | "Translator";

type ChatMsg = { role: "user" | "assistant"; content: string };

type Agent = {
  id: string;
  role: Role;
  provider: string;
  model: string;
  title: string;
  messages: ChatMsg[];
  busy: boolean;
};

type ProviderInfo = {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  configured: boolean;
};

type UserContext = {
  email?: string;
  accountId?: string;
  balance?: number;
  qrightCount?: number;
};

const STORAGE_KEY = "aevion_multichat_v1";
const MAX_AGENTS = 6;
const MAX_MESSAGES_KEPT = 50;

const ROLES: Role[] = [
  "General",
  "Code",
  "Finance",
  "IP/Legal",
  "Compliance",
  "Translator",
];

const ROLE_COLORS: Record<Role, { bg: string; border: string; fg: string }> = {
  General:    { bg: "rgba(94,234,212,0.18)",  border: "rgba(94,234,212,0.45)",  fg: "#5eead4" },
  Code:       { bg: "rgba(125,211,252,0.18)", border: "rgba(125,211,252,0.45)", fg: "#7dd3fc" },
  Finance:    { bg: "rgba(250,204,21,0.18)",  border: "rgba(250,204,21,0.45)",  fg: "#facc15" },
  "IP/Legal": { bg: "rgba(196,181,253,0.18)", border: "rgba(196,181,253,0.45)", fg: "#c4b5fd" },
  Compliance: { bg: "rgba(248,113,113,0.18)", border: "rgba(248,113,113,0.45)", fg: "#fca5a5" },
  Translator: { bg: "rgba(134,239,172,0.18)", border: "rgba(134,239,172,0.45)", fg: "#86efac" },
};

const ROLE_SYSTEM_PROMPT: Record<Role, string> = {
  General:
    "You are a helpful AEVION assistant. Be concise, clear and friendly. Answer in the user's language.",
  Code:
    "You are a senior software engineer. Output runnable, idiomatic code with brief explanations. Prefer TypeScript / Node / React unless told otherwise.",
  Finance:
    "You are a quantitative finance analyst for AEVION Bank users. Reason about portfolios, royalties, cashflow and risk. Cite assumptions. Never give specific investment advice.",
  "IP/Legal":
    "You are an IP and contract lawyer working inside AEVION QRight. Identify risks, suggest clauses, and flag jurisdiction issues. You are not a substitute for a licensed attorney — say so when relevant.",
  Compliance:
    "You are a compliance officer covering KYC, AML, data privacy (GDPR), sanctions and audit. Be cautious, structured, and cite regulation names where possible.",
  Translator:
    "You are a professional translator. Detect the source language, then translate into the target language requested by the user (default: English). Preserve tone and terminology.",
};

const DEMO_REPLIES: Record<Role, string> = {
  General:
    "(demo) The live AI engine is unreachable right now. In production I would route your question through QCoreAI and return a concise answer here.",
  Code:
    "(demo) Here is a refactored version:\n\n```ts\nfunction example(x: number) {\n  return x * 2;\n}\n```\nThe live engine is offline; this is a stub response.",
  Finance:
    "(demo) Based on a hypothetical portfolio: ~62% equities, ~28% fixed income, ~10% cash. Sharpe ~0.9. The live engine is offline; this is a stub response.",
  "IP/Legal":
    "(demo) Two clauses to review: (1) assignment of derivative works, (2) jurisdiction. Recommend escrowing source via QSign. Live engine offline.",
  Compliance:
    "(demo) Suggested KYC tier: T2 (PEP screening + proof of address). Logged for audit. Live engine offline.",
  Translator:
    "(demo) Source: en → Target: ru. \"Hello\" → \"Привет\". Live engine offline.",
};

/* Shorter pretty model names — same map as /qcoreai */
const prettyModel = (m: string) => {
  const map: Record<string, string> = {
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.0-flash-001": "Gemini 2.0 Flash",
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "deepseek-chat": "DeepSeek Chat",
    "deepseek-reasoner": "DeepSeek Reasoner",
    "grok-3": "Grok 3",
    "grok-3-mini": "Grok 3 Mini",
  };
  return map[m] || m;
};

const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `a_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`);

const titleFromMessage = (role: Role, content: string) => {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (!trimmed) return role;
  const snippet = trimmed.length > 36 ? `${trimmed.slice(0, 33)}…` : trimmed;
  return `${role} · ${snippet}`;
};

/* ─────────────────────────────────────────────────────────────────
 * Cross-agent handoff via @mention
 * Lets a user write "@finance forecast next quarter" inside a Code
 * panel — message is forwarded to a Finance agent, reply comes back
 * into the Code panel marked "↪ via @finance".
 * ────────────────────────────────────────────────────────────── */

const MENTION_ALIAS: Record<string, Role> = {
  general: "General",
  code: "Code",
  dev: "Code",
  engineer: "Code",
  finance: "Finance",
  cfo: "Finance",
  money: "Finance",
  legal: "IP/Legal",
  ip: "IP/Legal",
  iplegal: "IP/Legal",
  lawyer: "IP/Legal",
  compliance: "Compliance",
  kyc: "Compliance",
  aml: "Compliance",
  translator: "Translator",
  translate: "Translator",
  tr: "Translator",
};

const ROLE_TAG: Record<Role, string> = {
  General: "general",
  Code: "code",
  Finance: "finance",
  "IP/Legal": "legal",
  Compliance: "compliance",
  Translator: "translator",
};

const MENTION_RE = /^@([a-zA-Z][a-zA-Z/]*)\s+([\s\S]+)$/;

function parseMention(raw: string): { role: Role | null; body: string } {
  const m = raw.match(MENTION_RE);
  if (!m) return { role: null, body: raw };
  const key = m[1].toLowerCase().replace(/\//g, "");
  const role = MENTION_ALIAS[key] ?? null;
  if (!role) return { role: null, body: raw };
  return { role, body: m[2].trim() };
}

const makeAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: newId(),
  role: "General",
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  title: "General",
  messages: [],
  busy: false,
  ...overrides,
});

/* ─────────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────── */

export default function MultichatEnginePage() {
  const origin = getBackendOrigin();
  const m = launchedModules.find((x) => x.id === "multichat-engine");

  /* Providers (loaded from backend, optional) */
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/qcoreai/providers"));
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.providers)) {
          setProviders(data.providers as ProviderInfo[]);
        }
      } catch {
        /* silent — provider switcher will hide gracefully */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* AEVION user context — injected into agent system prompts so
   * every panel knows who the human is (balance, IP works, …). */
  const [userCtx, setUserCtx] = useState<UserContext | null>(null);
  const [ctxEnabled, setCtxEnabled] = useState(true);

  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("aevion_auth_token_v1");
    } catch {
      /* private mode — silently skip */
    }
    if (!token) return;

    let cancelled = false;
    (async () => {
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const ctx: UserContext = {};

      try {
        const r = await fetch(apiUrl("/api/auth/me"), { headers });
        if (r.ok) {
          const me = await r.json();
          ctx.email = me?.email || me?.user?.email;
        }
      } catch {
        /* ignore */
      }
      try {
        const r = await fetch(apiUrl("/api/qtrade/accounts"), { headers });
        if (r.ok) {
          const data = await r.json();
          const list = Array.isArray(data?.accounts)
            ? data.accounts
            : Array.isArray(data)
            ? data
            : null;
          if (list && list.length) {
            const acc = list[0];
            if (acc?.id) ctx.accountId = acc.id;
            if (typeof acc?.balance === "number") ctx.balance = acc.balance;
          }
        }
      } catch {
        /* ignore */
      }
      try {
        const r = await fetch(apiUrl("/api/qright/objects"), { headers });
        if (r.ok) {
          const data = await r.json();
          const objs = Array.isArray(data?.objects)
            ? data.objects
            : Array.isArray(data)
            ? data
            : null;
          if (objs) ctx.qrightCount = objs.length;
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return;
      const hasAny =
        ctx.email != null ||
        ctx.balance != null ||
        ctx.accountId != null ||
        ctx.qrightCount != null;
      if (hasAny) setUserCtx(ctx);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* Compose role system prompt + user context block */
  const buildSystemPrompt = useCallback(
    (role: Role): string => {
      const base = ROLE_SYSTEM_PROMPT[role];
      if (!ctxEnabled || !userCtx) return base;
      const lines: string[] = [
        "AEVION USER CONTEXT (the human you are talking to has a real account on AEVION):",
      ];
      if (userCtx.email) lines.push(`- Account email: ${userCtx.email}`);
      if (userCtx.accountId) lines.push(`- Wallet ID: ${userCtx.accountId}`);
      if (userCtx.balance != null)
        lines.push(`- Current AEC balance: ${userCtx.balance.toLocaleString("en-US")}`);
      if (userCtx.qrightCount != null)
        lines.push(`- Registered IP works on QRight: ${userCtx.qrightCount}`);
      lines.push(
        "Use these facts when they are relevant to the user's question. Do not list them back unless asked."
      );
      return `${lines.join("\n")}\n\n${base}`;
    },
    [ctxEnabled, userCtx]
  );

  /* Agents — restore from localStorage on mount */
  const [agents, setAgents] = useState<Agent[]>([makeAgent()]);
  const [hydrated, setHydrated] = useState(false);

  /* Always-current ref for cross-agent handoff lookup */
  const agentsRef = useRef<Agent[]>(agents);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Strip any stuck busy flags from a previous session.
          setAgents(
            parsed.slice(0, MAX_AGENTS).map((a: Agent) => ({ ...a, busy: false }))
          );
        }
      }
    } catch {
      /* ignore corrupted state */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    } catch {
      /* quota / privacy mode — ignore */
    }
  }, [agents, hydrated]);

  /* Agent operations */
  const addAgent = useCallback(() => {
    setAgents((cur) => {
      if (cur.length >= MAX_AGENTS) return cur;
      // Pick the next role that isn't already used, fall back to General
      const used = new Set(cur.map((a) => a.role));
      const nextRole = ROLES.find((r) => !used.has(r)) ?? "General";
      return [...cur, makeAgent({ role: nextRole, title: nextRole })];
    });
  }, []);

  const removeAgent = useCallback((id: string) => {
    setAgents((cur) => {
      const next = cur.filter((a) => a.id !== id);
      return next.length === 0 ? [makeAgent()] : next;
    });
  }, []);

  const updateAgent = useCallback(
    (id: string, patch: Partial<Agent> | ((a: Agent) => Partial<Agent>)) => {
      setAgents((cur) =>
        cur.map((a) => {
          if (a.id !== id) return a;
          const p = typeof patch === "function" ? patch(a) : patch;
          return { ...a, ...p };
        })
      );
    },
    []
  );

  const clearAll = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Wipe all agents and conversations? This cannot be undone."
    );
    if (!ok) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setAgents([makeAgent()]);
  }, []);

  /* Low-level: call /api/qcoreai/chat with role+model+history, get reply */
  const callChat = useCallback(
    async (role: Role, systemPrompt: string, provider: string, model: string, history: ChatMsg[]): Promise<{ reply: string; demo: boolean }> => {
      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((mm) => ({ role: mm.role, content: mm.content })),
      ];
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        try {
          const t = localStorage.getItem("aevion_auth_token_v1");
          if (t) headers.Authorization = `Bearer ${t}`;
        } catch {
          /* ignore */
        }
        const body: Record<string, unknown> = { messages: apiMessages };
        if (provider) body.provider = provider;
        if (model) body.model = model;
        const res = await fetch(apiUrl("/api/qcoreai/chat"), {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (typeof data?.reply === "string") return { reply: data.reply, demo: false };
        if (typeof data?.content === "string") return { reply: data.content, demo: false };
        return { reply: JSON.stringify(data, null, 2), demo: false };
      } catch {
        return { reply: DEMO_REPLIES[role], demo: true };
      }
    },
    []
  );

  /* Send message for a specific agent — supports @mention handoff */
  const sendMessage = useCallback(
    async (agentId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const { role: mentionRole, body: mentionBody } = parseMention(trimmed);
      const cur = agentsRef.current;
      const sourceAgent = cur.find((a) => a.id === agentId);
      if (!sourceAgent) return;

      const target = mentionRole
        ? cur.find((a) => a.role === mentionRole && a.id !== agentId)
        : null;

      /* ── Handoff branch: forward to target, return reply to both ── */
      if (mentionRole && target) {
        // 1) Append the @mention prompt in source as user msg + mark busy
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== agentId) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "user" as const, content: trimmed },
            ].slice(-MAX_MESSAGES_KEPT);
            return {
              ...a,
              messages: next,
              title: a.messages.length === 0 ? titleFromMessage(a.role, trimmed) : a.title,
              busy: true,
            };
          })
        );

        // 2) Append in target (visible "↪ from @<src>" so target user knows context)
        const sourceTag = ROLE_TAG[sourceAgent.role];
        const inboundMsg = `↪ from @${sourceTag}: ${mentionBody}`;
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== target.id) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "user" as const, content: inboundMsg },
            ].slice(-MAX_MESSAGES_KEPT);
            return {
              ...a,
              messages: next,
              title: a.messages.length === 0 ? titleFromMessage(a.role, mentionBody) : a.title,
              busy: true,
            };
          })
        );

        // Build target history from current state (post-append) for the call
        const targetHistory = [
          ...target.messages,
          { role: "user" as const, content: inboundMsg },
        ];

        const { reply } = await callChat(target.role, buildSystemPrompt(target.role), target.provider, target.model, targetHistory);

        // 3) Append assistant reply in TARGET (normal)
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== target.id) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "assistant" as const, content: reply },
            ].slice(-MAX_MESSAGES_KEPT);
            return { ...a, messages: next, busy: false };
          })
        );

        // 4) Append assistant reply in SOURCE with "↪ via @<target>" prefix
        const targetTag = ROLE_TAG[target.role];
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== agentId) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "assistant" as const, content: `↪ via @${targetTag}\n${reply}` },
            ].slice(-MAX_MESSAGES_KEPT);
            return { ...a, messages: next, busy: false };
          })
        );
        return;
      }

      /* ── Mention requested but no matching agent active ── */
      if (mentionRole && !target) {
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== agentId) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "user" as const, content: trimmed },
              {
                role: "assistant" as const,
                content: `No active @${ROLE_TAG[mentionRole]} agent in this window. Click "+ Spawn agent" and pick role "${mentionRole}" to enable handoff.`,
              },
            ].slice(-MAX_MESSAGES_KEPT);
            return {
              ...a,
              messages: next,
              title: a.messages.length === 0 ? titleFromMessage(a.role, trimmed) : a.title,
              busy: false,
            };
          })
        );
        return;
      }

      /* ── Normal (no-mention) branch ── */
      let snapshot: Agent | undefined;
      setAgents((curS) =>
        curS.map((a) => {
          if (a.id !== agentId) return a;
          const nextMessages: ChatMsg[] = [
            ...a.messages,
            { role: "user" as const, content: trimmed },
          ].slice(-MAX_MESSAGES_KEPT);
          const nextTitle =
            a.messages.length === 0 ? titleFromMessage(a.role, trimmed) : a.title;
          const updated: Agent = {
            ...a,
            messages: nextMessages,
            title: nextTitle,
            busy: true,
          };
          snapshot = updated;
          return updated;
        })
      );
      if (!snapshot) return;

      const { reply } = await callChat(snapshot.role, buildSystemPrompt(snapshot.role), snapshot.provider, snapshot.model, snapshot.messages);

      setAgents((curS) =>
        curS.map((a) => {
          if (a.id !== agentId) return a;
          const nextMessages: ChatMsg[] = [
            ...a.messages,
            { role: "assistant" as const, content: reply },
          ].slice(-MAX_MESSAGES_KEPT);
          return { ...a, messages: nextMessages, busy: false };
        })
      );
    },
    [callChat, buildSystemPrompt]
  );

  /* Layout: 1 col → 1, 2-3 → auto-fit, 4+ → 2 cols (CSS handles mobile) */
  const gridStyle = useMemo<React.CSSProperties>(() => {
    const n = agents.length;
    if (n <= 1) return { display: "grid", gridTemplateColumns: "1fr", gap: 16 };
    if (n <= 3)
      return {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
      };
    return {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 16,
    };
  }, [agents.length]);

  return (
    <div style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh" }}>
      <section
        style={{
          position: "relative",
          minHeight: "78vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 24px 56px",
          overflow: "hidden",
        }}
      >
        <div className="demo-aurora" aria-hidden />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", width: "100%" }}>
          <Wave1Nav variant="dark" />
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(148,163,184,0.95)",
              marginBottom: 16,
            }}
          >
            Multichat Engine · beta MVP
          </p>
          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.05,
              margin: "0 0 20px",
              letterSpacing: "-0.04em",
              background: "linear-gradient(120deg, #fff 0%, #99f6e4 45%, #7dd3fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Parallel agents,
            <br />
            <span style={{ fontSize: "0.62em", fontWeight: 800, letterSpacing: "-0.02em" }}>
              one identity, one window
            </span>
          </h1>
          <p
            style={{
              fontSize: "clamp(16px, 2.4vw, 20px)",
              lineHeight: 1.55,
              maxWidth: 760,
              color: "rgba(226,232,240,0.92)",
              margin: 0,
            }}
          >
            {m?.tagline ??
              "Parallel agent sessions over QCoreAI — code, finance, IP, content in one window."}
          </p>

          <div
            style={{
              marginTop: 32,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
            }}
          >
            {HERO_STATS.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(94,234,212,0.25)",
                  background: "rgba(15,23,42,0.65)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#5eead4", textTransform: "uppercase" }}>
                  {s.label}
                </div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.01em" }}>
                  {s.value}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{s.hint}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="#live"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 16,
                boxShadow: "0 8px 32px rgba(13,148,136,0.35)",
              }}
            >
              Try parallel agents ↓
            </a>
            <Link
              href="/qcoreai"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              Single chat (QCoreAI) →
            </Link>
            <a
              href={`${origin}/api/qcoreai/health`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              QCoreAI health
            </a>
          </div>

          {/* Personalisation strip — visible only when we have any AEVION context */}
          {userCtx ? (
            <div
              style={{
                marginTop: 22,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(94,234,212,0.25)",
                background: "rgba(15,23,42,0.55)",
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                fontSize: 13,
                color: "#cbd5e1",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#5eead4",
                }}
              >
                Personalised
              </span>
              {userCtx.email ? <span>· {userCtx.email}</span> : null}
              {userCtx.balance != null ? (
                <span>· {userCtx.balance.toLocaleString("en-US")} AEC</span>
              ) : null}
              {userCtx.qrightCount != null && userCtx.qrightCount > 0 ? (
                <span>· {userCtx.qrightCount} IP work{userCtx.qrightCount === 1 ? "" : "s"}</span>
              ) : null}
              <label
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  color: ctxEnabled ? "#5eead4" : "#94a3b8",
                  fontWeight: 700,
                }}
                title="Inject your real AEVION account state into agent system prompts"
              >
                <input
                  type="checkbox"
                  checked={ctxEnabled}
                  onChange={(e) => setCtxEnabled(e.target.checked)}
                  style={{ accentColor: "#5eead4" }}
                />
                Inject into agents
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 80px" }}>
        <PitchValueCallout moduleId="multichat-engine" variant="dark" />

        <section
          style={{
            marginTop: 24,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(148,163,184,0.2)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(15,118,110,0.15))",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#5eead4", marginBottom: 10, textTransform: "uppercase" }}>
            The vision
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 14px", color: "#fff", letterSpacing: "-0.02em" }}>
            From a chat box to an agent operating system
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#cbd5e1", margin: "0 0 20px" }}>
            {m?.problem ??
              "Users open four tabs to work with four different AI assistants. Multichat Engine collapses that into a single window — and then layers parallel agents on top, each with its own role, memory and tool scope."}
          </p>
          <ul style={{ margin: 0, paddingLeft: 22, color: "#e2e8f0", lineHeight: 1.75, fontSize: 15 }}>
            {VISION_BULLETS.map((b) => (
              <li key={b.slice(0, 40)} style={{ marginBottom: 10 }}>
                {b}
              </li>
            ))}
          </ul>
        </section>

        {/* ──────────────────────────────────────────────────────
         *  LIVE: parallel agent grid
         * ────────────────────────────────────────────────────── */}
        <section
          id="live"
          style={{
            marginTop: 40,
            padding: 24,
            borderRadius: 20,
            border: "1px solid rgba(94,234,212,0.25)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(13,148,136,0.10))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  color: "#5eead4",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Live · parallel agents
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  margin: 0,
                  color: "#fff",
                  letterSpacing: "-0.02em",
                }}
              >
                {agents.length}/{MAX_AGENTS} active session{agents.length === 1 ? "" : "s"}
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={addAgent}
                disabled={agents.length >= MAX_AGENTS}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid rgba(94,234,212,0.45)",
                  background:
                    agents.length >= MAX_AGENTS
                      ? "rgba(94,234,212,0.06)"
                      : "linear-gradient(135deg, rgba(13,148,136,0.6), rgba(14,165,233,0.55))",
                  color: agents.length >= MAX_AGENTS ? "#475569" : "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: agents.length >= MAX_AGENTS ? "not-allowed" : "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                + Spawn agent
              </button>
              <button
                type="button"
                onClick={clearAll}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(248,113,113,0.35)",
                  background: "rgba(248,113,113,0.08)",
                  color: "#fca5a5",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="multichat-grid" style={gridStyle}>
            {agents.map((a) => (
              <AgentPanel
                key={a.id}
                agent={a}
                providers={providers}
                onChange={(patch) => updateAgent(a.id, patch)}
                onClose={() => removeAgent(a.id)}
                onSend={(text) => sendMessage(a.id, text)}
              />
            ))}
          </div>
        </section>

        {m ? (
          <section
            style={{
              marginTop: 40,
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(59,130,246,0.25)",
              background: "rgba(30,58,138,0.18)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#93c5fd", marginBottom: 10, textTransform: "uppercase" }}>
              Killer feature
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "#dbeafe" }}>{m.killerFeature}</p>
            <div style={{ marginTop: 14, fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#93c5fd", textTransform: "uppercase" }}>
              Network role
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.65, color: "#cbd5e1" }}>{m.networkRole}</p>
          </section>
        ) : null}

        <footer
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid rgba(51,65,85,0.5)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
            Multichat Engine is the social and agent glue for the rest of AEVION — Planet voting, Bank Advisor, Awards judging, customer service.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link
              href="/pitch"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              Investor pitch →
            </Link>
            <Link
              href="/demo"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              Live demo →
            </Link>
            <Link
              href="/qcoreai"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 15,
                boxShadow: "0 8px 32px rgba(13,148,136,0.35)",
              }}
            >
              Open QCoreAI →
            </Link>
          </div>
        </footer>
      </div>

      {/* Inline keyframes + responsive grid (no global CSS edits) */}
      <style jsx>{`
        @keyframes mc-blink {
          0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
          40%           { opacity: 1;   transform: translateY(-2px); }
        }
        @media (max-width: 720px) {
          :global(.multichat-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Sub-component: per-agent panel
 * ────────────────────────────────────────────────────────────── */

function AgentPanel(props: {
  agent: Agent;
  providers: ProviderInfo[];
  onChange: (patch: Partial<Agent> | ((a: Agent) => Partial<Agent>)) => void;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const { agent, providers, onChange, onClose, onSend } = props;
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [agent.messages.length, agent.busy]);

  const provider = providers.find((p) => p.id === agent.provider);
  const availableModels = provider?.models ?? [];
  const colors = ROLE_COLORS[agent.role];

  const submit = () => {
    const t = input.trim();
    if (!t || agent.busy) return;
    onSend(t);
    setInput("");
  };

  const onRoleChange = (role: Role) => {
    onChange((a) => ({
      role,
      // If the panel still has an auto-generated title (== old role), update it.
      title: a.messages.length === 0 ? role : a.title,
    }));
  };

  const onProviderChange = (providerId: string) => {
    const p = providers.find((pp) => pp.id === providerId);
    onChange({
      provider: providerId,
      model: p?.defaultModel ?? agent.model,
    });
  };

  const visibleMessages = agent.messages.slice(-MAX_MESSAGES_KEPT);

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: "rgba(15,23,42,0.85)",
        minHeight: 480,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid rgba(51,65,85,0.5)",
          background: "rgba(2,6,23,0.4)",
        }}
      >
        <select
          value={agent.role}
          onChange={(e) => onRoleChange(e.target.value as Role)}
          aria-label="Agent role"
          style={{
            padding: "5px 8px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            color: colors.fg,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r} style={{ background: "#0f172a", color: "#fff" }}>
              {r}
            </option>
          ))}
        </select>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            title={agent.title}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#f8fafc",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {agent.title}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {providers.length > 0 ? (
              <>
                <select
                  value={agent.provider}
                  onChange={(e) => onProviderChange(e.target.value)}
                  aria-label="Provider"
                  style={{
                    padding: "2px 6px",
                    borderRadius: 6,
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(15,23,42,0.6)",
                    color: "#cbd5e1",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {providers.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={!p.configured}
                      style={{ background: "#0f172a", color: "#fff" }}
                    >
                      {p.name}{p.configured ? "" : " (no key)"}
                    </option>
                  ))}
                </select>
                {availableModels.length > 0 ? (
                  <select
                    value={agent.model}
                    onChange={(e) => onChange({ model: e.target.value })}
                    aria-label="Model"
                    style={{
                      padding: "2px 6px",
                      borderRadius: 6,
                      border: "1px solid rgba(148,163,184,0.25)",
                      background: "rgba(15,23,42,0.6)",
                      color: "#cbd5e1",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                      maxWidth: 160,
                    }}
                  >
                    {availableModels.map((mm) => (
                      <option key={mm} value={mm} style={{ background: "#0f172a", color: "#fff" }}>
                        {prettyModel(mm)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </>
            ) : (
              <span style={{ fontSize: 10, color: "#64748b" }}>{prettyModel(agent.model)}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close agent"
          title="Close agent"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.6)",
            color: "#94a3b8",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 280,
          maxHeight: 460,
          background: "rgba(2,6,23,0.55)",
        }}
      >
        {visibleMessages.length === 0 ? (
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              color: "#64748b",
              fontSize: 13,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>◈</div>
            <div style={{ fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
              {agent.role} agent ready
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              System prompt is preset. Send a message to start.
            </div>
          </div>
        ) : (
          visibleMessages.map((mm, i) => {
            // Detect handoff messages — they carry "↪ via @x\n..." or "↪ from @x: ..."
            const handoffOut = mm.content.match(/^↪ via @(\w+)\n([\s\S]*)$/);
            const handoffIn = mm.content.match(/^↪ from @(\w+): ([\s\S]*)$/);
            const userMention = mm.role === "user"
              ? mm.content.match(/^@(\w+)\s+([\s\S]+)$/)
              : null;
            const handoffTag = handoffOut?.[1] ?? handoffIn?.[1] ?? userMention?.[1] ?? null;
            const isHandoffOut = !!handoffOut;
            const isHandoffIn = !!handoffIn;
            const isUserMention = !!userMention;
            const renderBody =
              handoffOut?.[2] ?? handoffIn?.[2] ?? (userMention ? `@${userMention[1]} ${userMention[2]}` : mm.content);
            const accent = isHandoffOut || isHandoffIn || isUserMention ? "#fbbf24" : null;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: mm.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "88%",
                    padding: "9px 12px",
                    borderRadius:
                      mm.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    background:
                      mm.role === "user"
                        ? "linear-gradient(135deg, #0d9488, #0ea5e9)"
                        : "rgba(30,41,59,0.85)",
                    color: "#f8fafc",
                    border: accent
                      ? `1px solid ${accent}`
                      : mm.role === "user"
                      ? "none"
                      : "1px solid rgba(71,85,105,0.5)",
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {accent && handoffTag ? (
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: accent,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      {isHandoffOut
                        ? `↪ via @${handoffTag}`
                        : isHandoffIn
                        ? `↪ from @${handoffTag}`
                        : `→ @${handoffTag}`}
                    </div>
                  ) : null}
                  {renderBody}
                </div>
              </div>
            );
          })
        )}

        {agent.busy ? (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "9px 12px",
                borderRadius: "12px 12px 12px 4px",
                background: "rgba(30,41,59,0.85)",
                border: "1px solid rgba(71,85,105,0.5)",
                display: "inline-flex",
                gap: 4,
                alignItems: "center",
              }}
              aria-label="Agent is typing"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: colors.fg,
                    display: "inline-block",
                    animation: `mc-blink 1.2s ${i * 0.15}s infinite ease-in-out`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Input */}
      <div
        style={{
          padding: "10px 10px 6px",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          borderTop: "1px solid rgba(51,65,85,0.5)",
          background: "rgba(2,6,23,0.55)",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Message ${agent.role}…  (try @code, @finance, @legal to relay)`}
          disabled={agent.busy}
          rows={2}
          style={{
            flex: 1,
            resize: "none",
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.7)",
            color: "#f8fafc",
            fontSize: 13,
            lineHeight: 1.4,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={agent.busy || !input.trim()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background:
              agent.busy || !input.trim()
                ? "rgba(94,234,212,0.18)"
                : "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: agent.busy || !input.trim() ? "#475569" : "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: agent.busy || !input.trim() ? "not-allowed" : "pointer",
            letterSpacing: "0.02em",
          }}
        >
          {agent.busy ? "…" : "Send"}
        </button>
      </div>

      {/* Mention hint: tells user how to delegate to other agents */}
      <div
        style={{
          padding: "0 10px 8px",
          fontSize: 10,
          color: "#64748b",
          letterSpacing: "0.02em",
          background: "rgba(2,6,23,0.55)",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, color: "#94a3b8" }}>Relay:</span>
        {(["code", "finance", "legal", "compliance", "translator", "general"] as const).map((tag) => (
          <span
            key={tag}
            style={{
              padding: "1px 6px",
              borderRadius: 6,
              background: "rgba(71,85,105,0.35)",
              color: "#cbd5e1",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            @{tag}
          </span>
        ))}
      </div>
    </article>
  );
}
