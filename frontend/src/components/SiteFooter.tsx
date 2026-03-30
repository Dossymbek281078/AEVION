import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        marginTop: "auto",
        borderTop: "1px solid rgba(15,23,42,0.08)",
        background: "#0f172a",
        color: "#94a3b8",
        padding: "40px 20px 28px",
        fontSize: 13,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 32,
        }}
      >
        {/* Brand */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#f8fafc", marginBottom: 8, letterSpacing: "-0.02em" }}>
            AEVION
          </div>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 13, color: "#94a3b8" }}>
            Global trust infrastructure for digital content, intellectual property and creator economy.
          </p>
          <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
            Astana, Kazakhstan
          </div>
        </div>

        {/* Products */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            Products
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/qright" style={{ color: "#94a3b8", textDecoration: "none" }}>QRight — IP Registry</Link>
            <Link href="/qsign" style={{ color: "#94a3b8", textDecoration: "none" }}>QSign — Signatures</Link>
            <Link href="/bureau" style={{ color: "#94a3b8", textDecoration: "none" }}>IP Bureau</Link>
            <Link href="/planet" style={{ color: "#94a3b8", textDecoration: "none" }}>Planet Compliance</Link>
            <Link href="/awards" style={{ color: "#94a3b8", textDecoration: "none" }}>Awards</Link>
            <Link href="/bank" style={{ color: "#94a3b8", textDecoration: "none" }}>AEVION Bank</Link>
            <Link href="/cyberchess" style={{ color: "#94a3b8", textDecoration: "none" }}>CyberChess</Link>
          </div>
        </div>

        {/* Company */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            Company
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Link href="/demo" style={{ color: "#94a3b8", textDecoration: "none" }}>Demo</Link>
            <Link href="/terms" style={{ color: "#94a3b8", textDecoration: "none" }}>Terms of Service</Link>
            <Link href="/privacy" style={{ color: "#94a3b8", textDecoration: "none" }}>Privacy Policy</Link>
            <Link href="/help" style={{ color: "#94a3b8", textDecoration: "none" }}>Help Center</Link>
          </div>
        </div>

        {/* Contact */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            Contact
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <a href="mailto:yahiin1978@gmail.com" style={{ color: "#94a3b8", textDecoration: "none" }}>yahiin1978@gmail.com</a>
            <span>Astana, Kazakhstan</span>
            <span>+7 702 625 83 77</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <a
              href="https://github.com/Dossymbek281078/AEVION"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#64748b", textDecoration: "none", fontWeight: 700 }}
            >
              GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: 1280,
          margin: "28px auto 0",
          paddingTop: 20,
          borderTop: "1px solid rgba(148,163,184,0.15)",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: "#64748b",
        }}
      >
        <div>&copy; {year} AEVION. All rights reserved.</div>
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/terms" style={{ color: "#64748b", textDecoration: "none" }}>Terms</Link>
          <Link href="/privacy" style={{ color: "#64748b", textDecoration: "none" }}>Privacy</Link>
          <Link href="/help" style={{ color: "#64748b", textDecoration: "none" }}>Help</Link>
        </div>
      </div>
    </footer>
  );
}
