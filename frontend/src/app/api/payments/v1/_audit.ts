import type { NextRequest } from "next/server";
import { kvList, kvPush } from "./_persist";

export type AuditEntry = {
  id: string;
  at: number;
  action: string;
  target_id: string | null;
  actor_prefix: string;
  ip: string | null;
  ua: string | null;
  meta: Record<string, unknown> | null;
};

const AUDIT_KEY = "audit.v1";
const AUDIT_CAP = 1000;

function actorPrefix(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (!m) return "anonymous";
  const key = m[1];
  if (key.length <= 12) return key;
  return key.slice(0, 12) + "…";
}

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function logAudit(
  req: NextRequest,
  action: string,
  target_id?: string | null,
  meta?: Record<string, unknown>
): Promise<void> {
  const entry: AuditEntry = {
    id: `aud_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    action,
    target_id: target_id ?? null,
    actor_prefix: actorPrefix(req),
    ip: clientIp(req),
    ua: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    meta: meta ?? null,
  };
  try {
    await kvPush(AUDIT_KEY, entry, AUDIT_CAP);
  } catch {
    // best-effort; never fail the underlying request because of audit
  }
}

export async function readAudit(filter?: {
  action?: string;
  target_id?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  const all = await kvList<AuditEntry>(AUDIT_KEY);
  const limit = Math.min(500, filter?.limit ?? 100);
  let out = all;
  if (filter?.action) out = out.filter((e) => e.action === filter.action);
  if (filter?.target_id)
    out = out.filter((e) => e.target_id === filter.target_id);
  return out.slice(0, limit);
}
