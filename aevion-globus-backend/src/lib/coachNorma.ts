import type { Request, RequestHandler } from "express";
import { clientIp } from "./rateLimit";
import { denPoMestnomu } from "./denPoMestnomu";

/**
 * Спящая дневная норма ИИ-тренера CyberChess (решение оркестратора 13.10.2026,
 * по образцу гостевого пропуска Мультичата).
 *
 * Пока переменная FREE_COACH_PER_DAY не задана — поведение прежнее, ручки её
 * не замечают. Задана (целое ≥ 0) — каждый гость (по IP и по устройству) и
 * каждый вошедший (по sub) получает столько ответов тренера в день; сверх —
 * 402 с upgradeUrl на тариф CyberChess. Так решение основателя «тренер N в
 * день» включается одной переменной, без выкатки.
 *
 * День — календарный по Алматы (как у воронки), а не UTC: иначе норма
 * «обновлялась» бы в 05:00 утра по месту (класс bd, 13.10: день по UTC).
 * Счёт живёт в памяти процесса (как у Мультичата): перезапуск обнуляет —
 * граница честно названа, это норма вежливости, а не касса.
 */
export const ПЕРЕМЕННАЯ_НОРМЫ = "FREE_COACH_PER_DAY";
export const ССЫЛКА_НА_ТАРИФ = "/pricing?app=cyberchess";

/** null — норма спит (переменная не задана или не число). */
export function normaTreneraVDen(): number | null {
  const raw = process.env[ПЕРЕМЕННАЯ_НОРМЫ];
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** День нормы — общий помощник платформы (волна 109); имя оставлено ради вызывающих. */
export const denAlmaty = denPoMestnomu;

const счёт = new Map<string, number>();

function устройство(req: Request): string {
  return String(req.get("x-aevion-device") || (req.body as Record<string, unknown> | undefined)?.deviceId || "").trim().slice(0, 64);
}

/** Ключи, по которым один человек считается одним: вошедший — по sub, гость — по IP и устройству. */
export function klyuchiNormy(req: Request, день: string = denAlmaty()): string[] {
  const sub = (req as { auth?: { sub?: string } }).auth?.sub;
  if (sub) return [`u:${sub}:${день}`];
  const out = [`ip:${clientIp(req)}:${день}`];
  const dev = устройство(req);
  if (dev) out.push(`dev:${dev}:${день}`);
  return out;
}

export interface OstatokNormy { лимит: number; использовано: number; осталось: number }

/** Ничего не тратит. null — норма спит. */
export function ostatokNormy(req: Request): OstatokNormy | null {
  const лимит = normaTreneraVDen();
  if (лимит === null) return null;
  const использовано = Math.max(0, ...klyuchiNormy(req).map((k) => счёт.get(k) ?? 0));
  return { лимит, использовано, осталось: Math.max(0, лимит - использовано) };
}

/** Тратит одну единицу. Зовётся, когда человека ПУСКАЮТ. */
export function zaschitatNormu(req: Request): void {
  for (const k of klyuchiNormy(req)) счёт.set(k, (счёт.get(k) ?? 0) + 1);
}

/** Для тестов: новый день. */
export function sbrositNormu(): void {
  счёт.clear();
}

/**
 * Слой перед ручками тренера. Спит — пропускает без следа. Проснулся —
 * при исчерпании отвечает 402 с адресом тарифа, иначе списывает и пропускает.
 */
export const normaTrenera: RequestHandler = (req, res, next) => {
  const о = ostatokNormy(req);
  if (о === null) return next();
  if (о.осталось <= 0) {
    res.status(402).json({
      error: "coach_quota_exhausted",
      message: `Бесплатная норма тренера на сегодня исчерпана (${о.лимит} в день). Подписка CyberChess снимает ограничение.`,
      limit: о.лимит,
      used: о.использовано,
      resetsAt: "полночь по Алматы",
      upgradeUrl: ССЫЛКА_НА_ТАРИФ,
    });
    return;
  }
  zaschitatNormu(req);
  next();
};
