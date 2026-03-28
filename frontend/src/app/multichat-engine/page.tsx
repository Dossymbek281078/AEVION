import Link from "next/link";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { getBackendOrigin } from "@/lib/apiBase";

export default function MultichatEnginePage() {
  const origin = getBackendOrigin();
  return (
    <main>
      <ProductPageShell maxWidth={720}>
        <Wave1Nav />
        <h1 style={{ fontSize: 26, marginTop: 4 }}>AEVION Multichat Engine</h1>
        <p style={{ color: "#475569", lineHeight: 1.65, marginTop: 12, fontSize: 15 }}>
          MVP: один общий чат-бэкенд с <b>QCoreAI</b> (<code>POST /api/qcoreai/chat</code>). Параллельные
          подчаты и агенты — следующий инкремент (очередь сообщений, сессии, роли).
        </p>
        <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/qcoreai"
            style={{
              border: "1px solid #0f172a",
              borderRadius: 10,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#fff",
              background: "#0f172a",
              fontWeight: 700,
            }}
          >
            Открыть чат (QCoreAI)
          </Link>
          <a
            href={`${origin}/api/qcoreai/health`}
            target="_blank"
            rel="noreferrer"
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: "12px 16px",
              textDecoration: "none",
              color: "#334155",
              fontWeight: 650,
            }}
          >
            QCoreAI health
          </a>
        </div>
      </ProductPageShell>
    </main>
  );
}
