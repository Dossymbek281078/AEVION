import { Router, type Request, type Response, type NextFunction } from "express";
import { checkAdmin } from "../lib/adminAuth";
import { getPool } from "../lib/dbPool";

/**
 * GET /api/admin/marketing-consent/count  (admin only)
 * { consented, total } — только числа, без адресов и персональных данных.
 * consented = согласие TRUE, не удалён, адрес подтверждён; total = все не удалённые аккаунты.
 */
export const marketingConsentAdminRouter = Router();

marketingConsentAdminRouter.get(
  "/count",
  (req: Request, res: Response, next: NextFunction) => {
    const a = checkAdmin(req);
    if (!a.ok) {
      res.status(403).json({ error: "admin_required", reason: a.reason });
      return;
    }
    next();
  },
  async (_req: Request, res: Response) => {
    try {
      const r = await getPool().query(
        `SELECT
           COUNT(*) FILTER (WHERE "marketingConsent" = TRUE AND "emailVerifiedAt" IS NOT NULL)::int AS consented,
           COUNT(*)::int AS total
         FROM "AEVIONUser" WHERE "deletedAt" IS NULL`
      );
      const row = r.rows[0] ?? { consented: 0, total: 0 };
      res.json({ consented: Number(row.consented), total: Number(row.total) });
    } catch (err) {
      console.error("[marketing-consent/count]", err instanceof Error ? err.message : "error");
      res.status(500).json({ error: "count failed" });
    }
  }
);
