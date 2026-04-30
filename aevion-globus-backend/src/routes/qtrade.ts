import { Router, type Response, type Request } from "express";
import { randomUUID } from "node:crypto";
import { csvFromRows } from "../lib/csv";
import { readJsonFile, writeJsonFile } from "../lib/jsonFileStore";
import { requireAuth } from "../lib/authJwt";
import { getPool } from "../lib/dbPool";
import { consumeDailyCap, peekDailyCap } from "../lib/dailyCap";

export const qtradeRouter = Router();

type Account = {
  id: string;
  owner: string;
  balance: number;
  createdAt: string;
};

type Transfer = {
  id: string;
  from: string;
  to: string;
  amount: number;
  createdAt: string;
  memo?: string;
};

type Operation = {
  id: string;
  kind: "topup" | "transfer";
  amount: number;
  from: string | null;
  to: string;
  createdAt: string;
  memo?: string;
};

const MAX_MEMO_LEN = 140;
function sanitiseMemo(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().slice(0, MAX_MEMO_LEN);
  return trimmed ? trimmed : undefined;
}

const STORE_REL = "qtrade.json";

const accounts: Account[] = [];
const transfers: Transfer[] = [];
const operations: Operation[] = [];

function nextId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

let loaded = false;
let loading: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loading) {
    loading = (async () => {
      const data = await readJsonFile<{
        accounts?: Account[];
        transfers?: Transfer[];
        operations?: Operation[];
      }>(
        STORE_REL,
        { accounts: [], transfers: [], operations: [] },
      );
      const acc = Array.isArray(data.accounts) ? data.accounts : [];
      const tx = Array.isArray(data.transfers) ? data.transfers : [];
      const op = Array.isArray(data.operations) ? data.operations : [];
      accounts.splice(0, accounts.length, ...acc);
      transfers.splice(0, transfers.length, ...tx);
      operations.splice(
        0,
        operations.length,
        ...(op.length
          ? op
          : tx.map((x) => ({
              id: `op_${x.id}`,
              kind: "transfer" as const,
              amount: x.amount,
              from: x.from,
              to: x.to,
              createdAt: x.createdAt,
            }))),
      );
      loaded = true;
    })();
  }
  await loading;
}

let persistChain: Promise<void> = Promise.resolve();

function schedulePersist(): void {
  const snapshot = {
    accounts: [...accounts],
    transfers: [...transfers],
    operations: [...operations],
  };
  persistChain = persistChain
    .then(() => writeJsonFile(STORE_REL, snapshot))
    .catch((err) => {
      console.error("[qtrade] persist failed", err);
    });
}

qtradeRouter.use((_req, _res, next) => {
  ensureLoaded()
    .then(() => next())
    .catch(next);
});

// JWT middleware applies to every /api/qtrade/* route. Without this any
// caller could enumerate or mutate ledger state for another user — frontend
// was filtering by owner client-side which is unsafe.
qtradeRouter.use(requireAuth);

function ownerEmail(req: Request): string {
  return req.auth?.email ?? "";
}

function ownAccountIds(owner: string): Set<string> {
  return new Set(accounts.filter((a) => a.owner === owner).map((a) => a.id));
}

function ownsAccount(owner: string, accountId: string): boolean {
  const a = accounts.find((x) => x.id === accountId);
  return !!a && a.owner === owner;
}

// =======================
// Pagination helpers
// =======================
type PageOpts = { limit: number; cursor: string | null };

function parsePageOpts(req: Request): PageOpts {
  const rawLimit = Number(req.query.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 200)
      : 50;
  const c = req.query.cursor;
  const cursor = typeof c === "string" && c.length > 0 ? c : null;
  return { limit, cursor };
}

function paginate<T extends { id: string }>(
  items: T[],
  { limit, cursor }: PageOpts,
): { page: T[]; nextCursor: string | null } {
  let start = 0;
  if (cursor) {
    const idx = items.findIndex((x) => x.id === cursor);
    if (idx >= 0) start = idx + 1;
  }
  const page = items.slice(start, start + limit);
  const nextCursor =
    page.length === limit && start + limit < items.length
      ? page[page.length - 1].id
      : null;
  return { page, nextCursor };
}

