"use client";

import Link from "next/link";
import { useState } from "react";

const QUICK_LINKS = [
  { label: "Globus map",       href: "/",            color: "#0f172a", bg: "#0f172a", invert: true },
  { label: "Bank",             href: "/bank",        color: "#fbbf24" },
  { label: "Awards",           href: "/awards",      color: "#a78bfa" },
  { label: "QRight",           href: "/qright",      color: "#7dd3fc" },
  { label: "QSign",            href: "/qsign",       color: "#a78bfa" },
  { label: "Bureau",           href: "/bureau",      color: "#f472b6" },
  { label: "Planet",           href: "/planet",      color: "#86efac" },
  { label: "Quantum Shield",   href: "/quantum-shield", color: "#5eead4" },
  { label: "CyberChess",       href: "/cyberchess",  color: "#0d9488" },
  { label: "QTrade",           href: "/qtrade",      color: "#fb7185" },
  { label: "Demo",             href: "/demo",        color: "#94a3b8" },
  { label: "Pitch",            href: "/pitch",       color: "#0ea5e9" },
];

export default function NotFound() {
  const [query, setQuery] = useState("");
  const helpHref = query.trim() ? `/help?q=${encodeURIComponent(query.trim())}` : "/help";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 720, width: "100%" }}>
        <div style={{ fontSize: 96, fontWeight: 900, color: "#0d9488", lineHeight: 1, marginBottom: 8, letterSpacing: "-0.05em" }}>
          404
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
          This node is not on the map
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 22 }}>
          The page you are looking for does not exist. It may have been renamed,
          moved to a sub-route, or the link is outdated. Try a quick search or pick a module below.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (typeof window !== "undefined") window.location.href = helpHref; }}
          style={{ display: "flex", gap: 8, marginBottom: 28, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}
        >
          <label htmlFor="nf-search" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
            Search AEVION help
          </label>
          <input
            id="nf-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the AEVION help center…"
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.2)",
              background: "#fff",
              fontSize: 14,
              fontWeight: 600,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#64748b", marginBottom: 14, textTransform: "uppercase" }}>
          Or jump to a module
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: q.invert ? "none" : `1px solid ${q.color}55`,
                background: q.invert ? q.bg : "rgba(255,255,255,0.7)",
                color: q.invert ? "#fff" : "#0f172a",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {q.invert ? null : (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 6,
                    background: q.color,
                    display: "inline-block",
                  }}
                />
              )}
              {q.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
