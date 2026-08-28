"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import PersonaCard from "../../components/PersonaCard";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Persona {
  id?: number;
  alias: string;
  display_name: string;
  bio?: string | null;
  avatar_prompt?: string | null;
  skills?: string[];
  links?: string[];
  created_at?: string;
}

// ─── Public persona view by alias ──────────────────────────────────────────────

export default function PersonaViewPage({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = use(params);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(apiUrl(`/api/qpersona/personas/${encodeURIComponent(alias)}`))
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok && data.persona) setPersona(data.persona);
        else setError(data.error || "Persona not found");
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [alias]);

  return (
    <main style={{ minHeight: "100vh", background: "#050510", color: "#e2e8f0" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid #2d1054",
        background: "rgba(5,5,16,0.85)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 'var(--aevion-header-h, 0px)',
        zIndex: 10,
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" }}>
          <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>
            AEVION
          </Link>
          <span style={{ color: "#334155" }}>/</span>
          <Link href="/qpersona" style={{ fontWeight: 700, color: "#a78bfa", textDecoration: "none" }}>
            QPersona
          </Link>
          <span style={{ color: "#334155" }}>/</span>
          <span style={{ fontFamily: "monospace", color: "#c4b5fd" }}>@{alias}</span>
        </div>
      </header>

      {/* Content */}
      <section style={{ maxWidth: "640px", margin: "0 auto", padding: "48px 20px 60px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>Loading persona...</div>
        )}

        {!loading && error && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{
              padding: "16px",
              borderRadius: "10px",
              background: "#1a0000",
              border: "1px solid #7f1d1d",
              color: "#fca5a5",
              marginBottom: "24px",
            }}>
              {error}
            </div>
            <Link
              href="/qpersona"
              style={{
                display: "inline-block",
                padding: "10px 24px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to Gallery
            </Link>
          </div>
        )}

        {!loading && !error && persona && (
          <PersonaCard persona={persona} />
        )}
      </section>
    </main>
  );
}
