// Действие с бесплатной нормой (qright_register): свой обработчик вместо rewrite, чтобы
// бэкенд увидел адрес гостя, а не адрес выхода Vercel (lib/guestIpProxy.ts).
// 🔴 30.10.2026 (Приложения-2·Бюро), прибор на проде 04f65bbb7: /api/veilnetx/inspect через
// aevion.app/api-backend видит ip 3.126.121.238 (узел Vercel), напрямую — адрес человека;
// /health: guestIpFromSite accepted 368 / noKey 9426. Значит норма «3 бесплатных в месяц»
// на /qright считалась на общий адрес узла: 4-й гость ЛЮБОЙ за месяц получал стену.
import { проксироватьСАдресом } from "@/lib/guestIpProxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return проксироватьСАдресом(req, "/api/pipeline/protect");
}
