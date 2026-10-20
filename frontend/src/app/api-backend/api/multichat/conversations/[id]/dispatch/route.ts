// Гостевые вызовы Мультичата: свой обработчик вместо rewrite, чтобы бэкенд увидел
// адрес гостя, а не адрес Vercel (lib/guestIpProxy.ts). 20.10.2026, замер на проде:
// новое окно браузера с того же адреса снова получало 2 бесплатных вопроса — IP-ключ
// нормы (lib/multichatGuestPass) каждый раз был адресом другого узла Vercel.
import { проксироватьСАдресом } from "@/lib/guestIpProxy";

export const dynamic = "force-dynamic";
// Веер трёх агентов идёт 15–18 с (замер 20.10), бывает дольше: потолок функции задан явно,
// у rewrite его не было, и полагаться на умолчание плана Vercel нельзя.
export const maxDuration = 60;

const путь = (req: Request) => new URL(req.url).pathname.replace(/^\/api-backend/, "");

export async function POST(req: Request): Promise<Response> {
  return проксироватьСАдресом(req, путь(req));
}
