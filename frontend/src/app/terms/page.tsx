import type { Metadata } from "next";
import { ProductPageShell } from "@/components/ProductPageShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "AEVION terms of service and user agreement. Authorship rights stay with creators, AEVION takes no IP and no exclusive license. Read the full agreement before signing in.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "AEVION Terms of Service",
    description: "Authorship stays with you. AEVION takes no IP. Read the full agreement.",
    type: "article",
    siteName: "AEVION",
  },
  twitter: {
    card: "summary",
    title: "AEVION Terms of Service",
    description: "User agreement at AEVION.",
  },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const updated = "August 19, 2026";
  return (
    <main>
      <ProductPageShell maxWidth={760}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, letterSpacing: "-0.02em" }}>Terms of Service</h1>
        <p style={{ color: "#64748b", marginBottom: 24, fontSize: 13 }}>Last updated: {updated}</p>

        {/* Кто продавец. Добавлено 19.08.2026: до этого ни одна юридическая
            страница не называла юрлицо вовсе — компания была зарегистрирована
            20.07.2026, а страницы этого не знали. Платёжные системы при проверке
            сверяют заявителя с тем, что написано на сайте; расхождение — самая
            частая причина отказа. Реквизиты — из подписанной Form SS-4. */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 26, background: "#f8fafc", fontSize: 14, lineHeight: 1.6, color: "#334155" }}>
          <b>Who you are contracting with.</b> The AEVION platform is operated by
          {" "}<b>AEVION LLC</b>, a limited liability company registered in the State of
          Wyoming, United States, with its registered office at 30 N Gould St, Ste R,
          Sheridan, WY 82801, USA. Day-to-day operations are conducted from the Republic
          of Kazakhstan.
        </div>

        <div style={{ lineHeight: 1.75, color: "#334155", fontSize: 15 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>1. Acceptance of Terms</h2>
          <p>By accessing or using the AEVION platform (aevion.app and related services), you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>2. Description of Services</h2>
          <p>AEVION provides digital intellectual property infrastructure including: IP registration (QRight), cryptographic signatures (QSign), authorship & prior-art attestation (IP Bureau), compliance and certification (Planet), awards and recognition (Awards), digital banking (AEVION Bank), and gaming (CyberChess).</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>3. User Accounts</h2>
          <p>You must register to access certain features. You are responsible for maintaining the security of your account credentials. You must provide accurate information during registration.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>4. Intellectual Property</h2>
          <p>Content you register through QRight remains your intellectual property. AEVION provides cryptographic registration and verification services and does not claim any ownership of, or licence to, your content. Each certificate gives you a self-contained Verification Bundle (.json) that anyone can verify offline — even if AEVION is no longer operating, your proof of authorship survives via Ed25519 and the Bitcoin-anchored OpenTimestamps proof. The AEVION platform itself, including its design, code, and brand, remains the property of AEVION.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>5. Planet Compliance</h2>
          <p>Artifacts submitted to Planet undergo automated compliance checks. Certification does not constitute legal copyright registration. AEVION provides evidence trails and verification, not legal advice.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>5a. AEVION IP Bureau — Verified Tier</h2>
          <p>The Bureau Verified tier is a paid identity-attestation service. Workflow:</p>
          <ul style={{ paddingLeft: 22, marginTop: 6, marginBottom: 6 }}>
            <li>You complete identity verification with our KYC partner (passport / national ID).</li>
            <li>You pay the Verified-tier fee (currently USD 19 per certificate; see /bureau for current pricing).</li>
            <li>Your existing QRight certificate is amended with a real-name attestation that AEVION Bureau signs.</li>
          </ul>
          <p><b>What Verified does NOT do.</b> A Verified certificate is still cryptographic evidence of authorship and timestamp — it is <em>not</em> a patent, trademark, or government-issued copyright registration, and it does not grant a legal monopoly. For statutory protection, the Filed tier (separate fee) facilitates submission to government IP offices via partner attorneys; you remain the registrant of record.</p>
          <p><b>Refunds.</b> KYC and Verified-tier fees are refundable within 14 days if (a) the certificate has not yet been amended with the verification, or (b) the KYC vendor rejects your verification due to a defect on our side. After the certificate is upgraded, fees are non-refundable because the bureau has irreversibly committed evidence on the public ledger.</p>
          <p><b>Withdrawal of attestation.</b> You may request the bureau to revoke a verification (e.g. lost identity, name change). Revocation does not delete the historical attestation — it adds a revocation record visible on the verify page; the original cryptographic proof remains valid.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>5b. Jurisdiction & Governing Law</h2>
          <p>AEVION is operated from the Republic of Kazakhstan. Any dispute relating to AEVION services is governed by the laws of Kazakhstan and falls within the exclusive jurisdiction of the courts of Astana, unless a mandatory consumer-protection rule of your country of residence provides otherwise. International users acknowledge that AEVION&apos;s evidentiary services rely on the Berne Convention, the WIPO Copyright Treaty, the TRIPS Agreement, eIDAS, the ESIGN Act, and the Law of the Republic of Kazakhstan &ldquo;On Electronic Document and Electronic Digital Signature&rdquo;.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>6. AEVION Bank</h2>
          <p>AEVION Bank provides digital wallet services within the ecosystem. AEVION Credits (AEC) are internal units used for transactions between users. AEC is not a cryptocurrency or legal tender. Withdrawal to external accounts is subject to verification and applicable fees.</p>

          {/* Перенесено 19.08.2026 из /legal/terms — страницы-сироты, на которую
              никто не ссылался, но которая жила на проде отдельным комплектом
              условий. Там эти два раздела были, здесь их не было вовсе: платный
              продукт без описания списаний и отмены — прямой вопрос от платёжной
              системы при проверке и повод для спора с покупателем. */}
          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>6a. Subscriptions, Billing &amp; Cancellation</h2>
          <p>Paid subscriptions and one-off purchases are processed by our authorized payment processors, <b>Gumroad</b> and <b>Lemon Squeezy</b>, who act as Merchant of Record for those transactions. Recurring subscriptions renew automatically at the end of each billing period unless cancelled before the renewal date. Where a free trial is offered, no charge is made until the trial ends.</p>
          <p>You may cancel a subscription at any time; cancellation stops future renewals and does not retroactively refund the current period. Refund terms are set out in our <a href="/pricing/refund-policy" style={{ color: "#0d9488", fontWeight: 700 }}>Refund Policy</a>.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>6b. Suspension &amp; Termination</h2>
          <p>We may suspend or terminate an account for violation of these Terms. You may close your account at any time from your account settings. Certificates and attestations already issued remain cryptographically verifiable after termination — closing an account does not invalidate evidence already committed.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>7. Prohibited Conduct</h2>
          <p>You may not: submit fraudulent content, manipulate voting systems, attempt to bypass security measures, use the platform for money laundering, or violate any applicable laws.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>8. Limitation of Liability</h2>
          <p>AEVION is provided &quot;as is&quot; without warranties. We are not liable for indirect, incidental, or consequential damages arising from your use of the platform.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>9. Changes to Terms</h2>
          <p>We may update these terms at any time. Continued use after changes constitutes acceptance of the new terms.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>9a. TikTok Integration</h2>
          <p>AEVION offers an optional feature that lets you publish videos to your own TikTok account through TikTok&rsquo;s official Content Posting API. By connecting your TikTok account, you authorize AEVION to upload and publish content to that account only on your instruction, and you may disconnect at any time from your TikTok settings.</p>
          <p>You are solely responsible for the content you publish and represent that you own or have the necessary rights to it. You agree to comply with TikTok&rsquo;s Community Guidelines, Terms of Service and Content Sharing Guidelines when using this feature. AEVION is an independent service, is not affiliated with, sponsored by or endorsed by TikTok, and TikTok is a trademark of its respective owner. AEVION is not liable for any action TikTok takes with respect to your account or your content.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>10. Contact</h2>
          {/* Адрес намеренно этот, а не legal@aevion.io. Проверено 19.08.2026
              отправкой: legal@ и privacy@ на aevion.io НЕ СУЩЕСТВУЮТ (отбойник
              «address couldn’t be found»), а у домена aevion.app нет записи MX
              вовсе — там отбивается любой адрес. Печатать красивый адрес, который
              не принимает писем, хуже, чем печатать рабочий. Заведут ящик —
              поменять здесь и в /privacy. */}
          <p>For questions about these Terms, contact AEVION LLC at yahiin1978@gmail.com or through the Help Center.</p>
          <p style={{ color: "#64748b", fontSize: 13 }}>AEVION LLC · 30 N Gould St, Ste R, Sheridan, WY 82801, United States</p>
        </div>
      </ProductPageShell>
    </main>
  );
}
