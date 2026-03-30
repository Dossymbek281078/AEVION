"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { bureauUrlFocusObject, qsignUrlForQRightObject } from "@/lib/wave1Payload";
import { apiUrl } from "@/lib/apiBase";

type RightObject = {
  id: string;
  title: string;
  kind: string;
  description: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerUserId?: string;
  country?: string;
  city?: string;
  contentHash: string;
  createdAt: string;
};

const DEMO_ITEMS: RightObject[] = [
  { id: "demo-1", title: "AI Music Generator v2.1", kind: "code", description: "Neural network for music generation with transformer architecture. Supports MIDI output and multi-track rendering.", ownerName: "Dosymbek A.", ownerEmail: "d@aevion.app", country: "Kazakhstan", city: "Astana", contentHash: "sha256:a3f8c1d9e4b7f2a6c8d0e5f3b9a1c7d4e6f8a2b4c6d8e0f1a3b5c7d9e1f3a5", createdAt: "2026-03-15T10:30:00Z" },
  { id: "demo-2", title: "Quantum Shield Protocol Whitepaper", kind: "text", description: "Technical specification for three-layer cryptographic protection: Ed25519 + Shamir's Secret Sharing + HMAC-SHA256.", ownerName: "AEVION Research", ownerEmail: "research@aevion.app", country: "Kazakhstan", city: "Astana", contentHash: "sha256:b4e9d2c8f5a1b7e3d9c5f1a7b3e9d5c1f7a3b9e5d1c7f3a9b5e1d7c3f9a5b1", createdAt: "2026-03-10T14:20:00Z" },
  { id: "demo-3", title: "CyberChess AI Engine", kind: "code", description: "Chess engine with minimax + alpha-beta pruning, piece-square tables, 6 difficulty levels from 400 to 2400 ELO.", ownerName: "Dosymbek A.", ownerEmail: "d@aevion.app", country: "Kazakhstan", city: "Astana", contentHash: "sha256:c5f0e3d9a6b2c8f4e0d6a2b8c4f0e6d2a8b4c0f6e2d8a4b0c6f2e8d4a0b6c2", createdAt: "2026-03-20T09:15:00Z" },
  { id: "demo-4", title: "AEVION Bank Smart Contract", kind: "code", description: "Automated royalty distribution contract with Trust Graph integration. Handles P2P transfers, staking, and AEC minting.", ownerName: "AEVION Finance", ownerEmail: "finance@aevion.app", country: "Kazakhstan", city: "Astana", contentHash: "sha256:d6a1f4e0b7c3d9a5f1e7b3c9d5a1f7e3b9c5d1a7f3e9b5c1d7a3f9e5b1c7d3", createdAt: "2026-03-22T16:45:00Z" },
  { id: "demo-5", title: "Planet Compliance Validator", kind: "code", description: "Automated compliance checking module: canonization, evidence root generation, and certificate signing pipeline.", ownerName: "AEVION Research", ownerEmail: "research@aevion.app", country: "Kazakhstan", city: "Astana", contentHash: "sha256:e7b2a5f1c8d4e0a6f2b8c4d0e6a2f8b4c0d6e2a8f4b0c6d2e8a4f0b6c2d8e4", createdAt: "2026-03-25T11:00:00Z" },
];

