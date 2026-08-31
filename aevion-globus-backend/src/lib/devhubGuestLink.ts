import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getPool } from "./dbPool";
import { canSendEmail, send } from "./build/email";

/**
 * Связывание анонимного гостя DevHub с его покупкой.
 *
 * ЗАЧЕМ. Модуль намеренно работает без входа, а магазин знает покупателя
 * только по почте. Вебхук пишет тариф в DevHubEmailTier и, если аккаунт с
 * такой почтой есть, сразу выдаёт доступ. У гостя аккаунта нет — и человек,
 * заплативший $149, видел бы «Free plan».
 *
 * ПОЧЕМУ НЕ ПРОСТО ФОРМА «вот мой адрес». Адрес покупателя знает любой, кому
 * он его называл. Форма без подтверждения была бы способом присвоить чужую
 * покупку. Поэтому связывание подтверждается письмом НА ТОТ ЖЕ адрес.
 *
 * ПОЧЕМУ ОТВЕТ ВСЕГДА ОДИНАКОВ. Если отвечать «письмо отправлено» только
 * когда покупка есть, форма превращается в способ узнать, кто у нас покупал.
 * Наружу уходит одна фраза при любом исходе.
 */

const TTL_MINUTES = 30;

export type LinkRequestOutcome =
  | "sent"
  | "no_purchase"
  | "transport_down"
  | "storage_down";

function normalize(email: string): string {
  return String(email || "").trim().toLowerCase();
}

/** Разрешён ли адрес к связыванию: у него должна быть НЕ бесплатная покупка. */
async function paidTierFor(email: string): Promise<string | null> {
  const pool = getPool();
  const r = await pool.query(
    `SELECT "tier" FROM "DevHubEmailTier" WHERE "email" = $1 LIMIT 1`,
    [email],
  );
  const tier = r.rows[0]?.tier ?? null;
  return tier && tier !== "free" ? String(tier) : null;
}

export async function requestGuestLink(
  guestId: string,
  emailRaw: string,
  siteBase: string,
): Promise<LinkRequestOutcome> {
  const email = normalize(emailRaw);
  if (!email || !email.includes("@")) return "no_purchase";

  let tier: string | null;
  try {
    tier = await paidTierFor(email);
  } catch (err) {
    // Упавшее чтение — это НЕ «покупки нет». Молчаливое превращение отказа
    // базы в отрицательный ответ оставило бы платящего без доступа, и никто
    // бы не узнал: снаружи это неотличимо от честного «такой покупки нет».
    console.error("[devhub/link] чтение тарифа не удалось:", err instanceof Error ? err.message : err);
    return "storage_down";
  }
  if (!tier) return "no_purchase";

  if (!canSendEmail()) {
    // Делать вид, что письмо ушло, нельзя: человек будет ждать его вечно.
    console.error("[devhub/link] транспорт почты не настроен — письмо не отправлено");
    return "transport_down";
  }

  const plaintext = crypto.randomBytes(24).toString("base64url");
  const hash = await bcrypt.hash(plaintext, 10);
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + TTL_MINUTES * 60_000);

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO "DevHubGuestLinkToken" ("id","guestId","email","tokenHash","expiresAt")
       VALUES ($1,$2,$3,$4,$5)`,
      [id, guestId, email, hash, expires],
    );
  } catch (err) {
    console.error("[devhub/link] токен не сохранён:", err instanceof Error ? err.message : err);
    return "storage_down";
  }

  const url =
    siteBase.replace(/[/]+$/, "") +
    "/devhub/link?id=" + encodeURIComponent(id) + "&token=" + encodeURIComponent(plaintext);

  const ok = await send(
    email,
    "Доступ к DevHub Studio Pro",
    [
      "<h2>Подключаем вашу покупку</h2>",
      "<p>Вы попросили связать эту покупку с браузером, в котором работаете.</p>",
      "<p><a href=" + JSON.stringify(url) + ">Подтвердить</a></p>",
      "<p>Ссылка действует " + TTL_MINUTES + " минут и работает только в том браузере, откуда её запросили.</p>",
      "<p style=\"font-size:12px;color:#64748b\">Если вы этого не просили — просто не открывайте ссылку. Без перехода ничего не изменится.</p>",
    ].join(""),
  );
  if (!ok) {
    console.error("[devhub/link] отправка письма не удалась, адрес:", email);
    return "transport_down";
  }
  return "sent";
}

export type LinkConfirmOutcome = "linked" | "invalid" | "storage_down";

export async function confirmGuestLink(
  id: string,
  token: string,
  guestId: string,
): Promise<LinkConfirmOutcome> {
  if (!id || !token || !guestId) return "invalid";
  const pool = getPool();
  let row: { guestId: string; email: string; tokenHash: string; expiresAt: Date; usedAt: Date | null } | undefined;
  try {
    const r = await pool.query(
      `SELECT "guestId","email","tokenHash","expiresAt","usedAt"
         FROM "DevHubGuestLinkToken" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    row = r.rows[0];
  } catch (err) {
    console.error("[devhub/link] чтение токена не удалось:", err instanceof Error ? err.message : err);
    return "storage_down";
  }
  if (!row) return "invalid";
  if (row.usedAt) return "invalid";
  if (new Date(row.expiresAt).getTime() < Date.now()) return "invalid";
  // Ссылка действительна только в том браузере, откуда её запросили: иначе
  // письмо, попавшее к постороннему, привязало бы покупку к ЕГО гостю.
  if (row.guestId !== guestId) return "invalid";
  if (!(await bcrypt.compare(token, row.tokenHash))) return "invalid";

  try {
    await pool.query(
      `INSERT INTO "DevHubGuestEmail" ("guestId","email") VALUES ($1,$2)
       ON CONFLICT ("guestId") DO UPDATE SET "email" = $2, "linkedAt" = NOW()`,
      [guestId, row.email],
    );
    await pool.query(`UPDATE "DevHubGuestLinkToken" SET "usedAt" = NOW() WHERE "id" = $1`, [id]);
  } catch (err) {
    console.error("[devhub/link] связывание не сохранено:", err instanceof Error ? err.message : err);
    return "storage_down";
  }
  return "linked";
}
