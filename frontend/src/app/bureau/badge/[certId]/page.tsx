"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { use as usePromise } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Embed = {
  id: string;
  title: string;
  kind: string;
  verificationLevel: string;
  verifiedName: string | null;
  verifiedAt: string | null;
  protectedAt: string;
  status: string;
  verifyUrl: string;
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
  marginBottom: 16,
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

export default function BureauBadgePage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = usePromise(params);
  const { showToast } = useToast();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [data, setData] = useState<Embed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const badgePath = useMemo(
    () => apiUrl(`/api/bureau/cert/${encodeURIComponent(certId)}/badge.svg?theme=${theme}`),
    [certId, theme]
  );
  const embedPath = useMemo(
    () => apiUrl(`/api/bureau/cert/${encodeURIComponent(certId)}/embed`),
    [certId]
  );

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const absoluteBadgeUrl = origin ? `${origin}${badgePath}` : badgePath;
  const absoluteEmbedUrl = origin ? `${origin}${embedPath}` : embedPath;
  const verifyTarget = data?.verifyUrl || `/bureau`;
  const absoluteVerifyUrl = origin ? `${origin}${verifyTarget}` : verifyTarget;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(embedPath, { headers: { Accept: "application/json" } })
      .then(async (r) => {
        const json = await r.json();
        if (!alive) return;
        if (r.status === 404 || json.status === "not_found") {
          setError("Certificate not found");
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
  }, [embedPath]);

  function copy(text: string, label: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`${label} copied`, "success");
    }
  }

  const altText = data
    ? `AEVION Bureau — ${data.title} (${data.verificationLevel})`
    : "AEVION Bureau";

  const imgSnippet = `<a href="${absoluteVerifyUrl}" target="_blank" rel="noopener">
  <img src="${absoluteBadgeUrl}" alt="${altText}" height="22" />
</a>`;
  const mdSnippet = `[![${altText}](${absoluteBadgeUrl})](${absoluteVerifyUrl})`;
  const jsSnippet = `// Fetch verification status as JSON
fetch("${absoluteEmbedUrl}")
  .then(r => r.json())
  .then(d => console.log("AEVION Bureau:", d.verificationLevel, "name:", d.verifiedName));`;

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/bureau"
              style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
            >
              ← AEVION Bureau
            </Link>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Verification badge
          </h1>
          <p style={{ color: "#475569", fontSize: 14, marginTop: 8, marginBottom: 24 }}>
            Drop a live AEVION Bureau verification badge on any README or partner site. Updates when verification level changes.
          </p>

          {loading && <div style={{ ...card, color: "#64748b" }}>Loading…</div>}
          {error && !loading && (
            <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>{error}</div>
          )}
          {!loading && !error && data && (
            <>
              <div style={card}>
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
                  <img src={badgePath} alt="Badge preview" height={22} style={{ display: "block" }} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Theme:</span>
                  {(["dark", "light"] as const).map((th) => (
                    <button
                      key={th}
                      onClick={() => setTheme(th)}
                      style={{
                        ...copyBtn,
                        background: theme === th ? "#0f172a" : "#fff",
                        color: theme === th ? "#fff" : "#0f172a",
                        textTransform: "capitalize",
                      }}
                    >
                      {th}
                    </button>
                  ))}
                </div>
              </div>

              <div style={card}>
                <div style={labelStyle}>Certificate details</div>
                <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#0f172a" }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Title: </span>
                    <span style={{ fontWeight: 700 }}>{data.title}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Kind: </span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{data.kind}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Level: </span>
                    <span style={{ fontWeight: 800 }}>{data.verificationLevel}</span>
                  </div>
                  {data.verifiedName && (
                    <div>
                      <span style={{ color: "#64748b" }}>Verified name: </span>
                      <span style={{ fontWeight: 700 }}>{data.verifiedName}</span>
                    </div>
                  )}
                  <div>
                    <span style={{ color: "#64748b" }}>Status: </span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{data.status}</span>
                  </div>
                </div>
              </div>

              <Snippet
                label="Markdown — README badge (recommended)"
                value={mdSnippet}
                onCopy={() => copy(mdSnippet, "Markdown")}
              />
              <Snippet
                label="HTML — &lt;img&gt; tag"
                value={imgSnippet}
                onCopy={() => copy(imgSnippet, "HTML")}
              />
              <Snippet
                label="Direct badge URL"
                value={absoluteBadgeUrl}
                onCopy={() => copy(absoluteBadgeUrl, "URL")}
              />
              <Snippet
                label="Embed JSON — programmatic checks"
                value={jsSnippet}
                onCopy={() => copy(jsSnippet, "JS")}
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
    <div style={card}>
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
