// Гостевые вызовы Мультичата: свой обработчик вместо rewrite, чтобы бэкенд увидел
// адрес гостя, а не адрес Vercel (lib/guestIpProxy.ts). 20.10.2026, замер на проде:
// новое окно браузера с того же адреса снова получало 2 бесплатных вопроса — IP-ключ
// нормы (lib/multichatGuestPass) каждый раз был адресом другого узла Vercel.
import { проксироватьСАдресом } from "@/lib/guestIpProxy";

export const dynamic = "force-dynamic";

const путь = (req: Request) => new URL(req.url).pathname.replace(/^\/api-backend/, "");

export async function GET(req: Request): Promise<Response> {
  return проксироватьСАдресом(req, путь(req));
}

export async function POST(req: Request): Promise<Response> {
  return проксироватьСАдресом(req, путь(req));
}
