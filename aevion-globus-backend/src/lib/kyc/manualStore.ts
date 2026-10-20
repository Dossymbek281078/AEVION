/**
 * Хранилище ручной проверки личности бюро (BUREAU_KYC_PROVIDER=manual).
 *
 * 21.10.2026 (план «бюро Проверено», принят оркестратором): вместо внешнего
 * поставщика документ и селфи смотрит сотрудник AEVION. Обещание на витрине
 * ровно такое — «документ проверен сотрудником AEVION вручную», без
 * «real-name attestation» до ответа юриста.
 *
 * Два правила хранения, и оба держит код, а не договорённость:
 *  1. файлы отдаются ТОЛЬКО админу (ручки в routes/bureauManualKyc.ts);
 *  2. через MANUAL_KYC_RETENTION_DAYS после подачи байты стираются
 *     (purgeExpired), остаётся только решение и кто его принял.
 * Сторож удаления — tests/bureauManualKyc.test.ts (запросы к ручкам).
 */
import crypto from "node:crypto";
import type { KycStatus } from "./provider";

export const MANUAL_KYC_RETENTION_DAYS = 30;
export const MANUAL_KYC_SESSION_TTL_HOURS = 72;
// Предел 3,5 МБ на файл: оба файла идут base64 в одном JSON, а общий express.json
// в index.ts режет тело на 10 МБ (2 × 3,5 МБ × 4/3 ≈ 9,3 МБ). Фронт сжимает фото до отправки.
export const MANUAL_KYC_MAX_FILE_BYTES = 3.5 * 1024 * 1024;
export const MANUAL_KYC_DOC_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
export const MANUAL_KYC_SELFIE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ManualKycFileKind = "document" | "selfie";

export type ManualKycRecord = {
  id: string;
  userId: string | null;
  email: string | null;
  declaredName: string | null;
  declaredCountry: string | null;
  status: KycStatus;
  docType: string | null;
  docMime: string | null;
  selfieMime: string | null;
  hasFiles: boolean;
  createdAt: string;
  expiresAt: string;
  submittedAt: string | null;
  purgeAfter: string | null;
  purgedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  reason: string | null;
  verifiedName: string | null;
  verifiedCountry: string | null;
  verifiedDocType: string | null;
};

export type ManualKycSubmit = {
  docType: string;
  docMime: string;
  doc: Buffer;
  selfieMime: string;
  selfie: Buffer;
};

export type ManualKycDecision = {
  decision: "approved" | "rejected";
  by: string;
  reason: string | null;
  verifiedName: string | null;
  verifiedCountry: string | null;
  verifiedDocType: string | null;
};

export interface ManualKycStore {
  create(
    input: { userId: string | null; email: string | null; declaredName?: string | null; declaredCountry?: string | null },
    now: Date,
  ): Promise<ManualKycRecord>;
  get(id: string): Promise<ManualKycRecord | null>;
  submit(id: string, input: ManualKycSubmit, now: Date): Promise<ManualKycRecord | null>;
  list(status: KycStatus | null, limit: number): Promise<ManualKycRecord[]>;
  getFile(id: string, kind: ManualKycFileKind): Promise<{ mime: string; bytes: Buffer } | null>;
  decide(id: string, d: ManualKycDecision, now: Date): Promise<ManualKycRecord | null>;
  /** Стирает байты у подач старше срока хранения. Возвращает число очищенных. */
  purgeExpired(now: Date): Promise<number>;
}

export function newManualKycId(): string {
  return "kyc-man-" + crypto.randomBytes(16).toString("hex");
}

export function purgeAfterFor(submittedAt: Date): Date {
  return new Date(submittedAt.getTime() + MANUAL_KYC_RETENTION_DAYS * 24 * 3600 * 1000);
}

/** Сессия, которую не подали до expiresAt, считается истёкшей. */
export function effectiveStatus(r: ManualKycRecord, now: Date): KycStatus {
  if (r.status === "pending" && new Date(r.expiresAt).getTime() < now.getTime()) return "expired";
  return r.status;
}

type Q = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

const COLS = `"id","userId","email","declaredName","declaredCountry","status","docType","docMime","selfieMime",
  ("docBytes" IS NOT NULL OR "selfieBytes" IS NOT NULL) AS "hasFiles",
  "createdAt","expiresAt","submittedAt","purgeAfter","purgedAt","decidedAt","decidedBy","reason",
  "verifiedName","verifiedCountry","verifiedDocType"`;

