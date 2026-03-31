import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontSize: 80, fontWeight: 900, color: "#0d9488", lineHeight: 1, marginBottom: 8 }}>404</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>Page not found</h1>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 24 }}>
          The page you are looking for does not exist. The node may have been renamed or the link is outdated.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" style={{ padding: "10px 20px", borderRadius: 12, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14 }}>
            ← Back to Globus
          </Link>
          <Link href="/demo" style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.2)", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
            Ecosystem demo
          </Link>
          <Link href="/cyberchess" style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #0d9488", color: "#0d9488", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
            Play CyberChess
          </Link>
        </div>
      </div>
    </main>
  );
}
