/**
 * POST /api/proof/pilot-order — заказ пилота $490 с /proof (волна 129, 13.10.2026).
 *
 * До этого единственный путь к пилоту был mailto: тупик там, где нет почтового
 * клиента, и 0 нажатий за 14 дней. Форма пишет заявку в таблицу и в журнал
 * заявок (leads.jsonl), шлёт письмо на data@aevion.app и автоответ покупателю тем
 * же отправителем, что у форм (Resend, см. /api/health emailSender). Ничего не
 * списывается: счёт — после согласования объёма, как написано на странице.
 *
 * Отказы НЕ молчат (§16): каждая неудача отправки/записи названа в теле ответа.
 */
import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { sendEmail } from "./provisioning";
import { leadsFile } from "../lib/leadsFile";

export const proofPilotRouter = Router();

export const PILOT_USD = 490;
export const PILOT_TO = "data@aevion.app";

const limiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "proof:pilot-order",
  message: "Too many requests. Please wait a minute and try again.",
});

let tableReady = false;
let dbAvailable = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  try {
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS proof_pilot_order (
        "id"        TEXT PRIMARY KEY,
        "email"     TEXT NOT NULL,
        "records"   INTEGER NOT NULL,
        "days"      INTEGER NOT NULL,
        "data"      TEXT,
        "channel"   TEXT,
        "post"      TEXT,
        "path"      TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    dbAvailable = true;
  } catch (err) {
    dbAvailable = false;
    console.error("[proof/pilot-order] таблица недоступна:", err instanceof Error ? err.message : err);
  }
  tableReady = true;
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown, dflt: number, min: number, max: number): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[\s,_]/g, ""));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function pismoNam(z: { id: string; email: string; records: number; days: number; data: string | null; channel: string | null; post: string | null; path: string | null }) {
  const text = [
    `Pilot request — $${PILOT_USD}`,
    ``,
    `Email:   ${z.email}`,
    `Records: ${z.records.toLocaleString("en-US")}`,
    `Days:    ${z.days}`,
    `Data:    ${z.data ?? "—"}`,
    `Channel: ${z.channel ?? "—"} · post: ${z.post ?? "—"}`,
    `Path:    ${z.path ?? "—"}`,
    `Id:      ${z.id}`,
    ``,
    `Next: reply with the format we need and a fixed date; the invoice comes after the scope is agreed.`,
  ].join("\n");
  return { to: PILOT_TO, subject: `Pilot request — $${PILOT_USD} — ${z.email}`, text, html: `<pre style="font:14px/1.5 ui-monospace,monospace">${esc(text)}</pre>` };
}

export function pismoPokupatelyu(z: { email: string; records: number; days: number }) {
  // Только то, что обещает страница /proof: scope → format and a fixed date → invoice → manifest + verify kit.
  const text = [
    `Thank you — we received your pilot request ($${PILOT_USD}, up to ${z.records.toLocaleString("en-US")} records, ${z.days} days).`,
    ``,
    `What happens next:`,
    `1. We reply from ${PILOT_TO} with the record format we need and a fixed delivery date.`,
    `2. Once the scope is agreed, we send the invoice. Nothing has been charged yet.`,
    `3. After payment you receive a download link to the signed manifest (Ed25519 over RFC 8785 canonical JSON) and the verify kit — your client checks it on their own machine, calling nothing of ours.`,
    ``,
    `What it is not: we do not certify the author's identity, there is no notary co-signature, no SOC 2 or ISO 27001.`,
    ``,
    `Reply to this email to add details. — AEVION`,
  ].join("\n");
  return { to: z.email, subject: `AEVION pilot — we received your request`, text, html: `<pre style="font:14px/1.5 ui-monospace,monospace">${esc(text)}</pre>` };
}

function zapisatVZhurnal(lead: Record<string, unknown>): string | null {
  try {
    const f = leadsFile();
    const d = dirname(f);
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
    appendFileSync(f, JSON.stringify(lead) + "\n", "utf8");
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

proofPilotRouter.post("/pilot-order", limiter, async (req: Request, res: Response) => {
  try {
    // Honeypot: людям поле не показывается; заполнено — молча «ok» для робота, но честно в журнале.
    if (str(req.body?.website, 200)) {
      console.warn("[proof/pilot-order] honeypot заполнен — заявка отброшена");
      return res.status(200).json({ ok: true, stored: false, honeypot: true });
    }
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (email.length < 5 || email.length > 254 || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "valid_email_required" });
    }
    const z = {
      id: crypto.randomUUID(),
      email,
      records: int(req.body?.records, 10_000, 1, 1_000_000),
      days: int(req.body?.days, 7, 1, 60),
      data: str(req.body?.data, 500),
      channel: str(req.body?.channel, 60),
      post: str(req.body?.post, 60),
      path: str(req.body?.path, 300),
    };
    const errors: string[] = [];
    await ensureTable();
    let stored = false;
    if (dbAvailable) {
      try {
        await getPool().query(
          `INSERT INTO proof_pilot_order ("id","email","records","days","data","channel","post","path") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [z.id, z.email, z.records, z.days, z.data, z.channel, z.post, z.path],
        );
        stored = true;
      } catch (err) {
        tableReady = false; dbAvailable = false;
        errors.push("storage: " + (err instanceof Error ? err.message : String(err)));
      }
    } else {
      errors.push("storage: unavailable");
    }
    const журнал = zapisatVZhurnal({ ts: new Date().toISOString(), kind: "pilot_490", ...z });
    if (журнал) errors.push("leads: " + журнал);
    const нам = await sendEmail(pismoNam(z));
    const покупателю = await sendEmail(pismoPokupatelyu(z));
    if (!нам.ok) errors.push("mail-us: " + (нам.error ?? "failed"));
    if (!покупателю.ok) errors.push("mail-buyer: " + (покупателю.error ?? "failed"));
    for (const e of errors) console.error("[proof/pilot-order]", z.id, e);
    const принято = stored || !журнал || нам.ok;
    return res.status(принято ? 201 : 503).json({ ok: принято, id: z.id, stored, journaled: !журнал, mailed: { us: нам.ok, buyer: покупателю.ok, mode: нам.mode }, errors });
  } catch (err) {
    console.error("[proof/pilot-order] failed:", err instanceof Error ? err.message : err);
    return res.status(500).json({ ok: false, error: "pilot_order_failed" });
  }
});
