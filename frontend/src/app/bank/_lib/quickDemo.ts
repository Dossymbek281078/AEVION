// Quick-demo onboarding helpers.
//
// One click on /bank should take a stranger (an investor, a regulator,
// a reviewer) all the way to a fully authenticated, balance-having Bank
// session — without making them invent an email or a password. This file
// houses the auto-register flow and the matching teardown helper.
//
// The flow:
//   1. POST /api/auth/register with a random demo_<ts>@aevion.test user
//   2. Persist the returned JWT under the same TOKEN_KEY the rest of the
//      bank uses, so useAuthMe / useBank pick it up after a soft reload
//   3. Tag the session in localStorage as "this is a quick demo" so the
//      hero can show an "End demo" affordance back to a clean state
//
// Everything else (account provisioning, top-up flow, etc.) is left to
// the existing useBank logic — quickDemo just hands it a credentialed
// browser. No backend changes are required.

import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";
const DEMO_FLAG_KEY = "aevion_bank_quickdemo_v1";

export type QuickDemoResult =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

function generateDemoCredentials(): { email: string; password: string; name: string } {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    email: `demo_${ts}_${rand}@aevion.test`,
    password: `Demo!${ts}-${rand}`,
    name: `Demo ${rand}`,
  };
}

/**
 * Register a fresh demo user and persist the resulting JWT under TOKEN_KEY.
 * Returns the credentials on success so the caller can surface them in a
 * toast for transparency ("you are now signed in as …"). Marks the session
 * as a quick-demo so the UI can offer a one-click teardown later.
 */
export async function startQuickDemo(): Promise<QuickDemoResult> {
  if (typeof window === "undefined") return { ok: false, error: "ssr" };
  const creds = generateDemoCredentials();
  try {
    const res = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: creds.name, email: creds.email, password: creds.password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.token) {
      return { ok: false, error: data?.error || `register failed (${res.status})` };
    }
    try {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(
        DEMO_FLAG_KEY,
        JSON.stringify({ email: creds.email, startedAt: new Date().toISOString() }),
      );
    } catch {
      /* storage blocked — proceed anyway, in-memory token is gone but flow can be retried */
    }
    return { ok: true, email: creds.email, password: creds.password };
  } catch (e: any) {
    return { ok: false, error: e?.message || "network" };
  }
}

/**
 * Drops both the token and the demo flag, then notifies the rest of the page
 * so listeners can re-read storage. Returns nothing — the UI should re-render
 * itself based on the cleared state (typically: hard reload).
 */
export function endQuickDemo(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event("storage"));
  } catch {
    /* ignore */
  }
}

/**
 * Returns the demo session info if the current token was provisioned via
 * the quick-demo flow, otherwise null. Used to decide whether to render
 * "End demo" instead of the regular Sign-out.
 */
export function readQuickDemoSession(): { email: string; startedAt: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEMO_FLAG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.email === "string" && typeof parsed?.startedAt === "string") {
      return { email: parsed.email, startedAt: parsed.startedAt };
    }
    return null;
  } catch {
    return null;
  }
}

export function isQuickDemoActive(): boolean {
  return readQuickDemoSession() !== null;
}
