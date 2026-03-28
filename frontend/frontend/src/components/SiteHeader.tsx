import Link from "next/link";
import { getBackendOrigin } from "@/lib/apiBase";

export function SiteHeader() {
  const origin = getBackendOrigin();
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid rgba(15,23,42,0.08)",
        background: "rgba(248,250,252,0.92)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: "#0f172a" }}>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.02em" }}>AEVION</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b", fontWeight: 600 }}>
            IP · Compliance · Globus
          </span>
        </Link>
        <Link
          href="/demo"
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 13,
            color: "#fff",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            boxShadow: "0 2px 10px rgba(13,148,136,0.35)",
          }}
        >
          Демо экосистемы
        </Link>
        <nav
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: 13,
            fontWeight: 600,
          }}
          aria-label="Основная навигация"
        >
          {[
            { href: "/auth", label: "Auth" },
            { href: "/qright", label: "QRight" },
            { href: "/qsign", label: "QSign" },
            { href: "/bureau", label: "Bureau" },
            { href: "/planet", label: "Planet" },
            { href: "/awards", label: "Awards" },
          ].map((x) => (
            <Link
              key={x.href}
              href={x.href}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                textDecoration: "none",
                color: "#334155",
              }}
            >
              {x.label}
            </Link>
          ))}
          <a
            href={`${origin}/api/openapi.json`}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              textDecoration: "none",
              color: "#0d9488",
              border: "1px solid rgba(13,148,136,0.35)",
            }}
          >
            API
          </a>
        </nav>
      </div>
    </header>
  );
}
