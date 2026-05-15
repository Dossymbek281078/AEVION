"use client";

/**
 * Bank smoke runner — live end-to-end test of every wired backend slice.
 *
 * Why this page exists
 * ────────────────────
 *  • A static "Banking slice = LIVE" comment in code is unverifiable.
 *  • A smoke script in CI runs once per deploy and is invisible to humans.
 *  • This page makes the wiring AUDITABLE in the browser:
 *    investor / regulator / engineer can click Run and watch every
 *    contract-bound endpoint actually fire against the configured backend.
 *
 * Steps (15):
 *   1. GET /api/health                       — server alive
 *   2. (auth) reuse stored token OR register a fresh smoke_<ts>@aevion.test
 *   3. GET /api/auth/me                      — token resolves to a user
 *   4. GET /api/qtrade/accounts              — list reachable
 *   5. POST /api/qtrade/accounts (provision) — own primary account exists
 *   6. POST /api/qtrade/topup (+100 AEC)     — balance moves
 *   7. GET /api/qtrade/operations            — top-up appears
 *   8. POST /api/qtrade/accounts (alt)       — second smoke account
 *   9. POST /api/qtrade/transfer (1 AEC)     — primary → alt
 *  10. POST /api/qsign/sign  on transfer     — signature returned
 *  11. POST /api/qsign/verify on signature   — verifier accepts it
 *  12. GET /api/ecosystem/earnings           — aggregator alive
 *  13. GET /api/qright/royalties             — royalty stream alive
 *  14. GET /api/cyberchess/results           — chess prizes feed alive
 *  15. GET /api/planet/payouts                — planet cert payouts alive
 *
 * Each step records latency, http status, and a one-line detail.
 * State is kept in component memory only (token reused via TOKEN_KEY for steps).
 *
 * The page is layout-noindex'd. It is intended as an operational tool
 * and as a credible "click to prove it works" surface for stakeholders.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl, getApiBase } from "@/lib/apiBase";
import { appendSignature } from "../_lib/signatures";

const TOKEN_KEY = "aevion_auth_token_v1";

type StepStatus = "pending" | "running" | "pass" | "fail" | "skip";
type Step = {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
  ms?: number;
  http?: number;
};

const INITIAL_STEPS: Step[] = [
  { key: "health", label: "GET /api/health", status: "pending" },
  { key: "auth", label: "Reuse token or register smoke user", status: "pending" },
  { key: "me", label: "GET /api/auth/me", status: "pending" },
  { key: "accounts", label: "GET /api/qtrade/accounts", status: "pending" },
  { key: "provision", label: "Provision primary account if missing", status: "pending" },
  { key: "topup", label: "POST /api/qtrade/topup (+100 AEC)", status: "pending" },
  { key: "ops", label: "GET /api/qtrade/operations (top-up visible)", status: "pending" },
  { key: "altacc", label: "POST /api/qtrade/accounts (alt account)", status: "pending" },
  { key: "transfer", label: "POST /api/qtrade/transfer (1 AEC primary → alt)", status: "pending" },
  { key: "sign", label: "POST /api/qsign/sign on transfer", status: "pending" },
  { key: "verify", label: "POST /api/qsign/verify (must accept)", status: "pending" },
  { key: "earnings", label: "GET /api/ecosystem/earnings", status: "pending" },
  { key: "royalties", label: "GET /api/qright/royalties", status: "pending" },
  { key: "chessResults", label: "GET /api/cyberchess/results", status: "pending" },
  { key: "planetPayouts", label: "GET /api/planet/payouts", status: "pending" },
  { key: "capStatus", label: "GET /api/qtrade/cap-status (peek shape)", status: "pending" },
  { key: "hmacSelfTest", label: "POST /api/bank/hmac-self-test (HMAC end-to-end)", status: "pending" },
  { key: "cursorPagination", label: "GET /api/qright/royalties?limit=1 (cursor shape)", status: "pending" },
  { key: "multichatRoundtrip", label: "POST /api/multichat/conversations (round-trip)", status: "pending" },
];

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function writeToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
}

async function fetchJson(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ res: Response; data: any; ms: number }> {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.token) headers["Authorization"] = `Bearer ${init.token}`;
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const t0 = performance.now();
  const res = await fetch(apiUrl(path), { ...init, headers });
  const ms = Math.round(performance.now() - t0);
  const data = await res.json().catch(() => null);
  return { res, data, ms };
}

export default function BankSmokePage() {
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [apiBase, setApiBase] = useState<string>("");
  const [lastTransferId, setLastTransferId] = useState<string>("");
  const cancelRef = useRef(false);

  useEffect(() => {
    setApiBase(getApiBase());
  }, []);

  const update = useCallback((key: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = false;
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending", detail: undefined, ms: undefined, http: undefined })));
    setCompletedAt(null);
    setTotalMs(null);
    setLastTransferId("");
  }, []);

  const run = useCallback(async () => {
    if (running) return;
    cancelRef.current = false;
    reset();
    setRunning(true);
    const t0 = performance.now();

    type Ctx = {
      token: string;
      email: string;
      primaryAccountId: string;
      altAccountId: string;
      lastTransfer: any;
      lastSignature: string;
    };
    const ctx: Ctx = {
      token: "",
      email: "",
      primaryAccountId: "",
      altAccountId: "",
      lastTransfer: null,
      lastSignature: "",
    };

    const failAndStop = (key: string, detail: string, http?: number) => {
      update(key, { status: "fail", detail, http });
      cancelRef.current = true;
    };

    try {
      // 1. health
      update("health", { status: "running" });
      try {
        const { res, ms } = await fetchJson("/api/health");
        if (res.ok || res.status === 404) {
          update("health", { status: "pass", ms, http: res.status, detail: res.status === 404 ? "404 ok (server alive)" : `HTTP ${res.status}` });
        } else {
          failAndStop("health", `unexpected status ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("health", `network error: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 2. auth
      update("auth", { status: "running" });
      const existing = readToken();
      let authedFromExisting = false;
      if (existing) {
        try {
          const { res, data, ms } = await fetchJson("/api/auth/me", { token: existing });
          if (res.ok && data?.user?.email) {
            ctx.token = existing;
            ctx.email = data.user.email;
            authedFromExisting = true;
            update("auth", { status: "pass", ms, http: res.status, detail: `Reused token for ${ctx.email}` });
          }
        } catch {
          /* fall through to register */
        }
      }
      if (!authedFromExisting && !cancelRef.current) {
        const ts = Date.now();
        const email = `smoke_${ts}@aevion.test`;
        const password = `Smoke!${ts}`;
        try {
          const { res, data, ms } = await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ name: `Smoke ${ts}`, email, password }),
          });
          if (res.ok && data?.token) {
            ctx.token = data.token;
            ctx.email = email;
            writeToken(data.token);
            update("auth", { status: "pass", ms, http: res.status, detail: `Registered ${email}` });
          } else {
            failAndStop("auth", data?.error || `register failed ${res.status}`, res.status);
          }
        } catch (e: any) {
          failAndStop("auth", `network: ${e?.message || "unknown"}`);
        }
      }
      if (cancelRef.current) return;

      // 3. me
      update("me", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/auth/me", { token: ctx.token });
        if (res.ok && data?.user) {
          update("me", { status: "pass", ms, http: res.status, detail: `Resolved ${data.user.email}` });
        } else {
          failAndStop("me", data?.error || `me failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("me", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 4. accounts
      update("accounts", { status: "running" });
      let accountsList: any[] = [];
      try {
        const { res, data, ms } = await fetchJson("/api/qtrade/accounts", { token: ctx.token });
        if (res.ok && Array.isArray(data?.items)) {
          accountsList = data.items;
          update("accounts", { status: "pass", ms, http: res.status, detail: `${accountsList.length} accounts in system` });
        } else {
          failAndStop("accounts", data?.error || `accounts failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("accounts", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 5. provision
      update("provision", { status: "running" });
      try {
        const own = accountsList.find((a) => (a?.owner || "").toLowerCase() === ctx.email.toLowerCase());
        if (own?.id) {
          ctx.primaryAccountId = own.id;
          update("provision", { status: "pass", ms: 0, http: 200, detail: `Existing account ${own.id.slice(0, 12)}…` });
        } else {
          const { res, data, ms } = await fetchJson("/api/qtrade/accounts", {
            method: "POST",
            token: ctx.token,
            body: JSON.stringify({ owner: ctx.email }),
          });
          if (res.ok && data?.id) {
            ctx.primaryAccountId = data.id;
            update("provision", { status: "pass", ms, http: res.status, detail: `Created ${data.id.slice(0, 12)}…` });
          } else {
            failAndStop("provision", data?.error || `provision failed ${res.status}`, res.status);
          }
        }
      } catch (e: any) {
        failAndStop("provision", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 6. topup
      update("topup", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/qtrade/topup", {
          method: "POST",
          token: ctx.token,
          body: JSON.stringify({ accountId: ctx.primaryAccountId, amount: 100 }),
        });
        if (res.ok && typeof data?.balance === "number") {
          update("topup", { status: "pass", ms, http: res.status, detail: `Balance after: ${data.balance} AEC` });
        } else {
          failAndStop("topup", data?.error || `topup failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("topup", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 7. ops
      update("ops", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/qtrade/operations", { token: ctx.token });
        if (res.ok && Array.isArray(data?.items)) {
          const mine = (data.items as any[]).filter(
            (op) => op?.to === ctx.primaryAccountId || op?.from === ctx.primaryAccountId,
          );
          const lastTopup = mine.find((op) => op?.kind === "topup" && Number(op?.amount) === 100);
          if (lastTopup) {
            update("ops", { status: "pass", ms, http: res.status, detail: `${mine.length} ops on primary, top-up visible` });
          } else {
            failAndStop("ops", `top-up not found in ${mine.length} ops`, res.status);
          }
        } else {
          failAndStop("ops", data?.error || `ops failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("ops", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 8. alt account
      update("altacc", { status: "running" });
      try {
        const altOwner = `smoke_alt_${Date.now()}@aevion.test`;
        const { res, data, ms } = await fetchJson("/api/qtrade/accounts", {
          method: "POST",
          token: ctx.token,
          body: JSON.stringify({ owner: altOwner }),
        });
        if (res.ok && data?.id) {
          ctx.altAccountId = data.id;
          update("altacc", { status: "pass", ms, http: res.status, detail: `Alt ${data.id.slice(0, 12)}… (${altOwner})` });
        } else {
          failAndStop("altacc", data?.error || `alt provision failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("altacc", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 9. transfer
      update("transfer", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/qtrade/transfer", {
          method: "POST",
          token: ctx.token,
          body: JSON.stringify({ from: ctx.primaryAccountId, to: ctx.altAccountId, amount: 1 }),
        });
        if (res.ok && data?.id) {
          ctx.lastTransfer = data;
          setLastTransferId(String(data.id));
          update("transfer", { status: "pass", ms, http: res.status, detail: `Transfer id ${String(data.id).slice(0, 16)}…` });
        } else {
          failAndStop("transfer", data?.error || `transfer failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("transfer", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 10. sign
      update("sign", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/qsign/sign", {
          method: "POST",
          token: ctx.token,
          body: JSON.stringify(ctx.lastTransfer),
        });
        if (res.ok && data?.signature) {
          ctx.lastSignature = data.signature;
          // Persist to the same local audit log that useBank.send writes to,
          // so the printable receipt at /bank/receipt/<id> renders the
          // signature row for transfers performed by the smoke runner. This
          // closes the receipt e2e: smoke → /bank/receipt/<transferId>.
          try {
            appendSignature({
              id: String((ctx.lastTransfer as any)?.id || `smoke_${Date.now()}`),
              kind: "transfer",
              payload: ctx.lastTransfer as unknown as Record<string, unknown>,
              signature: data.signature,
              algo: String(data.algo || "unknown"),
              signedAt: String(data.createdAt || new Date().toISOString()),
              verified: "unknown",
              verifiedAt: null,
            });
          } catch {
            /* localStorage unavailable — receipt page will simply lack the row */
          }
          update("sign", { status: "pass", ms, http: res.status, detail: `${String(data.algo || "?")} · ${String(data.signature).slice(0, 18)}… · saved to local audit log` });
        } else {
          failAndStop("sign", data?.error || `sign failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("sign", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 11. verify
      update("verify", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/qsign/verify", {
          method: "POST",
          token: ctx.token,
          body: JSON.stringify({ payload: ctx.lastTransfer, signature: ctx.lastSignature }),
        });
        if (res.ok && data?.valid === true) {
          update("verify", { status: "pass", ms, http: res.status, detail: "valid: true" });
        } else {
          failAndStop("verify", data?.valid === false ? "verifier rejected" : data?.error || `verify failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("verify", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 12. ecosystem earnings
      update("earnings", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/ecosystem/earnings", { token: ctx.token });
        if (res.ok && data?.totals) {
          update("earnings", {
            status: "pass",
            ms,
            http: res.status,
            detail: `totals.all=${data.totals.all ?? 0} AEC across ${Array.isArray(data.perSource) ? data.perSource.length : 0} sources`,
          });
        } else {
          failAndStop("earnings", data?.error || `earnings failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("earnings", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 13. qright royalties
      update("royalties", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/qright/royalties", { token: ctx.token });
        if (res.ok && Array.isArray(data?.items)) {
          update("royalties", { status: "pass", ms, http: res.status, detail: `${data.items.length} royalty events` });
        } else {
          failAndStop("royalties", data?.error || `royalties failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("royalties", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 14. cyberchess results
      update("chessResults", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/cyberchess/results", { token: ctx.token });
        if (res.ok && Array.isArray(data?.items)) {
          update("chessResults", { status: "pass", ms, http: res.status, detail: `${data.items.length} chess prizes` });
        } else {
          failAndStop("chessResults", data?.error || `chess results failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("chessResults", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 15. planet payouts
      update("planetPayouts", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/planet/payouts", { token: ctx.token });
        if (res.ok && Array.isArray(data?.items)) {
          update("planetPayouts", { status: "pass", ms, http: res.status, detail: `${data.items.length} planet certs` });
        } else {
          failAndStop("planetPayouts", data?.error || `planet payouts failed ${res.status}`, res.status);
        }
      } catch (e: any) {
        failAndStop("planetPayouts", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 16. cap-status — peek shape (used / cap / remainingSec) per kind
      update("capStatus", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/qtrade/cap-status", { token: ctx.token });
        const okShape =
          res.ok &&
          data?.topup &&
          typeof data.topup.cap === "number" &&
          typeof data.topup.used === "number" &&
          data?.transfer &&
          typeof data.transfer.cap === "number";
        if (okShape) {
          update("capStatus", {
            status: "pass",
            ms,
            http: res.status,
            detail: `topup ${data.topup.used}/${data.topup.cap}, transfer ${data.transfer.used}/${data.transfer.cap}`,
          });
        } else {
          failAndStop("capStatus", data?.error || `cap-status shape invalid (${res.status})`, res.status);
        }
      } catch (e: any) {
        failAndStop("capStatus", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 17. HMAC webhook self-test — verifies the X-Aevion-Signature path
      // works end-to-end (server signs with each webhook secret + posts
      // back to its own /verify-webhook). Catches secret-rotation drift
      // and partial-deploy states without leaking secrets to the browser.
      update("hmacSelfTest", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/bank/hmac-self-test", {
          method: "POST",
          token: ctx.token,
        });
        if (res.ok && data?.ok && Array.isArray(data?.results) && data.results.length === 3) {
          const summary = data.results
            .map((x: { kind: string; status: number }) => `${x.kind}=${x.status}`)
            .join(", ");
          update("hmacSelfTest", { status: "pass", ms, http: res.status, detail: summary });
        } else {
          failAndStop(
            "hmacSelfTest",
            data?.error || `HMAC self-test failed (${res.status})`,
            res.status,
          );
        }
      } catch (e: any) {
        failAndStop("hmacSelfTest", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 18. Cursor-pagination shape — request limit=1 and assert that
      // the response shape matches the contract documented on /bank/api
      // ({ items, total, nextCursor }). Doesn't depend on having any
      // royalties recorded — total can be 0, nextCursor can be null.
      update("cursorPagination", { status: "running" });
      try {
        const { res, data, ms } = await fetchJson("/api/qright/royalties?limit=1", {
          token: ctx.token,
        });
        const okShape =
          res.ok &&
          Array.isArray(data?.items) &&
          typeof data.total === "number" &&
          (data.nextCursor === null || typeof data.nextCursor === "string");
        if (okShape) {
          update("cursorPagination", {
            status: "pass",
            ms,
            http: res.status,
            detail: `total=${data.total}, nextCursor=${data.nextCursor ?? "null"}`,
          });
        } else {
          failAndStop(
            "cursorPagination",
            data?.error || `pagination shape invalid (${res.status})`,
            res.status,
          );
        }
      } catch (e: any) {
        failAndStop("cursorPagination", `network: ${e?.message || "unknown"}`);
      }
      if (cancelRef.current) return;

      // 19. Multichat round-trip — create a conversation then list to
      // confirm it shows up. Doesn't dispatch (would require LLM keys);
      // just exercises the persistence + JWT scoping contract.
      update("multichatRoundtrip", { status: "running" });
      try {
        const create = await fetchJson("/api/multichat/conversations", {
          method: "POST",
          token: ctx.token,
          body: JSON.stringify({ title: `smoke ${new Date().toISOString().slice(11, 19)}` }),
        });
        if (!create.res.ok || typeof create.data?.id !== "string") {
          failAndStop(
            "multichatRoundtrip",
            create.data?.error || `conversation create failed (${create.res.status})`,
            create.res.status,
          );
        } else {
          const list = await fetchJson("/api/multichat/conversations", { token: ctx.token });
          const items = Array.isArray(list.data?.items) ? list.data.items : [];
          const found = items.some((x: any) => x?.id === create.data.id);
          if (list.res.ok && found) {
            update("multichatRoundtrip", {
              status: "pass",
              ms: create.ms + list.ms,
              http: list.res.status,
              detail: `created ${create.data.id.slice(0, 14)}…, listed ${items.length} conv${items.length === 1 ? "" : "s"}`,
            });
          } else {
            failAndStop(
              "multichatRoundtrip",
              `created ${create.data.id} but list endpoint didn't surface it`,
              list.res.status,
            );
          }
        }
      } catch (e: any) {
        failAndStop("multichatRoundtrip", `network: ${e?.message || "unknown"}`);
      }
    } finally {
      setTotalMs(Math.round(performance.now() - t0));
      setCompletedAt(new Date().toISOString());
      setRunning(false);
    }
  }, [reset, running, update]);

  // Auto-run via ?auto=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("auto") === "1") {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passed = steps.filter((s) => s.status === "pass").length;
  const failed = steps.filter((s) => s.status === "fail").length;
  const allDone = !running && (passed + failed === steps.length);
  const transferId = lastTransferId;

  return (
    <ProductPageShell>
      <Wave1Nav />
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 22px 64px", color: "#0f172a" }}>
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/bank"
            style={{ fontSize: 12, fontWeight: 700, color: "#475569", textDecoration: "none" }}
          >
            ← Back to Bank
          </Link>
        </div>

        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: "#7c3aed", textTransform: "uppercase" }}>
            Internal · Live wiring audit
          </div>
          <h1 style={{ margin: "6px 0 8px", fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em" }}>
            Bank smoke runner
          </h1>
          <p style={{ margin: 0, color: "#475569", fontSize: 15, lineHeight: 1.55 }}>
            Click <strong>Run</strong> to fire every wired AEVION Bank endpoint live against the
            configured backend. Each step records HTTP status and latency. Use this page to prove
            the integration is real, and to catch regressions after backend deploys.
          </p>
        </header>

        <div
          style={{
            border: "1px solid rgba(15,23,42,0.10)",
            borderRadius: 14,
            padding: "14px 16px",
            background: "rgba(241,245,249,0.6)",
            marginBottom: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            fontSize: 13,
          }}
        >
          <div>
            <span style={{ color: "#64748b" }}>Backend base:</span>{" "}
            <code style={{ background: "rgba(15,23,42,0.06)", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
              {apiBase || "—"}
            </code>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => void run()}
            disabled={running}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: running ? "#94a3b8" : "#0f172a",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              cursor: running ? "default" : "pointer",
              letterSpacing: "0.04em",
            }}
          >
            {running ? "Running…" : "▶ Run"}
          </button>
          <button
            onClick={reset}
            disabled={running}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "#fff",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: 13,
              cursor: running ? "default" : "pointer",
            }}
          >
            Reset
          </button>
        </div>

        {(passed > 0 || failed > 0) && (
          <div
            role="status"
            style={{
              border: failed > 0 ? "1px solid rgba(220,38,38,0.35)" : "1px solid rgba(16,185,129,0.4)",
              background: failed > 0 ? "rgba(254,226,226,0.6)" : "rgba(209,250,229,0.55)",
              padding: "10px 14px",
              borderRadius: 10,
              marginBottom: 14,
              fontSize: 13,
              fontWeight: 700,
              color: failed > 0 ? "#991b1b" : "#065f46",
            }}
          >
            {passed} / {steps.length} passed{failed > 0 ? ` · ${failed} failed` : ""}
            {totalMs != null ? ` · ${totalMs} ms total` : ""}
            {allDone && completedAt ? ` · finished ${new Date(completedAt).toLocaleTimeString()}` : ""}
          </div>
        )}

        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            border: "1px solid rgba(15,23,42,0.10)",
            borderRadius: 14,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {steps.map((s, i) => (
            <li
              key={s.key}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr auto",
                gap: 12,
                padding: "12px 14px",
                borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.08)",
                background:
                  s.status === "fail" ? "rgba(254,226,226,0.45)" : s.status === "pass" ? "rgba(236,253,245,0.45)" : "transparent",
                alignItems: "center",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 13,
                  background:
                    s.status === "pass"
                      ? "#10b981"
                      : s.status === "fail"
                      ? "#dc2626"
                      : s.status === "running"
                      ? "#0ea5e9"
                      : "rgba(15,23,42,0.08)",
                  color: s.status === "pending" ? "#475569" : "#fff",
                }}
              >
                {s.status === "pass" ? "✓" : s.status === "fail" ? "✕" : s.status === "running" ? "…" : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{s.label}</div>
                {s.detail ? (
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 2, wordBreak: "break-word" }}>{s.detail}</div>
                ) : null}
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: "#64748b", fontFamily: "ui-monospace, SFMono-Regular, monospace", whiteSpace: "nowrap" }}>
                {s.http ? <span>HTTP {s.http}</span> : null}
                {s.ms != null ? <div>{s.ms} ms</div> : null}
              </div>
            </li>
          ))}
        </ol>

        {allDone && passed === steps.length && transferId ? (
          <div
            style={{
              marginTop: 18,
              padding: "14px 16px",
              border: "1px solid rgba(16,185,129,0.40)",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(209,250,229,0.55), rgba(167,243,208,0.40))",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              fontSize: 13,
              color: "#065f46",
            }}
          >
            <span style={{ fontWeight: 800 }}>All {steps.length} steps passed.</span>
            {(() => {
              const totalMs = steps.reduce((acc, s) => acc + (s.ms ?? 0), 0);
              const seconds = (totalMs / 1000).toFixed(2);
              return (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(6,95,70,0.18)",
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    color: "#065f46",
                  }}
                  title={`Sum of measured step latencies: ${totalMs.toFixed(0)} ms`}
                >
                  {seconds}s total
                </span>
              );
            })()}
            <span>The signed transfer is now in your local audit log.</span>
            <Link
              href={`/bank/receipt/${encodeURIComponent(transferId)}`}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#065f46",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              View receipt →
            </Link>
            <Link
              href="/bank/audit-log"
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "rgba(6,95,70,0.10)",
                color: "#065f46",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                textDecoration: "none",
                border: "1px solid rgba(6,95,70,0.30)",
              }}
            >
              Audit log →
            </Link>
            <Link
              href="/bank/diagnostics"
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "rgba(6,95,70,0.10)",
                color: "#065f46",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                textDecoration: "none",
                border: "1px solid rgba(6,95,70,0.30)",
              }}
            >
              Diagnostics →
            </Link>
          </div>
        ) : null}

        <div
          style={{
            marginTop: 18,
            padding: "12px 14px",
            border: "1px dashed rgba(15,23,42,0.15)",
            borderRadius: 10,
            background: "rgba(248,250,252,0.7)",
            fontSize: 12,
            color: "#475569",
            lineHeight: 1.55,
          }}
        >
          <strong>Notes.</strong> The runner reuses an existing JWT in <code>localStorage</code> if
          present, otherwise registers a fresh <code>smoke_&lt;ts&gt;@aevion.test</code> user — every
          run after the first reuses the token, keeping account history accumulating. Append
          <code> ?auto=1</code> to this URL to run on load (handy for CI screenshots and investor
          demos). Top-up amount is 100 AEC; transfer is 1 AEC primary → freshly-provisioned alt
          account. Step 10 also writes the (payload, signature) pair into the local audit log so
          the printable <code>/bank/receipt/&lt;id&gt;</code> renders the signature row end-to-end.
        </div>
      </main>
    </ProductPageShell>
  );
}
