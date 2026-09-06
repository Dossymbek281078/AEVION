import type { Metadata } from "next";
import Link from "next/link";
import { getApiBase } from "@/lib/apiBase";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { VERDICT_COLOR, VERDICT_LABEL, STAGE_LABEL, type Verdict } from "../_result";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Примеры разборов — QVenture",
  description:
    "See how QVenture scores companies across sectors: fund-grade screening memos with a 0–100 quant score, a 4-expert council, and an entry strategy. Real engine outputs, no signup.",
  alternates: { canonical: "/qventure/gallery" },
  openGraph: {
    title: "QVenture — примеры разборов по отраслям",
    description: "Fund-grade screening memos across fintech, healthtech, biotech, climate, AI and more.",
    type: "website",
  },
};

interface ExampleSummary {
  id: string;
  name: string;
  sector: string;
  stage: string;
  geography: string | null;
  composite: number;
  verdict: Verdict;
}

const SECTOR_LABEL: Record<string, string> = {
  // Отрасли по-русски там, где в русской речи так и говорят. SaaS и AI
  // остаются латиницей: их не переводят, и «ИИ-приложение» звучало бы хуже.
  fintech: "Финтех", healthtech: "Медтех", biotech: "Биотех", climate: "Климат",
  ai_infra: "AI-инфраструктура", ai_app: "AI-приложение", saas: "SaaS", marketplace: "Маркетплейс",
};
// 🔴 ЗДЕСЬ БЫЛО `s.replace(/-/g, " ")` — стадия собиралась из машинного
// идентификатора заменой дефисов на пробелы, и человек читал «pre seed»,
// «series a». При этом карта STAGE_LABEL с русскими подписями существует и
// экспортируется из ../_result — галерея даже импортирует оттуда вердикты.
// То есть правильная функция была, её просто не позвали. Замер 04.09.2026.
//
// Запасная ветка возвращает сам идентификатор осознанно: у примеров данные
// приходят с сервера, и новая стадия лучше покажется как есть, чем исчезнет.
// Но она видна — то есть заметна, а не тиха.
const sectorLabel = (id: string) => SECTOR_LABEL[id] ?? id;
const stageLabel = (s: string) =>
  (STAGE_LABEL as Record<string, string>)[s] ?? s.replace(/-/g, " ");

async function loadExamples(): Promise<ExampleSummary[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/qventure/examples`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const j = await res.json();
    return j?.ok ? (j.data as ExampleSummary[]) : [];
  } catch {
    return [];
  }
}

export default async function GalleryPage() {
  const examples = await loadExamples();

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-deep, #075b53)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            AEVION · QVenture
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--ink, #17181a)", margin: "0 0 8px" }}>Примеры разборов</h1>
          <p style={{ fontSize: 15, color: "var(--ink-soft, #45474c)", margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
            Real QVenture outputs across sectors and stages — each is a full fund-grade memo:
            a transparent 0–100 quant score, a four-role expert council, and an entry strategy.
            Open any one, or run your own in ~30 seconds.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <Link href="/qventure" style={{ padding: "10px 20px", background: "var(--teal-deep, #075b53)", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              Свой разбор →
            </Link>
            <a href="/api-backend/api/qventure/examples.csv" style={{ padding: "10px 20px", background: "#fff", color: "var(--teal-deep, #075b53)", border: "1px solid var(--rule-mid, #b9b8b0)", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              ⬇ Download as CSV
            </a>
          </div>
        </div>

        {examples.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--ink-faint, #74767c)" }}>
            Примеры готовятся — загляните через минуту или{" "}
            <Link href="/qventure" style={{ color: "var(--teal-deep, #075b53)", fontWeight: 700 }}>запустите свой разбор</Link>.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {examples.map((e) => {
              const color = VERDICT_COLOR[e.verdict] ?? "var(--ink-faint, #74767c)";
              return (
                <Link
                  key={e.id}
                  href={`/qventure/a/${e.id}`}
                  style={{
                    display: "block", border: "1px solid var(--rule, #d4d3cc)", borderRadius: 4, padding: 16,
                    background: "#fff", textDecoration: "none", color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink, #17181a)" }}>{e.name}</div>
                    <div style={{
                      flexShrink: 0, width: 46, height: 46, borderRadius: "50%",
                      background: `conic-gradient(${color} ${Math.max(0, Math.min(100, e.composite)) * 3.6}deg, var(--rule, #d4d3cc) 0deg)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "var(--ink, #17181a)" }}>
                        {Math.round(e.composite)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-faint, #74767c)", marginTop: 6 }}>
                    {sectorLabel(e.sector)} · {stageLabel(e.stage)}{e.geography ? ` · ${e.geography}` : ""}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 999, background: color, color: "#fff", fontWeight: 800, fontSize: 12, letterSpacing: 0.4 }}>
                      {VERDICT_LABEL[e.verdict] ?? e.verdict}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 22, padding: "18px 20px", borderRadius: 4, background: "var(--ink, #17181a)", color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Есть компания на примете?</div>
          <Link href="/qventure" style={{ display: "inline-block", padding: "10px 22px", background: "var(--teal-deep, #075b53)", color: "#fff", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}>
            Инвестиционное резюме →
          </Link>
        </div>
      </ProductPageShell>
    </>
  );
}
