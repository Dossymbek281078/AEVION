import { Suspense } from "react";
import SearchClient from "./_client";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 880, margin: "0 auto", padding: "28px 16px 64px" }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em", color: "#0f172a", margin: "0 0 6px" }}>
            Поиск по AEVION
          </h1>
          <p style={{ color: "#475569", fontSize: 15 }}>Загружаем строку поиска…</p>
        </main>
      }
    >
      <SearchClient />
    </Suspense>
  );
}
