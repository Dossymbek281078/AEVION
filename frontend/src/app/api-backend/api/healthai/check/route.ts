// Действие с бесплатной нормой: свой обработчик вместо rewrite, чтобы бэкенд
// увидел адрес гостя, а не адрес Vercel (lib/guestIpProxy.ts, замер 13.10.2026).
import { проксироватьСАдресом } from "@/lib/guestIpProxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return проксироватьСАдресом(req, "/api/healthai/check");
}
