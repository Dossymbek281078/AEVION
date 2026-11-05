// Тело /cyberchess/guide: чистый серверный компонент без хуков — рисуется в SSR целиком
// (текст виден поисковику), тест рендерит его через renderToStaticMarkup.
import { GUIDE, GUIDE_EXAMPLES, PRICING_HREF, coachHref, guideFaqJsonLd, trapHref } from "./guide";
import type { Yazyk } from "../traps/traps";
import { BuyCyberChessButton } from "../BuyCyberChessButton";
import { CyberChessPaidList } from "../CyberChessPaidList";

const card: React.CSSProperties = { border: "1px solid rgba(22,22,26,0.12)", borderRadius: 12, padding: "14px 16px", background: "#fff" };
const btn: React.CSSProperties = { display: "inline-block", padding: "12px 20px", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none", textAlign: "center" };

function Buttons({ lang, n }: { lang: Yazyk; n: 1 | 2 }) {
  const t = GUIDE[lang];
  return (
    <>
    <p style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0 28px" }}>
      <a href={coachHref(lang)} data-testid={`ccg-coach-${n}`} style={{ ...btn, background: "#a9781a", color: "#fff" }}>{t.ctaCoach}</a>
      <a href={PRICING_HREF} data-testid={`ccg-price-${n}`} style={{ ...btn, background: "#fff", color: "#7a5410", border: "2px solid #a9781a" }}>{t.ctaPrice}</a>
      {/* 4.11: касса в одно нажатие на первом экране (n=1) — задача Оркестратора. */}
      {n === 1 && <BuyCyberChessButton lang={lang} source="guide" fallbackChannel="seo-cc-guide" />}
    </p>
    {n === 1 && <div style={{ margin: "-16px 0 28px" }}><CyberChessPaidList lang={lang} compact /></div>}
    </>
  );
}

export default function GuideView({ yazyk: lang }: { yazyk: Yazyk }) {
  const t = GUIDE[lang];
  return (
    <main lang={lang} data-guide-lang={lang} style={{ background: "#f7f6f2", color: "#16161a", minHeight: "100vh" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 16px 56px", lineHeight: 1.6, boxSizing: "border-box" }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideFaqJsonLd(lang)) }} />
        <h1 style={{ fontSize: "clamp(24px, 6vw, 36px)", lineHeight: 1.2, margin: "0 0 12px" }}>{t.h1}</h1>
        <p style={{ fontSize: 17, margin: "0 0 8px" }}>{t.lead}</p>
        <Buttons lang={lang} n={1} />

        <section aria-labelledby="ccg-how">
          <h2 id="ccg-how" style={{ fontSize: 22 }}>{t.howH}</h2>
          <ol style={{ paddingLeft: 0, listStylePosition: "inside", display: "grid", gap: 10 }}>
            {t.how.map((s, i) => (
              <li key={i} style={card}>
                <b>{s.h}</b>
                <p style={{ margin: "6px 0 0" }}>{s.p}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="ccg-labels">
          <h2 id="ccg-labels" style={{ fontSize: 22 }}>{t.labelsH}</h2>
          <ul style={{ paddingLeft: 20 }}>
            {t.labels.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </section>

        <section aria-labelledby="ccg-examples">
          <h2 id="ccg-examples" style={{ fontSize: 22 }}>{t.examplesH}</h2>
          <p>{t.examplesLead}</p>
          <ul style={{ paddingLeft: 20 }}>
            {GUIDE_EXAMPLES.map((e, i) => (
              <li key={e.id} style={{ marginBottom: 8 }}>
                <a href={trapHref(lang, e.id)} data-testid="ccg-example" style={{ color: "#7a5410", fontWeight: 700 }}>{t.examples[i]}</a>
              </li>
            ))}
          </ul>
          <p><a href={trapHref(lang, "").replace(/#$/, "")} data-testid="ccg-traps" style={{ color: "#7a5410", fontWeight: 700 }}>{t.trapsLink} →</a></p>
        </section>

        <section aria-labelledby="ccg-paid">
          <h2 id="ccg-paid" style={{ fontSize: 22 }}>{t.paidH}</h2>
          <p>{t.paidLead}</p>
          <ul style={{ paddingLeft: 20 }}>
            {t.paid.map((x, i) => <li key={i} style={{ marginBottom: 6 }}>{x}</li>)}
          </ul>
          <p style={{ color: "#3d3f46" }}>{t.freeNote}</p>
        </section>

        <section aria-labelledby="ccg-faq">
          <h2 id="ccg-faq" style={{ fontSize: 22 }}>{t.faqH}</h2>
          {t.faq.map((f, i) => (
            <details key={i} style={{ ...card, marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>{f.q}</summary>
              <p style={{ margin: "8px 0 0" }}>{f.a}</p>
            </details>
          ))}
        </section>

        <section aria-labelledby="ccg-cta" style={{ marginTop: 32 }}>
          <h2 id="ccg-cta" style={{ fontSize: 22 }}>{t.ctaH}</h2>
          <Buttons lang={lang} n={2} />
        </section>
      </div>
    </main>
  );
}
