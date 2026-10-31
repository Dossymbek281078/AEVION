// Страница сравнения ответов нейросетей: один компонент на /multichat-engine/compare, /en и /kk.
// Серверная разметка без клиентского кода — поисковик и человек видят весь текст сразу.
import { COMPARE_TEXT, askHref, pricingHref, type Yazyk } from "./compareText";
import { compareUrl } from "./meta";
import { T } from "../theme";

// Цвета — только через токены темы мультичата (сторож themeTokens.guard).
const C = { ink: T.text, muted: T.textFaded, line: T.lineSoft, accent: T.accent, soft: T.surfaceSoft } as const;

/** FAQPage для поисковика — те же вопросы и ответы, что на экране, без отдельного текста. */
export function faqJsonLd(lang: Yazyk): string {
  const t = COMPARE_TEXT[lang];
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang,
    url: compareUrl(lang),
    mainEntity: t.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }).replace(/</g, "\\u003c");
}

export default function CompareView({ yazyk }: { yazyk: Yazyk }) {
  const t = COMPARE_TEXT[yazyk];
  const cta = {
    display: "inline-block", padding: "12px 20px", borderRadius: 10, background: C.accent, color: T.onAccentDeep,
    fontWeight: 700, textDecoration: "none", fontSize: 16,
  } as const;
  return (
    <main lang={yazyk} style={{ maxWidth: 820, margin: "0 auto", padding: "28px 16px 64px", color: C.ink, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", lineHeight: 1.55 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd(yazyk) }} />
      <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", lineHeight: 1.15, margin: "0 0 14px" }}>{t.h1}</h1>
      <p style={{ fontSize: 18, margin: "0 0 12px" }}>{t.lead}</p>
      <p style={{ background: C.soft, borderLeft: `4px solid ${C.accent}`, padding: "10px 14px", margin: "0 0 18px" }}>{t.honest}</p>
      <p style={{ margin: "0 0 32px" }}>
        <a href={askHref(yazyk)} data-mc-compare="cta-top" style={cta}>{t.cta}</a>
        <span style={{ display: "block", fontSize: 14, color: C.muted, marginTop: 8 }}>{t.ctaNote}</span>
      </p>

      <h2 style={{ fontSize: 24, margin: "0 0 10px" }}>{t.methodTitle}</h2>
      <ol style={{ paddingLeft: 22, margin: "0 0 28px", listStyleType: "decimal" }}>
        {t.method.map((m) => <li key={m} style={{ marginBottom: 8 }}>{m}</li>)}
      </ol>

      <h2 style={{ fontSize: 24, margin: "0 0 10px" }}>{t.howTitle}</h2>
      <ol style={{ paddingLeft: 22, margin: "0 0 28px", listStyleType: "decimal" }}>
        {t.how.map((m) => <li key={m} style={{ marginBottom: 8 }}>{m}</li>)}
      </ol>

      <h2 style={{ fontSize: 24, margin: "0 0 6px" }}>{t.examplesTitle}</h2>
      <p style={{ color: C.muted, margin: "0 0 14px" }}>{t.examplesLead}</p>
      {t.examples.map((e, i) => (
        <section key={e.q} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
          <p style={{ fontWeight: 700, margin: "0 0 6px" }}>{i + 1}. {e.q}</p>
          <p style={{ color: C.muted, margin: "0 0 10px", fontSize: 15 }}>{e.look}</p>
          <a href={askHref(yazyk, e.q)} data-mc-compare={`example-${i + 1}`} style={{ color: C.accent, fontWeight: 700, textDecoration: "none" }}>{t.askThis}</a>
        </section>
      ))}

      <h2 style={{ fontSize: 24, margin: "26px 0 10px" }}>{t.faqTitle}</h2>
      {t.faq.map((f) => (
        <details key={f.q} open style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0" }}>
          <summary style={{ fontWeight: 700, cursor: "pointer" }}>{f.q}</summary>
          <p style={{ margin: "8px 0 0" }}>{f.a}</p>
        </details>
      ))}

      <p style={{ marginTop: 30, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <a href={askHref(yazyk)} data-mc-compare="cta-bottom" style={cta}>{t.cta}</a>
        <a href={pricingHref(yazyk)} data-mc-compare="pricing" style={{ color: C.accent, fontWeight: 700 }}>{t.pricing}</a>
      </p>
    </main>
  );
}
