import type { Metadata } from "next";
import { ProductPageShell } from "@/components/ProductPageShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "AEVION platform terms of service and user agreement.",
};

export default function TermsPage() {
  const updated = "April 26, 2026";
  return (
    <main>
      <ProductPageShell maxWidth={760}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, letterSpacing: "-0.02em" }}>Terms of Service</h1>
        <p style={{ color: "#64748b", marginBottom: 24, fontSize: 13 }}>Last updated: {updated}</p>

        <div style={{ lineHeight: 1.75, color: "#334155", fontSize: 15 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>1. Acceptance of Terms</h2>
          <p>By accessing or using the AEVION platform (aevion.vercel.app and related services), you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>2. Description of Services</h2>
          <p>AEVION provides digital intellectual property infrastructure including: IP registration (QRight), cryptographic signatures (QSign), patent bureau services (IP Bureau), compliance and certification (Planet), awards and recognition (Awards), digital banking (AEVION Bank), and gaming (CyberChess).</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>3. User Accounts</h2>
          <p>You must register to access certain features. You are responsible for maintaining the security of your account credentials. You must provide accurate information during registration.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>4. Intellectual Property</h2>
          <p>Content you register through QRight remains your intellectual property. AEVION provides certification and verification services but does not claim ownership of your content. The AEVION platform, including its design, code, and brand, is the property of AEVION.</p>

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

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>7. Prohibited Conduct</h2>
          <p>You may not: submit fraudulent content, manipulate voting systems, attempt to bypass security measures, use the platform for money laundering, or violate any applicable laws.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>8. Limitation of Liability</h2>
          <p>AEVION is provided &quot;as is&quot; without warranties. We are not liable for indirect, incidental, or consequential damages arising from your use of the platform.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>9. Changes to Terms</h2>
          <p>We may update these terms at any time. Continued use after changes constitutes acceptance of the new terms.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>10. Contact</h2>
          <p>For questions about these terms, contact us at yahiin1978@gmail.com or through the Help Center.</p>
        </div>
      </ProductPageShell>
    </main>
  );
}
