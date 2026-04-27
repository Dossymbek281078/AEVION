import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

type PageProps = { params: Promise<{ slug: string }> };

type AuthorProfile = {
  name?: string;
  stats?: {
    certificates?: number;
    verifications?: number;
    countries?: string[];
  };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  let profile: AuthorProfile | null = null;
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/pipeline/authors/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120 },
    });
    if (res.ok) profile = (await res.json()) as AuthorProfile;
  } catch {
    // fall through
  }

  if (!profile?.name) {
    return {
      title: `Author · AEVION Digital IP Bureau`,
      description: "AEVION public author profile — registry of cryptographically protected works.",
    };
  }

  const name = profile.name;
  const c = profile.stats?.certificates ?? 0;
  const v = profile.stats?.verifications ?? 0;
  const desc =
    `${name} on AEVION Digital IP Bureau · ${c} protected work${c === 1 ? "" : "s"}, ${v} verification${v === 1 ? "" : "s"}.` +
    " SHA-256 + Ed25519 + Shamir Secret Sharing, anchored to a public Merkle root.";
  return {
    title: `${name} — Author profile`,
    description: desc,
    openGraph: {
      title: `${name} — Protected works on AEVION Bureau`,
      description: desc,
      type: "profile",
      siteName: "AEVION Digital IP Bureau",
    },
    twitter: {
      card: "summary",
      title: `${name} on AEVION Bureau`,
      description: desc,
    },
  };
}

export default function AuthorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
