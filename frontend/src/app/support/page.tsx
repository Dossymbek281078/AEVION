import type { Metadata } from "next";
import { ProductPageShell } from "@/components/ProductPageShell";

// Страница поддержки нужна трём площадкам сразу: Google просит рабочий контакт
// на экране согласия OAuth, Meta — в заявке приложения, TikTok — в анкете.
// Проверено 16.08.2026: /support отдавал 404, страницы не было ни в одной ветке.
//
// Адрес намеренно gmail, а не privacy@aevion.app: у домена aevion.app НЕТ
// MX-записей (проверено через публичный резолвер, с контролем на gmail.com),
// то есть фирменные адреса на юридических страницах не принимают почту вовсе.
// Печатать здесь второй мёртвый ящик означало бы обещать канал, которого нет.

export const metadata: Metadata = {
  title: "Support",
  description:
    "How to reach AEVION: what to include, how long a reply takes, and where to go for payments, account deletion and platform integrations.",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "AEVION — Support",
    description: "How to reach AEVION and what to expect.",
    type: "article",
    siteName: "AEVION",
  },
  robots: { index: true, follow: true },
};

const H2 = { fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 } as const;
const MAIL = "yahiin1978@gmail.com";

export default function SupportPage() {
  const updated = "August 16, 2026";
  return (
    <main>
      <ProductPageShell maxWidth={760}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Support
        </h1>
        <p style={{ color: "#64748b", marginBottom: 24, fontSize: 13 }}>Last updated: {updated}</p>

        <div style={{ lineHeight: 1.75, color: "#334155", fontSize: 15 }}>
          <p>
            AEVION is a small team, so support is a real mailbox rather than a ticket maze. Write to{" "}
            <a href={`mailto:${MAIL}`}>
              <b>{MAIL}</b>
            </a>{" "}
            and you will get a reply from a person.
          </p>

          <h2 style={H2}>Response times</h2>
          <ul style={{ paddingLeft: 22, marginTop: 6, marginBottom: 6 }}>
            <li>
              <b>Payment or access problem</b> — within 1 business day. If you paid and did not get
              what you bought, say so in the subject line and it goes to the front of the queue.
            </li>
            <li>
              <b>Data deletion</b> — confirmed within 3 business days, completed within 30 days. The
              full procedure is on the <a href="/data-deletion">Data Deletion</a> page.
            </li>
            <li>
              <b>Everything else</b> — within 3 business days.
            </li>
          </ul>

          <h2 style={H2}>What to include</h2>
          <p>
            Write from the email address on your account, name the module you were using, and say
            what you expected to happen versus what happened. If it is a payment question, the order
            number from your receipt is enough — we do not need card details and will never ask for
            them.
          </p>

          <h2 style={H2}>Payments and refunds</h2>
          <p>
            Purchases are processed by Gumroad and Lemon Squeezy, who act as merchant of record and
            issue the receipt. Refund terms are on the <a href="/legal/refund">Refund Policy</a>{" "}
            page. Write to us either way — if a refund has to go through the processor, we will say
            so and point you to the right place instead of leaving you to guess.
          </p>

          <h2 style={H2}>Connected platforms</h2>
          <p>
            If you connected a TikTok, YouTube or Instagram account to AEVION and want to disconnect
            it, you can revoke access in that platform&apos;s own settings at any time, or ask us and
            we will revoke the token on our side. Both take effect immediately. Content already
            published to your account stays there and is managed by you on that platform.
          </p>

          <h2 style={H2}>Security</h2>
          <p>
            Found a vulnerability? Write to the same address with <b>Security</b> in the subject.
            Please give us a reasonable window to fix it before disclosing it publicly. We do not
            pursue researchers who report in good faith.
          </p>

          <h2 style={H2}>Related</h2>
          <p>
            <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> ·{" "}
            <a href="/data-deletion">Data Deletion</a> · <a href="/legal/refund">Refund Policy</a>
          </p>
        </div>
      </ProductPageShell>
    </main>
  );
}
