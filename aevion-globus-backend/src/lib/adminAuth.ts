import type { Request } from "express";
import { verifyBearerOptional } from "./authJwt";

/**
 * «Этот запрос от администратора?» — ОДНА реализация на платформу.
 *
 * Вынесено 30.08.2026 из `routes/constitutionFunnel.ts`, где проверка жила
 * локально. Понадобилась вторая — в сводке расхода QReal, — и копировать
 * решение об авторизации во второй файл нельзя: две копии одного действия
 * расходятся молча, и разойдутся они в ту сторону, где кто-то ослабил
 * условие ради своего случая.
 *
 * Правило допуска не менялось при переносе: роль `admin` в токене ЛИБО адрес
 * в списке `CONSTITUTION_ADMIN_ALLOWLIST`. Список читается при каждом вызове, а
 * не при загрузке модуля: иначе переменная, заданная после старта, не
 * подействовала бы до перезапуска.
 */
export function adminEmails(): string[] {
  // Имя переменной и УМОЛЧАНИЕ перенесены дословно из прежнего места. При
  // выносе я сперва придумал правдоподобное имя по памяти — с ним список стал
  // бы пустым, и основатель потерял бы собственный доступ. Ровно тот дрейф,
  // ради предотвращения которого проверка и выносится в одно место.
  return (process.env.CONSTITUTION_ADMIN_ALLOWLIST || "yahiin1978@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminRequest(req: Request): boolean {
  const payload = verifyBearerOptional(req);
  if (!payload) return false;
  const p = payload as Record<string, unknown>;
  if (p.role === "admin") return true;
  if (typeof p.email === "string" && adminEmails().includes(p.email.toLowerCase())) {
    return true;
  }
  return false;
}
