import { Router, type Request } from "express";
import { createHmac, randomUUID } from "node:crypto";
import { verifyBearerOptional } from "../lib/authJwt";
function requireAuth(req: any, res: any, next: any) { const p = verifyBearerOptional(req); if (!p) return res.status(401).json({ error: "auth required" }); (req as any).auth = p; next(); }
import { stableStringify } from "../lib/stableStringify";

// Server-side proxy that fires synthetic partner webhooks against the
// backend's own /api/qright/royalties/verify-webhook,
// /api/cyberchess/tournament-finalized and /api/planet/payouts/certify-webhook.
//
// Why a proxy and not a browser-side fetch:
//   - The webhook endpoints are gated by a shared secret (X-QRight-Secret /
//     X-CyberChess-Secret / X-Planet-Secret). Exposing those to the browser
//     would defeat the gate. By proxying through the backend we keep the
//     secret in process.env and let signed-in users still trigger demo
//     events from /bank/diagnostics.
//
// Why pinned to req.auth.email:
//   - The webhook handlers persist a ledger entry keyed by `email`. If the
//     test endpoint accepted an arbitrary email it would let any signed-in
//     user pollute someone else's ledger. Pinning to the JWT subject means
//     the synthetic event always lands in the caller's own /earnings.

export const bankTestRouter = Router();

const PORT = process.env.PORT || 4001;
const SELF_BASE = `http://127.0.0.1:${PORT}`;

const QRIGHT_SECRET = process.env.QRIGHT_WEBHOOK_SECRET || "dev-qright-webhook";
const CHESS_SECRET = process.env.CYBERCHESS_WEBHOOK_SECRET || "dev-chess-webhook";
const PLANET_SECRET = process.env.PLANET_WEBHOOK_SECRET || "dev-planet-webhook";

function ownerEmail(req: Request): string {
  return req.auth?.email ?? "test@aevion.test";
}

function shortId(): string {
  return randomUUID().slice(0, 8);
}

bankTestRouter.post("/test-webhook/qright", requireAuth, async (req, res, next) => {
  try {
    const email = ownerEmail(req);
    const eventId = `test_qright_${Date.now()}_${shortId()}`;
    const amount = Math.round((1 + Math.random() * 19) * 100) / 100;
    const r = await fetch(`${SELF_BASE}/api/qright/royalties/verify-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-QRight-Secret": QRIGHT_SECRET,
      },
      body: JSON.stringify({
        eventId,
        email,
        productKey: `test-album-${shortId()}`,
        period: "2026-Q2",
        amount,
      }),
    });
    const body = await r.json().catch(() => ({}));
    res.status(r.status).json({ kind: "qright", upstreamStatus: r.status, eventId, email, amount, response: body });
  } catch (e) {
    next(e);
  }
});

bankTestRouter.post("/test-webhook/chess", requireAuth, async (req, res, next) => {
  try {
    const email = ownerEmail(req);
    const tournamentId = `test_tour_${Date.now()}_${shortId()}`;
    const prize = Math.round((10 + Math.random() * 90) * 100) / 100;
    const r = await fetch(`${SELF_BASE}/api/cyberchess/tournament-finalized`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CyberChess-Secret": CHESS_SECRET,
      },
      body: JSON.stringify({
        tournamentId,
        podium: [{ email, place: 1, amount: prize }],
      }),
    });
    const body = await r.json().catch(() => ({}));
    res.status(r.status).json({ kind: "chess", upstreamStatus: r.status, tournamentId, email, prize, response: body });
  } catch (e) {
    next(e);
  }
});

bankTestRouter.post("/test-webhook/planet", requireAuth, async (req, res, next) => {
  try {
    const email = ownerEmail(req);
    const eventId = `test_planet_${Date.now()}_${shortId()}`;
    const amount = Math.round((1 + Math.random() * 9) * 100) / 100;
    const r = await fetch(`${SELF_BASE}/api/planet/payouts/certify-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Planet-Secret": PLANET_SECRET,
      },
      body: JSON.stringify({
        eventId,
        email,
        artifactVersionId: `test_art_${shortId()}`,
        amount,
      }),
    });
    const body = await r.json().catch(() => ({}));
    res.status(r.status).json({ kind: "planet", upstreamStatus: r.status, eventId, email, amount, response: body });
  } catch (e) {
    next(e);
  }
});

// HMAC self-test — fires all three webhooks via the new HMAC-signed path
// (X-Aevion-Timestamp + X-Aevion-Signature) instead of the legacy bearer
// header. Exposed for /bank/diagnostics so ops can verify the HMAC path
// works end-to-end on a deploy without leaking secrets to the browser.
//
// Each sub-result includes the upstream HTTP status: 201/200 means HMAC
// signing + server-side verification both succeeded; 401 means the
// computed signature didn't match (typically a secret-rotation drift).
bankTestRouter.post("/hmac-self-test", requireAuth, async (req, res, next) => {
  async function fire(
    kind: "qright" | "chess" | "planet",
    path: string,
    body: object,
    secret: string,
  ): Promise<{ kind: string; status: number; mode: "hmac"; replayed: boolean }> {
    const ts = Math.floor(Date.now() / 1000);
    const stable = stableStringify(body);
    const sig = createHmac("sha256", secret).update(`${ts}.${stable}`).digest("hex");
    const r = await fetch(`${SELF_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Aevion-Timestamp": String(ts),
        "X-Aevion-Signature": sig,
      },
      // The wire-body must match what we signed — emit the same stable
      // serialization rather than re-stringifying via JSON.stringify.
      body: stable,
    });
    const j = await r.json().catch(() => ({}));
    return { kind, status: r.status, mode: "hmac", replayed: !!j?.replayed };
  }

  try {
    const email = ownerEmail(req);
    const results = [];

    results.push(
      await fire(
        "qright",
        "/api/qright/royalties/verify-webhook",
        {
          eventId: `hmac_self_${Date.now()}_${shortId()}`,
          email,
          productKey: `hmac-album-${shortId()}`,
          period: "2026-Q2",
          amount: 4.5,
        },
        QRIGHT_SECRET,
      ),
    );

    results.push(
      await fire(
        "chess",
        "/api/cyberchess/tournament-finalized",
        {
          tournamentId: `hmac_tour_${Date.now()}_${shortId()}`,
          podium: [{ email, place: 1, amount: 22 }],
        },
        CHESS_SECRET,
      ),
    );

    results.push(
      await fire(
        "planet",
        "/api/planet/payouts/certify-webhook",
        {
          eventId: `hmac_planet_${Date.now()}_${shortId()}`,
          email,
          artifactVersionId: `hmac_art_${shortId()}`,
          amount: 1.5,
        },
        PLANET_SECRET,
      ),
    );

    const allOk = results.every((r) => r.status >= 200 && r.status < 300);
    res.status(allOk ? 200 : 502).json({
      ok: allOk,
      checkedAt: new Date().toISOString(),
      results,
    });
  } catch (e) {
    next(e);
  }
});
