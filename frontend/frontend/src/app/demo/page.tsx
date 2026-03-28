"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import {
  DEMO_MODULE_ORDER,
  ecosystemIntro,
  moduleBenefits,
  planetLayer,
} from "@/data/demoNarrative";
import { apiUrl } from "@/lib/apiBase";

type ApiProject = {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: string;
  status: string;
  priority: number;
};

const marqueePhrases = [
  "AEVION · единая платформа доверия",
  "27 продуктовых узлов · один контур",
  "QRight · QSign · Bureau · Planet",
  "Auth · реестр · подпись · compliance",
  "Globus · карта экосистемы",
  "От идеи к сертификату — в одной системе",
];

export default function DemoShowcasePage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/globus/projects"));
        if (!r.ok) throw new Error("API");
        const data = await r.json();
        if (!cancelled) setProjects(data.items || []);
      } catch {
        if (!cancelled) {
          setLoadErr("Каталог подгружается из API; ниже — полный заранее подготовленный нарратив по всем узлам.");
          setProjects([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayRows = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p]));
    return DEMO_MODULE_ORDER.map((id) => {
      const n = moduleBenefits[id];
      if (!n) return null;
      const api = byId.get(id);
      if (api) return api;
      return {
        id,
        code: id.replace(/-/g, "").toUpperCase().slice(0, 12),
        name: "",
        description: "",
        kind: "",
        status: "",
        priority: 99,
      } as ApiProject;
    }).filter((x): x is ApiProject => x !== null);
  }, [projects]);

  const marqueeText = useMemo(() => {
    const line = marqueePhrases.join("   ·   ");
    return `${line}   ·   ${line}`;
  }, []);

  return (
    <div style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh" }}>
      <section
        style={{
          position: "relative",
          minHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 24px 64px",
          overflow: "hidden",
        }}
      >
        <div className="demo-aurora" aria-hidden />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", width: "100%" }}>
          <Wave1Nav variant="dark" />
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(148,163,184,0.95)",
              marginBottom: 16,
            }}
          >
            Живая демонстрация · только прокрутка
          </p>
          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.05,
              margin: "0 0 20px",
              letterSpacing: "-0.04em",
              background: "linear-gradient(120deg, #fff 0%, #99f6e4 45%, #7dd3fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Экосистема AEVION
            <br />
            <span style={{ fontSize: "0.55em", fontWeight: 800, letterSpacing: "-0.02em" }}>
              доверие, IP, ИИ и финансы на одной карте
            </span>
          </h1>
          <p
            style={{
              fontSize: "clamp(16px, 2.4vw, 20px)",
              lineHeight: 1.55,
              maxWidth: 720,
              color: "rgba(226,232,240,0.92)",
              margin: 0,
            }}
          >
            Ниже — развёрнуто: зачем платформа целиком инвестору и рынку, зачем каждый узел, и как сквозной слой
            Planet связывает compliance с реестром и подписью. Никаких обязательных кнопок: просто листайте.
          </p>

          <div style={{ marginTop: 28 }} className="demo-marquee-wrap">
            <div className="demo-marquee-track" aria-hidden>
              <span style={{ paddingRight: 48, whiteSpace: "nowrap", fontSize: 15, fontWeight: 700, color: "#5eead4" }}>
                {marqueeText}
              </span>
              <span style={{ paddingRight: 48, whiteSpace: "nowrap", fontSize: 15, fontWeight: 700, color: "#5eead4" }}>
                {marqueeText}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 80px" }}>
        {loadErr ? (
          <p style={{ color: "#fbbf24", fontSize: 14, marginBottom: 24 }}>{loadErr}</p>
        ) : null}

        <article
          style={{
            marginBottom: 48,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(148,163,184,0.2)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(15,118,110,0.15))",
          }}
        >
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 12px", color: "#fff" }}>
            {ecosystemIntro.title}
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "#cbd5e1", margin: "0 0 20px" }}>{ecosystemIntro.lead}</p>
          <ul style={{ margin: 0, paddingLeft: 22, color: "#e2e8f0", lineHeight: 1.75, fontSize: 15 }}>
            {ecosystemIntro.bullets.map((b) => (
              <li key={b.slice(0, 40)} style={{ marginBottom: 10 }}>
                {b}
              </li>
            ))}
          </ul>
        </article>

        <article
          style={{
            marginBottom: 56,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(52,211,153,0.35)",
            background: "rgba(6,78,59,0.25)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", color: "#6ee7b7", marginBottom: 8 }}>
            СКВОЗНОЙ СЛОЙ
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px", color: "#fff" }}>
            {planetLayer.code} — {planetLayer.name}
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#d1fae5", marginBottom: 16 }}>{planetLayer.summary}</p>
          <ul style={{ margin: 0, paddingLeft: 22, color: "#ecfdf5", lineHeight: 1.7, fontSize: 15 }}>
            {planetLayer.benefits.map((b) => (
              <li key={b.slice(0, 40)} style={{ marginBottom: 8 }}>
                {b}
              </li>
            ))}
          </ul>
        </article>

        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.2em",
            color: "#94a3b8",
            margin: "0 0 20px",
            textTransform: "uppercase",
          }}
        >
          27 продуктовых узлов — выгоды по каждому
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {displayRows.map((p, idx) => {
              const narrative = moduleBenefits[p.id];
              if (!narrative) return null;
              const title = p.name?.trim() || narrative.tagline;
              const showTagline = !!(p.name?.trim() && narrative.tagline);
              return (
                <article
                  key={p.id}
                  className="demo-card-enter"
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid rgba(51,65,85,0.6)",
                    background: "rgba(15,23,42,0.65)",
                    animationDelay: `${Math.min(idx * 0.03, 1.2)}s`,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>{p.code}</span>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>{title}</h3>
                  </div>
                  {p.description ? (
                    <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 12px" }}>
                      {p.description}
                    </p>
                  ) : null}
                  {showTagline ? (
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#5eead4", margin: "0 0 12px" }}>{narrative.tagline}</p>
                  ) : null}
                  <ul style={{ margin: 0, paddingLeft: 20, color: "#e2e8f0", lineHeight: 1.65, fontSize: 14 }}>
                    {narrative.benefits.map((b) => (
                      <li key={b.slice(0, 48)} style={{ marginBottom: 6 }}>
                        {b}
                      </li>
                    ))}
                  </ul>
                  {narrative.investorAngle ? (
                    <div
                      style={{
                        marginTop: 14,
                        padding: "12px 14px",
                        borderRadius: 10,
                        background: "rgba(59,130,246,0.12)",
                        border: "1px solid rgba(59,130,246,0.25)",
                        fontSize: 13,
                        color: "#bfdbfe",
                        lineHeight: 1.55,
                      }}
                    >
                      <strong style={{ color: "#93c5fd" }}>Для инвестора: </strong>
                      {narrative.investorAngle}
                    </div>
                  ) : null}
                </article>
              );
            })}
        </div>

        <footer
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid rgba(51,65,85,0.5)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
            Это тот же продукт, что на главной: Globus, реестр, подпись, бюро и Planet — в рабочем MVP.
            <br />
            Дальше — углубление метрик, интеграций и go-to-market по выбранным вертикалям.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link
              href="/demo/deep"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              Углублённая демонстрация →
            </Link>
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 16,
                boxShadow: "0 8px 32px rgba(13,148,136,0.35)",
              }}
            >
              На главную — карта и интерфейсы
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
