import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { demoDeepIntro, demoDeepSections } from "@/data/demoDeep";
import { getBackendOrigin } from "@/lib/apiBase";

export default function DemoDeepPage() {
  const origin = getBackendOrigin();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(165deg, #0f172a 0%, #1e293b 45%, #0c4a6e 100%)",
        color: "#e2e8f0",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px 64px" }}>
        <Wave1Nav variant="dark" />

        <header style={{ marginBottom: 36 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", letterSpacing: "0.04em" }}>
            AEVION · техническая демонстрация
          </p>
          <h1 style={{ fontSize: "clamp(1.65rem, 4vw, 2.25rem)", fontWeight: 800, margin: "12px 0 10px", lineHeight: 1.2 }}>
            {demoDeepIntro.title}
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: "#cbd5e1", lineHeight: 1.65, maxWidth: 720 }}>
            {demoDeepIntro.subtitle}
          </p>
          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Link
              href="/demo"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "rgba(45,212,191,0.15)",
                border: "1px solid rgba(45,212,191,0.35)",
                color: "#5eead4",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              ← Спектакль /demo
            </Link>
            <Link
              href="/"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(148,163,184,0.25)",
                color: "#e2e8f0",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Главная
            </Link>
            <a
              href={`${origin}/api/openapi.json`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(148,163,184,0.25)",
                color: "#93c5fd",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              OpenAPI (backend)
            </a>
          </div>
        </header>

        <nav
          aria-label="Оглавление"
          style={{
            marginBottom: 40,
            padding: "18px 20px",
            borderRadius: 14,
            background: "rgba(15,23,42,0.55)",
            border: "1px solid rgba(51,65,85,0.6)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", marginBottom: 12, letterSpacing: "0.06em" }}>
            ОГЛАВЛЕНИЕ
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontSize: 14 }}>
            {demoDeepSections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} style={{ color: "#7dd3fc", textDecoration: "none" }}>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {demoDeepSections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            style={{
              scrollMarginTop: 24,
              marginBottom: 44,
              paddingBottom: 8,
              borderBottom: "1px solid rgba(51,65,85,0.45)",
            }}
          >
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0 0 10px", color: "#f1f5f9" }}>{s.title}</h2>
            {s.lead ? (
              <p style={{ margin: "0 0 14px", fontSize: 15, color: "#a5b4fc", fontWeight: 600, lineHeight: 1.5 }}>{s.lead}</p>
            ) : null}
            {s.body.map((p) => (
              <p key={p.slice(0, 48)} style={{ margin: "0 0 12px", fontSize: 15, color: "#cbd5e1", lineHeight: 1.7 }}>
                {p}
              </p>
            ))}
            {s.pre ? (
              <pre
                style={{
                  margin: "16px 0 0",
                  padding: 16,
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(71,85,105,0.5)",
                  fontSize: 12,
                  lineHeight: 1.45,
                  overflow: "auto",
                  color: "#e2e8f0",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {s.pre}
              </pre>
            ) : null}
            {s.bullets && s.bullets.length > 0 ? (
              <ul style={{ margin: "14px 0 0", paddingLeft: 20, color: "#cbd5e1", lineHeight: 1.65, fontSize: 14 }}>
                {s.bullets.map((b) => (
                  <li key={b.slice(0, 64)} style={{ marginBottom: 8 }}>
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <footer style={{ marginTop: 32, textAlign: "center", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 20px" }}>
            Полный визуальный нарратив по 27 узлам — на{" "}
            <Link href="/demo" style={{ color: "#5eead4" }}>
              /demo
            </Link>
            . Инвестиционный взгляд (TAM, network effects, defensibility, GTM, ARR-траектория) — на{" "}
            <Link href="/pitch" style={{ color: "#fbbf24", fontWeight: 700 }}>
              /pitch
            </Link>
            .
          </p>
          <Link
            href="/pitch"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.18))",
              border: "1px solid rgba(251,191,36,0.55)",
              color: "#fef3c7",
              fontWeight: 800,
              textDecoration: "none",
              fontSize: 15,
              boxShadow: "0 8px 32px rgba(251,191,36,0.25)",
            }}
          >
            Investor pitch · why $1B+ →
          </Link>
        </footer>
      </div>
    </div>
  );
}
