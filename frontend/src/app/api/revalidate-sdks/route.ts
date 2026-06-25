import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";

const PATHS = ["/sdks", "/developers/fintech/sdk"];

function authorized(req: Request): boolean {
  const expected = process.env.REVALIDATE_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  const presented = m ? m[1] : req.headers.get("x-revalidate-token") ?? "";
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  for (const p of PATHS) revalidatePath(p);
  return Response.json({ ok: true, revalidated: PATHS, at: new Date().toISOString() });
}

export const POST = handle;
export const GET = handle;
