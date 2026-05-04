import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

type ProjectMeta = { title: string; description: string; budget: number; city?: string };

async function fetchProject(id: string): Promise<ProjectMeta | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/projects/${encodeURIComponent(id)}/public`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const d = j?.data as { project?: ProjectMeta } | null;
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

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await fetchProject(id);
  if (!p) return <>{children}</>;
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "QBuild", item: "https://aevion.com/build" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Projects",
        item: "https://aevion.com/build",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: p.title,
        item: `https://aevion.com/build/project/${encodeURIComponent(id)}`,
      },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      {children}
    </>
  );
}
