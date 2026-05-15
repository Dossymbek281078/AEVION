"use client";

import Link from "next/link";
import PlanetActivityFeed from "@/components/PlanetActivityFeed";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";

export default function PlanetActivityPage() {
  return (
    <main style={{ overflowX: "hidden" }}>
      <ProductPageShell>
        <Wave1Nav hidePlanet />

        <div style={{ marginBottom: 8 }}>
          <Link
            href="/planet"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0f766e",
              textDecoration: "none",
            }}
          >
            ← AEVION Planet
          </Link>
        </div>

        <h1 style={{ fontSize: "clamp(22px, 5vw, 30px)", marginBottom: 6, letterSpacing: "-0.02em" }}>
          Planet activity feed
        </h1>
        <div style={{ color: "#475569", marginBottom: 18, fontSize: 14, maxWidth: 720 }}>
          A real-time, chronological feed of everything happening on Planet — new submissions,
          issued certificates, revocations, and votes. Public by design: anyone can audit
          the pipeline. Auto-refreshes every minute.
        </div>

        <PlanetActivityFeed limit={50} refreshSeconds={60} />

        <div
          style={{
            marginTop: 18,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,0.1)",
            background: "rgba(15,23,42,0.02)",
            color: "#475569",
            fontSize: 12,
          }}
        >
          Powered by{" "}
          <code style={{ fontSize: 12 }}>GET /api/planet/activity</code>. See also{" "}
          <Link href="/planet/transparency" style={{ color: "#0f766e", fontWeight: 700 }}>
            aggregate transparency stats
          </Link>
          .
        </div>
      </ProductPageShell>
    </main>
  );
}
