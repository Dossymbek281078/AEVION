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

  const read = await readAudit({ action, target_id, limit });
  if (!read.ok) {
    // Пустой след неотличим от отсутствующего: тот, кто разбирает денежный
    // спор, сделал бы вывод «записей не существует», хотя недоступно
    // хранилище. Отказ честнее пустоты.
    return attachRateHeaders(
      withCors(
        Response.json(
          {
            error: {
              type: "storage_unavailable",
              message: "Audit storage is temporarily unreachable. Please retry.",
            },
          },
          { status: 503 }
        )
      ),
      gate.rateHeaders
    );
  }
  const data = read.entries;
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
