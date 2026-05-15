"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { use as usePromise } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type EmbedData = {
  id: string;
  status: "active" | "revoked" | "not_found" | "passed" | string;
  title?: string | null;
  artifactType?: string | null;
  versionNo?: number | null;
  canonicalArtifactHash?: string | null;
  canonicalArtifactHashPrefix?: string | null;
  createdAt?: string;
  artifactVersionId?: string | null;
  verifyUrl?: string | null;
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
};
const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};
const codeBlock: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  color: "#0f172a",
  background: "#f1f5f9",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 10,
  padding: "10px 12px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};
const copyBtn: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "#fff",
  color: "#0f172a",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

export default function PlanetBadgePage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = usePromise(params);
  const { showToast } = useToast();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const badgePath = useMemo(
    () => apiUrl(`/api/planet/certificates/${encodeURIComponent(certId)}/badge.svg?theme=${theme}`),
    [certId, theme]
  );
  const embedPath = useMemo(
    () => apiUrl(`/api/planet/certificates/${encodeURIComponent(certId)}/embed`),
    [certId]
  );

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const absoluteBadgeUrl = origin ? `${origin}${badgePath}` : badgePath;
  const absoluteEmbedUrl = origin ? `${origin}${embedPath}` : embedPath;
  const verifyTarget = data?.artifactVersionId
    ? `/planet/artifact/${data.artifactVersionId}`
    : `/planet`;
  const absoluteVerifyUrl = origin ? `${origin}${verifyTarget}` : verifyTarget;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(embedPath, { headers: { Accept: "application/json" } })
      .then(async (r) => {
        const json = (await r.json()) as EmbedData;
        if (!alive) return;
        if (r.status === 404 || json.status === "not_found") {
          setData({ id: certId, status: "not_found" });
        } else {
          setData(json);
        }
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [embedPath, certId]);

  function copy(text: string, label: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`${label} copied`, "success");
    }
  }

  const imgSnippet = `<a href="${absoluteVerifyUrl}" target="_blank" rel="noopener">
  <img src="${absoluteBadgeUrl}" alt="AEVION Planet certificate" height="22" />
</a>`;

  const jsSnippet = `// Fetch certificate status as JSON
fetch("${absoluteEmbedUrl}")
  .then(r => r.json())
  .then(d => console.log("Planet:", d.status, d.canonicalArtifactHashPrefix));`;

  const notFound = data?.status === "not_found";

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ marginBottom: 20 }}>
            <Link
              href="/planet"
              style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
            >
              ← AEVION Planet
            </Link>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Planet certificate badge
          </h1>
          <p style={{ color: "#475569", fontSize: 14, marginTop: 8, marginBottom: 24 }}>
            Embed a verifiable Planet certificate on any site. Badge updates live from the registry.
          </p>

          {loading && <div style={{ ...card, color: "#64748b" }}>Loading certificate…</div>}
          {error && !loading && (
            <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
              Error loading: {error}
            </div>
          )}
          {!loading && !error && notFound && (
            <div style={{ ...card, borderColor: "rgba(234,179,8,0.4)", background: "rgba(254,252,232,0.6)", color: "#854d0e" }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Not found</div>
              <div style={{ fontSize: 13 }}>
                No Planet certificate with id <code>{certId}</code>.
              </div>
            </div>
          )}

          {!loading && !error && !notFound && data && (
            <>
              <div style={{ ...card, marginBottom: 20 }}>
                <div style={labelStyle}>Live preview</div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "20px 16px",
                    background:
                      theme === "light"
                        ? "linear-gradient(135deg, #f8fafc, #e2e8f0)"
                        : "linear-gradient(135deg, #0f172a, #1e293b)",
                    borderRadius: 12,
                    marginBottom: 14,
                    minHeight: 80,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badgePath} alt="Planet badge preview" height={22} style={{ display: "block" }} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Theme:</span>
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      style={{
                        ...copyBtn,
                        background: theme === t ? "#0f172a" : "#fff",
                        color: theme === t ? "#fff" : "#0f172a",
                        textTransform: "capitalize",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ ...card, marginBottom: 20 }}>
                <div style={labelStyle}>Certificate details</div>
                <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#0f172a" }}>
                  {data.title && (
                    <div>
                      <span style={{ color: "#64748b" }}>Title: </span>
                      <span style={{ fontWeight: 700 }}>{data.title}</span>
                    </div>
                  )}
                  {data.artifactType && (
                    <div>
                      <span style={{ color: "#64748b" }}>Type: </span>
                      <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{data.artifactType}</span>
                    </div>
                  )}
                  {typeof data.versionNo === "number" && (
                    <div>
                      <span style={{ color: "#64748b" }}>Version: </span>
                      <span>{data.versionNo}</span>
                    </div>
                  )}
                  {data.createdAt && (
                    <div>
                      <span style={{ color: "#64748b" }}>Issued: </span>
                      <span>{new Date(data.createdAt).toUTCString()}</span>
                    </div>
                  )}
                  {data.canonicalArtifactHash && (
                    <div style={{ wordBreak: "break-all" }}>
                      <span style={{ color: "#64748b" }}>SHA-256: </span>
                      <code style={{ fontSize: 11 }}>{data.canonicalArtifactHash}</code>
                    </div>
                  )}
                </div>
              </div>

              <Snippet
                label="HTML — &lt;img&gt; tag (recommended)"
                value={imgSnippet}
                onCopy={() => copy(imgSnippet, "HTML snippet")}
              />
              <Snippet
                label="Direct badge URL"
                value={absoluteBadgeUrl}
                onCopy={() => copy(absoluteBadgeUrl, "Badge URL")}
              />
              <Snippet
                label="Embed JSON — programmatic checks"
                value={jsSnippet}
                onCopy={() => copy(jsSnippet, "JS snippet")}
              />
            </>
          )}
        </div>
      </ProductPageShell>
    </main>
  );
}

function Snippet({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ ...labelStyle, marginBottom: 0 }} dangerouslySetInnerHTML={{ __html: label }} />
        <button onClick={onCopy} style={copyBtn}>
          Copy
        </button>
      </div>
      <div style={codeBlock}>{value}</div>
    </div>
  );
}
