/**
 * Адрес гостя от прокси сайта (Vercel → бэк) и счёт принятых/отвергнутых.
 *
 * 28.10.2026: вынесено из freeActionQuota.ts. Повод — находка Науки: в /api/pricing/events
 * поле ip = X-Real-IP, и все события часа (305) приходили с 3–4 адресов — это выходы
 * прокси Vercel (aevion.app → api), а не люди. Тот же адрес ложился в ключи лимитов и
 * квот через rateLimit.clientIp, то есть лимит был общим на всех посетителей сайта.
 * clientIp теперь сперва берёт ЭТОТ адрес — он подписан секретом AEVION_EDGE_KEY,
 * который знает только прокси сайта (frontend/src/lib/guestIpProxy.ts); без ключа или
 * с чужим ключом заголовок не принимается, и тогда — прежняя логика (X-Real-IP за Railway).
 * Модуль без зависимостей от rateLimit — иначе цикл freeActionQuota → rateLimit → …
 */
import type { Request } from "express";
import { timingSafeEqual } from "node:crypto";

/**
 * Сколько раз адрес гостя от прокси сайта принят и почему отвергнут — с
 * перезапуска процесса. Без этого «счёт гостя всё ещё общий» не отличить:
 * заголовки до бэкенда не доходят, или секрет не совпал (замер 13.10.2026).
 */
const счётАдреса = { accepted: 0, keyMismatch: 0, noKey: 0, badAddress: 0 };

export function сводкаАдресаГостя(): { edgeKeyConfigured: boolean } & typeof счётАдреса {
  return { edgeKeyConfigured: (process.env.AEVION_EDGE_KEY || "").length >= 16, ...счётАдреса };
}

/** Адрес гостя от прокси сайта — только при совпавшем секрете AEVION_EDGE_KEY. */
export function адресОтПроксиСайта(req: Pick<Request, "headers">): string | null {
  const секрет = process.env.AEVION_EDGE_KEY || "";
  if (секрет.length < 16) return null;
  const ключ = req.headers["x-aevion-edge-key"];
  if (typeof ключ !== "string") {
    счётАдреса.noKey += 1;
    return null;
  }
  const а = Buffer.from(ключ);
  const б = Buffer.from(секрет);
  if (а.length !== б.length || !timingSafeEqual(а, б)) {
    счётАдреса.keyMismatch += 1;
    return null;
  }
  const адрес = req.headers["x-aevion-client-ip"];
  const чистый = typeof адрес === "string" ? адрес.trim() : "";
  if (!/^[0-9a-fA-F.:]{3,45}$/.test(чистый)) {
    счётАдреса.badAddress += 1;
    return null;
  }
  счётАдреса.accepted += 1;
  return чистый;
}
