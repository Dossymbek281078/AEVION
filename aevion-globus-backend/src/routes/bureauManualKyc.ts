/**
 * Ручки ручной проверки личности бюро (BUREAU_KYC_PROVIDER=manual).
 *
 * Человек:  GET  /kyc-manual/:id           — статус своей заявки (без файлов)
 *           POST /kyc-manual/:id/submit    — документ + селфи (base64 в JSON)
 * Админ:    GET  /admin/kyc-manual         — очередь (без файлов)
 *           GET  /admin/kyc-manual/:id/file/:kind — файл, только админу, no-store
 *           POST /admin/kyc-manual/:id/decide     — approved | rejected
 *
 * Пока поставщик не manual, все ручки отвечают 404 kyc_manual_disabled — флаг
 * один, и он же снимает барьер upgrade (KYC_LIVE_IDS в bureau.ts).
 *
 * Удаление через 30 дней: purgeExpired зовётся в начале каждой ручки (дешёвый
 * UPDATE по индексу) — файл не может пережить срок дольше, чем до следующего
 * обращения, а без обращений его никто и не увидит. Сторож — tests/bureauManualKyc.test.ts.
 */
import express, { Request, Response, Router } from "express";
import type { KycStatus } from "../lib/kyc/provider";
import {
  effectiveStatus,
  MANUAL_KYC_DOC_MIME,
  MANUAL_KYC_MAX_FILE_BYTES,
  MANUAL_KYC_RETENTION_DAYS,
  MANUAL_KYC_SELFIE_MIME,
  ManualKycFileKind,
  ManualKycRecord,
  ManualKycStore,
} from "../lib/kyc/manualStore";

export type ManualKycDeps = {
  store: () => ManualKycStore;
  enabled: () => boolean;
  isAdmin: (req: Request) => { ok: boolean; email: string | null; reason: string | null };
  audit: (o: { action: string; actor: string | null; payload: Record<string, unknown> | null }) => Promise<void>;
  now?: () => Date;
};

const DOC_TYPES = new Set(["passport", "id_card", "driver_license", "residence_permit"]);
const ID_RE = /^kyc-man-[0-9a-f]{32}$/;
const STATUSES = new Set<KycStatus>(["pending", "review", "approved", "rejected", "expired"]);

function publicView(r: ManualKycRecord, now: Date) {
  return {
    sessionId: r.id,
    status: effectiveStatus(r, now),
    submittedAt: r.submittedAt,
    decidedAt: r.decidedAt,
    reason: r.status === "rejected" ? r.reason : null,
    expiresAt: r.expiresAt,
    filesDeleteAfter: r.purgeAfter,
    retentionDays: MANUAL_KYC_RETENTION_DAYS,
    reviewedBy: "AEVION staff (manual review)",
  };
}

function adminView(r: ManualKycRecord, now: Date) {
  return { ...r, status: effectiveStatus(r, now) };
}

