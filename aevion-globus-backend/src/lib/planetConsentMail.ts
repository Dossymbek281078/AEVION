import type { ConstitutionEmailPayload } from "./constitutionBrevo";
import { marketingUnsubscribeUrl } from "./marketingConsent";
import { unsubContact } from "./waitlistUnsubToken";
import { PLANET_TERM_PRICE, CHESS_YEARLY_USD } from "../data/pricing";

/**
 * Письмо о кассе «Планета» тем, кто при регистрации поставил галочку
 * «новости и предложения» (5.11.2026). Только строит письмо — НИЧЕГО не шлёт:
 * отправка идёт через sendBrevoEmail отдельным, осознанным шагом.
 *
 * Цены берутся из тех же констант, что отдаёт GET /api/pricing (data/pricing.ts),
 * чтобы письмо не разошлось с кассой. Продукты — только Планета и шахматы.
 * Нет секрета отписки — письмо не строится: рассылка без рабочей отписки хуже,
 * чем отсутствие рассылки.
 */

export const PLANET_MAIL_LINK = "https://aevion.app/pricing?c=mail-planet";

export function buildPlanetConsentEmail(email: string): ConstitutionEmailPayload {
  const unsub = marketingUnsubscribeUrl(email);
  if (!unsub) {
    throw new Error("planetConsentMail: unsubscribe secret is not configured — email is not built");
  }
  const contact = unsubContact();
  const lite = PLANET_TERM_PRICE.lite;
  const max = PLANET_TERM_PRICE.max;
  const chess = CHESS_YEARLY_USD;

  const subject = `AEVION Планета: от $${lite} в месяц, шахматы — $${chess} в год / AEVION Planet is open`;

  const textContent = [
    "Здравствуйте!",
    "",
    "Вы оставили согласие на новости и предложения AEVION. Касса открыта.",
    "",
    `AEVION Планета — все продукты в одной подписке: $${lite} за месяц без срока; при подписке на 12 месяцев — $${max} в месяц.`,
    `CyberChess (шахматы) — отдельно, $${chess} в год.`,
    "",
    `Цены и оформление: ${PLANET_MAIL_LINK}`,
    "",
    "---",
    "",
    "Hello!",
    "",
    "You agreed to receive AEVION news and offers. Checkout is open.",
    "",
    `AEVION Planet - all products in one subscription: $${lite} per month with no term; $${max} per month on a 12-month term.`,
    `CyberChess is sold separately: $${chess} per year.`,
    "",
    `Prices and checkout: ${PLANET_MAIL_LINK}`,
    "",
    "---",
    `Отписаться / Unsubscribe: ${unsub}`,
    `Контакт / Contact: ${contact}`,
  ].join("\n");

  const htmlContent = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
<p>Здравствуйте!</p>
<p>Вы оставили согласие на новости и предложения AEVION. Касса открыта.</p>
<ul>
<li><b>AEVION Планета</b> — все продукты в одной подписке: $${lite} за месяц без срока; при подписке на 12 месяцев — $${max} в месяц.</li>
<li><b>CyberChess</b> (шахматы) — отдельно, $${chess} в год.</li>
</ul>
<p><a href="${PLANET_MAIL_LINK}">Цены и оформление</a></p>
<hr>
<p>Hello!</p>
<p>You agreed to receive AEVION news and offers. Checkout is open.</p>
<ul>
<li><b>AEVION Planet</b> - all products in one subscription: $${lite} per month with no term; $${max} per month on a 12-month term.</li>
<li><b>CyberChess</b> is sold separately: $${chess} per year.</li>
</ul>
<p><a href="${PLANET_MAIL_LINK}">Prices and checkout</a></p>
<hr>
<p style="font-size:12px;color:#555"><a href="${unsub}">Отписаться / Unsubscribe</a> &middot; Контакт / Contact: ${contact}</p>
</body></html>`;

  return {
    to: [{ email }],
    subject,
    htmlContent,
    textContent,
    replyTo: { email: contact },
    tags: ["planet-consent-mail"],
  };
}
