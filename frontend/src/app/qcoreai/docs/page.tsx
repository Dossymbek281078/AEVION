"use client";

import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const BASE = "{BASE_URL}/api/qcoreai";

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  path: string;
  auth?: "required" | "optional" | "none";
  description: string;
  body?: string;
  returns?: string;
};

type Section = {
  title: string;
  icon: string;
  endpoints: Endpoint[];
};

const SECTIONS: Section[] = [
  {
    title: "Core pipeline",
    icon: "🤖",
    endpoints: [
      { method: "POST", path: "/multi-agent", auth: "optional", description: "Run multi-agent pipeline (SSE stream). Returns events: session, agent_start, chunk, agent_end, verdict, final, cost_tick, sse_end.", body: "{ input, strategy, overrides, maxRevisions, sessionId, maxCostUsd, continueFromRunId, promptOverrides }", returns: "SSE stream of OrchestratorEvent" },
      { method: "POST", path: "/chat", auth: "optional", description: "Legacy single-model chat (no agents, no streaming).", body: "{ messages, provider?, model? }", returns: "{ reply, provider, model }" },
      { method: "POST", path: "/runs/:runId/guidance", auth: "none", description: "Inject mid-run human guidance during an active streaming run.", body: "{ text }", returns: "{ ok }" },
      { method: "GET", path: "/runs/:id", auth: "optional", description: "Fetch run metadata and all messages.", returns: "{ run, messages }" },
      { method: "GET", path: "/runs/:id/cost-breakdown", auth: "optional", description: "Per-agent cost + token breakdown.", returns: "{ breakdown[], totalCostUsd, byProvider }" },
      { method: "GET", path: "/runs/:id/thread", auth: "optional", description: "All runs in a conversation thread (root + replies).", returns: "{ threadId, runs[] }" },
      { method: "GET", path: "/runs/:id/export", auth: "optional", description: "Download run as JSON or Markdown.", body: "?format=json|md", returns: "File download" },
      { method: "POST", path: "/runs/:id/refine", auth: "optional", description: "One-pass surgical edit on a finished run.", body: "{ instruction, provider?, model? }", returns: "{ run, messages }" },
      { method: "PATCH", path: "/runs/:id/tags", auth: "optional", description: "Replace run tag list.", body: "{ tags: string[] }", returns: "{ run }" },
      { method: "DELETE", path: "/runs/bulk", auth: "required", description: "Bulk delete runs (up to 100, owner-scoped).", body: "{ runIds: string[] }", returns: "{ deleted: number }" },
      { method: "POST", path: "/runs/:id/share", auth: "optional", description: "Generate share token for a run.", returns: "{ token }" },
      { method: "DELETE", path: "/runs/:id/share", auth: "optional", description: "Revoke share token.", returns: "{ ok }" },
    ],
  },
  {
    title: "Sessions",
    icon: "💬",
    endpoints: [
      { method: "GET", path: "/sessions", auth: "optional", description: "List sessions (sorted pinned DESC, updatedAt DESC).", returns: "{ items[], total, scope }" },
      { method: "GET", path: "/sessions/:id", auth: "optional", returns: "{ session }", description: "Get a single session." },
      { method: "PATCH", path: "/sessions/:id", auth: "optional", description: "Rename session.", body: "{ title }", returns: "{ session }" },
      { method: "PATCH", path: "/sessions/:id/pin", auth: "optional", description: "Pin or unpin a session.", body: "{ pinned: boolean }", returns: "{ ok, pinned }" },
      { method: "DELETE", path: "/sessions/:id", auth: "optional", description: "Delete session and all its runs.", returns: "{ ok }" },
      { method: "GET", path: "/sessions/:id/export", auth: "optional", description: "Bulk export all runs in a session.", body: "?format=json|md", returns: "File download" },
    ],
  },
  {
    title: "Shared / public",
    icon: "🔗",
    endpoints: [
      { method: "GET", path: "/shared/:token", auth: "none", description: "Public read-only snapshot of a shared run.", returns: "{ session, run, messages }" },
      { method: "GET", path: "/shared/:token/comments", auth: "none", description: "Public comments on a shared run.", returns: "{ items[] }" },
      { method: "POST", path: "/shared/:token/comments", auth: "none", description: "Post a public comment.", body: "{ authorName?, content }", returns: "{ comment }" },
    ],
  },
  {
    title: "Search & analytics",
    icon: "📊",
    endpoints: [
      { method: "GET", path: "/search", auth: "optional", description: "Full-text + tag search across runs.", body: "?q=&limit=", returns: "{ items[] }" },
      { method: "GET", path: "/tags", auth: "optional", description: "Top tags for the caller.", body: "?limit=", returns: "{ items[] }" },
      { method: "GET", path: "/analytics", auth: "optional", description: "KPI summary: runs, sessions, cost, by-strategy, by-provider, by-model, recent.", returns: "{ ...AnalyticsSummary }" },
      { method: "GET", path: "/analytics/timeseries", auth: "optional", description: "Daily cost+run buckets for the last N days.", body: "?days=30", returns: "{ items[]{date,runs,costUsd} }" },
      { method: "GET", path: "/analytics/sessions", auth: "optional", description: "Top sessions by cost for a time window.", body: "?days=7&limit=10", returns: "{ items[] }" },
      { method: "GET", path: "/analytics/by-tag", auth: "optional", description: "Per-tag cost + run breakdown.", body: "?limit=20", returns: "{ items[]{tag,runs,totalCostUsd,avgCostUsd} }" },
      { method: "GET", path: "/analytics/export", auth: "optional", description: "CSV download of timeseries data.", body: "?days=30", returns: "CSV file" },
    ],
  },
  {
    title: "Notebook",
    icon: "📓",
    endpoints: [
      { method: "POST", path: "/notebook", auth: "required", description: "Save a snippet from a run.", body: "{ runId, role?, content, annotation?, tags? }", returns: "{ snippet }" },
      { method: "GET", path: "/notebook", auth: "required", description: "List snippets with optional filters.", body: "?q=&tag=&pinned=&limit=", returns: "{ items[] }" },
      { method: "GET", path: "/notebook/tags", auth: "required", description: "Tag cloud for the caller's notebook.", returns: "{ items[]{tag,count} }" },
      { method: "PATCH", path: "/notebook/:id", auth: "required", description: "Update annotation, tags, or pin state.", body: "{ annotation?, tags?, pinned? }", returns: "{ snippet }" },
      { method: "DELETE", path: "/notebook/:id", auth: "required", description: "Delete a snippet.", returns: "{ deleted }" },
    ],
  },
  {
    title: "Templates",
    icon: "📋",
    endpoints: [
      { method: "POST", path: "/templates", auth: "required", description: "Create a named template (input + strategy + overrides).", body: "{ name, input, strategy?, overrides?, description?, isPublic? }", returns: "{ template }" },
      { method: "GET", path: "/templates", auth: "required", description: "List own templates.", returns: "{ items[] }" },
      { method: "GET", path: "/templates/public", auth: "none", description: "Browse public templates (sorted by useCount).", body: "?q=&limit=", returns: "{ items[] }" },
      { method: "PATCH", path: "/templates/:id", auth: "required", description: "Update template.", returns: "{ template }" },
      { method: "DELETE", path: "/templates/:id", auth: "required", returns: "{ deleted }", description: "Delete template." },
      { method: "POST", path: "/templates/:id/use", auth: "optional", description: "Apply template (bumps useCount).", returns: "{ template }" },
    ],
  },
  {
    title: "Batch & schedules",
    icon: "⚡",
    endpoints: [
      { method: "POST", path: "/batch", auth: "required", description: "Submit N prompts as a batch (max 20, 5 parallel). Returns 202 immediately.", body: "{ inputs[], strategy?, overrides?, maxCostUsd? }", returns: "{ batchId, totalRuns, runIds[] }" },
      { method: "GET", path: "/batches", auth: "required", description: "List user's recent batches.", returns: "{ items[] }" },
      { method: "GET", path: "/batch/:id", auth: "required", description: "Batch status + per-run summaries.", returns: "{ batch, runs[] }" },
      { method: "POST", path: "/schedules", auth: "required", description: "Create a recurring or one-shot scheduled batch.", body: "{ name, inputs[], strategy?, schedule?, nextRunAt? }", returns: "{ schedule }" },
      { method: "GET", path: "/schedules", auth: "required", returns: "{ items[] }", description: "List scheduled batches." },
      { method: "PATCH", path: "/schedules/:id", auth: "required", description: "Update schedule (name/inputs/enabled/nextRunAt).", returns: "{ schedule }" },
      { method: "DELETE", path: "/schedules/:id", auth: "required", returns: "{ deleted }", description: "Delete schedule." },
      { method: "POST", path: "/schedules/:id/run-now", auth: "required", description: "Trigger schedule immediately.", returns: "{ batchId, runIds[] }" },
    ],
  },
  {
    title: "Eval harness",
    icon: "🧪",
    endpoints: [
      { method: "POST", path: "/eval/suites", auth: "required", description: "Create an eval suite.", body: "{ name, description?, strategy?, overrides?, cases[] }", returns: "{ suite }" },
      { method: "GET", path: "/eval/suites", auth: "required", returns: "{ items[] }", description: "List eval suites." },
      { method: "GET", path: "/eval/suites/:id", auth: "required", returns: "{ suite }", description: "Get a suite." },
      { method: "PATCH", path: "/eval/suites/:id", auth: "required", description: "Update suite.", returns: "{ suite }" },
      { method: "DELETE", path: "/eval/suites/:id", auth: "required", returns: "{ deleted }", description: "Delete suite." },
      { method: "POST", path: "/eval/suites/:id/run", auth: "required", description: "Kick off an eval run (async).", returns: "{ run }" },
      { method: "GET", path: "/eval/runs/:id", auth: "required", description: "Poll eval run status + results.", returns: "{ run }" },
      { method: "GET", path: "/eval/suites/:id/runs", auth: "required", description: "History of eval runs for a suite.", returns: "{ items[] }" },
    ],
  },
  {
    title: "Prompts library",
    icon: "📝",
    endpoints: [
      { method: "POST", path: "/prompts", auth: "required", description: "Create a versioned system prompt.", body: "{ name, content, role?, description?, isPublic?, parentPromptId? }", returns: "{ prompt }" },
      { method: "GET", path: "/prompts", auth: "required", returns: "{ items[] }", description: "List own prompts." },
      { method: "GET", path: "/prompts/public", auth: "none", description: "Browse public prompts.", returns: "{ items[] }" },
      { method: "GET", path: "/prompts/audit", auth: "required", description: "Prompt library audit log.", returns: "{ items[] }" },
      { method: "PATCH", path: "/prompts/:id", auth: "required", description: "Update prompt metadata.", returns: "{ prompt }" },
      { method: "DELETE", path: "/prompts/:id", auth: "required", returns: "{ deleted }", description: "Delete prompt version." },
      { method: "POST", path: "/prompts/:id/fork", auth: "required", description: "Fork a prompt (own = new version, public = copy to your library).", returns: "{ prompt }" },
      { method: "GET", path: "/prompts/:id/versions", auth: "optional", description: "Version chain for a prompt.", returns: "{ items[] }" },
    ],
  },
  {
    title: "Workspaces",
    icon: "🗂️",
    endpoints: [
      { method: "POST", path: "/workspaces", auth: "required", description: "Create a workspace.", body: "{ name, description? }", returns: "{ workspace }" },
      { method: "GET", path: "/workspaces", auth: "required", returns: "{ items[] }", description: "List workspaces (owned or member)." },
      { method: "PATCH", path: "/workspaces/:id", auth: "required", description: "Rename workspace.", returns: "{ workspace }" },
      { method: "DELETE", path: "/workspaces/:id", auth: "required", returns: "{ deleted }", description: "Delete workspace." },
      { method: "POST", path: "/workspaces/:id/members", auth: "required", description: "Invite a member.", body: "{ userId, role }", returns: "{ member }" },
      { method: "DELETE", path: "/workspaces/:id/members/:userId", auth: "required", returns: "{ ok }", description: "Remove member." },
      { method: "GET", path: "/workspaces/:id/sessions", auth: "required", returns: "{ items[] }", description: "Sessions in workspace." },
      { method: "POST", path: "/workspaces/:id/sessions", auth: "required", description: "Add session to workspace.", body: "{ sessionId }", returns: "{ ok }" },
      { method: "DELETE", path: "/workspaces/:id/sessions/:sessionId", auth: "required", returns: "{ ok }", description: "Remove session from workspace." },
    ],
  },
  {
    title: "Spend limits & webhooks",
    icon: "💰",
    endpoints: [
      { method: "GET", path: "/me/spend-limit", auth: "required", returns: "{ limit }", description: "Get monthly spend limit." },
      { method: "PUT", path: "/me/spend-limit", auth: "required", description: "Set monthly spend limit.", body: "{ monthlyLimitUsd, alertAt? }", returns: "{ limit }" },
      { method: "DELETE", path: "/me/spend-limit", auth: "required", returns: "{ ok }", description: "Remove spend limit." },
      { method: "GET", path: "/me/spend-summary", auth: "required", description: "Current month spend vs. limit.", returns: "{ spentUsd, limitUsd, pct, alerting, exceeded }" },
      { method: "GET", path: "/me/webhook", auth: "required", returns: "{ webhook }", description: "Get webhook config." },
      { method: "PUT", path: "/me/webhook", auth: "required", description: "Set webhook URL + secret.", body: "{ url, secret? }", returns: "{ webhook }" },
      { method: "DELETE", path: "/me/webhook", auth: "required", returns: "{ ok }", description: "Remove webhook." },
      { method: "POST", path: "/me/webhook/test", auth: "required", description: "Send a test run.completed event.", returns: "{ ok, sentTo }" },
      { method: "GET", path: "/me/webhook/log", auth: "required", description: "Last 50 webhook delivery attempts.", body: "?limit=", returns: "{ items[] }" },
    ],
  },
  {
    title: "Health & config",
    icon: "⚙️",
    endpoints: [
      { method: "GET", path: "/health", auth: "none", description: "Service health: storage, providers, guidance bus, live runs, features, version.", returns: "{ ok, configuredProviders[], storage, guidanceBus, liveRuns, features[], version }" },
      { method: "GET", path: "/providers", auth: "none", description: "Available providers with model lists.", returns: "{ providers[] }" },
      { method: "GET", path: "/pricing", auth: "none", description: "Input/output pricing per 1M tokens.", returns: "{ table[] }" },
      { method: "GET", path: "/agents", auth: "none", description: "Role defaults and strategy list.", returns: "{ roles[], strategies[] }" },
    ],
  },
];

