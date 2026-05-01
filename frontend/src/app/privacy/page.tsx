import type { Metadata } from "next";
import { ProductPageShell } from "@/components/ProductPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "AEVION platform privacy policy and data protection information.",
};

export default function PrivacyPage() {
  const updated = "April 26, 2026";
  return (
    <main>
      <ProductPageShell maxWidth={760}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, letterSpacing: "-0.02em" }}>Privacy Policy</h1>
        <p style={{ color: "#64748b", marginBottom: 24, fontSize: 13 }}>Last updated: {updated}</p>

        <div style={{ lineHeight: 1.75, color: "#334155", fontSize: 15 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>1. Information We Collect</h2>
          <p>We collect: account information (name, email), content you submit (QRight objects, Planet artifacts), transaction data (AEVION Bank), and usage analytics. We do not sell your personal data to third parties.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>2. How We Use Your Data</h2>
          <p>Your data is used to: provide platform services, verify intellectual property claims, process transactions, prevent fraud, and improve the platform. Compliance data (hashes, signatures) is stored for verification purposes.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>3. Data Security</h2>
          <p>We use industry-standard encryption and Quantum Shield cryptographic protection: every QRight certificate carries an Ed25519 signature whose private key is split via 2-of-3 Shamir Secret Sharing across independent locations, so AEVION never holds enough of the key to forge or recover it alone. Modern certificates also carry a co-signature held only in your browser and an OpenTimestamps proof anchored in a Bitcoin block — meaning a downloaded verification bundle remains mathematically valid even if AEVION ceases operations. Passwords are hashed and never stored in plain text.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>4. Trust Graph</h2>
          <p>Your public Trust Graph (verification history, voting participation, compliance records) is visible to other users as part of the reputation system. Private data (email, financial details) is never exposed through the Trust Graph.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>4a. AEVION Bureau — KYC Data</h2>
          <p>When you upgrade a certificate to the Verified tier, we collect KYC (Know-Your-Customer) data through a regulated identity-verification partner.</p>
          <ul style={{ paddingLeft: 22, marginTop: 6, marginBottom: 6 }}>
            <li><b>What AEVION stores:</b> the verification decision (approved / rejected), verified full name, document type (passport / national ID / driver&apos;s licence), country of issue, the partner&apos;s session reference, and the timestamp.</li>
            <li><b>What AEVION does NOT store:</b> raw scans of your ID document, biometric templates, or selfie images. Those remain with the KYC partner under their retention policy (typically 5–7 years for AML/CFT compliance).</li>
            <li><b>What ends up on the certificate:</b> only your verified full name and the verification timestamp. The certificate is publicly viewable at /verify/&lt;id&gt;, so understand that your name becomes part of an immutable cryptographic record after the upgrade.</li>
          </ul>
          <p>This processing relies on (a) your explicit consent at the start of the upgrade flow, (b) AEVION&apos;s legitimate interest in fraud-prevention, and (c) the Law of the Republic of Kazakhstan No. 94-V dated 21 May 2013 &ldquo;On Personal Data and Their Protection&rdquo;. EU/EEA residents additionally rely on GDPR Articles 6(1)(a) and 6(1)(f).</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>5. AEVION Bank Data</h2>
          <p>Financial transaction data is encrypted and stored securely. We comply with applicable financial regulations. Transaction history is available to the account holder and for regulatory audit purposes only.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>6. Cookies and Tracking</h2>
          <p>We use essential cookies for authentication (JWT tokens stored locally). We use minimal analytics to understand platform usage. No third-party advertising trackers.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>7. Your Rights</h2>
          <p>You have the right to: access your data, correct inaccurate data, request deletion of your account, export your data, and withdraw consent. Contact yahiin1978@gmail.com to exercise these rights.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>8. Data Retention</h2>
          <p>Account data is retained while your account is active. IP registration records and compliance certificates are retained permanently as part of the evidence trail — this is the core value proposition. Note that even outside our retention, a Verification Bundle you downloaded remains independently checkable: SHA-256, Ed25519, and the Bitcoin-anchored timestamp are the trust anchors, not our database. Financial records are retained as required by applicable law.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>9. Contact</h2>
          <p>Data Protection Officer: yahiin1978@gmail.com. AEVION, Astana, Kazakhstan.</p>
        </div>
      </ProductPageShell>
    </main>
  );
}
