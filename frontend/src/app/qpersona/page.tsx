"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import PersonaCard from "./components/PersonaCard";
import CreatePersonaForm from "./components/CreatePersonaForm";
import AvatarDisplay from "./components/AvatarDisplay";

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

type Tab = "gallery" | "create" | "view";

// ─── Main page ───────────────────────────────────────────────────────────────

export default function QPersonaPage() {
  const [tab, setTab] = useState<Tab>("gallery");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [stats, setStats] = useState<{ total: number; latest: string[] } | null>(null);

  // Load gallery
  useEffect(() => {
    if (tab !== "gallery") return;
    setGalleryLoading(true);
    setGalleryError(null);
    fetch(apiUrl("/api/qpersona/personas?limit=20"))
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPersonas(data.personas ?? []);
        else setGalleryError(data.error || "Failed to load");
      })
      .catch((e: Error) => setGalleryError(e.message))
      .finally(() => setGalleryLoading(false));
  }, [tab]);

  // Load stats
  useEffect(() => {
    fetch(apiUrl("/api/qpersona/stats"))
      .then((r) => r.json())
      .then((data) => { if (data.ok) setStats(data); })
      .catch(() => null);
  }, []);

  function handleCreated(persona: Persona) {
    setSelectedPersona(persona);
    setTab("view");
    setPersonas((prev) => [persona, ...prev.filter((p) => p.alias !== persona.alias)]);
  }

  function handlePersonaClick(persona: Persona) {
    setSelectedPersona(persona);
    setTab("view");
  }

  const violet = "#7c3aed";
  const surface = "#0d0720";

  const tabBase: React.CSSProperties = {
    padding: "8px 20px",
    borderRadius: "8px",
    border: "none",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  };

  const activeTab: React.CSSProperties = {
    ...tabBase,
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "#fff",
  };

  const inactiveTab: React.CSSProperties = {
    ...tabBase,
    background: "#1a0533",
    color: "#a78bfa",
  };

  return (
    <main style={{ minHeight: "100vh", background: "#050510", color: "#e2e8f0" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid #2d1054",
        background: "rgba(5,5,16,0.85)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" }}>
          <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>
            AEVION
          </Link>
          <span style={{ color: "#334155" }}>/</span>
          <span style={{ fontWeight: 700, color: "#a78bfa" }}>QPersona</span>
          <span style={{
            padding: "2px 8px",
            borderRadius: "6px",
            background: "#2d1054",
            border: "1px solid #7c3aed",
            color: "#c4b5fd",
            fontSize: "11px",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            MVP
          </span>
          {stats && (
            <span style={{ marginLeft: "auto", color: "#64748b", fontSize: "12px" }}>
              {stats.total} personas created
            </span>
          )}
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: "960px", margin: "0 auto", padding: "56px 20px 32px" }}>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 900, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.1 }}>
          Your Digital{" "}
          <span style={{ background: "linear-gradient(135deg, #a78bfa, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Avatar.
          </span>
        </h1>
        <p style={{ marginTop: "16px", fontSize: "17px", color: "#94a3b8", maxWidth: "560px", lineHeight: 1.65 }}>
          Create a public profile persona — configure your digital stand-in with skills, bio, and a shareable link.
          Share it as <code style={{ color: "#a78bfa", fontSize: "15px" }}>/qpersona/view/[alias]</code>.
        </p>
      </section>

      {/* Tabs */}
      <section style={{ maxWidth: "960px", margin: "0 auto", padding: "0 20px 24px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={tab === "gallery" ? activeTab : inactiveTab} onClick={() => setTab("gallery")}>
            Gallery
          </button>
          <button style={tab === "create" ? activeTab : inactiveTab} onClick={() => setTab("create")}>
            + Create Persona
          </button>
          {selectedPersona && (
            <button style={tab === "view" ? activeTab : inactiveTab} onClick={() => setTab("view")}>
              @{selectedPersona.alias}
            </button>
          )}
        </div>
      </section>

      {/* Tab content */}
      <section style={{ maxWidth: "960px", margin: "0 auto", padding: "0 20px 60px" }}>

        {/* Gallery */}
        {tab === "gallery" && (
          <div>
            {galleryLoading && (
              <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>Loading personas...</div>
            )}
            {galleryError && (
              <div style={{ padding: "16px", borderRadius: "10px", background: "#1a0000", border: "1px solid #7f1d1d", color: "#fca5a5", marginBottom: "16px" }}>
                {galleryError}
              </div>
            )}
            {!galleryLoading && !galleryError && personas.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 20px", color: "#475569" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                  <AvatarDisplay displayName="QP" avatarPrompt="empty" size={72} />
                </div>
                <p style={{ fontSize: "16px" }}>No personas yet. Be the first!</p>
                <button
                  onClick={() => setTab("create")}
                  style={{
                    marginTop: "16px",
                    padding: "10px 24px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    border: "none",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Create First Persona
                </button>
              </div>
            )}
            {!galleryLoading && personas.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                {personas.map((p) => (
                  <PersonaCard key={p.alias} persona={p} compact onClick={() => handlePersonaClick(p)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create */}
        {tab === "create" && (
          <div style={{
            background: "linear-gradient(135deg, #0d0720 0%, #050510 100%)",
            border: "1px solid #2d1054",
            borderRadius: "16px",
            padding: "32px",
          }}>
            <h2 style={{ margin: "0 0 24px", fontSize: "22px", fontWeight: 700, color: "#c4b5fd" }}>
              Create Your Persona
            </h2>
            <CreatePersonaForm onCreated={handleCreated} />
          </div>
        )}

        {/* View single persona */}
        {tab === "view" && selectedPersona && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <PersonaCard persona={selectedPersona} />

            {/* Share link box */}
            <div style={{
              background: surface,
              border: "1px solid #2d1054",
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                  Share link
                </div>
                <code style={{ color: "#a78bfa", fontSize: "14px" }}>
                  {typeof window !== "undefined" ? window.location.origin : "https://aevion.app"}/qpersona/view/{selectedPersona.alias}
                </code>
              </div>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/qpersona/view/${selectedPersona.alias}`;
                  navigator.clipboard.writeText(url).catch(() => null);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "#1a0533",
                  border: "1px solid #5b21b6",
                  color: "#c4b5fd",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Copy Link
              </button>
            </div>
          </div>
        )}

      </section>

      {/* Related modules */}
      <section style={{ maxWidth: "960px", margin: "0 auto", padding: "0 20px 60px" }}>
        <h3 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: "16px" }}>
          Related in AEVION
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
          {[
            { href: "/qcoreai", title: "QCoreAI", desc: "AI engine powering bio generation" },
            { href: "/qsign",   title: "QSign",   desc: "Audit trail for persona actions" },
            { href: "/qright",  title: "QRight",  desc: "IP protection for your identity assets" },
          ].map(({ href, title, desc }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "block",
                padding: "16px",
                borderRadius: "12px",
                background: "#0d0720",
                border: "1px solid #1e0a40",
                textDecoration: "none",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = violet; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1e0a40"; }}
            >
              <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: "4px" }}>{title}</div>
              <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>{desc}</div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 40px" }}>
        <MvpConceptBoard
          moduleId="qpersona"
          noun="concept/messages"
          accent="violet"
          sectionTitle="Persona ideas board"
          sectionHint="Какие сигналы должны формировать цифровую персону? Какие верифицируемые источники?"
          titleField="idea"
          summaryField="rationale"
          fields={[
            { key: "idea", label: "Идея / сигнал", placeholder: "напр.: верифицированный коммит в open-source", required: true },
            { key: "rationale", label: "Зачем это в персоне", type: "textarea", placeholder: "Кому это полезно, как это измеряется" },
            { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
          ]}
        />
      </section>
    </main>
  );
}
