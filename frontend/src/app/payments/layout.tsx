import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payments Rail",
  description:
    "AEVION Payments Rail — payment links, 12 methods, HMAC-signed webhooks, settlements with royalty auto-split, recurring subscriptions, fraud detection, compliance reports, and a developer API tied natively to the trust graph.",
  alternates: {
    canonical: "https://aevion.app/payments",
  },
  openGraph: {
    title: "Payments Rail · AEVION",
    description:
      "Links, 12 methods, signed webhooks, settlements, subscriptions, fraud, compliance, and developer API — connected to the AEVION trust graph.",
    type: "website",
    url: "https://aevion.app/payments",
  },
  twitter: {
    card: "summary_large_image",
    title: "Payments Rail · AEVION",
    description:
      "8-surface AEVION Payments Rail: links, methods, webhooks, settlements, subscriptions, fraud, compliance, API.",
  },
};

export default function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
