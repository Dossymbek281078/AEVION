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
  seasonId: string;
  season: { code: string; title: string; status: string };
  artifactVersionId: string;
  submissionTitle: string;
  artifactType: string;
  status: string;
  medalPlace: number | null;
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

export default function AwardBadgePage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = usePromise(params);
  const { showToast } = useToast();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [data, setData] = useState<Embed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const badgePath = useMemo(
    () => apiUrl(`/api/awards/entries/${encodeURIComponent(entryId)}/badge.svg?theme=${theme}`),
    [entryId, theme]
  );
  const embedPath = useMemo(
    () => apiUrl(`/api/awards/entries/${encodeURIComponent(entryId)}/embed`),
    [entryId]
  );

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const absoluteBadgeUrl = origin ? `${origin}${badgePath}` : badgePath;
  const absoluteEmbedUrl = origin ? `${origin}${embedPath}` : embedPath;
  const verifyTarget = data?.verifyUrl || `/planet`;
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
          setError("Entry not found");
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

  const placeText = data?.medalPlace
    ? data.medalPlace === 1
      ? "🥇 1st place"
      : data.medalPlace === 2
      ? "🥈 2nd place"
      : "🥉 3rd place"
    : null;

  const altText = data
    ? `AEVION Awards — ${data.submissionTitle}${placeText ? ` (${placeText})` : ""}`
    : "AEVION Award";

  const imgSnippet = `<a href="${absoluteVerifyUrl}" target="_blank" rel="noopener">
  <img src="${absoluteBadgeUrl}" alt="${altText}" height="22" />
</a>`;
  const mdSnippet = `[![${altText}](${absoluteBadgeUrl})](${absoluteVerifyUrl})`;
  const jsSnippet = `// Fetch entry status as JSON
fetch("${absoluteEmbedUrl}")
  .then(r => r.json())
  .then(d => console.log("AEVION Award:", d.status, "place:", d.medalPlace));`;

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/awards"
              style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
            >
              ← AEVION Awards
            </Link>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Awards entry badge
          </h1>
          <p style={{ color: "#475569", fontSize: 14, marginTop: 8, marginBottom: 24 }}>
            Drop a live AEVION Awards badge on any README or partner site. Updates when status or medal changes.
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
                  <img src={badgePath} alt="Award badge preview" height={22} style={{ display: "block" }} />
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
                <div style={labelStyle}>Entry details</div>
                <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#0f172a" }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Title: </span>
                    <span style={{ fontWeight: 700 }}>{data.submissionTitle}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Season: </span>
                    <span style={{ fontWeight: 700 }}>{data.season.title}</span>
                    <span style={{ marginLeft: 6, padding: "2px 6px", borderRadius: 4, background: "rgba(15,23,42,0.06)", fontSize: 10, fontFamily: "monospace" }}>
                      {data.season.status}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Status: </span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{data.status}</span>
                  </div>
                  {placeText && (
                    <div>
                      <span style={{ color: "#64748b" }}>Medal: </span>
                      <span style={{ fontWeight: 800 }}>{placeText}</span>
                    </div>
                  )}
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
