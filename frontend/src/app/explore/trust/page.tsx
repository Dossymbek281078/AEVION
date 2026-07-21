import type { Metadata } from "next";
import TrustClient from "./_client";

export const metadata: Metadata = {
  title: "AEVION Trust Score — signed & Bitcoin-anchorable data-honesty KPI",
  description:
    "How much of the AEVION platform's data is actually measured, not estimated — Ed25519-signed and anchorable into Bitcoin via OpenTimestamps, so anyone can verify it with zero trust in AEVION.",
  openGraph: {
    title: "AEVION Trust Score — a provable data-honesty KPI",
    description:
      "Signed with Ed25519 and anchorable into Bitcoin. Verify the platform's measured-data share yourself.",
    type: "website",
  },
};

export default function TrustPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0a0f1c" }}>
      <TrustClient />
    </main>
  );
}
