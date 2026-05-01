// Email delivery for payer receipts via Resend.
// No-op when RESEND_API_KEY is unset — callers can ignore the result.

type SendArgs = {
  to: string;
  origin: string;
  link_id: string;
  amount_label: string;
  title: string;
  method?: string | null;
  last4?: string | null;
};

export async function sendReceiptEmail(
  args: SendArgs
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.to)) {
    return { ok: false, error: "invalid_email" };
  }

  const from = process.env.RESEND_FROM ?? "AEVION Payments <receipts@aevion.app>";
  const receiptUrl = `${args.origin}/r/${args.link_id}`;
  const subject = `Receipt · ${args.title} · ${args.amount_label}`;

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f8fafc; padding: 32px; color: #0f172a;">
    <div style="max-width: 540px; margin: 0 auto; background: #fff; border: 1px solid rgba(15,23,42,0.08); border-radius: 16px; padding: 30px;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.06em; color: #475569; text-transform: uppercase; margin-bottom: 6px;">AEVION Payments Rail</div>
      <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 18px; letter-spacing: -0.02em;">Receipt</h1>
      <div style="font-size: 36px; font-weight: 900; margin-bottom: 6px;">${escape(args.amount_label)}</div>
      <div style="font-size: 15px; color: #475569; margin-bottom: 22px;">${escape(args.title)}</div>
      <table style="width: 100%; font-size: 13px; color: #0f172a; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #94a3b8; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Receipt for</td><td style="padding: 6px 0; font-family: monospace;">${escape(args.link_id)}</td></tr>
        ${args.method ? `<tr><td style="padding: 6px 0; color: #94a3b8; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Method</td><td style="padding: 6px 0;">${escape(args.method)}</td></tr>` : ""}
        ${args.last4 ? `<tr><td style="padding: 6px 0; color: #94a3b8; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Card</td><td style="padding: 6px 0; font-family: monospace;">•••• ${escape(args.last4)}</td></tr>` : ""}
      </table>
      <a href="${receiptUrl}" style="display: inline-block; margin-top: 24px; padding: 12px 22px; background: #0d9488; color: #fff; border-radius: 10px; text-decoration: none; font-weight: 800;">View printable receipt</a>
      <p style="margin-top: 28px; font-size: 11px; color: #94a3b8; line-height: 1.5;">This receipt was issued by AEVION Payments Rail. Reply to this email if you did not authorize this payment.</p>
    </div>
  </body>
</html>`;

  const text = [
    `AEVION Payments Rail — Receipt`,
    ``,
    `${args.amount_label} — ${args.title}`,
    `Receipt id: ${args.link_id}`,
    args.method ? `Method: ${args.method}` : null,
    args.last4 ? `Card: •••• ${args.last4}` : null,
    ``,
    `View receipt: ${receiptUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: args.to, subject, html, text }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, error: `resend-${r.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
