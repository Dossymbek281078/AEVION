import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getApiBase } from "@/lib/apiBase";

export const dynamic = "force-dynamic";

type ProjectStatus = "OPEN" | "IN_PROGRESS" | "DONE";
type VacancyStatus = "OPEN" | "CLOSED";

type PublicProject = {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: ProjectStatus;
  city: string | null;
  clientId: string;
  createdAt: string;
  updatedAt: string;
};
type PublicVacancy = {
  id: string;
  title: string;
  description: string;
  salary: number;
  status: VacancyStatus;
  createdAt: string;
  applicationsCount: number;
};
type PublicFile = {
  id: string;
  url: string;
  name: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};
type PublicClient = {
  name: string | null;
  city: string | null;
  buildRole: string | null;
};
type PublicView = {
  project: PublicProject;
  vacancies: PublicVacancy[];
  files: PublicFile[];
  client: PublicClient | null;
};

async function loadPublic(id: string): Promise<PublicView | null> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/build/projects/${encodeURIComponent(id)}/public`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data?: PublicView };
    if (!json?.success || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}

async function getOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {}
  return "";
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = {
    title: "Construction project — AEVION QBuild",
    description: "Public project page on the AEVION QBuild marketplace.",
  };
  if (!id) return fallback;
  const data = await loadPublic(id);
  if (!data) return fallback;

  const p = data.project;
  const vacOpen = data.vacancies.filter((v) => v.status === "OPEN").length;
  const titleLine = `${p.title} · ${p.status}`;
  const desc = [
    p.status,
    p.city ? `city=${p.city}` : null,
    p.budget > 0 ? `budget=${p.budget}` : null,
    vacOpen ? `${vacOpen} open vacancy${vacOpen === 1 ? "" : "ies"}` : null,
    data.client?.name ? `client=${data.client.name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${titleLine} — AEVION QBuild`,
    description: desc || p.description.slice(0, 160),
    openGraph: {
      type: "article",
      title: titleLine,
      description: desc || p.description.slice(0, 160),
    },
  };
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#0f172a",
  padding: "48px 16px",
  color: "#e2e8f0",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const wrap: CSSProperties = { maxWidth: 880, margin: "0 auto" };
const card: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: 22,
  background: "rgba(255,255,255,0.03)",
};
const dt: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 4,
};
const dd: CSSProperties = {
  fontSize: 14,
  color: "#e2e8f0",
  margin: 0,
  marginBottom: 14,
  wordBreak: "break-word",
};

function statusTone(s: ProjectStatus): { bg: string; fg: string; label: string } {
  if (s === "OPEN") return { bg: "rgba(16,185,129,0.15)", fg: "#34d399", label: "OPEN" };
  if (s === "IN_PROGRESS") return { bg: "rgba(245,158,11,0.15)", fg: "#fbbf24", label: "IN PROGRESS" };
  return { bg: "rgba(148,163,184,0.15)", fg: "#cbd5e1", label: "DONE" };
}

function fmtBudget(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default async function PublicProjectPage({ params }: Props) {
  const { id } = await params;
  const data = await loadPublic(id);
  const origin = await getOrigin();

  if (!data) {
    return (
      <main style={page}>
        <div style={wrap}>
          <div style={{ ...card, borderColor: "rgba(220,38,38,0.3)" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Project not found</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              No public project with id <code>{id}</code>. It may have been removed or the link is wrong.
            </div>
            <Link
              href="/build"
              style={{ display: "inline-block", marginTop: 14, color: "#34d399", fontWeight: 700, textDecoration: "none" }}
            >
              ← Browse open projects
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { project, vacancies, files, client } = data;
  const tone = statusTone(project.status);
  const detailUrl = origin ? `${origin}/build/p/${project.id}` : `/build/p/${project.id}`;
  const openVacancies = vacancies.filter((v) => v.status === "OPEN");

  return (
    <main style={page}>
      <div style={wrap}>
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/build"
            style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}
          >
            ← AEVION QBuild
          </Link>
          <span style={{ color: "#475569" }}>·</span>
          <span style={{ color: "#64748b", fontSize: 13 }}>Public project</span>
        </div>

        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#fff" }}>{project.title}</h1>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                background: tone.bg,
                color: tone.fg,
                whiteSpace: "nowrap",
              }}
            >
              {tone.label}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={dt}>Budget</div>
              <p style={dd}>{fmtBudget(project.budget)}</p>
            </div>
            {project.city && (
              <div>
                <div style={dt}>City</div>
                <p style={dd}>{project.city}</p>
              </div>
            )}
            {client?.name && (
              <div>
                <div style={dt}>Client</div>
                <p style={dd}>{client.name}{client.buildRole ? ` · ${client.buildRole}` : ""}</p>
              </div>
            )}
            <div>
              <div style={dt}>Posted</div>
              <p style={dd}>{project.createdAt.slice(0, 10)}</p>
            </div>
          </div>

          <div>
            <div style={dt}>Description</div>
            <p style={{ ...dd, whiteSpace: "pre-wrap" }}>{project.description}</p>
          </div>
        </div>

        {openVacancies.length > 0 && (
          <div style={{ ...card, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, marginBottom: 12, color: "#fff" }}>
              Open vacancies ({openVacancies.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {openVacancies.map((v) => (
                <Link
                  key={v.id}
                  href={`/build/vacancy/${v.id}`}
                  style={{
                    display: "block",
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, color: "#fff" }}>{v.title}</div>
                    {v.salary > 0 && (
                      <div style={{ fontSize: 13, color: "#34d399", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {fmtBudget(v.salary)}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {v.description}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>
                    {v.applicationsCount} application{v.applicationsCount === 1 ? "" : "s"} · {v.createdAt.slice(0, 10)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div style={{ ...card, marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, marginBottom: 12, color: "#fff" }}>
              Files ({files.length})
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {files.map((f) => (
                <li key={f.id}>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#34d399", fontSize: 13, textDecoration: "none" }}
                  >
                    {f.name || f.url}
                  </a>
                  {f.sizeBytes && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>
                      ({Math.round(f.sizeBytes / 1024)} KB)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ ...card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Share: <code style={{ color: "#94a3b8" }}>{detailUrl}</code>
            </div>
            <Link
              href={`/build/project/${project.id}`}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "#10b981",
                color: "#022c22",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Open in app →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
