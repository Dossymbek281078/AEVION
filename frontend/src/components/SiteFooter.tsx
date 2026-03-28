import Link from "next/link";
import { getBackendOrigin } from "@/lib/apiBase";

export function SiteFooter() {
  const origin = getBackendOrigin();
  return (
    <footer
      style={{
        marginTop: "auto",
        borderTop: "1px solid rgba(15,23,42,0.08)",
        background: "#f1f5f9",
        padding: "28px 20px",
        fontSize: 13,
        color: "#64748b",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ lineHeight: 1.5 }}>
          <strong style={{ color: "#334155" }}>AEVION</strong> — платформа для реестра объектов, 
          криптографической подписи и патентного бюро, с картой экосистемы (Globus).
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/demo" style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none" }}>
            Демо экосистемы
          </Link>
          <a href={`${origin}/health`} target="_blank" rel="noreferrer" style={{ color: "#0d9488" }}>
            Health
          </a>
          <a href={`${origin}/api/openapi.json`} target="_blank" rel="noreferrer" style={{ color: "#0d9488" }}>
            OpenAPI
          </a>
          <a href={`${origin}/api/modules/status`} target="_blank" rel="noreferrer" style={{ color: "#0d9488" }}>
            Modules
          </a>
        </div>
      </div>
    </footer>
  );
}
