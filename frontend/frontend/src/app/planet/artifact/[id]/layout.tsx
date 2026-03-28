import type { Metadata } from "next";
import { getApiBase } from "@/lib/apiBase";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const fallback: Metadata = {
    title: "Артефакт Planet — AEVION",
    description: "Публичная витрина артефакта: compliance, голосование, сертификат.",
    openGraph: {
      title: "AEVION Planet Artifact",
      description: "Публичная витрина артефакта с compliance и голосованием участников Planet.",
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

    const title = artifact.submissionTitle || "Артефакт Planet";
    const type = artifact.artifactType || "artifact";
    const version = artifact.versionNo ?? 1;
    const status = artifact.status || "pending";
    const voteCount = data?.voteStats?.count ?? 0;
    const voteAvg = data?.voteStats?.average;

    const description = [
      `${type} · v${version} · ${status}`,
      voteCount > 0 ? `Голосов: ${voteCount}` : null,
      voteAvg != null ? `Средняя оценка: ${Number(voteAvg).toFixed(1)}` : null,
      "Публичная витрина AEVION Planet",
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      title: `${title} — AEVION Planet`,
      description,
      openGraph: {
        title: `${title} — AEVION Planet`,
        description,
        type: "article",
      },
    };
  } catch {
    return fallback;
  }
}

export default function ArtifactLayout({ children }: Props) {
  return <>{children}</>;
}
