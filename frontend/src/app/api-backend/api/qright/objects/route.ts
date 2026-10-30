// POST /api/qright/objects — регистрация с бесплатной нормой (qright_register): свой
// обработчик вместо rewrite — адрес гостя бэкенду по AEVION_EDGE_KEY (см. pipeline/protect).
// GET (?mine=1 и реестр) идёт тем же обработчиком: файл route.ts перекрывает перезапись
// для ВСЕХ методов, без GET здесь реестр получил бы 405.
import { проксироватьСАдресом } from "@/lib/guestIpProxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return проксироватьСАдресом(req, "/api/qright/objects");
}

export async function POST(req: Request): Promise<Response> {
  return проксироватьСАдресом(req, "/api/qright/objects");
}
