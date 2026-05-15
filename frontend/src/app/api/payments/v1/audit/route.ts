import type { NextRequest } from "next/server";
import { attachRateHeaders, gateRequest, withCors } from "../_lib";
import { readAudit } from "../_audit";

export async function GET(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? undefined;
  const target_id = url.searchParams.get("target_id") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 100);

  const data = await readAudit({ action, target_id, limit });
  return attachRateHeaders(
    withCors(
      Response.json({
        object: "list",
        count: data.length,
        data,
      })
    ),
    gate.rateHeaders
  );
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}
