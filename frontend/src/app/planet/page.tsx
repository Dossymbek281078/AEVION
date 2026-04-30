"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl, getBackendOrigin } from "@/lib/apiBase";
import { planetNominationOptions } from "@/lib/planetNominations";

const TOKEN_KEY = "aevion_auth_token_v1";
const PLANET_FORM_DRAFT_KEY = "aevion_planet_form_draft_v1";

type ArtifactType = "movie" | "music" | "code" | "web";

type Validator = {
  validatorId: string;
  status: "passed" | "flagged" | "rejected";
  publicExplanation?: any;
  evidenceRefs?: any;
  resubmitPolicy?: { allowed: boolean; requiredChangeDescription: string };
  metrics?: any;
  threshold?: any;
};

type PlanetResponse = {
  submissionId: string;
  artifactVersionId: string;
  status: "passed" | "flagged" | "rejected";
  evidenceRoot: string;
  validators: Validator[];
  certificate?: any;
};

type PlanetDraft = {
  artifactType: ArtifactType;
  title: string;
  productKey: string;
  tier: string;
  declaredLicense: string;
  mediaFingerprint: string;
  mediaArtist: string;
  mediaIsrc: string;
  mediaDurationSec: string;
  codeFilesJson: string;
};

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default function PlanetCompliancePage() {
  const { showToast } = useToast();
  const [token, setToken] = useState("");

  const [artifactType, setArtifactType] = useState<ArtifactType>("code");
  const [title, setTitle] = useState("My AI Code Artifact");
  const [productKey, setProductKey] = useState("planet_prod_v1_code");
  const [tier, setTier] = useState("standard");
  const [declaredLicense, setDeclaredLicense] = useState("MIT");

  const [mediaFingerprint, setMediaFingerprint] = useState("a1b2c3d4e5f6789012345678901234567890abcd1234567890abcd1234567890ab");
  const [mediaArtist, setMediaArtist] = useState("");
  const [mediaIsrc, setMediaIsrc] = useState("");
  const [mediaDurationSec, setMediaDurationSec] = useState("");
  const [codeFilesJson, setCodeFilesJson] = useState(
    JSON.stringify(
      [
        {
          path: "src/index.ts",
          content: "export const hello = 'planet';\n",
        },
      ],
      null,
      2,
    ),
  );

  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<PlanetResponse | null>(null);
  const [awardPreset, setAwardPreset] = useState<"music" | "film" | null>(null);
  const [planetStats, setPlanetStats] = useState<{
    eligibleParticipants: number;
    distinctVotersAllTime: number;
    shieldedObjects?: number;
  } | null>(null);

  const applyMediaTemplate = (preset: "music" | "film") => {
    if (preset === "music") {
      if (!mediaArtist.trim()) setMediaArtist("Artist / Producer");
      if (!mediaDurationSec.trim()) setMediaDurationSec("180");
      return;
    }
    if (!mediaArtist.trim()) setMediaArtist("Director / Studio");
    if (!mediaDurationSec.trim()) setMediaDurationSec("600");
  };

  const applyAwardPreset = (
    preset: "music" | "film" | null,
    opts?: { title?: string; productKey?: string }
  ) => {
    setAwardPreset(preset);
    if (preset === "music") {
      setTitle(opts?.title || "AEVION Music Awards submission");
      setProductKey(opts?.productKey || "aevion_award_music_v1");
      applyMediaTemplate("music");
      return;
    }
    if (preset === "film") {
      setTitle(opts?.title || "AEVION Film Awards submission");
      setProductKey(opts?.productKey || "aevion_award_film_v1");
      applyMediaTemplate("film");
      return;
    }
  };

  const applyAwardMode = (preset: "music" | "film") => {
    setArtifactType(preset === "music" ? "music" : "movie");
    applyAwardPreset(preset);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY) || "";
      setToken(raw);
      const sp = new URLSearchParams(window.location.search);
      const hasPresetParams = Boolean(sp.get("type") || sp.get("artifactType") || sp.get("preset"));
      if (!hasPresetParams) {
        const draftRaw = localStorage.getItem(PLANET_FORM_DRAFT_KEY);
        const draft = draftRaw ? (safeJsonParse(draftRaw) as PlanetDraft | null) : null;
        if (draft && draft.artifactType) {
          setArtifactType(draft.artifactType);
          setTitle(draft.title || "My AI Code Artifact");
          setProductKey(draft.productKey || "planet_prod_v1_code");
          setTier(draft.tier || "standard");
          setDeclaredLicense(draft.declaredLicense || "MIT");
          setMediaFingerprint(draft.mediaFingerprint || "");
          setMediaArtist(draft.mediaArtist || "");
          setMediaIsrc(draft.mediaIsrc || "");
          setMediaDurationSec(draft.mediaDurationSec || "");
          setCodeFilesJson(draft.codeFilesJson || codeFilesJson);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const draft: PlanetDraft = {
      artifactType,
      title,
      productKey,
      tier,
      declaredLicense,
      mediaFingerprint,
      mediaArtist,
      mediaIsrc,
      mediaDurationSec,
      codeFilesJson,
    };
    try {
      localStorage.setItem(PLANET_FORM_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    artifactType,
    title,
    productKey,
    tier,
    declaredLicense,
    mediaFingerprint,
    mediaArtist,
    mediaIsrc,
    mediaDurationSec,
    codeFilesJson,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/planet/stats"));
        const j = await r.json().catch(() => null);
        if (!r.ok || cancelled) return;
        setPlanetStats({
          eligibleParticipants: j.eligibleParticipants ?? 0,
          distinctVotersAllTime: j.distinctVotersAllTime ?? 0,
          shieldedObjects: j.shieldedObjects ?? 0,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Deep links: `/planet?type=music`, `/planet?artifactType=movie` (showcases `/awards/*`). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const t = (sp.get("type") || sp.get("artifactType") || "").toLowerCase();
    const presetRaw = (sp.get("preset") || "").toLowerCase();
    const titleQ = (sp.get("title") || "").trim();
    const productKeyQ = (sp.get("productKey") || "").trim();
    if (t === "music" || t === "movie" || t === "code" || t === "web") {
      setArtifactType(t as ArtifactType);
      if (t === "music") {
        applyAwardPreset("music", { title: titleQ || undefined, productKey: productKeyQ || undefined });
      } else if (t === "movie") {
        applyAwardPreset("film", { title: titleQ || undefined, productKey: productKeyQ || undefined });
      }
    } else if (presetRaw === "music" || presetRaw === "film") {
      const p = presetRaw as "music" | "film";
      setArtifactType(p === "music" ? "music" : "movie");
      applyAwardPreset(p, { title: titleQ || undefined, productKey: productKeyQ || undefined });
    }
  }, []);

  const codeFiles = useMemo(() => {
    const v = safeJsonParse(codeFilesJson);
    return Array.isArray(v) ? v : null;
  }, [codeFilesJson]);
  const nominationOptions = useMemo(() => planetNominationOptions(artifactType), [artifactType]);

  const createOrRun = async () => {
    setBusy(true);
    setRes(null);
    try {
      if (!token) throw new Error("Please login first");

      if ((artifactType === "code" || artifactType === "web") && !codeFiles) {
        throw new Error("Invalid codeFiles JSON (need array of {path, content})");
      }

      const body: any = {
        artifactType,
        title,
        productKey,
        tier,
        declaredLicense,
        generationParams: { seed: 1, mvp: true },
      };

      if (artifactType === "movie" || artifactType === "music") {
        body.mediaFingerprint = mediaFingerprint;
        const desc: Record<string, string | number> = {};
        if (mediaArtist.trim()) desc.artist = mediaArtist.trim();
        if (mediaIsrc.trim()) desc.isrc = mediaIsrc.trim();
        const d = mediaDurationSec.trim();
        if (d) {
          const n = Number(d);
          if (Number.isFinite(n) && n >= 0) desc.durationSec = n;
        }
        if (Object.keys(desc).length) body.mediaDescriptor = desc;
      } else {
        body.codeFiles = codeFiles;
      }

      const r = await fetch(apiUrl("/api/planet/submissions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.error || "Create failed");
      }

      setRes((await r.json()) as PlanetResponse);
    } catch (e: any) {
      showToast(e?.message || "Submission error", "error");
    } finally {
      setBusy(false);
    }
  };

  const resubmit = async () => {
    if (!res) return;
    setBusy(true);
    try {
      if (!token) throw new Error("Please login first");

      const body: any = {
        declaredLicense,
        generationParams: { seed: 2, mvp: true },
      };

      if (artifactType === "movie" || artifactType === "music") {
        body.mediaFingerprint = mediaFingerprint;
        const desc: Record<string, string | number> = {};
        if (mediaArtist.trim()) desc.artist = mediaArtist.trim();
        if (mediaIsrc.trim()) desc.isrc = mediaIsrc.trim();
        const d = mediaDurationSec.trim();
        if (d) {
          const n = Number(d);
          if (Number.isFinite(n) && n >= 0) desc.durationSec = n;
        }
        if (Object.keys(desc).length) body.mediaDescriptor = desc;
      } else {
        if (!codeFiles) throw new Error("Invalid codeFiles JSON");
        body.codeFiles = codeFiles;
      }

      const r = await fetch(
        apiUrl(`/api/planet/submissions/${res.submissionId}/resubmit`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        },
      );
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.error || "Resubmit failed");
      }
      setRes((await r.json()) as PlanetResponse);
    } catch (e: any) {
      showToast(e?.message || "Resubmission error", "error");
    } finally {
      setBusy(false);
    }
  };

  const backendOrigin = getBackendOrigin();

  const createLabel = res ? "Re-run in new submission (separate)" : "Create & Run Compliance";
  const awardsBackHref = awardPreset === "music" ? "/awards/music" : awardPreset === "film" ? "/awards/film" : "/awards";

  const renderSegments = (v: Validator) => {
    const segs = v?.evidenceRefs?.segments;
    if (!Array.isArray(segs) || !segs.length) return null;
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Segments (current code)</div>
        <pre
          style={{
            background: "#f6f6f6",
            padding: 12,
            borderRadius: 10,
            fontSize: 12,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(segs.slice(0, 25), null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <main>
      <ProductPageShell>
      <Wave1Nav hidePlanet />
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Planet / Evidence / Certificate (MVP)</h1>
      <div style={{ color: "#555", marginBottom: 16 }}>
        Single pipeline: canonization → validators → evidenceRoot → signed certificate. Code/web segments shown based on your code.
      </div>

      {planetStats ? (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(15,118,110,0.08)",
            border: "1px solid rgba(15,118,110,0.2)",
            fontSize: 13,
            color: "#334155",
          }}
        >
          <strong>Planet</strong>: participants with active symbol (metric Y) —{" "}
          <strong>{planetStats.eligibleParticipants}</strong>; unique voters —{" "}
          <strong>{planetStats.distinctVotersAllTime}</strong>
          {typeof planetStats.shieldedObjects === "number" && (
            <>
              ; <a href="/quantum-shield" style={{ color: "#0d9488", textDecoration: "none", fontWeight: 800 }}>🛡️ shielded objects</a>{" "}
              — <strong>{planetStats.shieldedObjects}</strong>
            </>
          )}
          . API:{" "}
          <code style={{ fontSize: 12 }}>GET {backendOrigin}/api/planet/stats</code>
        </div>
      ) : null}

      {awardPreset ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: awardPreset === "music" ? "rgba(124,58,237,0.1)" : "rgba(220,38,38,0.08)",
            border: `1px solid ${awardPreset === "music" ? "rgba(124,58,237,0.35)" : "rgba(220,38,38,0.3)"}`,
            fontSize: 14,
            color: "#334155",
          }}
        >
          <strong>{awardPreset === "music" ? "Music Awards" : "Film Awards"}</strong> — you came from the showcase{" "}
          <Link href={awardPreset === "music" ? "/awards/music" : "/awards/film"} style={{ fontWeight: 800 }}>
            AEVION Awards
          </Link>
          . Artifact type and productKey are prefilled; after certification the work participates in Planet voting.
        </div>
      ) : null}

      <section style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 16, padding: 16, background: "#fff" }}>
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "linear-gradient(135deg, rgba(15,118,110,0.06), rgba(99,102,241,0.05))",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Quick submission mode</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => applyAwardMode("music")}
              style={{
                padding: "8px 10px",
                borderRadius: 9,
                border: "1px solid rgba(124,58,237,0.35)",
                background: "rgba(124,58,237,0.1)",
                color: "#4c1d95",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Music Awards preset
            </button>
            <button
              type="button"
              onClick={() => applyAwardMode("film")}
              style={{
                padding: "8px 10px",
                borderRadius: 9,
                border: "1px solid rgba(180,83,9,0.35)",
                background: "rgba(180,83,9,0.1)",
                color: "#92400e",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Film Awards preset
            </button>
            <button
              type="button"
              onClick={() => {
                setAwardPreset(null);
                setArtifactType("code");
                setTitle("My AI Code Artifact");
                setProductKey("planet_prod_v1_code");
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 9,
                border: "1px solid rgba(15,23,42,0.25)",
                background: "#fff",
                color: "#334155",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Reset to generic mode
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(PLANET_FORM_DRAFT_KEY);
                } catch {
                  // ignore
                }
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 9,
                border: "1px solid rgba(0,0,0,0.25)",
                background: "#fff",
                color: "#475569",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Clear saved draft
            </button>
          </div>
        </div>

        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(15,23,42,0.02)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Nominations for this artifact type</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {nominationOptions.map((n) => (
              <span
                key={n.id}
                style={{
                  padding: "5px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: n.id === "general" ? "rgba(15,23,42,0.06)" : "rgba(15,118,110,0.08)",
                  color: "#334155",
                  fontSize: 12,
                }}
              >
                {n.label}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          }}
        >
          <label>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>artifactType</div>
            <select
              value={artifactType}
              onChange={(e) => {
                const nextType = e.target.value as ArtifactType;
                setArtifactType(nextType);
                if (nextType === "music") {
                  applyAwardPreset("music");
                } else if (nextType === "movie") {
                  applyAwardPreset("film");
                } else {
                  setAwardPreset(null);
                }
              }}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="movie">movie</option>
              <option value="music">music</option>
              <option value="code">code</option>
              <option value="web">web</option>
            </select>
          </label>

          <label>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>title</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </label>

          <label>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>productKey</div>
            <input value={productKey} onChange={(e) => setProductKey(e.target.value)} style={{ width: "100%", padding: 10 }} />
            <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
              Recommendation for track:{" "}
              <code>
                {artifactType === "music"
                  ? "aevion_award_music_v1"
                  : artifactType === "movie"
                    ? "aevion_award_film_v1"
                    : "planet_prod_v1_code"}
              </code>
            </div>
          </label>

          <label>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>tier</div>
            <input value={tier} onChange={(e) => setTier(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </label>

          <label style={{ gridColumn: "1 / span 2" }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>declaredLicense (code/web + MVP)</div>
            <input value={declaredLicense} onChange={(e) => setDeclaredLicense(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </label>

          {(artifactType === "movie" || artifactType === "music") ? (
            <>
              <label style={{ gridColumn: "1 / span 2" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>mediaFingerprint (hex64 or arbitrary id)</div>
                <input value={mediaFingerprint} onChange={(e) => setMediaFingerprint(e.target.value)} style={{ width: "100%", padding: 10 }} />
              </label>
              <label>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>artist (optional, for singles)</div>
                <input value={mediaArtist} onChange={(e) => setMediaArtist(e.target.value)} style={{ width: "100%", padding: 10 }} />
              </label>
              <label>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>ISRC (optional)</div>
                <input value={mediaIsrc} onChange={(e) => setMediaIsrc(e.target.value)} style={{ width: "100%", padding: 10 }} />
              </label>
              <label style={{ gridColumn: "1 / span 2" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>duration (sec, optional)</div>
                <input
                  value={mediaDurationSec}
                  onChange={(e) => setMediaDurationSec(e.target.value)}
                  placeholder="187.5"
                  style={{ width: "100%", padding: 10 }}
                />
              </label>
              <div style={{ gridColumn: "1 / span 2", marginTop: -4 }}>
                <button
                  type="button"
                  onClick={() => applyMediaTemplate(artifactType === "music" ? "music" : "film")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 9,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "#fff",
                    color: "#334155",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  Apply recommended media fields
                </button>
              </div>
            </>
          ) : (
            <label style={{ gridColumn: "1 / span 2" }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>codeFiles JSON array [{`{path, content}`}]</div>
              <textarea
                value={codeFilesJson}
                onChange={(e) => setCodeFilesJson(e.target.value)}
                rows={10}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.15)", fontFamily: "monospace" }}
              />
            </label>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <button
            onClick={createOrRun}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 900,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Working..." : createLabel}
          </button>

          <button
            onClick={resubmit}
            disabled={busy || !res || res.status === "passed"}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#fff",
              color: "#111",
              cursor: "pointer",
              fontWeight: 900,
              opacity: busy || !res || res.status === "passed" ? 0.55 : 1,
            }}
          >
            Resubmit (after flagged)
          </button>
        </div>
      </section>

      {res ? (
        <section style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Result</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>status</div>
              <div style={{ fontWeight: 900 }}>{res.status}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>evidenceRoot</div>
              <div style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{res.evidenceRoot}</div>
            </div>
          </div>

          {res.certificate ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>certificate</div>
              <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 10, fontSize: 12 }}>
                {JSON.stringify(res.certificate, null, 2)}
              </pre>
              <div style={{ marginTop: 10 }}>
                <Link
                  href={`/planet/artifact/${res.artifactVersionId}`}
                  style={{ fontWeight: 800, color: "#0a5" }}
                >
                  Public showcase + voting →
                </Link>
              </div>
            </div>
          ) : null}

          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(15,23,42,0.02)",
              padding: "10px 12px",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Next action</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Link
                href={`/planet/artifact/${res.artifactVersionId}`}
                style={{
                  padding: "8px 10px",
                  borderRadius: 9,
                  border: "1px solid rgba(15,118,110,0.3)",
                  color: "#0f766e",
                  fontWeight: 800,
                  textDecoration: "none",
                  background: "rgba(15,118,110,0.08)",
                }}
              >
                Open artifact card
              </Link>
              <Link
                href={awardsBackHref}
                style={{
                  padding: "8px 10px",
                  borderRadius: 9,
                  border: "1px solid rgba(0,0,0,0.18)",
                  color: "#334155",
                  fontWeight: 700,
                  textDecoration: "none",
                  background: "#fff",
                }}
              >
                Back to awards showcase
              </Link>
              <button
                type="button"
                onClick={() => setRes(null)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 9,
                  border: "1px solid rgba(0,0,0,0.18)",
                  color: "#334155",
                  fontWeight: 700,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                New submission (clear result)
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>validators</div>
            <div style={{ display: "grid", gap: 12 }}>
              {res.validators.map((v) => (
                <article key={v.validatorId} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 900 }}>{v.validatorId}</div>
                    <div style={{ fontWeight: 900, color: v.status === "passed" ? "#0a5" : v.status === "flagged" ? "#b80" : "crimson" }}>
                      {v.status}
                    </div>
                  </div>
                  {v.publicExplanation ? (
                    <pre style={{ marginTop: 8, background: "#fafafa", padding: 10, borderRadius: 10, fontSize: 12, overflowX: "auto" }}>
                      {JSON.stringify(v.publicExplanation, null, 2)}
                    </pre>
                  ) : null}
                  {renderSegments(v)}
                  {v.resubmitPolicy?.allowed ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "#333" }}>
                      resubmit: {v.resubmitPolicy.requiredChangeDescription}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      </ProductPageShell>
    </main>
  );
}

