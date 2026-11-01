// Тело /bureau/guide: чистый серверный компонент без хуков — рисуется в SSR целиком
// (текст виден поисковику), тест рендерит его через renderToStaticMarkup.
import Link from "next/link";
import {
  GUIDE,
  GUIDE_CONTACT_HREF,
  GUIDE_EXAMPLES,
  GUIDE_QRIGHT_HREF,
  guideFaqJsonLd,
  type GuideLang,
} from "./guideText";

const card: React.CSSProperties = { border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "14px 16px", background: "#fff" };
const btn: React.CSSProperties = { display: "inline-block", padding: "12px 20px", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none", textAlign: "center" };

export function GuideView({ lang }: { lang: GuideLang }) {
  const t = GUIDE[lang];
  return (
    <main lang={lang} data-guide-lang={lang} style={{ maxWidth: 780, margin: "0 auto", padding: "28px 16px 56px", color: "#0f172a", lineHeight: 1.6, background: "#f8fafc", minHeight: "100vh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideFaqJsonLd(lang)) }} />
      <h1 style={{ fontSize: "clamp(24px, 6vw, 36px)", lineHeight: 1.2, margin: "0 0 12px" }}>{t.h1}</h1>
      <p style={{ fontSize: 17, margin: "0 0 24px" }}>{t.lead}</p>

      <p style={{ margin: "0 0 28px", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href={GUIDE_CONTACT_HREF} data-testid="guide-cta-main" style={{ ...btn, background: "#0f766e", color: "#fff" }}>{t.ctaMain}</Link>
      </p>

      <section aria-labelledby="g-steps">
        <h2 id="g-steps" style={{ fontSize: 22 }}>{t.stepsH}</h2>
        <ol style={{ paddingLeft: 0, listStylePosition: "inside", display: "grid", gap: 10 }}>
          {t.steps.map((s, i) => (
            <li key={i} style={card}>
              <b>{s.h}</b>
              <p style={{ margin: "6px 0 0" }}>{s.p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="g-limits">
        <h2 id="g-limits" style={{ fontSize: 22 }}>{t.limitsH}</h2>
        <ul style={{ paddingLeft: 20 }}>
          {t.limits.map((x, i) => <li key={i} style={{ marginBottom: 8 }}>{x}</li>)}
        </ul>
      </section>

      <section aria-labelledby="g-examples">
        <h2 id="g-examples" style={{ fontSize: 22 }}>{t.examplesH}</h2>
        <p>{t.examplesLead}</p>
        <ul style={{ paddingLeft: 20 }}>
          {GUIDE_EXAMPLES.map((e, i) => (
            <li key={e.id} style={{ marginBottom: 8 }}>
              <Link href={`/verify/${e.id}`} data-testid="guide-example" style={{ color: "#0f766e", fontWeight: 700 }}>{t.examples[i]}</Link>
              <div style={{ fontSize: 13, color: "#475569", wordBreak: "break-all" }}>aevion.app/verify/{e.id}</div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="g-faq">
        <h2 id="g-faq" style={{ fontSize: 22 }}>{t.faqH}</h2>
        {t.faq.map((f, i) => (
          <details key={i} style={{ ...card, marginBottom: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>{f.q}</summary>
            <p style={{ margin: "8px 0 0" }}>{f.a}</p>
          </details>
        ))}
      </section>

      <section aria-labelledby="g-cta" style={{ marginTop: 32 }}>
        <h2 id="g-cta" style={{ fontSize: 22 }}>{t.ctaH}</h2>
        <p style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
          <Link href={GUIDE_CONTACT_HREF} data-testid="guide-cta-main-2" style={{ ...btn, background: "#0f766e", color: "#fff" }}>{t.ctaMain}</Link>
          <Link href={GUIDE_QRIGHT_HREF} data-testid="guide-cta-second" style={{ ...btn, background: "#fff", color: "#0f766e", border: "2px solid #0f766e" }}>{t.ctaSecond}</Link>
        </p>
        <p style={{ fontSize: 13, color: "#475569" }}>{t.ctaNote}</p>
      </section>
    </main>
  );
}
