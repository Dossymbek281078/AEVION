/**
 * Brevo (formerly Sendinblue) email helper for Constitution.
 *
 * Env:
 *   BREVO_API_KEY       — from Brevo dashboard → Account → API Keys
 *   BREVO_SENDER_EMAIL  — verified sender (default: noreply@aevion.app)
 *   BREVO_SENDER_NAME   — display name (default: AEVION Constitution)
 *
 * Used by:
 *   - constitutionWaitlist.ts: sendWeeklyDigest() when Pro launches
 *   - Future transactional emails: welcome, upgrade confirmation, cert-issued
 */

const BREVO_API = "https://api.brevo.com/v3";

type BrevoRecipient = { email: string; name?: string };

export type ConstitutionEmailPayload = {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: BrevoRecipient;
  tags?: string[];
};

async function sendBrevoEmail(payload: ConstitutionEmailPayload): Promise<{
  ok: boolean;
  messageId?: string;
  error?: string;
}> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[Brevo] BREVO_API_KEY not set — email not sent");
    return { ok: false, error: "BREVO_API_KEY missing" };
  }
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@aevion.app";
  const senderName  = process.env.BREVO_SENDER_NAME  || "AEVION Constitution";

  const body = {
    sender: { email: senderEmail, name: senderName },
    to: payload.to,
    subject: payload.subject,
    htmlContent: payload.htmlContent,
    textContent: payload.textContent,
    replyTo: payload.replyTo,
    tags: payload.tags,
  };

  try {
    const r = await fetch(`${BREVO_API}/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, error: `Brevo HTTP ${r.status}: ${text.slice(0, 200)}` };
    }
    const j = await r.json() as { messageId?: string };
    return { ok: true, messageId: j.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/* ─── Constitution-specific email templates ──────────────────────── */

export function buildWaitlistConfirmEmail(email: string): ConstitutionEmailPayload {
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b1736;color:#e7ecf8;border-radius:12px">
      <div style="color:#d4af37;font-size:24px;font-weight:900;margin-bottom:8px">AEVION Constitution</div>
      <p style="margin:0 0 16px">Ты в списке ожидания Pro.</p>
      <p style="color:#9aa3c0;margin:0 0 16px">
        Как только Constitution Pro запустится, ты получишь письмо с
        <strong style="color:#f472b6">30% скидкой на первый месяц</strong> — только для ранней подписки.
      </p>
      <p style="color:#9aa3c0;margin:0 0 24px">
        Пока — пробуй Free: <a href="https://aevion.app/constitution" style="color:#22d3ee">aevion.app/constitution</a>
      </p>
      <hr style="border:none;border-top:1px solid rgba(212,175,55,0.2);margin-bottom:16px">
      <p style="color:#64748b;font-size:11px;margin:0">
        Ты получил это письмо потому что подписался на waitlist на aevion.app/constitution/pricing.<br>
        <a href="https://aevion.app/constitution/waitlist/unsubscribe?email=${encodeURIComponent(email)}" style="color:#64748b">Отписаться</a>
      </p>
    </div>
  `;
  return {
    to: [{ email }],
    subject: "📨 Ты в листе ожидания Constitution Pro",
    htmlContent: html,
    textContent: `Ты в списке ожидания Constitution Pro. Откроем — сразу письмо с 30% скидкой. Пока: aevion.app/constitution`,
    tags: ["constitution", "waitlist-confirm"],
  };
}

export function buildWeeklyDigestEmail(
  recipients: Array<{ email: string }>,
  topArtifacts: Array<{ title: string; regimeName: string; url: string; votes: number }>,
  weekOf: string,
): ConstitutionEmailPayload {
  const list = topArtifacts
    .map(
      (a, i) => `
      <tr>
        <td style="padding:8px 4px;color:#d4af37;font-weight:700">#${i + 1}</td>
        <td style="padding:8px 4px">
          <a href="${a.url}" style="color:#22d3ee">${a.title}</a>
        </td>
        <td style="padding:8px 4px;color:#9aa3c0">${a.regimeName}</td>
        <td style="padding:8px 4px;color:#f472b6;text-align:right">👍 ${a.votes}</td>
      </tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b1736;color:#e7ecf8;border-radius:12px">
      <div style="color:#d4af37;font-size:22px;font-weight:900;margin-bottom:4px">AEVION Constitution</div>
      <div style="color:#9aa3c0;font-size:12px;margin-bottom:20px">Weekly digest · ${weekOf}</div>
      <h2 style="color:#f5d27a;font-size:18px;margin:0 0 12px">Топ-5 конституций недели</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid rgba(212,175,55,0.2)">
            <th style="padding:4px;text-align:left;color:#9aa3c0;font-size:11px">#</th>
            <th style="padding:4px;text-align:left;color:#9aa3c0;font-size:11px">Сценарий</th>
            <th style="padding:4px;text-align:left;color:#9aa3c0;font-size:11px">Режим</th>
            <th style="padding:4px;text-align:right;color:#9aa3c0;font-size:11px">Голоса</th>
          </tr>
        </thead>
        <tbody>${list}</tbody>
      </table>
      <div style="margin-top:20px;text-align:center">
        <a href="https://aevion.app/constitution/leaderboard" style="display:inline-block;padding:10px 20px;background:#d4af37;color:#0b1736;font-weight:700;border-radius:8px;text-decoration:none">
          Смотреть все →
        </a>
      </div>
      <hr style="border:none;border-top:1px solid rgba(212,175,55,0.2);margin:20px 0">
      <p style="color:#64748b;font-size:11px;margin:0">
        Constitution Weekly · 1 письмо в неделю ·
        <a href="https://aevion.app/constitution/pricing" style="color:#64748b">Upgrade to Pro</a>
      </p>
    </div>
  `;
  return {
    to: recipients.map((r) => ({ email: r.email })),
    subject: `📊 Топ-5 конституций недели · ${weekOf}`,
    htmlContent: html,
    tags: ["constitution", "weekly-digest"],
  };
}

/* ─── Exported send functions ─────────────────────────────────────── */

export async function sendWaitlistConfirm(email: string): Promise<void> {
  const payload = buildWaitlistConfirmEmail(email);
  const result = await sendBrevoEmail(payload);
  if (!result.ok) {
    console.error("[Brevo] waitlist-confirm failed:", result.error);
  }
}

export async function sendWeeklyDigestEmail(
  recipients: Array<{ email: string }>,
  topArtifacts: Array<{ title: string; regimeName: string; url: string; votes: number }>,
  weekOf: string,
): Promise<{ sent: number; errors: number }> {
  if (!recipients.length) return { sent: 0, errors: 0 };
  // Brevo allows up to 50 recipients per send; batch if needed
  const BATCH = 50;
  let sent = 0;
  let errors = 0;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const payload = buildWeeklyDigestEmail(batch, topArtifacts, weekOf);
    const result = await sendBrevoEmail(payload);
    if (result.ok) sent += batch.length;
    else errors += batch.length;
  }
  return { sent, errors };
}