// =======================
// Создать счёт
// =======================
qtradeRouter.post("/accounts", (req, res) => {
  const owner = ownerEmail(req);
  const { owner: bodyOwner } = req.body || {};
  // For backwards compat the client may still send `owner` — but we always
  // bind the new account to the authenticated user's email.
  if (bodyOwner && bodyOwner !== owner) {
    return res.status(403).json({ error: "owner mismatch" });
  }

  const acc: Account = {
    id: nextId("acc"),
    owner,
    balance: 0,
    createdAt: new Date().toISOString(),
  };

  accounts.push(acc);
  schedulePersist();
  res.status(201).json(acc);
});

// =======================
// Получить мои счета
// =======================
qtradeRouter.get("/accounts", (req, res) => {
  const owner = ownerEmail(req);
  const items = accounts.filter((a) => a.owner === owner);
  const { page, nextCursor } = paginate(items, parsePageOpts(req));
  res.json({ items: page, nextCursor });
});

// =======================
// История переводов (новые сверху)
// =======================
qtradeRouter.get("/transfers", (req, res) => {
  const ownIds = ownAccountIds(ownerEmail(req));
  const all = [...transfers]
    .reverse()
    .filter((tx) => ownIds.has(tx.from) || ownIds.has(tx.to));
  const { page, nextCursor } = paginate(all, parsePageOpts(req));
  res.json({ items: page, nextCursor });
});

// =======================
// Журнал операций (новые сверху)
// =======================
qtradeRouter.get("/operations", (req, res) => {
  const ownIds = ownAccountIds(ownerEmail(req));
  const all = [...operations]
    .reverse()
    .filter((op) => ownIds.has(op.to) || (op.from && ownIds.has(op.from)));
  const { page, nextCursor } = paginate(all, parsePageOpts(req));
  res.json({ items: page, nextCursor });
});

// =======================
// Сводка по моим счетам
// =======================
qtradeRouter.get("/summary", (req, res) => {
  const owner = ownerEmail(req);
  const ownIds = ownAccountIds(owner);
  const myAccounts = accounts.filter((a) => a.owner === owner);
  const myOps = operations.filter(
    (op) => ownIds.has(op.to) || (op.from && ownIds.has(op.from)),
  );
  const totalBalance = myAccounts.reduce((s, a) => s + a.balance, 0);
  const totalTransferVolume = transfers
    .filter((tx) => ownIds.has(tx.from) || ownIds.has(tx.to))
    .reduce((s, x) => s + x.amount, 0);
  const totalTopupVolume = myOps
    .filter((x) => x.kind === "topup")
    .reduce((s, x) => s + x.amount, 0);
  res.json({
    accounts: myAccounts.length,
    transfers: transfers.filter((tx) => ownIds.has(tx.from) || ownIds.has(tx.to))
      .length,
    operations: myOps.length,
    totalBalance,
    totalTransferVolume,
    totalTopupVolume,
  });
});

// =======================
// Daily-cap status (read-only). Lets the wallet UI render a progress
// strip so users see remaining headroom before they hit a 429.
// =======================
qtradeRouter.get("/cap-status", (req, res) => {
  const owner = ownerEmail(req);
  const topup = peekDailyCap(owner, "topup");
  const transfer = peekDailyCap(owner, "transfer");
  res.json({
    topup,
    transfer,
    resetsAtIso: new Date(Date.now() + topup.remainingSec * 1000).toISOString(),
  });
});

// =======================
// Email → accountId lookup (for P2P transfer UX)
// =======================
qtradeRouter.get("/accounts/lookup", async (req, res) => {
  const emailRaw = req.query.email;
  if (typeof emailRaw !== "string" || !emailRaw.trim()) {
    return res.status(400).json({ error: "email required" });
  }
  const email = emailRaw.trim().toLowerCase();

  // Try users table first — confirms that email actually corresponds to a
  // registered user, even if no account has been provisioned yet.
  let userExists = false;
  try {
    const pool = getPool();
    const r = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = $1) AS exists",
      [email],
    );
    userExists = !!(r.rows[0] as { exists?: boolean } | undefined)?.exists;
  } catch {
    // DB unavailable in pure-JSON dev mode — fall through and rely on
    // accounts.owner only.
  }

  const owned = accounts.filter((a) => a.owner.toLowerCase() === email);
  if (owned.length === 0) {
    return res.status(404).json({
      error: "no account",
      email,
      userExists,
    });
  }
  // Return primary (oldest) plus full list so callers can pick.
  const primary = owned.reduce((a, b) =>
    a.createdAt < b.createdAt ? a : b,
  );
  res.json({
    email,
    primary: { id: primary.id, balance: primary.balance },
    accounts: owned.map((a) => ({ id: a.id, balance: a.balance, createdAt: a.createdAt })),
    userExists,
  });
});

