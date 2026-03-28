import type { Metadata } from "next";
import { ProductPageShell } from "@/components/ProductPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "AEVION platform privacy policy and data protection information.",
};

export default function PrivacyPage() {
  const updated = "March 28, 2026";
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
          <p>We use industry-standard encryption, Quantum Shield cryptographic protection (Ed25519 + Shamir Secret Sharing), and secure infrastructure. Your passwords are hashed and never stored in plain text.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>4. Trust Graph</h2>
          <p>Your public Trust Graph (verification history, voting participation, compliance records) is visible to other users as part of the reputation system. Private data (email, financial details) is never exposed through the Trust Graph.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>5. AEVION Bank Data</h2>
          <p>Financial transaction data is encrypted and stored securely. We comply with applicable financial regulations. Transaction history is available to the account holder and for regulatory audit purposes only.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>6. Cookies and Tracking</h2>
          <p>We use essential cookies for authentication (JWT tokens stored locally). We use minimal analytics to understand platform usage. No third-party advertising trackers.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>7. Your Rights</h2>
          <p>You have the right to: access your data, correct inaccurate data, request deletion of your account, export your data, and withdraw consent. Contact info@aevion.app to exercise these rights.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>8. Data Retention</h2>
          <p>Account data is retained while your account is active. IP registration records and compliance certificates are retained permanently as part of the evidence trail (this is the core value proposition). Financial records are retained as required by applicable law.</p>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8 }}>9. Contact</h2>
          <p>Data Protection Officer: info@aevion.app. AEVION, Astana, Kazakhstan.</p>
        </div>
      </ProductPageShell>
    </main>
  );
}
