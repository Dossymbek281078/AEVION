import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";

export default function NotFound() {
  return (
    <ProductPageShell maxWidth={720}>
      <div
        style={{
          textAlign: "center",
          padding: "48px 16px",
          borderRadius: 20,
          border: "1px solid rgba(15,23,42,0.1)",
          background: "linear-gradient(180deg, #fff, #f8fafc)",
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: "#64748b", margin: "0 0 8px" }}>
          AEVION
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#0f172a", margin: "0 0 12px", letterSpacing: "-0.03em" }}>
          404
        </h1>
        <p style={{ color: "#475569", lineHeight: 1.6, margin: "0 0 24px", fontSize: 16 }}>
          Page not found. The node may have been renamed or the link is outdated.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              background: "#0f172a",
              color: "#fff",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Globus
          </Link>
          <Link
            href="/demo"
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              border: "2px solid #0d9488",
              color: "#0d9488",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Ecosystem demo
          </Link>
        </div>
      </div>
    </ProductPageShell>
  );
}
