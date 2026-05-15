import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const safeId = (id || "").slice(0, 32);
  const fallbackOg = `/api/og/artifact/${encodeURIComponent(safeId || "artifact")}?title=${encodeURIComponent("AEVION Planet artifact")}&subtitle=${encodeURIComponent("Public artifact showcase: compliance, voting, certificate.")}`;

  const fallback: Metadata = {
    title: "Artifact Planet — AEVION",
    description: "Публичная витрина artifactа: compliance, votesание, сертификат.",
    openGraph: {
      title: "AEVION Planet Artifact",
      description: "Публичная витрина artifactа с compliance и votesанием участников Planet.",
      images: [{ url: fallbackOg, width: 1200, height: 630, alt: "AEVION Planet artifact" }],
    },
    twitter: {
      card: "summary_large_image",
      images: [fallbackOg],
    },
  };

  if (!id) return fallback;

  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/planet/artifacts/${encodeURIComponent(id)}/public`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return fallback;

    const data = await res.json();
    const artifact = data?.artifact;
    if (!artifact) return fallback;

    const title = artifact.submissionTitle || "Artifact Planet";
    const type = artifact.artifactType || "artifact";
    const version = artifact.versionNo ?? 1;
    const status = artifact.status || "pending";
    const voteCount = data?.voteStats?.count ?? 0;
    const voteAvg = data?.voteStats?.average;

    const description = [
      `${type} · v${version} · ${status}`,
      voteCount > 0 ? `Голосов: ${voteCount}` : null,
      voteAvg != null ? `Средняя rating: ${Number(voteAvg).toFixed(1)}` : null,
      "Публичная витрина AEVION Planet",
    ]
      .filter(Boolean)
      .join(" · ");

    const ogQuery = new URLSearchParams({
      title: `${title}`.slice(0, 80),
      subtitle: description.slice(0, 200),
      tag: type.toUpperCase().slice(0, 12),
      status: voteCount > 0 ? `${voteCount} votes` : status,
    }).toString();
    const ogUrl = `/api/og/artifact/${encodeURIComponent(safeId)}?${ogQuery}`;

    return {
      title: `${title} — AEVION Planet`,
      description,
      openGraph: {
        title: `${title} — AEVION Planet`,
        description,
        type: "article",
        images: [{ url: ogUrl, width: 1200, height: 630, alt: `${title} — AEVION Planet artifact` }],
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} — AEVION Planet`,
        description,
        images: [ogUrl],
      },
    };
  } catch {
    return fallback;
  }
}

export default function ArtifactLayout({ children }: Props) {
  return <>{children}</>;
}
