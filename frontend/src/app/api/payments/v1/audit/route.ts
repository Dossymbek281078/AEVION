import type { NextRequest } from "next/server";
import {
  readLimit, attachRateHeaders, gateRequest, withCors } from "../_lib";
import { readAudit } from "../_audit";

export async function GET(req: NextRequest) {
  const gate = gateRequest(req);
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? undefined;
  const target_id = url.searchParams.get("target_id") ?? undefined;
  const limit = readLimit(url.searchParams.get("limit"), { поумолчанию: 100, максимум: 1000 });

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
  // 31.08.2026. Отдавали записи ЦЕЛИКОМ, вместе с ip и ua вызывающих.
  // Журнал платежей читает любой, у кого есть ключ, а разделения по клиентам
  // здесь нет вовсе — значит адрес и браузер одного покупателя видел другой.
  // Наружу отдаём то, ради чего журнал и нужен: что произошло, с чем и когда.
  // Сами поля из записи не убираем: внутри они нужны для разбора инцидентов.
  const data = read.entries.map(({ ip: _ip, ua: _ua, ...остальное }) => остальное);
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