const METHOD_COLORS: Record<string, { bg: string; color: string }> = {
  GET:    { bg: "rgba(59,130,246,0.1)", color: "#1d4ed8" },
  POST:   { bg: "rgba(16,185,129,0.1)", color: "#065f46" },
  PATCH:  { bg: "rgba(245,158,11,0.1)", color: "#92400e" },
  DELETE: { bg: "rgba(239,68,68,0.08)", color: "#991b1b" },
  PUT:    { bg: "rgba(124,58,237,0.08)", color: "#5b21b6" },
};

const AUTH_STYLE: Record<string, { label: string; color: string }> = {
  required: { label: "auth", color: "#dc2626" },
  optional: { label: "auth?", color: "#d97706" },
  none:     { label: "public", color: "#059669" },
};

export default function DocsPage() {
  return (
    <main>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>📖 API Reference</h1>
            <Link href="/qcoreai/multi" style={{ fontSize: 12, color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>← Multi-agent</Link>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Base URL: <code style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 5, fontSize: 12 }}>{apiUrl("/api/qcoreai")}</code>
            &nbsp;·&nbsp;Auth: <code style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 5, fontSize: 12 }}>Authorization: Bearer &lt;JWT&gt;</code>
            &nbsp;·&nbsp;
            <a href="https://www.npmjs.com/package/@aevion/qcoreai-client" target="_blank" rel="noreferrer" style={{ color: "#4338ca", fontWeight: 700, fontSize: 12 }}>
              npm @aevion/qcoreai-client
            </a>
          </p>
        </div>

        {/* Table of contents */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
          {SECTIONS.map((s) => (
            <a key={s.title} href={`#${s.title.toLowerCase().replace(/\s+/g, "-")}`}
              style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, textDecoration: "none", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
              {s.icon} {s.title}
            </a>
          ))}
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title} id={section.title.toLowerCase().replace(/\s+/g, "-")} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{section.icon}</span>
              {section.title}
            </h2>
            <div style={{ borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)", overflow: "hidden" }}>
              {section.endpoints.map((ep, i) => {
                const mc = METHOD_COLORS[ep.method];
                const ac = AUTH_STYLE[ep.auth || "none"];
                return (
                  <div
                    key={i}
                    style={{
                      padding: "12px 16px",
                      borderBottom: i < section.endpoints.length - 1 ? "1px solid rgba(15,23,42,0.06)" : "none",
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: ep.description ? 4 : 0 }}>
                      <span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 900, background: mc.bg, color: mc.color, fontFamily: "monospace", letterSpacing: "0.03em" }}>
                        {ep.method}
                      </span>
                      <code style={{ fontSize: 12, fontFamily: "monospace", color: "#0f172a", fontWeight: 700 }}>
                        {BASE}{ep.path}
                      </code>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: `${ac.color}15`, color: ac.color, border: `1px solid ${ac.color}33` }}>
                        {ac.label}
                      </span>
                    </div>
                    {ep.description && (
                      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                        {ep.description}
                        {ep.body && <span style={{ marginLeft: 4, color: "#94a3b8" }}>Body/params: <code style={{ fontSize: 11, color: "#64748b" }}>{ep.body}</code></span>}
                        {ep.returns && <span style={{ marginLeft: 4, color: "#94a3b8" }}>→ <code style={{ fontSize: 11, color: "#6d28d9" }}>{ep.returns}</code></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </ProductPageShell>
    </main>
  );
}