/** base64 → Buffer с пределом размера; null — если пусто, мусор или больше предела. */
function decodeFile(v: unknown): Buffer | null {
  if (typeof v !== "string" || v.length === 0) return null;
  if (v.length > Math.ceil((MANUAL_KYC_MAX_FILE_BYTES * 4) / 3) + 8) return null;
  if (!/^[A-Za-z0-9+/=_-]+$/.test(v)) return null;
  const b = Buffer.from(v, "base64");
  if (b.length === 0 || b.length > MANUAL_KYC_MAX_FILE_BYTES) return null;
  return b;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export function manualKycRouter(deps: ManualKycDeps): Router {
  const r = express.Router();
  const now = () => (deps.now ? deps.now() : new Date());

  async function gate(res: Response): Promise<boolean> {
    if (!deps.enabled()) {
      res.status(404).json({ error: "kyc_manual_disabled" });
      return false;
    }
    await deps.store().purgeExpired(now());
    return true;
  }

  r.get("/kyc-manual/:id", async (req, res) => {
    try {
      if (!(await gate(res))) return;
      const id = String(req.params.id);
      if (!ID_RE.test(id)) return res.status(400).json({ error: "bad_session_id" });
      const rec = await deps.store().get(id);
      if (!rec) return res.status(404).json({ error: "session_not_found" });
      return res.json(publicView(rec, now()));
    } catch (e) {
      return res.status(500).json({ error: "kyc_manual_failed", detail: (e as Error).message });
    }
  });

  r.post("/kyc-manual/:id/submit", async (req, res) => {
    try {
      if (!(await gate(res))) return;
      const id = String(req.params.id);
      if (!ID_RE.test(id)) return res.status(400).json({ error: "bad_session_id" });
      const b = req.body || {};
      const docType = String(b.docType || "");
      if (!DOC_TYPES.has(docType)) return res.status(400).json({ error: "bad_doc_type", allowed: [...DOC_TYPES] });
      const docMime = String(b.docMime || "");
      const selfieMime = String(b.selfieMime || "");
      if (!MANUAL_KYC_DOC_MIME.has(docMime)) return res.status(400).json({ error: "bad_doc_mime" });
      if (!MANUAL_KYC_SELFIE_MIME.has(selfieMime)) return res.status(400).json({ error: "bad_selfie_mime" });
      const doc = decodeFile(b.docBase64);
      const selfie = decodeFile(b.selfieBase64);
      if (!doc) return res.status(400).json({ error: "bad_document_file", maxBytes: MANUAL_KYC_MAX_FILE_BYTES });
      if (!selfie) return res.status(400).json({ error: "bad_selfie_file", maxBytes: MANUAL_KYC_MAX_FILE_BYTES });
      const existing = await deps.store().get(id);
      if (!existing) return res.status(404).json({ error: "session_not_found" });
      const st = effectiveStatus(existing, now());
      if (st !== "pending") return res.status(409).json({ error: "not_pending", status: st });
      const rec = await deps.store().submit(id, { docType, docMime, doc, selfieMime, selfie }, now());
      if (!rec) return res.status(409).json({ error: "not_pending" });
      await deps.audit({
        action: "kyc_manual_submitted",
        actor: rec.email,
        payload: { sessionId: id, docType, docBytes: doc.length, selfieBytes: selfie.length },
      });
      return res.status(201).json(publicView(rec, now()));
    } catch (e) {
      return res.status(500).json({ error: "kyc_manual_failed", detail: (e as Error).message });
    }
  });

  function admin(req: Request, res: Response): string | null {
    const a = deps.isAdmin(req);
    if (!a.ok) {
      res.status(a.reason === "no-bearer" || a.reason === "invalid-token" ? 401 : 403).json({ error: "admin_only" });
      return null;
    }
    return a.email || "admin";
  }

  r.get("/admin/kyc-manual", async (req, res) => {
    try {
      if (!(await gate(res))) return;
      if (!admin(req, res)) return;
      const q = String(req.query.status || "review") as KycStatus | "all";
      if (q !== "all" && !STATUSES.has(q)) return res.status(400).json({ error: "bad_status" });
      const items = await deps.store().list(q === "all" ? null : q, 200);
      return res.json({ items: items.map((i) => adminView(i, now())), count: items.length });
    } catch (e) {
      return res.status(500).json({ error: "kyc_manual_failed", detail: (e as Error).message });
    }
  });

  r.get("/admin/kyc-manual/:id/file/:kind", async (req, res) => {
    try {
      if (!(await gate(res))) return;
      const who = admin(req, res);
      if (!who) return;
      const id = String(req.params.id);
      const kind = String(req.params.kind) as ManualKycFileKind;
      if (!ID_RE.test(id)) return res.status(400).json({ error: "bad_session_id" });
      if (kind !== "document" && kind !== "selfie") return res.status(400).json({ error: "bad_kind" });
      const rec = await deps.store().get(id);
      if (!rec) return res.status(404).json({ error: "session_not_found" });
      if (rec.purgedAt) return res.status(410).json({ error: "files_deleted", purgedAt: rec.purgedAt });
      const f = await deps.store().getFile(id, kind);
      if (!f) return res.status(404).json({ error: "file_not_found" });
      await deps.audit({ action: "kyc_manual_file_viewed", actor: who, payload: { sessionId: id, kind } });
      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `attachment; filename="${id}-${kind}"`);
      res.type(f.mime);
      return res.send(f.bytes);
    } catch (e) {
      return res.status(500).json({ error: "kyc_manual_failed", detail: (e as Error).message });
    }
  });

  r.post("/admin/kyc-manual/:id/decide", async (req, res) => {
    try {
      if (!(await gate(res))) return;
      const who = admin(req, res);
      if (!who) return;
      const id = String(req.params.id);
      if (!ID_RE.test(id)) return res.status(400).json({ error: "bad_session_id" });
      const b = req.body || {};
      const decision = String(b.decision || "");
      if (decision !== "approved" && decision !== "rejected") return res.status(400).json({ error: "bad_decision" });
      const verifiedName = str(b.verifiedName, 200);
      const reason = str(b.reason, 500);
      if (decision === "approved" && !verifiedName) return res.status(400).json({ error: "verified_name_required" });
      if (decision === "rejected" && !reason) return res.status(400).json({ error: "reason_required" });
      const rec = await deps.store().decide(
        id,
        {
          decision,
          by: who,
          reason,
          verifiedName: decision === "approved" ? verifiedName : null,
          verifiedCountry: decision === "approved" ? str(b.verifiedCountry, 2)?.toUpperCase() ?? null : null,
          verifiedDocType: decision === "approved" ? str(b.verifiedDocType, 40) : null,
        },
        now(),
      );
      if (!rec) {
        const cur = await deps.store().get(id);
        if (!cur) return res.status(404).json({ error: "session_not_found" });
        return res.status(409).json({ error: "not_in_review", status: effectiveStatus(cur, now()) });
      }
      await deps.audit({ action: `kyc_manual_${decision}`, actor: who, payload: { sessionId: id, reason } });
      return res.json(adminView(rec, now()));
    } catch (e) {
      return res.status(500).json({ error: "kyc_manual_failed", detail: (e as Error).message });
    }
  });

  return r;
}
