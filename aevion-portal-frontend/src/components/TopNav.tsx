
"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

const links = [
  { href: "/", label: "Globus" },
  { href: "/qcore", label: "QCoreAI" },
  { href: "/qright", label: "QRight" },
  { href: "/qtrade", label: "QTrade" },
  { href: "/qsign", label: "QSign" },
  { href: "/auth", label: "Auth" },
  { href: "/aevion-ip-bureau", label: "IP Bureau" },
  { href: "/ai-music", label: "AI Music" },
  { href: "/ai-cinema", label: "AI Cinema" },
];

export default function TopNav() {
  const pathname = usePathname();
  const isQcore = pathname === "/qcore";

  return (
    <header style={{
      padding: "8px 20px",
      borderBottom: isQcore ? "1px solid #1e293b" : "1px solid #e2e8f0",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      background: isQcore ? "#0f172a" : "#fff",
    }}>
      <Link href="/" style={{ fontWeight: 800, fontSize: 18, color: isQcore ? "#a78bfa" : "#4f46e5", textDecoration: "none" }}>
        AEVION
      </Link>
      <nav style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href} style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? "#fff" : (isQcore ? "#94a3b8" : "#64748b"),
              background: active ? "#4f46e5" : "transparent",
              textDecoration: "none", transition: "all 0.2s",
            }}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}