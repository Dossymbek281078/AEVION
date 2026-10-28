import { проксироватьСАдресом } from "@/lib/guestIpProxy";

/**
 * 28.10.2026 (находка Науки): события воронки /api/pricing/events шли на бэк через
 * rewrite /api-backend без адреса гостя, и бэк записывал ip = X-Real-IP = выход прокси
 * Vercel: 305 событий за час с 3–4 адресов. Обработчик сайта побеждает перезапись
 * (сторож guestProxyRoutesWin) и несёт настоящий адрес с ключом AEVION_EDGE_KEY —
 * бэк (rateLimit.clientIp, 258316164) принимает его только с верным ключом.
 * Только POST: чтение /events/day и прочие GET — админские, адрес гостя им не нужен.
 */
export const dynamic = "force-dynamic";

const путь = (req: Request) => new URL(req.url).pathname.replace(/^\/api-backend/, "");

export async function POST(req: Request): Promise<Response> {
  return проксироватьСАдресом(req, путь(req));
}
