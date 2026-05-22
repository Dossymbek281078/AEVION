import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "AEVION Fintech Changelog",
  description: "Release history for AEVION fintech SDK packages — fintech-sdk, catalog-client, qpaynet-client, qcoreai-client. Live versions from /api/aevion/sdks.",
  alternates: { canonical: "https://aevion.app/developers/fintech/changelog" },
};

const C = { bg: "#050810", surface: "#0d1117", border: "#1e2a3a", text: "#e2e8f0", muted: "#64748b", green: "#10b981", amber: "#f59e0b", blue: "#6366f1" };

interface LiveSdk {
  id: string;
  name: string;
  version: string;
  modules: string[];
  registry: string;
  lastPublished?: string | null;
}

interface SdksResponse {
  total: number;
  sdks: LiveSdk[];
}

async function fetchSdks(): Promise<SdksResponse | null> {
  try {
    const r = await fetch(`${getApiBase()}/api/aevion/sdks`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return (await r.json()) as SdksResponse;
  } catch {
    return null;
  }
}

function relAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return null;
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Maps SDK id → GitHub path of its CHANGELOG.md. The repo path is stable
// across releases (the file moves only on package rename).
const CHANGELOG_PATHS: Record<string, string> = {
  "fintech-sdk": "packages/fintech-sdk/CHANGELOG.md",
  "catalog-client": "packages/aevion-catalog-client/CHANGELOG.md",
};

const GITHUB_REPO = "https://github.com/Dossymbek281078/AEVION";

export default async function FintechChangelogPage() {
  const data = await fetchSdks();
  const sdks = data?.sdks ?? [];

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
        <Link href="/developers/fintech" style={{ color: C.muted, fontSize: "0.8rem", textDecoration: "none", display: "inline-block", marginBottom: 12 }}>← Fintech Docs</Link>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>Fintech Changelog</h1>
        <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: 8 }}>
          Live release state of the AEVION fintech SDK packages. Detailed change notes live in each package&apos;s <code>CHANGELOG.md</code> on GitHub.
        </p>

        {sdks.length > 0 ? (
          <div style={{ marginTop: 36, display: "grid", gap: 16 }}>
            {sdks.map(sdk => {
              const age = relAge(sdk.lastPublished);
              const changelogPath = CHANGELOG_PATHS[sdk.id];
              const changelogHref = changelogPath ? `${GITHUB_REPO}/blob/main/${changelogPath}` : null;
              return (
                <div key={sdk.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.25rem 1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <code style={{ fontSize: "1rem", fontWeight: 700, color: "#f1f5f9" }}>{sdk.name}</code>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: `${C.green}20`, color: "#34d399" }}>
                      v{sdk.version}
                    </span>
                    {age && (
                      <span style={{ fontSize: "0.78rem", color: C.muted }}>published {age}</span>
                    )}
                    <a href={sdk.registry} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", fontSize: "0.78rem", color: C.blue, textDecoration: "none" }}>
                      npm ↗
                    </a>
                    {changelogHref && (
                      <a href={changelogHref} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.78rem", color: C.amber, textDecoration: "none" }}>
                        CHANGELOG.md ↗
                      </a>
                    )}
                  </div>
                  {sdk.modules.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {sdk.modules.map(m => (
                        <span key={m} style={{ fontSize: "0.7rem", padding: "2px 8px", background: "#1e2a3a", color: C.muted, borderRadius: 5 }}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ marginTop: 36, padding: "1rem 1.25rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: "0.85rem", color: C.muted }}>
            SDK registry endpoint вернул ошибку. Полный CHANGELOG доступен напрямую в репозитории:{" "}
            <a href={`${GITHUB_REPO}/blob/main/packages/fintech-sdk/CHANGELOG.md`} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: "none" }}>
              fintech-sdk ↗
            </a>
          </div>
        )}

        <div style={{ marginTop: 36, padding: "14px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: "0.82rem", color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.text }}>Related:</strong>{" "}
          <Link href="/developers/fintech/sdk" style={{ color: C.blue, textDecoration: "none" }}>SDK reference →</Link>
          {" · "}
          <Link href="/developers/fintech/migration" style={{ color: C.blue, textDecoration: "none" }}>Migration guide →</Link>
          {" · "}
          <Link href="/developers/fintech/errors" style={{ color: C.blue, textDecoration: "none" }}>Error codes →</Link>
          {" · "}
          <Link href="/developers/fintech/rate-limits" style={{ color: C.blue, textDecoration: "none" }}>Rate limits →</Link>
        </div>
      </div>
    </main>
  );
}