export default function QRightPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<RightObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("idea");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [listMineOnly, setListMineOnly] = useState(false);
  const TOKEN_KEY = "aevion_auth_token_v1";

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return {};
      return { Authorization: `Bearer ${raw}` };
    } catch {
      return {};
    }
  };

  useEffect(() => {
    // Optional prefill for "place for realization" from Globus node clicks.
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("country");
    const ci = sp.get("city");
    const prefTitle = sp.get("title");
    const prefDesc = sp.get("description");
    if (c) setCountry(c);
    if (ci) setCity(ci);
    if (prefTitle) setTitle(prefTitle);
    if (prefDesc) setDescription(prefDesc);
  }, []);

  useEffect(() => {
    // If user is logged in, prefill owner fields from Auth (/api/auth/me).
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return;

      fetch(apiUrl("/api/auth/me"), {
        method: "GET",
        headers: { Authorization: `Bearer ${raw}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.user) return;
          const u = data.user as { name: string; email: string };
          setOwnerName((n) => n || u.name);
          setOwnerEmail((e) => e || u.email);
        })
        .catch(() => null);
    } catch {
      // ignore
    }
  }, []);

  const load = async (mineFlag: boolean) => {
    try {
      setLoading(true);
      setErr(null);
      const qs = mineFlag ? "?mine=1" : "";
      const res = await fetch(`${apiUrl("/api/qright/objects")}${qs}`, {
        headers: { ...authHeaders() },
      });
      if (res.status === 401) {
        setListMineOnly(false);
        throw new Error("Sign in via Auth to see your records only");
      }
      if (!res.ok) throw new Error("Failed to load QRight registry");
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
        setErr(null); // Don't show error — show demo data instead
        setItems(DEMO_ITEMS);
      } else {
        setErr(m);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(listMineOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable enough for this page
  }, [listMineOnly]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setErr("Title и описание обязательны");
      return;
    }

    try {
      setSaving(true);
      setErr(null);

      const res = await fetch(apiUrl("/api/qright/objects"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          title,
          kind,
          description,
          ownerName: ownerName || undefined,
          ownerEmail: ownerEmail || undefined,
          country: country || undefined,
          city: city || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Error при регистрации объекта");
      }

      setTitle("");
      setDescription("");
      setOwnerName("");
      setOwnerEmail("");
      setCountry("");
      setCity("");
      setKind("idea");

      showToast("Object registered in QRight", "success");
      await load(listMineOnly);
    } catch (e) {
      showToast((e as Error).message, "error");
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <ProductPageShell>
      <Wave1Nav />
      <PipelineSteps current="qright" />

      {/* Pipeline flow */}
      <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 14, background: "linear-gradient(135deg, rgba(13,148,136,0.06), rgba(124,58,237,0.04))", border: "1px solid rgba(13,148,136,0.15)" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0d9488", marginBottom: 6 }}>YOUR IP PIPELINE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13 }}>
          <span style={{ padding: "4px 10px", borderRadius: 8, background: "#0d9488", color: "#fff", fontWeight: 800 }}>1. Register here</span>
          <span style={{ color: "#94a3b8" }}>→</span>
          <span style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #0f172a", fontWeight: 700, color: "#0f172a" }}>2. Sign (QSign)</span>
          <span style={{ color: "#94a3b8" }}>→</span>
          <span style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #7c3aed", fontWeight: 700, color: "#7c3aed" }}>3. Certify (Bureau)</span>
          <span style={{ color: "#94a3b8" }}>→</span>
          <span style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #0f766e", fontWeight: 700, color: "#0f766e" }}>4. Validate (Planet)</span>
        </div>
      </div>

      <h1 style={{ fontSize: 26, marginBottom: 6 }}>QRight</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>
        Digital IP registration: register your work → get a cryptographic hash → store in registry. Then sign and certify in one click.
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 760 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Title *</div>
          <input
            placeholder="Name of your work (e.g. 'My AI Music Track')"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Type</div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
          >
            <option value="idea">Idea / Concept</option>
            <option value="code">Code / Software</option>
            <option value="design">Design / Visual</option>
            <option value="music">Music / Audio</option>
            <option value="text">Text / Article</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Description *</div>
          <textarea
            placeholder="Describe your work — what it is, what makes it unique"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
          />
        </div>

        <div className="aevion-form-grid" style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Author name (optional)</div>
            <input
              placeholder="Your name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Author email (optional)</div>
            <input
              placeholder="your@email.com"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
          />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Country (optional)</div>
            <input
              placeholder="e.g. Kazakhstan"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>City (optional)</div>
            <input
              placeholder="e.g. Astana"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            border: "none",
            background: saving ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            cursor: saving ? "default" : "pointer",
            fontWeight: 900,
            fontSize: 15,
            boxShadow: saving ? "none" : "0 4px 14px rgba(13,148,136,0.35)",
          }}
        >
          {saving ? "Saving..." : "Register object"}
        </button>

        {err && <div style={{ color: "crimson" }}>{err}</div>}
      </form>

      <hr style={{ margin: "24px 0" }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: 18, margin: 0 }}>QRight Registry ({items.length})</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={listMineOnly}
            onChange={(e) => setListMineOnly(e.target.checked)}
          />
          My records only (Auth login required)
        </label>
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:24,color:"#94a3b8"}}>Loading registry...</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((x) => (
            <div key={x.id} style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 14, padding: 16, background: "#fff", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: "rgba(13,148,136,0.1)", color: "#0d9488", textTransform: "uppercase" as const }}>{x.kind}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(x.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{x.title}</div>
                </div>
                <div style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "rgba(16,185,129,0.1)", color: "#059669", whiteSpace: "nowrap" as const }}>
                  ✓ REGISTERED
                </div>
              </div>
              
              <div style={{ marginTop: 8, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>{x.description}</div>
              
              {(x.country || x.city) ? (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                  📍 {x.city || "—"}{x.country ? `, ${x.country}` : ""}
                </div>
              ) : null}
              
              {(x.ownerName || x.ownerEmail) ? (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  👤 {x.ownerName || "—"}{x.ownerEmail ? ` · ${x.ownerEmail}` : ""}{x.ownerUserId ? ` · ID ${x.ownerUserId.slice(0, 8)}…` : ""}
                </div>
              ) : null}
              
              <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>SHA-256 CONTENT HASH</div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" as const }}>{x.contentHash}</div>
              </div>
              
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Link href={qsignUrlForQRightObject(x)}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>
                  Sign with QSign →
                </Link>
                <Link href={bureauUrlFocusObject(x)}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #0d9488", color: "#0d9488", textDecoration: "none", fontWeight: 700, fontSize: 12, background: "rgba(13,148,136,0.06)" }}>
                  Certify in Bureau →
                </Link>
                <Link href={`/planet?title=${encodeURIComponent(x.title)}&productKey=${encodeURIComponent(`planet_qright_${x.kind}`)}`}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #7c3aed", color: "#7c3aed", textDecoration: "none", fontWeight: 700, fontSize: 12, background: "rgba(124,58,237,0.06)" }}>
                  Submit to Planet →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      </ProductPageShell>
    </main>
  );
}