function iso(v: unknown): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToRecord(r: any): ManualKycRecord {
  return {
    id: r.id,
    userId: r.userId ?? null,
    email: r.email ?? null,
    declaredName: r.declaredName ?? null,
    declaredCountry: r.declaredCountry ?? null,
    status: r.status,
    docType: r.docType ?? null,
    docMime: r.docMime ?? null,
    selfieMime: r.selfieMime ?? null,
    hasFiles: Boolean(r.hasFiles),
    createdAt: iso(r.createdAt)!,
    expiresAt: iso(r.expiresAt)!,
    submittedAt: iso(r.submittedAt),
    purgeAfter: iso(r.purgeAfter),
    purgedAt: iso(r.purgedAt),
    decidedAt: iso(r.decidedAt),
    decidedBy: r.decidedBy ?? null,
    reason: r.reason ?? null,
    verifiedName: r.verifiedName ?? null,
    verifiedCountry: r.verifiedCountry ?? null,
    verifiedDocType: r.verifiedDocType ?? null,
  };
}

export function pgManualKycStore(db: Q): ManualKycStore {
  let ready = false;
  async function ensure() {
    if (ready) return;
    await db.query(`CREATE TABLE IF NOT EXISTS "BureauManualKyc" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT, "email" TEXT, "declaredName" TEXT, "declaredCountry" TEXT,
      "status" TEXT NOT NULL,
      "docType" TEXT, "docMime" TEXT, "docBytes" BYTEA, "selfieMime" TEXT, "selfieBytes" BYTEA,
      "createdAt" TIMESTAMPTZ NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL,
      "submittedAt" TIMESTAMPTZ, "purgeAfter" TIMESTAMPTZ, "purgedAt" TIMESTAMPTZ,
      "decidedAt" TIMESTAMPTZ, "decidedBy" TEXT, "reason" TEXT,
      "verifiedName" TEXT, "verifiedCountry" TEXT, "verifiedDocType" TEXT
    )`);
    await db.query(
      `CREATE INDEX IF NOT EXISTS "BureauManualKyc_purge" ON "BureauManualKyc" ("purgeAfter") WHERE "purgedAt" IS NULL`,
    );
    ready = true;
  }
  return {
    async create(input, now) {
      await ensure();
      const id = newManualKycId();
      const expiresAt = new Date(now.getTime() + MANUAL_KYC_SESSION_TTL_HOURS * 3600 * 1000);
      const { rows } = await db.query(
        `INSERT INTO "BureauManualKyc" ("id","userId","email","declaredName","declaredCountry","status","createdAt","expiresAt")
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7) RETURNING ${COLS}`,
        [id, input.userId, input.email, input.declaredName ?? null, input.declaredCountry ?? null, now, expiresAt],
      );
      return rowToRecord(rows[0]);
    },
    async get(id) {
      await ensure();
      const { rows } = await db.query(`SELECT ${COLS} FROM "BureauManualKyc" WHERE "id" = $1`, [id]);
      return rows[0] ? rowToRecord(rows[0]) : null;
    },
    async submit(id, s, now) {
      await ensure();
      const { rows } = await db.query(
        `UPDATE "BureauManualKyc" SET "status"='review',"docType"=$2,"docMime"=$3,"docBytes"=$4,"selfieMime"=$5,"selfieBytes"=$6,
           "submittedAt"=$7,"purgeAfter"=$8
         WHERE "id"=$1 AND "status"='pending' AND "expiresAt" >= $7 RETURNING ${COLS}`,
        [id, s.docType, s.docMime, s.doc, s.selfieMime, s.selfie, now, purgeAfterFor(now)],
      );
      return rows[0] ? rowToRecord(rows[0]) : null;
    },
    async list(status, limit) {
      await ensure();
      const { rows } = status
        ? await db.query(
            `SELECT ${COLS} FROM "BureauManualKyc" WHERE "status"=$1 ORDER BY "submittedAt" ASC NULLS LAST LIMIT $2`,
            [status, limit],
          )
        : await db.query(`SELECT ${COLS} FROM "BureauManualKyc" ORDER BY "createdAt" DESC LIMIT $1`, [limit]);
      return rows.map(rowToRecord);
    },
    async getFile(id, kind) {
      await ensure();
      const col = kind === "document" ? `"docMime" AS m, "docBytes" AS b` : `"selfieMime" AS m, "selfieBytes" AS b`;
      const { rows } = await db.query(`SELECT ${col} FROM "BureauManualKyc" WHERE "id"=$1`, [id]);
      if (!rows[0] || !rows[0].b) return null;
      return { mime: rows[0].m, bytes: Buffer.from(rows[0].b) };
    },
    async decide(id, d, now) {
      await ensure();
      const { rows } = await db.query(
        `UPDATE "BureauManualKyc" SET "status"=$2,"decidedAt"=$3,"decidedBy"=$4,"reason"=$5,
           "verifiedName"=$6,"verifiedCountry"=$7,"verifiedDocType"=$8
         WHERE "id"=$1 AND "status"='review' RETURNING ${COLS}`,
        [id, d.decision, now, d.by, d.reason, d.verifiedName, d.verifiedCountry, d.verifiedDocType],
      );
      return rows[0] ? rowToRecord(rows[0]) : null;
    },
    async purgeExpired(now) {
      await ensure();
      const r = await db.query(
        `UPDATE "BureauManualKyc" SET "docBytes"=NULL,"selfieBytes"=NULL,"purgedAt"=$1
         WHERE "purgedAt" IS NULL AND "purgeAfter" IS NOT NULL AND "purgeAfter" <= $1`,
        [now],
      );
      return r.rowCount ?? 0;
    },
  };
}

