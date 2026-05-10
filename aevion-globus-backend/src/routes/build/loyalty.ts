import { Router } from "express";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
  RECRUITER_TIERS,
  getRecruiterTier,
  nextRecruiterTier,
} from "../../lib/build";

export const loyaltyRouter = Router();

// GET /api/build/loyalty/me
loyaltyRouter.get("/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const { tier, hires } = await getRecruiterTier(auth.sub);
    const next = nextRecruiterTier(tier);
    const hiresToNext = next ? Math.max(0, next.minHires - hires) : 0;
    const progressPct = next
      ? Math.min(
          100,
          Math.round(((hires - tier.minHires) / (next.minHires - tier.minHires)) * 100),
        )
      : 100;

    return ok(res, {
      hires,
      tier: {
        key: tier.key,
        label: tier.label,
        hireFeeBps: tier.hireFeeBps,
        hireFeePct: tier.hireFeeBps / 100,
        cashbackBps: tier.cashbackBps,
        cashbackPct: tier.cashbackBps / 100,
        subDiscountBps: tier.subDiscountBps,
        subDiscountPct: tier.subDiscountBps / 100,
        boostSlotsBonus: tier.boostSlotsBonus,
        perks: tier.perks,
      },
      next: next
        ? {
            key: next.key,
            label: next.label,
            minHires: next.minHires,
            hireFeeBps: next.hireFeeBps,
            hireFeePct: next.hireFeeBps / 100,
            cashbackBps: next.cashbackBps,
            subDiscountBps: next.subDiscountBps,
            hiresToNext,
            progressPct,
          }
        : null,
      hireFeeBps: tier.hireFeeBps,
      hireFeePct: tier.hireFeeBps / 100,
      cashbackBps: tier.cashbackBps,
      cashbackPct: tier.cashbackBps / 100,
      nextTierAt: next ? next.minHires : null,
      nextTierBps: next ? next.hireFeeBps : null,
      tiers: RECRUITER_TIERS.map((t) => ({
        key: t.key,
        atHires: t.minHires,
        bps: t.hireFeeBps,
        label: t.label,
      })),
    });
  } catch (err: unknown) {
    return fail(res, 500, "loyalty_failed", { details: (err as Error).message });
  }
});

// GET /api/build/loyalty/tiers — public, no auth
loyaltyRouter.get("/tiers", async (_req, res) => {
  try {
    return ok(res, {
      items: RECRUITER_TIERS.map((t) => ({
        key: t.key,
        label: t.label,
        minHires: t.minHires,
        hireFeeBps: t.hireFeeBps,
        hireFeePct: t.hireFeeBps / 100,
        cashbackBps: t.cashbackBps,
        cashbackPct: t.cashbackBps / 100,
        subDiscountBps: t.subDiscountBps,
        subDiscountPct: t.subDiscountBps / 100,
        boostSlotsBonus: t.boostSlotsBonus,
        perks: t.perks,
      })),
    });
  } catch (err: unknown) {
    return fail(res, 500, "tiers_failed", { details: (err as Error).message });
  }
});

// POST /api/build/loyalty/cashback/claim
loyaltyRouter.post("/cashback/claim", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const deviceId =
      typeof req.body?.deviceId === "string" ? req.body.deviceId.trim().slice(0, 200) : null;
    if (!deviceId) return fail(res, 400, "deviceId_required");

    await pool.query("BEGIN");
    try {
      const pending = await pool.query(
        `SELECT "id","cashbackAev"
         FROM "BuildCashback"
         WHERE "userId" = $1 AND "claimStatus" = 'PENDING'
         FOR UPDATE`,
        [auth.sub],
      );
      const ids = pending.rows.map((r: { id: string }) => r.id);
      const claimedAev = pending.rows.reduce(
        (acc: number, r: { cashbackAev: number }) => acc + Number(r.cashbackAev),
        0,
      );

      if (ids.length === 0) {
        await pool.query("COMMIT");
        return ok(res, { claimedAev: 0, claimedRows: 0 });
      }

      await pool.query(
        `UPDATE "BuildCashback"
           SET "claimStatus" = 'CLAIMED', "claimedAt" = NOW(), "claimDeviceId" = $2
         WHERE "id" = ANY($1::text[])`,
        [ids, deviceId],
      );
      await pool.query("COMMIT");
      return ok(res, {
        claimedAev: Math.round(claimedAev * 1_000_000) / 1_000_000,
        claimedRows: ids.length,
        deviceId,
      });
    } catch (innerErr) {
      await pool.query("ROLLBACK");
      throw innerErr;
    }
  } catch (err: unknown) {
    return fail(res, 500, "cashback_claim_failed", { details: (err as Error).message });
  }
});

// GET /api/build/loyalty/cashback
loyaltyRouter.get("/cashback", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;

    const totals = await pool.query(
      `SELECT
         COALESCE(SUM("cashbackAev"),0)::float8 AS "totalAev",
         COUNT(*)::int AS "entries"
       FROM "BuildCashback" WHERE "userId" = $1`,
      [auth.sub],
    );
    const tail = await pool.query(
      `SELECT "id","orderId","orderKind","orderAmount","orderCurrency","cashbackAev","createdAt"
       FROM "BuildCashback" WHERE "userId" = $1
       ORDER BY "createdAt" DESC LIMIT 25`,
      [auth.sub],
    );
    return ok(res, {
      totalAev: Number(totals.rows[0]?.totalAev ?? 0),
      entries: Number(totals.rows[0]?.entries ?? 0),
      cashbackBps: 200,
      ledger: tail.rows,
    });
  } catch (err: unknown) {
    return fail(res, 500, "cashback_failed", { details: (err as Error).message });
  }
});
