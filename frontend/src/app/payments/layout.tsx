import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payments Rail",
  description:
    "AEVION Payments Rail — payment links, method orchestration, webhook delivery, and settlement tied natively to the trust graph. Part of the 27-node AEVION ecosystem.",
  alternates: {
    canonical: "https://aevion.app/payments",
  },
  openGraph: {
    title: "Payments Rail · AEVION",
    description:
      "Create payment links, accept any method, receive signed webhooks, and settle to bank or AEC wallet — all connected to the AEVION trust graph.",
    type: "website",
    url: "https://aevion.app/payments",
  },
  twitter: {
    card: "summary_large_image",
    title: "Payments Rail · AEVION",
    description:
      "The AEVION Payments Rail: links, methods, webhooks, settlements — native to the trust graph.",
  },
};

export default function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
