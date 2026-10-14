import { sendBrevoEmail } from "./constitutionBrevo";

/**
 * Доставка письма через Resend ≠ приём в очередь (волна 135б, 14.10.2026).
 *
 * Повод: письмо гостю DevHub 14.10 00:02 вернулось «bounced» (приёмный сервер: 551 5.7.1 — IP общего
 * пула Amazon SES в чёрном списке SpamCop), а ручка и журнал записали guestMailed:true. Resend отвечает
 * «принято», отказ приходит позже событием. Поэтому через минуту спрашиваем состояние письма и при
 * отказе шлём то же письмо запасным каналом (Brevo — он уже держит лист ожидания).
 *
 * Молчать нельзя (§16): и повтор, и его отказ пишутся в журнал сервера.
 */
export type PismoDlyaPovtora = { to: string; subject: string; html: string; text: string };

/** События Resend, после которых письмо точно не дошло и его надо послать заново. */
export function nuzhenPovtor(lastEvent: string | null | undefined): boolean {
  return lastEvent === "bounced" || lastEvent === "failed";
}

export async function sostoyanieResend(id: string, key: string, f: typeof fetch = fetch): Promise<string | null> {
  const r = await f(`https://api.resend.com/emails/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as { last_event?: string } | null;
  return j?.last_event ?? null;
}

export async function proveritIPovtorit(a: {
  id: string; pismo: PismoDlyaPovtora; key: string;
  f?: typeof fetch; brevo?: typeof sendBrevoEmail;
}): Promise<{ lastEvent: string | null; повтор: boolean; brevoOk?: boolean }> {
  const lastEvent = await sostoyanieResend(a.id, a.key, a.f);
  if (!nuzhenPovtor(lastEvent)) return { lastEvent, повтор: false };
  const b = await (a.brevo ?? sendBrevoEmail)({
    to: [{ email: a.pismo.to }],
    subject: a.pismo.subject,
    htmlContent: a.pismo.html,
    textContent: a.pismo.text,
    tags: ["resend-bounce-retry"],
  });
  const строка = `[почта] Resend ${a.id} → ${lastEvent}; повтор через Brevo для ${a.pismo.to}: ${b.ok ? "ушёл" : "НЕ ушёл: " + (b.error ?? "без причины")}`;
  if (b.ok) console.log(строка); else console.error(строка);
  return { lastEvent, повтор: true, brevoOk: b.ok };
}

/** Через cherezMs (60 с) проверить доставку и при отказе повторить через Brevo. Без id/ключа — тишина с записью. */
export function zaplanirovatProverkuDostavki(a: { id?: string; pismo: PismoDlyaPovtora; cherezMs?: number }): boolean {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!a.id || !key) { console.warn(`[почта] проверка доставки не запланирована для ${a.pismo.to}: ${!a.id ? "нет id письма" : "нет ключа Resend"}`); return false; }
  const id = a.id;
  const t = setTimeout(() => {
    proveritIPovtorit({ id, pismo: a.pismo, key }).catch((e) => console.error("[почта] проверка доставки не выполнена:", e instanceof Error ? e.message : e));
  }, a.cherezMs ?? 60_000);
  (t as { unref?: () => void }).unref?.();
  return true;
}
