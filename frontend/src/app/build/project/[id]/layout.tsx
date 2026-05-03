import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

async function fetchProject(id: string) {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/projects/${encodeURIComponent(id)}/public`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const d = j?.data as { project?: { title: string; description: string; budget: number; city?: string } } | null;
    return d?.project ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchProject(id);
  const title = p?.title ?? "Project";
  const city = p?.city ? ` · ${p.city}` : "";
  const desc = p?.description
    ? `${p.description.slice(0, 140)}…`
    : "Construction project on AEVION QBuild.";

  return {
    title: `${title}${city} — AEVION QBuild`,
    description: desc,
    openGraph: {
      title: `${title}${city}`,
      description: desc,
      type: "website",
      siteName: "AEVION QBuild",
    },
    twitter: { card: "summary", title: `${title}${city}`, description: desc },
  };
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
