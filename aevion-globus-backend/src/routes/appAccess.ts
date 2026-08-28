/**
 * /api/apps/access — какие поштучные подписки активны У ЗАПРОСИВШЕГО.
 *
 * GET /api/apps/access              (Bearer)  -> { apps: ["qventure", ...] }
 * GET /api/apps/access/check?app=…  (Bearer)  -> { active: true|false }
 *
 * ⚠️ 28.08.2026: РАНЬШЕ ОБЕ РУЧКИ БЫЛИ ПУБЛИЧНЫМИ И БРАЛИ ПОЧТУ ИЗ ЗАПРОСА.
 *
 * То есть кто угодно, зная чужой адрес, узнавал, за что человек платит:
 *
 *     GET /api/apps/access?email=someone@example.com
 *     -> {"apps":["healthai","qmelanin"]}
 *
 * Это персональные данные, и среди наших товаров есть связанные со здоровьем
 * («Анти-седина», HealthAI, QMelanin). Ограничителя частоты на маршруте не
 * было, то есть список адресов можно было проверить целиком.
 *
 * В прежнем комментарии решение объяснялось так: «same pattern as
 * /api/pricing/subscription/me». Проверил — это НЕВЕРНО: сосед отвечает 401
 * без токена. Обоснование ссылалось на образец, который ведёт себя обратно.
 *
 * Теперь почта берётся ИЗ ТОКЕНА и параметр `email` не читается вовсе:
 * подделать чужой ответ нельзя даже случайно. Единственный клиент — личный
 * кабинет — уже авторизован, ему добавлен заголовок.
 */

import { Router, type Request } from "express";
import jwt from "jsonwebtoken";
import { getPool } from "../lib/dbPool";
import { ensureAppSubscriptionTable } from "../lib/ensureAppSubscriptionTable";
import { getJwtSecret } from "../lib/authJwt";

export const appAccessRouter = Router();

/**
 * Почта запросившего — только из токена. Возвращает null, если токена нет
 * или он не разбирается; вызывающий отвечает 401.
 *
 * Параметр `email` из запроса СОЗНАТЕЛЬНО не читается: пока он читался,
 * ручка была оракулом «за что платит вот этот человек».
 */
function emailFromToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(auth.slice(7), getJwtSecret(), {
      algorithms: ["HS256"],
    }) as { email?: unknown };
    // Проверяем ТИП, а не только истинность. Подделать такой токен нельзя —
    // он подписан нашим секретом, — но нестроковое поле (объект, число)
    // уронило бы `.toLowerCase()` и дало 500 вместо честного 401. Отказ
    // должен выглядеть отказом, а не поломкой сервера.
    return typeof payload.email === "string" && payload.email.length > 0
      ? payload.email.toLowerCase()
      : null;
  } catch {
    return null;
  }
}


appAccessRouter.get("/", async (req, res) => {
  const email = emailFromToken(req);
  if (!email) return res.status(401).json({ error: "unauthorized" });

  try {
    const pool = getPool();
    await ensureAppSubscriptionTable(pool);
    const result = await pool.query(
      `SELECT "appSlug" FROM "AppSubscription" WHERE "email"=$1 AND "status"='active'`,
      [email],
    );
    return res.json({ apps: result.rows.map((r: { appSlug: string }) => r.appSlug) });
  } catch (err) {
    console.error("[appAccess] query error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "db error" });
  }
});

appAccessRouter.get("/check", async (req, res) => {
  const email = emailFromToken(req);
  if (!email) return res.status(401).json({ error: "unauthorized" });
  const app = String(req.query.app ?? "").trim().toLowerCase();
  if (!app) return res.status(400).json({ error: "app required" });

  try {
    const pool = getPool();
    await ensureAppSubscriptionTable(pool);
    const result = await pool.query(
      `SELECT 1 FROM "AppSubscription" WHERE "email"=$1 AND "appSlug"=$2 AND "status"='active' LIMIT 1`,
      [email, app],
    );
    return res.json({ active: result.rowCount! > 0 });
  } catch (err) {
    console.error("[appAccess] check error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "db error" });
  }
});
