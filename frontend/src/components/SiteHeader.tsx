"use client";

import Link from "next/link";
import { getBackendOrigin } from "@/lib/apiBase";
import { LangSwitch } from "@/lib/i18n";

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
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.02em" }}>AEVION</span>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
            Trust · IP · Globus
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <Link href="/demo" style={{ padding: "5px 10px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 12, color: "#fff", background: "linear-gradient(135deg, #0d9488, #0ea5e9)" }}>
            Demo
          </Link>
          {[
            { href: "/auth", label: "Auth" },
            { href: "/qright", label: "QRight" },
            { href: "/qsign", label: "QSign" },
            { href: "/bureau", label: "Bureau" },
            { href: "/planet", label: "Planet" },
            { href: "/awards", label: "Awards" },
            { href: "/bank", label: "Bank" },
            { href: "/cyberchess", label: "Chess" },
          ].map((x) => (
            <Link key={x.href} href={x.href} style={{ padding: "5px 8px", borderRadius: 6, textDecoration: "none", color: "#334155", fontSize: 12, fontWeight: 600 }}>
              {x.label}
            </Link>
          ))}
          <a href={`${origin}/api/openapi.json`} target="_blank" rel="noreferrer" style={{ padding: "5px 8px", borderRadius: 6, textDecoration: "none", color: "#0d9488", fontSize: 12, fontWeight: 600, border: "1px solid rgba(13,148,136,0.3)" }}>
            API
          </a>
          <div style={{ marginLeft: 4 }}>
            <LangSwitch />
          </div>
        </div>
      </div>
    </header>
  );
}
