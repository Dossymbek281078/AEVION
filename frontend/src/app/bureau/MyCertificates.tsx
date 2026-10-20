"use client";

/**
 * «Мои сертификаты» на /bureau — только у вошедшего.
 *
 * 20.10.2026 (замер прода, путь вошедшего): /api/bureau/dashboard уже отдавал свои
 * сертификаты, но на /bureau их не было — только текст про Verified. Свои человек
 * находил лишь на /qright за свёрнутым «▶ View QRight Registry» и английской «Mine».
 * Для платного бюро это тупик. Теперь здесь: название, дата, PDF, проверка; пустое
 * состояние ведёт к первой защите. Тексты — через словарь ru/en/kk.
 */
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

export type МойСертификат = { id: string; title: string; protectedAt: string };

export function MyCertificates({
  certificates,
  t,
  lang,
}: {
  certificates: МойСертификат[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  lang: string;
}) {
  const дата = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US");
  };
  return (
    <section data-bureau-my-certs aria-label={t("bureau.mine.title")} style={{ marginBottom: 22, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", padding: "18px 22px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 900, color: "#0f172a", margin: "0 0 10px" }}>{t("bureau.mine.title")}</h2>
      {certificates.length === 0 ? (
        <div data-bureau-my-certs-empty style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 15, color: "#475569" }}>{t("bureau.mine.empty")}</span>
          <Link href="/qright" style={{ padding: "9px 16px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 15 }}>
            {t("bureau.mine.protectFirst")}
          </Link>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {certificates.map((c) => (
            <li key={c.id} data-bureau-my-cert={c.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #f1f5f9", background: "#f8fafc" }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15.5, color: "#0f172a", overflowWrap: "anywhere" }}>{c.title}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{t("bureau.mine.protectedAt", { date: дата(c.protectedAt) })}</div>
              </div>
              <a href={apiUrl(`/api/pipeline/certificate/${c.id}/pdf`)} target="_blank" rel="noreferrer" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
                📄 PDF
              </a>
              <Link href={`/verify/${c.id}`} style={{ padding: "7px 12px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
                ✓ {t("bureau.mine.verify")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
