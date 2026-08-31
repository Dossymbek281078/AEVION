import type { Request } from "express";
import { verifyBearerOptional } from "./authJwt";

/**
 * «Этот запрос от администратора?» — ОДНА реализация на платформу.
 *
 * Сведено 30.08.2026 из ДВУХ самостоятельных копий:
 *
 *   routes/constitutionFunnel.ts   isAdmin(req): boolean
 *   routes/constitutionAdmin.ts    isAdmin(req): { ok, reason, email }
 *
 * Копировать решение об авторизации нельзя: копии расходятся молча, и
 * разойдутся в ту сторону, где кто-то ослабил условие ради своего случая.
 *
 * ФОРМА ВЗЯТА БОГАТАЯ, и это не вкусовщина. Верни общая функция `boolean` —
 * поля `reason` и `email` исчезли бы у второго потребителя, а `tsc` поймал бы
 * НЕ ВСЁ: `reason` уходит в `res.json`, а тело ответа не типизировано.
 * Расширение переживается молча, сужение нет.
 *
 * Имя переменной и УМОЛЧАНИЕ перенесены дословно из обеих копий (они совпадали).
 * При первом выносе я написал имя по памяти, и оно было другим. Ошибка здесь
 * тише, чем кажется: доступ у основателя остался бы по умолчанию, а у всех,
 * кого он добавил переменной, пропал бы молча — и проверка «я вхожу» прошла бы
 * успешно.
 *
 * Список читается при КАЖДОМ вызове, а не при загрузке модуля: иначе
 * переменная, заданная после старта, не подействовала бы до перезапуска.
 */

export type AdminVerdict = { ok: boolean; reason: string; email: string | null };

export function adminAllowlist(): string[] {
  return (process.env.CONSTITUTION_ADMIN_ALLOWLIST || "yahiin1978@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function checkAdmin(req: Request): AdminVerdict {
  const payload = verifyBearerOptional(req);
  if (!payload) return { ok: false, reason: "no-token", email: null };
  const p = payload as Record<string, unknown>;
  const email = typeof p.email === "string" ? p.email.toLowerCase() : null;
  if (p.role === "admin") return { ok: true, reason: "jwt-role", email };
  if (email && adminAllowlist().includes(email)) {
    return { ok: true, reason: "allowlist", email };
  }
  return { ok: false, reason: "denied", email };
}

/** Короткая форма для тех, кому нужен только ответ «да/нет». */
export function isAdminRequest(req: Request): boolean {
  return checkAdmin(req).ok;
}
