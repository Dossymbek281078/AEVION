import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const title = `AEVION Verified Certificate · ${id}`;
  const description = "Cryptographic proof of authorship — verified under the Berne Convention, WIPO, TRIPS, eIDAS and ESIGN.";

  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/pipeline/verify/${id}`, { next: { revalidate: 30 } });
    if (res.ok) {
      const j = await res.json();
      if (j?.valid && j?.certificate) {
        const c = j.certificate;
        const kindLabel = ({ music: "Music", code: "Code", design: "Design", text: "Text", video: "Video", idea: "Idea", other: "Work" } as Record<string, string>)[c.kind] || "Work";
        const byLine = c.location ? `${c.author} · ${c.location}` : c.author;
        return {
          title: `${c.title} — ${kindLabel} · Protected by AEVION`,
          description: `${kindLabel} by ${byLine}. Protected ${new Date(c.protectedAt).toLocaleDateString()}. SHA-256 + Ed25519 + Shamir SSS cryptographic proof, verifiable in 3 seconds.`,
          openGraph: {
            title: `${c.title} — Protected by AEVION`,
            description: `${kindLabel} by ${byLine}. Verified ${j?.stats?.verifiedCount ?? 0}× · SHA-256 + Ed25519 + Shamir SSS.`,
            type: "article",
            siteName: "AEVION Digital IP Bureau",
          },
          twitter: {
            card: "summary",
            title: `${c.title} — Protected by AEVION`,
            description: `${kindLabel} by ${byLine}. Verified ${j?.stats?.verifiedCount ?? 0}× on AEVION Digital IP Bureau.`,
          },
        };
      }
    }
  } catch { /* fall through to default */ }

  return { title, description };
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