/** Хранилище в памяти — для тестов и dev без базы. Те же правила, что в SQL выше. */
export function memoryManualKycStore(): ManualKycStore & { __raw: Map<string, any> } {
  const m = new Map<string, any>();
  const rec = (r: any): ManualKycRecord => rowToRecord({ ...r, hasFiles: r.docBytes != null || r.selfieBytes != null });
  return {
    __raw: m,
    async create(input, now) {
      const r = {
        id: newManualKycId(),
        userId: input.userId,
        email: input.email,
        declaredName: input.declaredName ?? null,
        declaredCountry: input.declaredCountry ?? null,
        status: "pending",
        createdAt: now,
        expiresAt: new Date(now.getTime() + MANUAL_KYC_SESSION_TTL_HOURS * 3600 * 1000),
      };
      m.set(r.id, r);
      return rec(r);
    },
    async get(id) {
      const r = m.get(id);
      return r ? rec(r) : null;
    },
    async submit(id, s, now) {
      const r = m.get(id);
      if (!r || r.status !== "pending" || new Date(r.expiresAt).getTime() < now.getTime()) return null;
      Object.assign(r, {
        status: "review",
        docType: s.docType,
        docMime: s.docMime,
        docBytes: s.doc,
        selfieMime: s.selfieMime,
        selfieBytes: s.selfie,
        submittedAt: now,
        purgeAfter: purgeAfterFor(now),
      });
      return rec(r);
    },
    async list(status, limit) {
      return [...m.values()].filter((r) => !status || r.status === status).slice(0, limit).map(rec);
    },
    async getFile(id, kind) {
      const r = m.get(id);
      const b = r?.[kind === "document" ? "docBytes" : "selfieBytes"];
      return b ? { mime: r[kind === "document" ? "docMime" : "selfieMime"], bytes: b } : null;
    },
    async decide(id, d, now) {
      const r = m.get(id);
      if (!r || r.status !== "review") return null;
      Object.assign(r, {
        status: d.decision,
        decidedAt: now,
        decidedBy: d.by,
        reason: d.reason,
        verifiedName: d.verifiedName,
        verifiedCountry: d.verifiedCountry,
        verifiedDocType: d.verifiedDocType,
      });
      return rec(r);
    },
    async purgeExpired(now) {
      let n = 0;
      for (const r of m.values()) {
        if (!r.purgedAt && r.purgeAfter && new Date(r.purgeAfter).getTime() <= now.getTime()) {
          r.docBytes = null;
          r.selfieBytes = null;
          r.purgedAt = now;
          n++;
        }
      }
      return n;
    },
  };
}
