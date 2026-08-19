import type { Metadata } from "next";
import { ProductPageShell } from "@/components/ProductPageShell";

// Обязательная страница для App Review в Meta: у приложения, которое трогает
// данные пользователя, должен быть публичный "Data Deletion Instructions URL".
// Без неё заявку не принимают вовсе — проверено 16.08.2026, страницы не было
// ни в одной ветке, а /data-deletion отдавал 404.
//
// Google и TikTok такой отдельной страницы не требуют, но оба смотрят, что
// удаление вообще описано; поэтому здесь же перечислены сторонние интеграции,
// у которых свои сроки хранения — иначе обещание "удалим всё" было бы ложным.

export const metadata: Metadata = {
  title: "Data Deletion",
  description:
    "How to delete your AEVION account and connected platform data, what is removed immediately, and what third-party providers keep under their own retention rules.",
  alternates: { canonical: "/data-deletion" },
  openGraph: {
    title: "AEVION — Data Deletion",
    description: "How to request deletion of your AEVION data.",
    type: "article",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

const H2 = { fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 } as const;

export default function DataDeletionPage() {
  const updated = "August 16, 2026";
  return (
    <main>
      <ProductPageShell maxWidth={760}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Data Deletion
        </h1>
        <p style={{ color: "#64748b", marginBottom: 24, fontSize: 13 }}>Last updated: {updated}</p>

        <div style={{ lineHeight: 1.75, color: "#334155", fontSize: 15 }}>
          <p>
            You can ask us to delete your AEVION data at any time, and you do not need a reason.
            This page explains exactly how to do it, what disappears immediately, and what we are
            not able to remove — because pretending otherwise would be a promise we cannot keep.
          </p>

          <h2 style={H2}>1. How to request deletion</h2>
          <p>
            Send an email from the address registered on your account to{" "}
            <a href="mailto:yahiin1978@gmail.com">yahiin1978@gmail.com</a> with the subject{" "}
            <b>Delete my data</b>. Sending it from the registered address is what proves the request
            is yours; we do not ask for documents or a phone number.
          </p>
          <p>
            We confirm receipt within <b>3 business days</b> and complete the deletion within{" "}
            <b>30 days</b>. If anything cannot be deleted, we tell you what and why rather than
            quietly leaving it in place.
          </p>

          <h2 style={H2}>2. What is deleted</h2>
          <ul style={{ paddingLeft: 22, marginTop: 6, marginBottom: 6 }}>
            <li>Your account record: name, email address, and authentication credentials.</li>
            <li>Content you created in AEVION modules and any drafts attached to your account.</li>
            <li>
              Access tokens for connected platforms (TikTok, YouTube, Meta). Revoking them stops
              AEVION from acting on your behalf immediately, before the rest of the deletion runs.
            </li>
            <li>Analytics events tied to your session identifier.</li>
          </ul>

          <h2 style={H2}>3. What we cannot delete, and why</h2>
          <p>
            Some records exist outside AEVION or are required by law. We list them plainly instead
            of implying a clean sweep:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 6, marginBottom: 6 }}>
            <li>
              <b>Content already published to a third-party platform.</b> A video posted to your own
              TikTok, YouTube or Instagram account lives on that platform and belongs to your
              account there. Delete it in that platform&apos;s own interface — we have no way to
              remove it after publication.
            </li>
            <li>
              <b>Payment records.</b> Purchases are processed by Gumroad and Lemon Squeezy, who act
              as merchant of record. Tax and accounting law requires them to retain transaction
              records; request deletion directly with them, subject to those obligations.
            </li>
            <li>
              <b>Published cryptographic certificates.</b> A QRight certificate you chose to publish
              is an immutable signed record, by design. Its public page can be withdrawn from
              listings, but the signature itself cannot be un-issued.
            </li>
            <li>
              <b>Identity-verification data.</b> If you completed a Bureau KYC check, the verification
              partner keeps its own records for anti-money-laundering compliance, typically 5–7 years.
              See the <a href="/privacy">Privacy Policy</a> for what AEVION itself stores.
            </li>
          </ul>

          <h2 style={H2}>4. Disconnecting a platform without deleting your account</h2>
          <p>
            If you only want AEVION to stop accessing a connected platform, you do not need to delete
            anything else. Revoke access in that platform&apos;s own settings — for TikTok, under
            Security and permissions, Manage app permissions — or write to us and we will revoke the
            token on our side. Either action takes effect at once.
          </p>

          <h2 style={H2}>5. Questions</h2>
          <p>
            Write to <a href="mailto:yahiin1978@gmail.com">yahiin1978@gmail.com</a>. Related documents:{" "}
            <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Service</a>.
          </p>
        </div>
      </ProductPageShell>
    </main>
  );
}
