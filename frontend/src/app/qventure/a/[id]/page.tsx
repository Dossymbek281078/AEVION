import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { serverFetch } from "@/lib/apiBase";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import paper from "@/styles/aevionPaper.module.css";
import { ResultView, VERDICT_LABEL, SERIF, type AnalysisResult, type Verdict } from "../../_result";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Три исхода, а не два.
 *
 * `if (!res || !res.ok) return null` уравнивал «такого разбора нет» с «мы не
 * смогли спросить», и страница на любой выдуманный id отвечала 200 с полной
 * вёрсткой. Несуществующих id бесконечно много — это бесконечный
 * индексируемый мусор.
 *
 * Повтор при холодном бэкенде СОХРАНЁН намеренно (он в serverFetch): именно
 * он и не даёт отдать 404 на живой отчёт во время выкатки. По той же
 * причине "absent" ставится ТОЛЬКО по коду 404/410 от сервера, а не по
 * пустому телу: `{ok:false}` при 200 остаётся "unknown".
 */
type Loaded =
  | { state: "found"; data: AnalysisResult }
  | { state: "absent" }
  | { state: "unknown" };

async function loadAnalysis(id: string): Promise<Loaded> {
  try {
    const res = await serverFetch(`/api/qventure/analyses/${encodeURIComponent(id)}`);
    if (!res) return { state: "unknown" };
    if (res.status === 404 || res.status === 410) return { state: "absent" };
    if (!res.ok) return { state: "unknown" };
    const j = await res.json();
    return j?.ok ? { state: "found", data: j.data as AnalysisResult } : { state: "unknown" };
  } catch {
    return { state: "unknown" };
  }
}

async function getOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch { /* headers unavailable at build time */ }
  return "";
}

function memoSnippet(memo: string, max = 180): string {
  const t = memo.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Разбор конфликта 02.09.2026: их сторона проверяла `!a`, а loadAnalysis
  // возвращает ОБЪЕКТ состояния — проверка не сработала бы никогда, и ветка
  // «разбор не найден» была мёртвой. Взята структура с состоянием.
  // Заголовок РУССКИЙ — их сторона. Я сперва взял английский, выведя намерение
  // из темы их коммита («PDF английский по замыслу»), но тема была про PDF, а не
  // про страницу. Ответил их же сторож qventureSpeaksOneLanguage: страница
  // обязана говорить на ОДНОМ языке, и здесь он русский. Сторож существовал и
  // отвечал — спрашивать надо было его, а не толковать заголовок коммита.
  const zagruzka = await loadAnalysis(id);
  if (zagruzka.state !== "found") {
    return { title: "Разбор QVenture — AEVION", robots: { index: false, follow: false } };
  }
  const a = zagruzka.data;
  const verdict = VERDICT_LABEL[a.verdict as Verdict] ?? a.verdict.toUpperCase();
  const title = `${a.name} — ${a.composite}/100 · ${verdict} · QVenture`;
  const description = memoSnippet(a.result.council.memo);

  // Image is intentionally omitted here: the co-located opengraph-image.tsx
  // renders the newspaper card (name · verdict · composite) and Next injects it
  // into both og:image and twitter:image automatically. Setting images here would
  // override it with the generic /api/og/module card.
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedAnalysisPage({ params }: Props) {
  const { id } = await params;
  const zagruzka = await loadAnalysis(id);
  // Разбора НЕТ — честный 404. При "unknown" (не смогли спросить) остаётся
  // 200 и прежний вид: 404 при аварии сказал бы поисковику, что живого
  // отчёта не существует, и выбросил бы его из выдачи.
  if (zagruzka.state === "absent") notFound();
  const a = zagruzka.state === "found" ? zagruzka.data : null;

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
       <div className={paper.paper} style={{ background: "transparent", minHeight: 0 }}>
        {!a ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 800, color: "var(--ink, #17181a)" }}>Разбор не найден</h1>
            <p style={{ color: "var(--ink-faint, #74767c)", marginTop: 8 }}>This QVenture report doesn&apos;t exist or is no longer public.</p>
            <Link href="/qventure" style={{ display: "inline-block", marginTop: 16, padding: "11px 20px", background: "var(--teal, #0a7d72)", color: "#fff", borderRadius: 4, fontWeight: 700, textDecoration: "none" }}>
              Новый разбор →
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16, borderTop: "3px solid var(--rule-bold, #17181a)", paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-deep, #075b53)", letterSpacing: "0.28em", textTransform: "uppercase" }}>
                AEVION · QVenture · общий отчёт
              </div>
              <Link href="/qventure" style={{ padding: "10px 18px", background: "var(--teal, #0a7d72)", color: "#fff", borderRadius: 4, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
                Свой разбор →
              </Link>
            </div>
            <ResultView result={a} shared />
            <div style={{ marginTop: 8, padding: "20px", borderRadius: 4, background: "var(--ink, #17181a)", color: "var(--card, #fffefb)", textAlign: "center" }}>
              <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Разбор любой компании в любой отрасли — QVenture</div>
              <Link href="/qventure" style={{ display: "inline-block", padding: "11px 22px", background: "var(--teal, #0a7d72)", color: "#fff", borderRadius: 4, fontWeight: 700, textDecoration: "none" }}>
                Инвестиционное резюме →
              </Link>
            </div>
          </>
        )}
       </div>
      </ProductPageShell>
    </>
  );
}
