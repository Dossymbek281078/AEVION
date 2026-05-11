/**
 * Planning-module waitlist confirmation email.
 *
 * Sent fire-and-forget after a successful waitlist insert. Uses SMTP via
 * nodemailer (Brevo, Gmail, Mailgun, anything). Silently skips if SMTP isn't
 * configured — never blocks the HTTP response.
 *
 * Required env (all optional):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

import nodemailer from "nodemailer";

const FROM = process.env.SMTP_FROM || "AEVION <noreply@aevion.app>";
const BASE = process.env.FRONTEND_URL?.replace(/\/+$/, "") || "https://aevion.app";

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user, pass },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#020617; color:#e2e8f0; margin:0; padding:24px; }
  .card { max-width:560px; margin:0 auto; background:#0f172a; border-radius:16px; padding:32px; border:1px solid rgba(255,255,255,0.08); }
  .logo { font-size:13px; font-weight:800; color:#22d3ee; letter-spacing:0.08em; margin-bottom:24px; text-transform:uppercase; }
  h2 { margin:0 0 12px; font-size:22px; color:#f8fafc; }
  p { margin:0 0 16px; line-height:1.6; color:#cbd5e1; font-size:14px; }
  .btn { display:inline-block; background:#22d3ee; color:#06292e; font-weight:700; font-size:14px; padding:12px 24px; border-radius:10px; text-decoration:none; margin-top:8px; }
  .muted { font-size:12px; color:#475569; margin-top:24px; }
  .pill { display:inline-block; background:rgba(34,211,238,0.12); border:1px solid rgba(34,211,238,0.4); color:#67e8f9; font-size:11px; font-weight:600; padding:4px 10px; border-radius:999px; letter-spacing:0.05em; text-transform:uppercase; }
</style>
</head>
<body><div class="card">
  <div class="logo">AEVION</div>
  ${body}
  <p class="muted">This is an automated confirmation from AEVION. Reply to <a href="mailto:support@aevion.app" style="color:#22d3ee">support@aevion.app</a> for help.</p>
</div></body></html>`;
}

export type WaitlistEmailContext = {
  toEmail: string;
  moduleId: string;
  moduleTitle: string;
  modulePhase: string;
  moduleEta: string;
  moduleDescription: string;
};

/** Fire-and-forget. Never throws. */
export function sendWaitlistConfirmation(ctx: WaitlistEmailContext): void {
  void (async () => {
    try {
      const transport = getTransport();
      if (!transport) return; // SMTP not configured — skip silently
      const moduleUrl = `${BASE}/${ctx.moduleId}`;
      const statusUrl = `https://api.aevion.app/api/${ctx.moduleId}/status`;
      const body = `
        <span class="pill">${escapeHtml(ctx.modulePhase)}</span>
        <h2 style="margin-top:14px">You're on the ${escapeHtml(ctx.moduleTitle)} waitlist.</h2>
        <p>${escapeHtml(ctx.moduleDescription)}</p>
        <p>We'll notify you the moment ${escapeHtml(ctx.moduleTitle)} goes live. Estimated launch: <strong>${escapeHtml(ctx.moduleEta)}</strong>.</p>
        <a class="btn" href="${escapeHtml(moduleUrl)}">View module page →</a>
        <p style="margin-top:24px;font-size:12px;color:#64748b">
          Live status JSON: <a href="${escapeHtml(statusUrl)}" style="color:#22d3ee">${escapeHtml(statusUrl)}</a>
        </p>
        <p style="font-size:12px;color:#64748b">
          Don't want updates? Just reply with "unsubscribe" and we'll remove you. No spam, ever.
        </p>
      `;
      await transport.sendMail({
        from: FROM,
        to: ctx.toEmail,
        subject: `You're on the ${ctx.moduleTitle} waitlist`,
        html: layout(`${ctx.moduleTitle} waitlist`, body),
      });
    } catch (e) {
      console.warn(`[planning/email] send failed for ${ctx.moduleId}:`, (e as Error).message);
    }
  })();
}
