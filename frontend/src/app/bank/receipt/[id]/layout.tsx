import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const safeId = (id || "").slice(0, 24);
  const title = "Receipt — AEVION Bank";
  const description = "Printable AEVION Bank receipt with QSign signature row and verification QR.";
  const ogQuery = new URLSearchParams({
    title: "AEC receipt",
    subtitle: "Printable AEVION Bank receipt with QSign signature and verification QR.",
    tag: safeId ? `#${safeId.slice(0, 10)}` : "",
    status: "signed",
  }).toString();

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      images: [
        {
          url: `/api/og/receipt/${encodeURIComponent(safeId || "receipt")}?${ogQuery}`,
          width: 1200,
          height: 630,
          alt: "AEVION Bank receipt",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/og/receipt/${encodeURIComponent(safeId || "receipt")}?${ogQuery}`],
    },
  };
}

export default function ReceiptLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
