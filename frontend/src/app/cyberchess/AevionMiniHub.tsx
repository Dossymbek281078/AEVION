"use client";

import { useEffect, useRef, useState } from "react";

type Product = {
  id: string;
  href: string;
  emoji: string;
  name: string;
  desc: string;
  color: string; // accent hue для hover
};

const PRODUCTS: Product[] = [
  { id: "bureau",   href: "/bureau",         emoji: "🏛", name: "Bureau",     desc: "Patent registry · Merkle anchor", color: "#059669" },
  { id: "qsign",    href: "/qsign",          emoji: "✍",  name: "QSign",      desc: "Цифровая подпись · Ed25519",      color: "#0ea5e9" },
  { id: "qright",   href: "/qright",         emoji: "⚖",  name: "QRight",     desc: "Права + Shamir SSS",              color: "#7c3aed" },
  { id: "qpaynet",  href: "/qpaynet",        emoji: "💳", name: "QPayNet",    desc: "Wallets · transfers · merchant",   color: "#d97706" },
  { id: "qtrade",   href: "/qtrade",         emoji: "📈", name: "QTrade",     desc: "AEV trading · offline",            color: "#dc2626" },
  { id: "smeta",    href: "/smeta-trainer",  emoji: "📐", name: "Смета",      desc: "AI сметный тренажёр РК",          color: "#f59e0b" },
  { id: "globus",   href: "/globus",         emoji: "🌍", name: "Globus",     desc: "3D экосистема AEVION",            color: "#06b6d4" },
  { id: "gtm",      href: "/gtm",            emoji: "🚀", name: "GTM",        desc: "Pricing · go-to-market",          color: "#ec4899" },
];

type Props = {
  onVisit?: (productId: string) => void;
  surface1: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  textMute: string;
  brand: string;
};

export default function AevionMiniHub({ onVisit, surface1, surface2, border, text, textDim, textMute, brand }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="AEVION экосистема — открыть другой продукт"
        className="cc-focus-ring"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px 5px 9px", borderRadius: 9999,
          border: `1px solid ${open ? brand : border}`,
          background: open ? `${brand}15` : surface1,
          color: text, fontSize: 11, fontWeight: 800, cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "background 150ms ease, border-color 150ms ease",
        }}
      >
        <span style={{
          display: "inline-block", width: 16, height: 16, borderRadius: 4,
          background: "linear-gradient(135deg,#059669 0%,#10b981 55%,#7c3aed 100%)",
          fontSize: 10, color: "#fff", fontWeight: 900, lineHeight: "16px", textAlign: "center",
        }}>A</span>
        <span>AEVION</span>
        <span style={{ fontSize: 9, color: textDim, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            minWidth: 280, maxWidth: 320, zIndex: 250,
            background: surface1, border: `1px solid ${border}`, borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            padding: 8,
            display: "grid", gap: 4,
          }}
        >
          <div style={{
            fontSize: 9, fontWeight: 900, color: textMute, letterSpacing: 1.4,
            textTransform: "uppercase", padding: "4px 8px 6px",
          }}>
            Экосистема AEVION
          </div>
          {PRODUCTS.map(p => (
            <a key={p.id} href={p.href} role="menuitem"
              onClick={() => onVisit?.(p.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8,
                textDecoration: "none", color: text,
                background: "transparent",
                transition: "background 120ms ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = surface2; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${p.color}1f`, color: p.color,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, flexShrink: 0,
              }}>{p.emoji}</span>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: text, lineHeight: 1.2 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: textDim, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.desc}</span>
              </div>
              <span style={{ fontSize: 12, color: textMute, flexShrink: 0 }}>→</span>
            </a>
          ))}
          <div style={{
            fontSize: 9, color: textMute, padding: "6px 8px 2px",
            borderTop: `1px solid ${border}`, marginTop: 4,
            display: "flex", justifyContent: "space-between",
          }}>
            <span>{PRODUCTS.length} продуктов</span>
            <a href="/" style={{ color: brand, textDecoration: "none", fontWeight: 700 }}>На главную →</a>
          </div>
        </div>
      )}
    </div>
  );
}
