import type { Metadata } from "next";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { COMPARISONS, UNANALYSED, type Basis, type Claim } from "@/data/competitors";

export const metadata: Metadata = {
  title: "AEVION против аналогов — где мы сильнее и где слабее",
  description:
    "Честное сравнение модулей AEVION с существующими продуктами: у каждого модуля есть строка «где мы слабее», у каждого утверждения — основание.",
};

const BASIS_LABEL: Record<Basis, string> = {
  measured: "замер",
  public: "публичные данные",
  design: "устройство",
};

const BASIS_COLOR: Record<Basis, { bg: string; fg: string }> = {
  measured: { bg: "#ecfdf5", fg: "#065f46" },
  public: { bg: "#eff6ff", fg: "#1e40af" },
  design: { bg: "#f5f3ff", fg: "#5b21b6" },
};

function ClaimRow({ claim, tone }: { claim: Claim; tone: "win" | "lose" }) {
  const mark = tone === "win" ? "+" : "−";
  const markColor = tone === "win" ? "#047857" : "#b91c1c";
  const basis = BASIS_COLOR[claim.basis];
  return (
    <li style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: "1px solid #f1f5f9", listStyle: "none" }}>
      <span aria-hidden style={{ color: markColor, fontWeight: 800, fontSize: 15, lineHeight: "22px" }}>{mark}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: "#0f172a", lineHeight: 1.55 }}>{claim.text}</div>
        <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "2px 7px",
              borderRadius: 999,
              background: basis.bg,
              color: basis.fg,
              whiteSpace: "nowrap",
            }}
          >
            {BASIS_LABEL[claim.basis]}
          </span>
          <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{claim.evidence}</span>
        </div>
      </div>
    </li>
  );
}

export default function ComparePage() {
  const measuredCount = COMPARISONS.reduce(
    (n, c) => n + [...c.weWin, ...c.weLose].filter((x) => x.basis === "measured").length,
    0,
  );

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <header style={{ marginBottom: 26 }}>
          <div
            style={{
              display: "inline-block",
              padding: "3px 12px",
              borderRadius: 20,
              background: "#f1f5f9",
              color: "#334155",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            Сравнение
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1.2, maxWidth: 780 }}>
            AEVION против аналогов — включая то, где аналоги лучше
          </h1>
          <p style={{ margin: "0 0 14px", fontSize: 14.5, color: "#475569", lineHeight: 1.65, maxWidth: 760 }}>
            У каждого модуля здесь обязательно есть строка «где мы слабее». Таблица, в которой одна
            сторона выигрывает везде, ничего не сообщает: ею нельзя пользоваться, чтобы выбрать
            инструмент. У каждого утверждения указано основание — наш замер, публичные данные
            конкурента или свойство устройства продукта.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 12.5, color: "#64748b" }}>
            <span>Разобрано модулей: <b style={{ color: "#0f172a" }}>{COMPARISONS.length}</b></span>
            <span>Утверждений на собственных замерах: <b style={{ color: "#0f172a" }}>{measuredCount}</b></span>
            <span>Ждут разбора: <b style={{ color: "#0f172a" }}>{UNANALYSED.length}</b></span>
          </div>
        </header>

        {COMPARISONS.map((c) => (
          <section
            key={c.moduleId}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 20,
              marginBottom: 18,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a" }}>
                <a href={c.page} style={{ color: "inherit", textDecoration: "none" }}>{c.module} ↗</a>
              </h2>
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>срез {c.surveyedAt}</span>
            </div>
            <p style={{ margin: "6px 0 14px", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
              Сравниваем с категорией: {c.category}.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginBottom: 16 }}>
              {c.rivals.map((r) => (
                <div key={r.name} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" }}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", minHeight: 28, fontSize: 13, fontWeight: 700, color: "#0f172a", textDecoration: "none" }}
                  >
                    {r.name} ↗
                  </a>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginTop: 2 }}>{r.strength}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#047857" }}>
                  Где сильнее мы
                </h3>
                <ul style={{ margin: 0, padding: 0 }}>
                  {c.weWin.map((claim) => <ClaimRow key={claim.text} claim={claim} tone="win" />)}
                </ul>
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#b91c1c" }}>
                  Где сильнее они
                </h3>
                <ul style={{ margin: 0, padding: 0 }}>
                  {c.weLose.map((claim) => <ClaimRow key={claim.text} claim={claim} tone="lose" />)}
                </ul>
              </div>
            </div>

            <p style={{ margin: "16px 0 0", padding: "12px 14px", background: "#f8fafc", borderRadius: 10, fontSize: 13.5, color: "#0f172a", lineHeight: 1.6 }}>
              <b>Когда выбирать нас: </b>{c.verdict}
            </p>
            {c.sources.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: "#94a3b8" }}>Источники разбора: {c.sources.join(" · ")}</div>
            )}
          </section>
        ))}

        <section style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 14, padding: 20, marginBottom: 28 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Ещё не разобрано</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
            У этих модулей аналоги есть, но среза мы не делали. Пустая строка честнее выдуманной,
            поэтому они перечислены отдельно, а не заполнены догадками.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {UNANALYSED.map((u) => (
              <li key={u.module} style={{ fontSize: 13, color: "#334155", lineHeight: 1.55 }}>
                <b>{u.module}</b> — вероятные аналоги: {u.likelyRivals}
              </li>
            ))}
          </ul>
        </section>
      </ProductPageShell>
    </>
  );
}
