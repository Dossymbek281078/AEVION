import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { verifyBearerOptional } from "../lib/authJwt";
import { makeServiceCapture } from "../lib/sentry/platform";

/**
 * Приём обращений со страницы помощи.
 *
 * Зачем эта ручка появилась. `POST /api/help/contact` вызывалась формой с 12.08
 * и отвечала 404 — маршрута не существовало. Форма написана предусмотрительно:
 * не вышло через ручку — открывает почтовый клиент. Но эта «запасная» ветка
 * срабатывала ВСЕГДА, то есть была единственной, и вела на личный ящик
 * основателя. А у домена `aevion.app` нет записей MX, поэтому адреса вида
 * support@/hello@/billing@ на сайте писем не принимают вовсе.
 *
 * Итог: человек, у которого возник вопрос перед покупкой, писал в никуда либо
 * зависел от того, настроен ли у него почтовый клиент.
 *
 * Здесь обращение просто СОХРАНЯЕТСЯ. Почта не нужна.
 *
 * Главное правило этого файла: ответ «принято» даётся ТОЛЬКО когда запись
 * действительно легла в базу. Если базы нет — 503 и честный текст, а не
 * `{ok:true}`. Молчаливый успех здесь стоил бы дороже отказа: человек уверен,
 * что его услышали, и ждёт ответа, которого не будет.
 */

export const helpContactRouter = Router();
const capture = makeServiceCapture("help-contact");

const contactLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "help:contact",
  message: "Слишком часто. Подождите минуту и отправьте снова.",
});

let tableReady = false;
let dbAvailable = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  try {
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS help_contact (
        "id"        TEXT PRIMARY KEY,
        "topic"     TEXT,
        "subject"   TEXT,
        "email"     TEXT,
        "message"   TEXT NOT NULL,
        "lang"      TEXT,
        "page"      TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_help_contact_created
        ON help_contact ("createdAt" DESC);
    `);
    dbAvailable = true;
  } catch (err) {
    dbAvailable = false;
    // Слепота не бывает молчаливой: причина обязана быть названа.
    console.error("[help/contact] таблица недоступна:", err instanceof Error ? err.message : err);
  }
  tableReady = true;
}

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

helpContactRouter.post("/contact", contactLimiter, async (req: Request, res: Response) => {
  try {
    await ensureTable();

    const message = str(req.body?.message, 5000);
    if (!message) {
      // Ошибка ЗАПРОСА — 400, а не 500: иначе обычная пустая форма поднимала бы
      // тревогу как авария сервера.
      return res.status(400).json({ error: "message_required" });
    }

    if (!dbAvailable) {
      return res.status(503).json({
        error: "storage_unavailable",
        stored: false,
        message: "Сейчас не можем принять обращение. Попробуйте позже.",
      });
    }

    const id = crypto.randomUUID();
    try {
      await getPool().query(
        `INSERT INTO help_contact ("id","topic","subject","email","message","lang","page")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, str(req.body?.topic, 60), str(req.body?.subject, 200),
         str(req.body?.email, 200), message, str(req.body?.lang, 8), str(req.body?.page, 500)],
      );
    } catch (err) {
      // Отказ ХРАНИЛИЩА — это 503 «попробуйте позже», а не 500 «у нас сломалось».
      // Разница для человека существенная: первое обещает, что попытка имеет
      // смысл, второе нет.
      //
      // Ловится здесь отдельно, потому что проверка доступности выше делается
      // ОДИН раз за жизнь процесса: после первого успешного обращения таблица
      // помечена готовой, и позднейший отказ базы прошёл бы мимо неё. Этот
      // пробел нашёл тест, а не я.
      // НЕ защёлка: следующий запрос проверит хранилище заново.
      //
      // Первая версия ставила dbAvailable = false и оставляла так до
      // перезапуска процесса — кратковременный сбой базы отключал бы форму
      // насовсем. Это класс «сбой навсегда вместо кулдауна»: отказ должен
      // истекать сам, иначе одна секунда неудачи стоит суток тишины.
      tableReady = false;
      dbAvailable = false;
      capture(err);
      console.error("[help/contact] запись не удалась:", err instanceof Error ? err.message : err);
      return res.status(503).json({
        error: "storage_unavailable",
        stored: false,
        message: "Сейчас не можем принять обращение. Попробуйте позже.",
      });
    }

    // `stored` — по ФАКТУ записи. Страница читает именно его, а не код ответа:
    // ровно ту небрежность (успех показан независимо от факта) пришлось чинить
    // в подтверждении адреса 21.08.
    res.status(201).json({ ok: true, stored: true, id });
  } catch (err) {
    capture(err);
    console.error("[help/contact] не сохранено:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "contact_failed", stored: false });
  }
});

/** Сколько обращений пришло — чтобы было видно, что канал живой. */
helpContactRouter.get("/contact/health", async (_req: Request, res: Response) => {
  await ensureTable();
  if (!dbAvailable) return res.json({ ok: false, storage: "unavailable", total: null });
  try {
    const r = await getPool().query(`SELECT count(*)::int AS n FROM help_contact`);
    // total — число, а не «0 по умолчанию»: ноль и «спросить не удалось» разные вещи.
    return res.json({ ok: true, storage: "db", total: (r.rows[0] as { n: number }).n });
  } catch {
    return res.json({ ok: false, storage: "error", total: null });
  }
});
