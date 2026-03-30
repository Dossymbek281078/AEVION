import type { Metadata } from "next";
import { ProductPageShell } from "@/components/ProductPageShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "AEVION platform terms of service and user agreement.",
};

export default function TermsPage() {
  const updated = "March 28, 2026";
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
