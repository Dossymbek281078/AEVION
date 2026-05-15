import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getApiBase } from "@/lib/apiBase";

interface RequestMeta {
  amount?: number;
  currency?: string;
  description?: string;
  status?: string;
}

async function loadRequest(token: string): Promise<RequestMeta | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/qpaynet/requests/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as RequestMeta;
  } catch {
    return null;
  }
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const meta = await loadRequest(params.token);
  if (!meta?.amount) {
    return {
      title: "Запрос на оплату · QPayNet · AEVION",
      description: "Безопасный платёж через AEVION QPayNet.",
    };
  }
  const title = `${fmt(meta.amount)} ${meta.currency ?? "₸"} · QPayNet`;
  const description = meta.description
    ? `${meta.description.slice(0, 140)} · оплатить через AEVION QPayNet`
    : "Запрос на оплату через AEVION QPayNet";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "AEVION QPayNet" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false, follow: false },
  };
}

export default function PayRequestLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
