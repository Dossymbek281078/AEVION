import type { Metadata } from "next";
import SharedRunClient from "./SharedRunClient";
import { apiUrl } from "@/lib/apiBase";

const SITE_NAME = "AEVION QCoreAI";
const DEFAULT_DESCRIPTION =
  "Read-only snapshot of a multi-agent LLM run: analyst plan, writer drafts, critic review and the final answer — with token cost accounting.";

type SharedMetaPayload = {
  session: { id: string; title: string } | null;
  run: {
    strategy: string | null;
    totalCostUsd: number | null;
    totalDurationMs: number | null;
    userInput: string;
  };
};

async function fetchShared(token: string): Promise<SharedMetaPayload | null> {
  try {
    const res = await fetch(apiUrl(`/api/qcoreai/shared/${encodeURIComponent(token)}`), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as SharedMetaPayload;
  } catch {
    return null;
  }
}

function fmtMoney(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return null;
  if (v === 0) return "$0";
  if (v < 0.0001) return "<$0.0001";
  return `$${v.toFixed(4)}`;
}

function fmtDur(ms: number | null | undefined) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function prettyStrategy(s: string | null | undefined) {
  if (s === "parallel") return "Parallel (Writer‖Writer → Judge)";
  if (s === "debate") return "Debate (Pro‖Con → Moderator)";
  return "Sequential (Analyst → Writer → Critic)";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchShared(token);

  const titleBase = data?.session?.title?.trim() || "Shared QCoreAI run";
  const title = `${titleBase} — ${SITE_NAME}`;

  const pieces: string[] = [];
  if (data?.run) {
    const strategy = prettyStrategy(data.run.strategy);
    pieces.push(strategy);
    const cost = fmtMoney(data.run.totalCostUsd);
    if (cost) pieces.push(`cost ${cost}`);
    const dur = fmtDur(data.run.totalDurationMs);
    if (dur) pieces.push(`in ${dur}`);
  }
  const input = data?.run?.userInput?.trim().slice(0, 140);
  const description = input
    ? `${input}${input.length === 140 ? "…" : ""} — ${pieces.join(" · ") || SITE_NAME}`
    : pieces.length
      ? `${pieces.join(" · ")} — ${DEFAULT_DESCRIPTION}`
      : DEFAULT_DESCRIPTION;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: false, follow: false },
  };
}

export default function Page() {
  return <SharedRunClient />;
}
