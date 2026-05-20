import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";

/* ISR — refresh every hour. The /api/aevion/sdks payload changes only
   when we publish a new SDK version, which is infrequent. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "AEVION SDKs — TypeScript clients for the ecosystem",
  description:
    "Four published AEVION SDK packages on npm: fintech-sdk, catalog-client, qpaynet-client, qcoreai-client. Install commands, versions, covered modules.",
  alternates: { canonical: "/sdks" },
  openGraph: {
    title: "AEVION SDKs",
    description: "Four TypeScript SDKs on npm covering the AEVION ecosystem.",
    siteName: "AEVION",
  },
};

interface SDK {
  id: string;
  name: string;
  version: string;
  description: string;
  install: string;
  registry: string;
  tarball: string;
  modules: string[];
  license: string;
}

interface SdksResponse {
  total: number;
  sdks: SDK[];
  docs: string;
  generatedAt: string;
}

async function fetchSdks(): Promise<SdksResponse | null> {
  try {
    const base = getApiBase();
    const r = await fetch(`${base}/api/aevion/sdks`, {
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    return (await r.json()) as SdksResponse;
  } catch {
    return null;
  }
}

const SCOPE_BADGE: Record<string, { label: string; color: string }> = {
  "@aevion-io": { label: "@aevion-io (official)", color: "#0d9488" },
  "@dosymbek": { label: "@dosymbek (personal)", color: "#7c3aed" },
};

function scopeOf(name: string): string {
  const m = name.match(/^(@[^/]+)\//);
  return m ? m[1] : "";
}

export default async function SdksPage() {
  const data = await fetchSdks();

  return (
    <main style={{ background: "#f8fafc", minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link
          href="/"
          style={{ color: "#64748b", fontSize: 14, textDecoration: "none" }}
        >
          ← AEVION
        </Link>

        <h1 style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", margin: "16px 0 8px" }}>
          AEVION SDKs
        </h1>
        <p style={{ fontSize: 17, color: "#64748b", marginBottom: 32, maxWidth: 720 }}>
          {data
            ? `${data.total} официально опубликованных TypeScript-пакета на npm, покрывающих экосистему AEVION. Zero-dep, strict-typed, готовы к prod.`
            : "TypeScript-клиенты для AEVION экосистемы (загрузка списка временно недоступна — попробуйте обновить страницу)."}
        </p>

        {!data && (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.08)",
              color: "#64748b",
            }}
          >
            SDK registry endpoint вернул ошибку. Это не блокирует установку — все 4 пакета
            опубликованы на npm и доступны через стандартный <code>npm install</code>.
          </div>
        )}

        {data && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: 20,
              marginBottom: 32,
            }}
          >
            {data.sdks.map((sdk) => {
              const scope = scopeOf(sdk.name);
              const badge = SCOPE_BADGE[scope] ?? { label: scope, color: "#64748b" };
              return (
                <article
                  key={sdk.id}
                  style={{
                    background: "#fff",
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 14,
                    padding: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <code style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>{sdk.name}</code>
                    <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>v{sdk.version}</span>
                    <span
                      style={{
                        fontSize: 11,
                        color: badge.color,
                        background: `${badge.color}14`,
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                      }}
                    >
                      {badge.label}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>{sdk.license}</span>
                  </div>

                  <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.55, margin: 0 }}>
                    {sdk.description}
                  </p>

                  <pre
                    style={{
                      background: "#0f172a",
                      color: "#e2e8f0",
                      padding: "12px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      overflowX: "auto",
                      margin: 0,
                    }}
                  >
                    <code>{sdk.install}</code>
                  </pre>

                  {sdk.modules.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {sdk.modules.map((m) => (
                        <span
                          key={m}
                          style={{
                            fontSize: 11,
                            color: "#475569",
                            background: "#f1f5f9",
                            padding: "3px 8px",
                            borderRadius: 5,
                            fontWeight: 500,
                          }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
                    <a
                      href={sdk.registry}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 13,
                        color: "#0d9488",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      npmjs.com →
                    </a>
                    <a
                      href={`https://www.npmjs.com/package/${sdk.name}?activeTab=readme`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 13,
                        color: "#64748b",
                        textDecoration: "none",
                      }}
                    >
                      README
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {data && (
          <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 32 }}>
            Registry source: <code>/api/aevion/sdks</code> · обновлено{" "}
            {new Date(data.generatedAt).toLocaleString("ru-RU")} ·{" "}
            <a
              href={data.docs}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0d9488", textDecoration: "none" }}
            >
              source on GitHub
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
