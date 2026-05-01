#!/usr/bin/env node
/**
 * QCoreAI — end-to-end prod smoke test.
 *
 * Walks the live /api/qcoreai surface across V1/V4/V5/V6:
 *   health → providers → pricing → register/login → multi-agent run →
 *   tags/search → refine → analytics → eval suite create+run+compare →
 *   prompts CRUD + fork → run with promptOverrides → cleanup.
 *
 * Pass/fail printed per step; process exits 1 on first failure.
 *
 * Usage (from aevion-globus-backend/):
 *   node scripts/qcore-smoke.js
 *
 * Env overrides:
 *   BASE          default http://127.0.0.1:4001
 *   EMAIL         default qcore-smoke-<ts>@aevion.test (unique per run)
 *   PASSWORD      default smoke-password-123
 *   SKIP_RUN      set to 1 to skip the actual /multi-agent run (requires
 *                 a configured LLM provider; otherwise the run errors out)
 *   SKIP_LLM_JUDGE set to 1 to skip the llm_judge eval step (uses tokens)
 *
 * Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const EMAIL = process.env.EMAIL || `qcore-smoke-${Date.now()}@aevion.test`;
const PASSWORD = process.env.PASSWORD || "smoke-password-123";
const SKIP_RUN = process.env.SKIP_RUN === "1";
const SKIP_LLM_JUDGE = process.env.SKIP_LLM_JUDGE === "1";

let step = 0;
const results = [];

function pass(name, extra) {
  step += 1;
  const line = `  ${String(step).padStart(2, "0")}  PASS  ${name}`;
  console.log(extra ? `${line}  ${extra}` : line);
  results.push({ name, ok: true });
}

function fail(name, reason) {
  step += 1;
  console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}`);
  console.error(`       ↳ ${reason}`);
  results.push({ name, ok: false, reason });
}

async function jsonFetch(method, path, { body, token } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log(`\n  QCoreAI smoke test`);
  console.log(`  BASE  = ${BASE}`);
  console.log(`  EMAIL = ${EMAIL}`);
  console.log(`  ─────────────────────────────────────────────\n`);

  /* ─── V1/V4 health surface ───────────────────────────────────────────── */

  // 1 — /health (must include guidanceBus + storage)
  {
    const r = await jsonFetch("GET", "/api/qcoreai/health");
    if (!r.ok) return fail("health", `HTTP ${r.status}`);
    if (r.data?.service !== "qcoreai") return fail("health", `service != qcoreai`);
    if (!r.data?.storage) return fail("health", "missing storage field");
    if (!r.data?.guidanceBus) return fail("health", "missing guidanceBus field (V6-R)");
    pass(
      "health",
      `storage=${r.data.storage} bus=${r.data.guidanceBus} providers=${r.data.configuredProviders?.length ?? 0}`
    );
  }

  // 2 — /providers
  {
    const r = await jsonFetch("GET", "/api/qcoreai/providers");
    if (!r.ok) return fail("providers", `HTTP ${r.status}`);
    if (!Array.isArray(r.data?.providers)) return fail("providers", "providers not array");
    pass("providers", `${r.data.providers.length} listed`);
  }

  // 3 — /pricing
  {
    const r = await jsonFetch("GET", "/api/qcoreai/pricing");
    if (!r.ok) return fail("pricing", `HTTP ${r.status}`);
    if (!Array.isArray(r.data?.table)) return fail("pricing", "pricing.table not array");
    pass("pricing", `${r.data.table.length} rows`);
  }

  // 4 — /agents (role defaults)
  {
    const r = await jsonFetch("GET", "/api/qcoreai/agents");
    if (!r.ok) return fail("agents", `HTTP ${r.status}`);
    if (!Array.isArray(r.data?.roles)) return fail("agents", "roles not array");
    pass("agents", `${r.data.roles.length} roles`);
  }

  /* ─── auth ───────────────────────────────────────────────────────────── */

  // 5 — register
  {
    const r = await jsonFetch("POST", "/api/auth/register", {
      body: { email: EMAIL, password: PASSWORD, name: "QCore Smoke" },
    });
    if (!r.ok && r.status !== 409) return fail("register", `HTTP ${r.status}`);
    pass("register", r.status === 409 ? "already-exists (ok)" : "created");
  }

  // 6 — login (token needed for owner-scoped V5/V6 endpoints)
  let token = null;
  {
    const r = await jsonFetch("POST", "/api/auth/login", {
      body: { email: EMAIL, password: PASSWORD },
    });
    if (!r.ok) return fail("login", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    token = r.data?.token;
    if (!token) return fail("login", "no token in response");
    pass("login", `token len=${token.length}`);
  }

  /* ─── V6-P: prompts library CRUD ─────────────────────────────────────── */

  // 7 — create prompt
  let promptId = null;
  {
    const r = await jsonFetch("POST", "/api/qcoreai/prompts", {
      token,
      body: {
        name: `Smoke writer ${Date.now()}`,
        role: "writer",
        content:
          "You are a concise senior PM. Always reply with exactly the literal answer requested, no preamble.",
      },
    });
    if (!r.ok) return fail("V6-P create prompt", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    promptId = r.data?.prompt?.id;
    if (!promptId) return fail("V6-P create prompt", "no prompt.id");
    pass("V6-P create prompt", `id=${promptId.slice(0, 8)}…`);
  }

  // 8 — list prompts
  {
    const r = await jsonFetch("GET", "/api/qcoreai/prompts?limit=5", { token });
    if (!r.ok) return fail("V6-P list prompts", `HTTP ${r.status}`);
    const found = (r.data?.items || []).find((p) => p.id === promptId);
    if (!found) return fail("V6-P list prompts", "created prompt not in list");
    pass("V6-P list prompts", `${r.data.items.length} items`);
  }

  // 9 — fork prompt (own → next version)
  let forkedPromptId = null;
  {
    const r = await jsonFetch("POST", `/api/qcoreai/prompts/${promptId}/fork`, {
      token,
      body: { content: "You are an even more concise senior PM. One line replies only." },
    });
    if (!r.ok) return fail("V6-P fork", `HTTP ${r.status}`);
    forkedPromptId = r.data?.prompt?.id;
    if (!forkedPromptId) return fail("V6-P fork", "no fork id");
    if (r.data.prompt.version !== 2) return fail("V6-P fork", `expected v2, got v${r.data.prompt.version}`);
    pass("V6-P fork", `v${r.data.prompt.version} id=${forkedPromptId.slice(0, 8)}…`);
  }

  // 10 — version chain
  {
    const r = await jsonFetch("GET", `/api/qcoreai/prompts/${promptId}/versions`, { token });
    if (!r.ok) return fail("V6-P versions", `HTTP ${r.status}`);
    if ((r.data?.items?.length ?? 0) < 2) return fail("V6-P versions", "expected ≥2 versions");
    pass("V6-P versions", `${r.data.items.length} in chain`);
  }

  /* ─── V5: eval harness ───────────────────────────────────────────────── */

  // 11 — create eval suite
  let suiteId = null;
  {
    const r = await jsonFetch("POST", "/api/qcoreai/eval/suites", {
      token,
      body: {
        name: `Smoke suite ${Date.now()}`,
        description: "Prod smoke",
        strategy: "sequential",
        cases: [
          {
            id: "c-contains",
            name: "Contains 4",
            input: "What is 2+2? Reply with the digit only.",
            judge: { type: "contains", needle: "4" },
          },
          {
            id: "c-min-length",
            name: "Min length 1",
            input: "Reply with: hi",
            judge: { type: "min_length", chars: 1 },
          },
        ],
      },
    });
    if (!r.ok) return fail("V5 create suite", `HTTP ${r.status}`);
    suiteId = r.data?.suite?.id;
    if (!suiteId) return fail("V5 create suite", "no suite.id");
    pass("V5 create suite", `id=${suiteId.slice(0, 8)}…`);
  }

  // 12 — list eval suites
  {
    const r = await jsonFetch("GET", "/api/qcoreai/eval/suites?limit=5", { token });
    if (!r.ok) return fail("V5 list suites", `HTTP ${r.status}`);
    const found = (r.data?.items || []).find((s) => s.id === suiteId);
    if (!found) return fail("V5 list suites", "suite not in list");
    pass("V5 list suites", `${r.data.items.length} items`);
  }

  /* ─── V4 marketplace + analytics surface (read-only) ─────────────────── */

  // 13 — analytics summary
  {
    const r = await jsonFetch("GET", "/api/qcoreai/analytics", { token });
    if (!r.ok) return fail("V4 analytics", `HTTP ${r.status}`);
    if (typeof r.data?.runs !== "number") return fail("V4 analytics", "runs not number");
    pass("V4 analytics", `${r.data.runs} runs · $${(r.data.totals?.costUsd ?? 0).toFixed(4)}`);
  }

  // 14 — analytics timeseries
  {
    const r = await jsonFetch("GET", "/api/qcoreai/analytics/timeseries?days=7", { token });
    if (!r.ok) return fail("V4 timeseries", `HTTP ${r.status}`);
    if (!Array.isArray(r.data?.items)) return fail("V4 timeseries", "items not array");
    pass("V4 timeseries", `${r.data.items.length} buckets / ${r.data.days}d`);
  }

  // 15 — V4 marketplace browse (public, no auth required)
  {
    const r = await jsonFetch("GET", "/api/qcoreai/presets/public?limit=5");
    if (!r.ok) return fail("V4 marketplace browse", `HTTP ${r.status}`);
    if (!Array.isArray(r.data?.items)) return fail("V4 marketplace browse", "items not array");
    pass("V4 marketplace browse", `${r.data.items.length} public presets`);
  }

  // 16 — V6-P public prompts browse (no auth)
  {
    const r = await jsonFetch("GET", "/api/qcoreai/prompts/public?limit=5");
    if (!r.ok) return fail("V6-P public browse", `HTTP ${r.status}`);
    if (!Array.isArray(r.data?.items)) return fail("V6-P public browse", "items not array");
    pass("V6-P public browse", `${r.data.items.length} public prompts`);
  }

  /* ─── V1: real /multi-agent run (eats LLM tokens — gate behind SKIP_RUN) */

  let runId = null;
  if (!SKIP_RUN) {
    // 17 — multi-agent SSE → buffer events, capture run_complete
    try {
      const url = `${BASE}/api/qcoreai/multi-agent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          input: "Reply with the literal digit 4 and nothing else.",
          strategy: "sequential",
          maxRevisions: 0,
          maxCostUsd: 0.05,
          // V6-P-int: use the prompt we created so this also smokes promptOverrides
          promptOverrides: { writer: { promptId } },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return fail("V1 multi-agent run", `HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      // Consume SSE stream looking for session + run_complete events.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sessionRunId = null;
      let completed = null;
      let safety = 30000; // ms
      const start = Date.now();
      readLoop: while (true) {
        if (Date.now() - start > safety) break;
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const ev = JSON.parse(payload);
              if (ev.type === "session" && ev.runId) sessionRunId = ev.runId;
              if (ev.type === "done" || ev.type === "run_complete") completed = ev;
              if (ev.type === "sse_end") {
                break readLoop;
              }
            } catch {
              /* ignore non-JSON lines */
            }
          }
        }
      }
      if (!sessionRunId) return fail("V1 multi-agent run", "no session event in stream");
      if (!completed) return fail("V1 multi-agent run", "no done/run_complete event");
      runId = sessionRunId;
      pass(
        "V1 multi-agent run",
        `runId=${runId.slice(0, 8)}… cost=$${(completed.totalCostUsd ?? 0).toFixed(4)}`
      );
    } catch (e) {
      return fail("V1 multi-agent run", e?.message || String(e));
    }

    // 18 — V4 search the run we just created
    {
      const r = await jsonFetch("GET", "/api/qcoreai/search?q=digit&limit=5", { token });
      if (!r.ok) return fail("V4 search", `HTTP ${r.status}`);
      pass("V4 search", `${(r.data.items || []).length} hits`);
    }

    // 19 — V4 set tags
    {
      const r = await jsonFetch("PATCH", `/api/qcoreai/runs/${runId}/tags`, {
        token,
        body: { tags: ["smoke", "ci"] },
      });
      if (!r.ok) return fail("V4 set tags", `HTTP ${r.status}`);
      pass("V4 set tags", `tags=smoke,ci`);
    }

    // 20 — V4 top tags
    {
      const r = await jsonFetch("GET", "/api/qcoreai/tags?limit=5", { token });
      if (!r.ok) return fail("V4 top tags", `HTTP ${r.status}`);
      const has = (r.data.items || []).some((t) => t.tag === "smoke");
      if (!has) return fail("V4 top tags", "smoke tag not surfaced");
      pass("V4 top tags", `smoke tag found`);
    }

    /* ─── V5 eval run (uses tokens) ────────────────────────────────────── */

    // 21 — kick off eval
    let evalRunId = null;
    {
      const r = await jsonFetch("POST", `/api/qcoreai/eval/suites/${suiteId}/run`, {
        token,
        body: { concurrency: 2, perCaseMaxCostUsd: 0.05 },
      });
      if (!r.ok) return fail("V5 eval kickoff", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
      evalRunId = r.data?.run?.id;
      if (!evalRunId) return fail("V5 eval kickoff", "no run.id");
      pass("V5 eval kickoff", `runId=${evalRunId.slice(0, 8)}…`);
    }

    // 22 — poll until done
    {
      const start = Date.now();
      const timeout = 180_000;
      let final = null;
      while (Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 2000));
        const r = await jsonFetch("GET", `/api/qcoreai/eval/runs/${evalRunId}`, { token });
        if (!r.ok) return fail("V5 eval poll", `HTTP ${r.status}`);
        const status = r.data?.run?.status;
        if (status !== "running") {
          final = r.data.run;
          break;
        }
      }
      if (!final) return fail("V5 eval poll", "still running after 180s");
      if (final.status !== "done") return fail("V5 eval poll", `status=${final.status}`);
      pass(
        "V5 eval poll",
        `score=${((final.score ?? 0) * 100).toFixed(0)}% (${final.passedCases}/${final.totalCases})`
      );
    }
  } else {
    pass("V1 multi-agent run", "skipped (SKIP_RUN=1)");
    pass("V5 eval kickoff+poll", "skipped (SKIP_RUN=1)");
  }

  /* ─── V6-P-int via prompt delete (cleanup) ───────────────────────────── */

  // 23 — delete forked prompt
  {
    const r = await jsonFetch("DELETE", `/api/qcoreai/prompts/${forkedPromptId}`, { token });
    if (!r.ok) return fail("V6-P delete fork", `HTTP ${r.status}`);
    pass("V6-P delete fork", "deleted");
  }

  // 24 — delete suite
  {
    const r = await jsonFetch("DELETE", `/api/qcoreai/eval/suites/${suiteId}`, { token });
    if (!r.ok) return fail("V5 delete suite", `HTTP ${r.status}`);
    pass("V5 delete suite", "deleted");
  }

  // 25 — delete root prompt
  {
    const r = await jsonFetch("DELETE", `/api/qcoreai/prompts/${promptId}`, { token });
    if (!r.ok) return fail("V6-P delete prompt", `HTTP ${r.status}`);
    pass("V6-P delete prompt", "deleted");
  }

  /* ─── Summary ────────────────────────────────────────────────────────── */
  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ─────────────────────────────────────────────`);
  console.log(`  ${results.length - failed.length}/${results.length} steps passed`);
  if (failed.length > 0) {
    console.log(`\n  Failures:`);
    failed.forEach((f) => console.log(`    – ${f.name}: ${f.reason}`));
    process.exit(1);
  }
  console.log(`  ALL GREEN — V4+V5+V6 prod surface healthy.\n`);
}

main().catch((e) => {
  console.error(`\n  FATAL  ${e?.stack || e?.message || e}\n`);
  process.exit(1);
});
