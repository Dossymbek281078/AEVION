// Действие с бесплатной нормой (qright_register, пакетная регистрация): свой обработчик
// вместо rewrite — адрес гостя бэкенду по AEVION_EDGE_KEY (см. ../protect/route.ts).
import { проксироватьСАдресом } from "@/lib/guestIpProxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return проксироватьСАдресом(req, "/api/pipeline/protect-batch");
}
