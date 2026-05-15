"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { InfoTip } from "@/components/InfoTip";
import { useToast } from "@/components/ToastProvider";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type Org = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  role: "owner" | "admin" | "member";
};

export default function BureauOrgListPage() {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [name, setName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingCountry, setBillingCountry] = useState("KZ");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}` } : {};
    } catch {
      return {};
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/bureau/org/mine"), {
        headers: { ...authHeaders() },
      });
      if (r.status === 401) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      if (r.ok) {
        const data = await r.json();
        setOrgs(data.organizations || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Organization name is required");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const r = await fetch(apiUrl("/api/bureau/org"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          billingEmail: billingEmail.trim() || undefined,
          billingCountry: billingCountry.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
      showToast(`Organization "${data.name}" created`, "success");
      setName("");
      setBillingEmail("");
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (!authed && !loading) {
    return (
      <main>
        <ProductPageShell maxWidth={680}>
          <Wave1Nav />
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden>🏢</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
              Sign in to manage organizations
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 18, maxWidth: 420, margin: "0 auto 18px" }}>
              Bureau Organizations let law firms, agencies, and joint-author groups hold AEVION
              certificates collectively under one billing relationship.
            </div>
            <Link href="/auth" style={{ padding: "12px 24px", borderRadius: 12, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14 }}>
              Sign in
            </Link>
          </div>
        </ProductPageShell>
      </main>
    );
  }

  return (
    <main>
      <ProductPageShell maxWidth={760}>
        <Wave1Nav />

        <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(135deg, #312e81, #4f46e5)", padding: "24px 26px", color: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 4 }}>BUREAU · ORGANIZATIONS</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
              Hold IP under an organization
              <InfoTip
                label="Bureau Organization"
                text="A single billing relationship that can own AEVION certificates and Verified-tier upgrades on behalf of multiple authors. Useful for agencies, law firms, and joint-author groups. Members keep their own author co-signing keys."
              />
            </h1>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
              Invite teammates, share verified status, and keep all certificates under
              one corporate identity.
            </div>
          </div>
        </div>

        {/* Existing orgs */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
            My organizations ({orgs.length})
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
              Loading…
            </div>
          ) : orgs.length === 0 ? (
            <div style={{ padding: "24px 18px", borderRadius: 12, border: "1px dashed rgba(15,23,42,0.15)", background: "#f8fafc", textAlign: "center", fontSize: 13, color: "#64748b" }}>
              You don&apos;t belong to any organization yet. Create one below.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {orgs.map((o) => (
                <Link
                  key={o.id}
                  href={`/bureau/org/${o.id}`}
                  style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{o.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, fontFamily: "monospace" }}>
                      /bureau/org/{o.slug} · plan: <b>{o.plan}</b> · created {new Date(o.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: o.role === "owner" ? "rgba(99,102,241,0.12)" : "rgba(15,23,42,0.06)", color: o.role === "owner" ? "#4338ca" : "#475569", textTransform: "uppercase" as const }}>
                    {o.role}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Create form */}
        <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", padding: "20px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>
            Create a new organization
          </div>
          <form onSubmit={create} style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 4, display: "block" }}>
                Organization name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme IP Studio"
                aria-required="true"
                required
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", marginBottom: 4, display: "block" }}>
                  Billing email
                </label>
                <input
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="finance@your-firm.com"
                  type="email"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", marginBottom: 4, display: "block" }}>
                  Country
                </label>
                <input
                  value={billingCountry}
                  onChange={(e) => setBillingCountry(e.target.value)}
                  placeholder="KZ"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
            {error && (
              <div role="alert" style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", color: "#991b1b", fontSize: 12 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={creating}
              style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: creating ? "#cbd5e1" : "linear-gradient(135deg, #4f46e5, #6366f1)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: creating ? "not-allowed" : "pointer", justifySelf: "start" }}
            >
              {creating ? "Creating…" : "Create organization"}
            </button>
          </form>
        </div>
      </ProductPageShell>
    </main>
  );
}