function sendCsvAttachment(
  res: Response,
  baseName: string,
  rows: (string | number | null | undefined)[][],
): void {
  const csv = csvFromRows(rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${baseName}-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.status(200).send(csv);
}

// =======================
// Экспорт счетов в CSV
// =======================
qtradeRouter.get("/accounts.csv", (req, res) => {
  const owner = ownerEmail(req);
  const mine = accounts.filter((a) => a.owner === owner);
  const rows = [
    ["id", "owner", "balance", "createdAt"],
    ...mine.map((a) => [a.id, a.owner, a.balance, a.createdAt]),
  ];
  sendCsvAttachment(res, "qtrade-accounts", rows);
});

// =======================
// Экспорт переводов в CSV
// =======================
qtradeRouter.get("/transfers.csv", (req, res) => {
  const ownIds = ownAccountIds(ownerEmail(req));
  const rows = [
    ["id", "from", "to", "amount", "createdAt", "memo"],
    ...[...transfers]
      .reverse()
      .filter((x) => ownIds.has(x.from) || ownIds.has(x.to))
      .map((x) => [x.id, x.from, x.to, x.amount, x.createdAt, x.memo ?? ""]),
  ];
  sendCsvAttachment(res, "qtrade-transfers", rows);
});

// =======================
// Экспорт операций в CSV
// =======================
qtradeRouter.get("/operations.csv", (req, res) => {
  const ownIds = ownAccountIds(ownerEmail(req));
  const rows = [
    ["id", "kind", "amount", "from", "to", "createdAt", "memo"],
    ...[...operations]
      .reverse()
      .filter((x) => ownIds.has(x.to) || (x.from && ownIds.has(x.from)))
      .map((x) => [x.id, x.kind, x.amount, x.from, x.to, x.createdAt, x.memo ?? ""]),
  ];
  sendCsvAttachment(res, "qtrade-operations", rows);
});

// =======================
// Server-rendered account statement PDF — multi-page, all operations
// owned by the caller within ?period=30d|90d|all (default 30d), with
// running balance reconstructed from zero so the totals are auditable.
// =======================
qtradeRouter.get("/statement.pdf", async (req, res, next) => {
  try {
    const owner = ownerEmail(req);
    const ownIds = ownAccountIds(owner);
    const period = (typeof req.query.period === "string" ? req.query.period : "30d").toLowerCase();
    const now = Date.now();
    let cutoff = 0;
    if (period === "30d") cutoff = now - 30 * 24 * 3600_000;
    else if (period === "90d") cutoff = now - 90 * 24 * 3600_000;
    else if (period === "ytd") cutoff = Date.UTC(new Date().getUTCFullYear(), 0, 1);
    else if (period === "all") cutoff = 0;
    else cutoff = now - 30 * 24 * 3600_000;

    const myOps = [...operations]
      .filter((op) => ownIds.has(op.to) || (op.from && ownIds.has(op.from)))
      .filter((op) => Date.parse(op.createdAt) >= cutoff)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    const myAccounts = accounts.filter((a) => a.owner === owner);
    const liveBalance = myAccounts.reduce((s, a) => s + a.balance, 0);

    // Running balance walks from 0; this should land at liveBalance when
    // period=all, and somewhere short of it for shorter windows because
    // earlier ops are excluded. Either way the column shows what the
    // user actually held *at that moment in the window*.
    let running = 0;
    if (period !== "all") {
      // Sum every op before cutoff to get the opening balance.
      for (const op of operations) {
        if (Date.parse(op.createdAt) >= cutoff) continue;
        if (op.kind === "topup" && ownIds.has(op.to)) running += op.amount;
        else if (op.kind === "transfer") {
          if (op.from && ownIds.has(op.from)) running -= op.amount;
          if (ownIds.has(op.to)) running += op.amount;
        }
      }
    }
    const opening = Math.round(running * 100) / 100;

    const PDFDocumentMod = await import("pdfkit");
    const PDFDocument = PDFDocumentMod.default;
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="aevion-statement-${period}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    doc.pipe(res);

    const W = doc.page.width - 100;
    const pageW = doc.page.width;

    // Header bar
    doc.rect(0, 0, pageW, 80).fill("#0f172a");
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#ffffff").text("AEVION Bank", 50, 26);
    doc.fontSize(10).font("Helvetica").fillColor("#94a3b8").text("Account statement — Test Net", 50, 52);
    doc.rect(0, 80, pageW, 3).fill("#7c3aed");

    // Summary block
    let y = 100;
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#475569").text("OWNER", 50, y);
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text(owner, 50, y + 14);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#475569").text("PERIOD", 280, y);
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text(period, 280, y + 14);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#475569").text("LIVE BALANCE", 420, y);
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text(`${liveBalance.toFixed(2)} AEC`, 420, y + 14);

    y += 44;
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#475569").text("ACCOUNTS", 50, y);
    doc.fontSize(10).font("Courier").fillColor("#0f172a").text(myAccounts.map((a) => a.id).join(", ") || "(none)", 50, y + 14, { width: W });
    y += 32;
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#475569").text("OPENING BALANCE", 50, y);
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text(`${opening.toFixed(2)} AEC`, 50, y + 14);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#475569").text("OPERATIONS", 280, y);
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text(String(myOps.length), 280, y + 14);
    y += 38;
    doc.rect(50, y, W, 1).fill("#e2e8f0");
    y += 12;

    // Column headers
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#64748b");
    doc.text("DATE", 50, y);
    doc.text("KIND", 130, y);
    doc.text("FROM → TO", 175, y);
    doc.text("AMOUNT", 380, y, { width: 70, align: "right" });
    doc.text("BALANCE", 460, y, { width: 90, align: "right" });
    y += 14;
    doc.rect(50, y, W, 0.5).fill("#cbd5e1");
    y += 6;

    // Table rows
    doc.fontSize(9).font("Helvetica").fillColor("#0f172a");
    for (const op of myOps) {
      if (op.kind === "topup" && ownIds.has(op.to)) running += op.amount;
      else if (op.kind === "transfer") {
        if (op.from && ownIds.has(op.from)) running -= op.amount;
        if (ownIds.has(op.to)) running += op.amount;
      }
      const sign = op.kind === "topup" || (op.from && !ownIds.has(op.from)) ? "+" : "-";
      const dt = new Date(op.createdAt).toISOString().replace("T", " ").slice(0, 16);
      // Page break check
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
      }
      doc.fillColor("#0f172a").font("Courier").fontSize(8).text(dt, 50, y, { width: 75 });
      doc.font("Helvetica").fontSize(9).text(op.kind, 130, y);
      doc.font("Courier").fontSize(8).text(`${op.from ?? "(net)"} → ${op.to}`, 175, y, { width: 200 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(sign === "+" ? "#16a34a" : "#dc2626").text(
        `${sign}${op.amount.toFixed(2)}`,
        380,
        y,
        { width: 70, align: "right" },
      );
      doc.fillColor("#0f172a").font("Courier").fontSize(9).text(running.toFixed(2), 460, y, { width: 90, align: "right" });
      y += 14;
    }

    if (myOps.length === 0) {
      doc.fontSize(10).font("Helvetica").fillColor("#64748b").text("No operations in selected period.", 50, y);
    }

    // Page numbers in the bottom margin
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fontSize(8).font("Helvetica").fillColor("#94a3b8").text(
        `Page ${i + 1} of ${range.count}  ·  Generated ${new Date().toISOString()}  ·  AEVION Bank Test Net`,
        50,
        doc.page.height - 40,
        { width: W, align: "center" },
      );
    }

    doc.end();
  } catch (e) {
    next(e);
  }
});

// =======================
// Server-rendered single-page PDF receipt for one operation.
// Auth-gated and scoped: caller must own one side of the operation.
// pdfkit is already a dep (used by /api/pipeline/* certificate PDFs).
// =======================
qtradeRouter.get("/receipt/:opId.pdf", async (req, res, next) => {
  try {
    const owner = ownerEmail(req);
    const ownIds = ownAccountIds(owner);
    const opId = req.params.opId;
    const op = operations.find((x) => x.id === opId);
    if (!op) return res.status(404).json({ error: "operation not found" });
    if (!ownIds.has(op.to) && !(op.from && ownIds.has(op.from))) {
      return res.status(403).json({ error: "not your operation" });
    }

    const PDFDocumentMod = await import("pdfkit");
    const QRCodeMod = await import("qrcode");
    const PDFDocument = PDFDocumentMod.default;
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="aevion-receipt-${op.id}.pdf"`);
    doc.pipe(res);

    const baseUrl = process.env.RECEIPT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://aevion.app";
    const verifyUrl = `${baseUrl.replace(/\/+$/, "")}/bank/receipt/${op.id}`;
    const qrDataUrl = await QRCodeMod.toDataURL(verifyUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64");

    const W = doc.page.width - 100;
    const pageW = doc.page.width;

    // Header bar
    doc.rect(0, 0, pageW, 80).fill("#0f172a");
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#ffffff").text("AEVION Bank", 50, 26);
    doc.fontSize(10).font("Helvetica").fillColor("#94a3b8").text("Operation receipt — Test Net", 50, 52);

    // Accent
    doc.rect(0, 80, pageW, 3).fill("#7c3aed");

    // Verify QR — top right of body. Friend scans → /bank/receipt/:id
    // opens with the signed envelope rendered alongside the PDF reader,
    // which is the closest thing to a "tap to verify" we can ship before
    // a dedicated /verify-bank route.
    const qrSize = 80;
    const qrX = pageW - qrSize - 50;
    const qrY = 100;
    doc.image(qrBuffer, qrX, qrY, { width: qrSize });
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#94a3b8").text(
      "SCAN TO VERIFY",
      qrX,
      qrY + qrSize + 4,
      { width: qrSize, align: "center" },
    );

    // Title
    const yTitle = 110;
    doc.fontSize(11).font("Helvetica").fillColor("#7c3aed").text("PROOF OF MOVEMENT", 50, yTitle, { align: "center", width: W });
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#0f172a").text(
      `${op.kind === "topup" ? "Top-up" : "Transfer"} · ${op.amount.toFixed(2)} AEC`,
      50,
      yTitle + 22,
      { align: "center", width: W },
    );
    doc.fontSize(10).font("Helvetica").fillColor("#64748b").text(
      new Date(op.createdAt).toLocaleString(),
      50,
      yTitle + 56,
      { align: "center", width: W },
    );

    const yDiv = yTitle + 90;
    doc.rect(50, yDiv, W, 1).fill("#e2e8f0");

    // Detail grid
    const yInfo = yDiv + 16;
    const col1X = 50;
    const col2X = 50 + W / 2;

    function row(y: number, k1: string, v1: string, k2?: string, v2?: string) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8").text(k1, col1X, y);
      doc.fontSize(11).font("Courier").fillColor("#0f172a").text(v1, col1X, y + 12);
      if (k2 && v2) {
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8").text(k2, col2X, y);
        doc.fontSize(11).font("Courier").fillColor("#0f172a").text(v2, col2X, y + 12);
      }
    }

    row(yInfo, "OPERATION ID", op.id, "KIND", op.kind);
    row(yInfo + 42, "FROM", op.from ?? "(top-up source)", "TO", op.to);
    row(yInfo + 84, "AMOUNT (AEC)", op.amount.toFixed(2), "OWNER", owner);
    row(yInfo + 126, "TIMESTAMP", op.createdAt, "BANK", "AEVION Bank · Test Net");
    if (op.memo) {
      row(yInfo + 168, "MEMO", op.memo, "", "");
    }

    // Footer
    doc.fontSize(9).font("Helvetica").fillColor("#94a3b8").text(
      "This document is generated server-side from the AEVION Bank ledger. Verify any signed envelope at /bank/audit-log.",
      50,
      doc.page.height - 80,
      { width: W, align: "center" },
    );
    doc.fontSize(8).font("Helvetica").fillColor("#cbd5e1").text(
      `Generated ${new Date().toISOString()}`,
      50,
      doc.page.height - 60,
      { width: W, align: "center" },
    );

    doc.end();
  } catch (e) {
    next(e);
  }
});

// =======================
// Idempotency cache (in-memory, 24h TTL).
// Same key → same response, no double-billing on retry storms.
// =======================
type CachedReply = { status: number; body: unknown; storedAt: number };
const idemCache = new Map<string, CachedReply>();
const IDEM_TTL_MS = 24 * 60 * 60 * 1000;

// Counts read by /api/metrics. Reads are cheap; we don't snapshot.
export function getQtradeMetrics(): {
  accounts: number;
  transfers: number;
  operations: number;
  idemCache: number;
} {
  return {
    accounts: accounts.length,
    transfers: transfers.length,
    operations: operations.length,
    idemCache: idemCache.size,
  };
}

function gcIdem(): void {
  const cutoff = Date.now() - IDEM_TTL_MS;
  for (const [k, v] of idemCache) {
    if (v.storedAt < cutoff) idemCache.delete(k);
  }
}

function readIdemKey(req: Request): string | null {
  const raw = req.headers["idempotency-key"];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || typeof v !== "string") return null;
  const k = v.trim();
  if (!k || k.length > 128) return null;
  return k;
}

function idemNamespace(req: Request, route: string): string {
  return `${ownerEmail(req)}::${route}::${readIdemKey(req)}`;
}

// =======================
// Пополнение счёта
// =======================
qtradeRouter.post("/topup", (req, res) => {
  const owner = ownerEmail(req);
  const { accountId, amount } = req.body || {};

  if (!ownsAccount(owner, accountId)) {
    return res.status(403).json({ error: "not owner of account" });
  }
  const acc = accounts.find((a) => a.id === accountId)!;

  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0)
    return res.status(400).json({ error: "invalid amount" });

  const idemKey = readIdemKey(req);
  if (idemKey) {
    gcIdem();
    const ns = idemNamespace(req, "topup");
    const hit = idemCache.get(ns);
    if (hit) {
      res.setHeader("Idempotency-Replayed", "true");
      return res.status(hit.status).json(hit.body);
    }
  } else {
    res.setHeader("Idempotency-Warning", "missing-key");
  }

  // Daily cap is checked after idempotency replay so a retry of an already-
  // accepted top-up doesn't get rejected for "exceeded today" — the cap was
  // already consumed by the original request.
  const cap = consumeDailyCap(owner, "topup", a);
  if (!cap.ok) {
    res.setHeader("Retry-After", String(cap.retryInSec));
    return res.status(429).json({
      error: "daily topup cap exceeded",
      cap: cap.cap,
      used: cap.used,
      requested: a,
      retryInSec: cap.retryInSec,
    });
  }

  acc.balance += a;
  operations.push({
    id: nextId("op"),
    kind: "topup",
    amount: a,
    from: null,
    to: acc.id,
    createdAt: new Date().toISOString(),
  });
  schedulePersist();

  const body = {
    id: acc.id,
    balance: acc.balance,
    updatedAt: new Date().toISOString(),
  };

  if (idemKey) {
    idemCache.set(idemNamespace(req, "topup"), {
      status: 200,
      body,
      storedAt: Date.now(),
    });
  }

  res.json(body);
});

// =======================
// Перевод средств
// =======================
qtradeRouter.post("/transfer", (req, res) => {
  const owner = ownerEmail(req);
  const { from, to, amount } = req.body || {};
  const memo = sanitiseMemo(req.body?.memo);

  if (!ownsAccount(owner, from)) {
    return res.status(403).json({ error: "not owner of source account" });
  }

  const fromAcc = accounts.find((a) => a.id === from);
  const toAcc = accounts.find((a) => a.id === to);

  if (!fromAcc || !toAcc)
    return res.status(400).json({ error: "invalid accounts" });
  if (from === to)
    return res.status(400).json({ error: "cannot transfer to same account" });

  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0 || fromAcc.balance < a)
    return res.status(400).json({ error: "invalid amount" });

  const idemKey = readIdemKey(req);
  if (idemKey) {
    gcIdem();
    const ns = idemNamespace(req, "transfer");
    const hit = idemCache.get(ns);
    if (hit) {
      res.setHeader("Idempotency-Replayed", "true");
      return res.status(hit.status).json(hit.body);
    }
  } else {
    res.setHeader("Idempotency-Warning", "missing-key");
  }

  const cap = consumeDailyCap(owner, "transfer", a);
  if (!cap.ok) {
    res.setHeader("Retry-After", String(cap.retryInSec));
    return res.status(429).json({
      error: "daily transfer cap exceeded",
      cap: cap.cap,
      used: cap.used,
      requested: a,
      retryInSec: cap.retryInSec,
    });
  }

  fromAcc.balance -= a;
  toAcc.balance += a;

  const tx: Transfer = {
    id: nextId("tx"),
    from,
    to,
    amount: a,
    createdAt: new Date().toISOString(),
    ...(memo ? { memo } : {}),
  };

  transfers.push(tx);
  operations.push({
    id: nextId("op"),
    kind: "transfer",
    amount: a,
    from,
    to,
    createdAt: tx.createdAt,
    ...(memo ? { memo } : {}),
  });
  schedulePersist();

  if (idemKey) {
    idemCache.set(idemNamespace(req, "transfer"), {
      status: 200,
      body: tx,
      storedAt: Date.now(),
    });
  }

  res.json(tx);
});
