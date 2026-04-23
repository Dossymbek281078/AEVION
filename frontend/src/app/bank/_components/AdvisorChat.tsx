"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { loadAdvance } from "../_lib/advance";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { lastActivityMs, stats30d } from "../_lib/format";
import { loadGoals } from "../_lib/savings";
import { categoriseOps } from "../_lib/spending";
import { computeEcosystemTrustScore, tierLabel } from "../_lib/trust";
import type { Account, Me, Operation } from "../_lib/types";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;
type ChatRole = "system" | "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

const SUGGESTIONS = [
  "Should I take a salary advance?",
  "How can I boost my Trust Score?",
  "Am I saving enough for my goals?",
  "What's my spending pattern telling me?",
  "Any red flags in my recent activity?",
];

export function AdvisorChat({
  account,
  me,
  operations,
  notify,
}: {
  account: Account;
  me: Me;
  operations: Operation[];
  notify: Notify;
}) {
  const { royalty, chess, ecosystem } = useEcosystemData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [provider, setProvider] = useState<string | null>(null);
  const { code } = useCurrency();
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages.length, busy]);

  const buildSystemPrompt = (): string => {
    const trust = computeEcosystemTrustScore({ account, operations, royalty, chess, ecosystem });
    const advance = loadAdvance();
    const goals = loadGoals();
    const activeGoals = goals.filter((g) => !g.completedAt);
    const last = lastActivityMs(operations);
    const s30 = stats30d(operations, account.id);
    const cats = categoriseOps(operations, account.id);
    const catSums = new Map<string, number>();
    for (const c of cats) catSums.set(c.category, (catSums.get(c.category) ?? 0) + Math.abs(c.signed));
    const topCat = [...catSums.entries()].sort((a, b) => b[1] - a[1])[0];

    return [
      `You are AEVION Bank's financial advisor. Be concise, actionable, friendly.`,
      `Always answer in 2-4 short paragraphs (no bullet lists unless asked).`,
      `Currency display preference: ${code}. Refer to amounts in AEC (the underlying token).`,
      ``,
      `User snapshot:`,
      `- Email: ${me.email}`,
      `- Wallet balance: ${account.balance.toFixed(2)} AEC`,
      `- Trust Score: ${trust.score}/100 (tier: ${tierLabel[trust.tier]})`,
      `- 30-day net flow: ${s30.netFlow.toFixed(2)} AEC (in ${s30.incoming.toFixed(0)}, out ${s30.outgoing.toFixed(0)})`,
      `- 30-day operations count: ${s30.count}`,
      `- Last activity: ${last ? new Date(last).toISOString() : "never"}`,
      advance
        ? `- Active salary advance: ${advance.outstanding.toFixed(2)} AEC outstanding (principal ${advance.principal.toFixed(2)})`
        : `- No active salary advance`,
      `- Active savings goals: ${activeGoals.length}${
        activeGoals.length
          ? ` (top: "${activeGoals[0].label}", ${activeGoals[0].currentAec.toFixed(0)}/${activeGoals[0].targetAec.toFixed(0)} AEC)`
          : ""
      }`,
      topCat
        ? `- Top spending category last period: ${topCat[0]} (${topCat[1].toFixed(0)} AEC)`
        : `- No outgoing spending tracked yet`,
      `- QRight IP works registered: ${royalty?.works.length ?? 0}, total verifications: ${royalty?.works.reduce((s, w) => s + w.verifications, 0) ?? 0}`,
      `- Chess rating: ${chess?.currentRating ?? "n/a"}, tournaments: ${chess?.tournamentsPlayed ?? 0}, wins: ${chess?.wins ?? 0}`,
      ``,
      `Use this snapshot to give specific advice. Don't reveal the snapshot verbatim — refer to numbers organically. Don't promise returns or guarantee outcomes.`,
    ].join("\n");
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const systemPrompt = buildSystemPrompt();
      const payloadMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...next,
      ];
      const res = await fetch(apiUrl("/api/qcoreai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `AI request failed (${res.status})`);
      setProvider(typeof data?.provider === "string" ? data.provider : null);
      const reply = typeof data?.reply === "string" ? data.reply : "(empty reply)";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Advisor unavailable";
      notify(msg, "error");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `_Advisor unavailable: ${msg}_` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const visibleMessages = messages.filter((m) => m.role !== "system");

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(180deg, rgba(124,58,237,0.04) 0%, #ffffff 100%)",
      }}
      aria-labelledby="advisor-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #7c3aed, #0ea5e9)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            ✻
          </span>
          <div>
            <h2 id="advisor-heading" style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
              AI advisor · powered by QCoreAI
            </h2>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Knows your balance, Trust Score, advances, goals, royalties — all client-side context.
              {provider ? ` · via ${provider}` : ""}
            </div>
          </div>
        </div>
        {messages.length > 0 ? (
          <button
            onClick={() => {
              setMessages([]);
              setProvider(null);
              notify("Chat cleared", "info");
            }}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.12)",
              background: "#fff",
              fontSize: 12,
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div
        ref={feedRef}
        role="log"
        aria-live="polite"
        aria-label="Advisor conversation"
        style={{
          padding: 12,
          borderRadius: 10,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "#fff",
          minHeight: 180,
          maxHeight: 320,
          overflowY: "auto" as const,
          display: "grid",
          gap: 8,
          marginBottom: 10,
        }}
      >
        {visibleMessages.length === 0 ? (
          <div
            style={{
              padding: 12,
              fontSize: 13,
              color: "#64748b",
              textAlign: "center" as const,
            }}
          >
            Ask anything about your money. I see your balance ({formatCurrency(account.balance, code)}),
            Trust Score, goals, recent ops — and respond in plain language.
          </div>
        ) : (
          visibleMessages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))
        )}
        {busy ? (
          <Bubble role="assistant" content="thinking…" muted />
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => void ask(s)}
            disabled={busy}
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              border: "1px solid rgba(124,58,237,0.25)",
              background: "rgba(124,58,237,0.04)",
              color: "#4c1d95",
              fontSize: 11,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ask(input);
          }}
          placeholder="Ask about your finances…"
          aria-label="Message advisor"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(15,23,42,0.15)",
            fontSize: 13,
            background: "#fff",
          }}
        />
        <button
          onClick={() => void ask(input)}
          disabled={busy || !input.trim()}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: busy || !input.trim() ? "#94a3b8" : "linear-gradient(135deg, #7c3aed, #0ea5e9)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: busy || !input.trim() ? "default" : "pointer",
          }}
        >
          {busy ? "…" : "Ask"}
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        Context (balance, trust, goals, recent ops) is sent with each question. Backend selects
        provider based on configured API keys (Claude / GPT / Gemini / DeepSeek / Grok).
      </div>
    </section>
  );
}

function Bubble({
  role,
  content,
  muted,
}: {
  role: ChatRole;
  content: string;
  muted?: boolean;
}) {
  const mine = role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "8px 12px",
          borderRadius: 10,
          background: mine
            ? "linear-gradient(135deg, #0f172a, #334155)"
            : "rgba(124,58,237,0.06)",
          color: mine ? "#fff" : "#0f172a",
          fontSize: 13,
          lineHeight: 1.5,
          fontWeight: mine ? 600 : 500,
          opacity: muted ? 0.6 : 1,
          whiteSpace: "pre-wrap" as const,
          border: mine ? "none" : "1px solid rgba(124,58,237,0.18)",
        }}
      >
        {content}
      </div>
    </div>
  );
}
