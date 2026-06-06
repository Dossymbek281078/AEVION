/**
 * Print-friendly "Ways to participate" — money policy tuned for a platform
 * partner (Anthropic / AI lab). Open in browser → Ctrl/Cmd+P → "Save as PDF".
 * Attach to outbound email or show on a call. B/W, A4, high contrast.
 *
 * Core message: the deal does NOT start with a $1B wire. Founder asks for
 * little now and ties upside to whether the planet works. Pay in resources,
 * not capital; big money only on real success.
 */

const css = `
  @page { size: A4; margin: 16mm 14mm; }
  html, body { background: #fff !important; color: #111 !important; font-family: Inter, Helvetica, Arial, sans-serif; }
  .print-root { color: #111; max-width: 720px; margin: 0 auto; font-size: 11.5pt; line-height: 1.45; }
  .print-root h1, .print-root h2, .print-root h3 { color: #0f172a; letter-spacing: -0.01em; }
  .print-root h1 { font-size: 27pt; font-weight: 900; line-height: 1.06; margin: 0 0 10pt; }
  .print-root h2 { font-size: 15pt; font-weight: 800; margin: 16pt 0 7pt; border-bottom: 1px solid #111; padding-bottom: 4pt; }
  .print-root h3 { font-size: 12pt; font-weight: 800; margin: 10pt 0 4pt; }
  .print-root p { margin: 0 0 8pt; }
  .print-root strong { color: #0f172a; }
  .print-root .eyebrow { font-size: 8pt; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #555; margin-bottom: 6pt; }
  .print-root .ask-box { border: 2pt solid #111; padding: 12pt 16pt; margin: 14pt 0; }
  .print-root .ask-box .price { font-size: 18pt; font-weight: 900; line-height: 1.1; margin-bottom: 6pt; }
  .print-root table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 6pt 0; }
  .print-root th, .print-root td { border: 1px solid #999; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  .print-root th { background: #f1f5f9; font-weight: 800; }
  .print-root ul { padding-left: 16pt; margin: 4pt 0 10pt; }
  .print-root li { margin-bottom: 3pt; }
  .print-root .footer { font-size: 8.5pt; color: #555; margin-top: 14pt; border-top: 1px solid #ccc; padding-top: 6pt; }
  .print-root .page-break { page-break-before: always; break-before: page; }
  @media screen { body { background: #f5f5f5; } .print-root { background: #fff; box-shadow: 0 1px 8px rgba(0,0,0,0.08); margin-top: 24px; margin-bottom: 24px; padding: 48px; } }
`;

export default function AcquireWaysPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="print-root">
        {/* PAGE 1 — Ways + principle */}
        <div className="eyebrow">Ways to participate · for a platform partner · Confidential · 2026</div>
        <h1>This does not start<br />with a $1B wire.</h1>
        <p>
          AEVION is the first self-contained planet built on your base — AI tools, games, a bank, payments,
          IP, identity and commerce under one login, where the user never needs to leave. There are several
          ways to participate, and the ones below cost almost no cash: you pay in what you already have in
          abundance — <strong>compute, engineers, distribution, brand</strong> — not in scarce capital.
        </p>

        <div className="ask-box">
          <div className="eyebrow">The deal-saver</div>
          <div className="price">I ask for little now. My upside is tied to whether the planet works.</div>
          <p style={{ margin: 0 }}>
            A salary and a role today — not a fortune. My wealth comes through <strong>vesting and earnouts on
            real milestones</strong>, with liquidity later. You risk resources, not capital, and pay in full
            only if it succeeds. The opposite of what frightens a company heading into an IPO.
          </p>
        </div>

        <h2>The doors (from near-zero risk upward)</h2>
        <table>
          <thead>
            <tr><th style={{ width: "22%" }}>Door</th><th>What you contribute</th><th>What you get</th><th style={{ width: "16%" }}>Cash now</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>V0 · Showcase &amp; Credits</strong></td><td>Compute credits + brand “first planet on Claude” + access</td><td>A flagship case, a hand on the pulse, zero obligation</td><td>≈ $0</td></tr>
            <tr><td><strong>V1 · Small stake 1–10%</strong></td><td>$10.5M–$105M at one valuation (~$1.05B), milestone tranches</td><td>De-risked exposure, no operational load</td><td>Small</td></tr>
            <tr><td><strong>V2 · Planet Co-Build ⭐</strong></td><td>A team + resources (+ modest cash)</td><td>Control 80–90%; founder keeps 10–20% (vesting) as Chief Idea Officer</td><td>Modest</td></tr>
            <tr><td><strong>V3 · Full buyout</strong></td><td>$1B for 95%</td><td>The whole engine; founder → Senior Advisor</td><td>Large (last door)</td></tr>
          </tbody>
        </table>

        {/* PAGE 2 — phased policy + anti-clone */}
        <div className="page-break" />
        <div className="eyebrow">Recommended structure</div>
        <h2>Founder-light, success-heavy — three phases</h2>
        <table>
          <thead>
            <tr><th style={{ width: "26%" }}>Phase</th><th>What happens</th><th style={{ width: "20%" }}>Cash to founder</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>1. Incubate (0–6 mo)</strong></td>
              <td>Founder joins as Head of Planet / EIR on a modest salary. You give compute + 2–3 engineers + the “first planet on Claude” brand. IP contributed into a new entity; <strong>the AEV token is ring-fenced / paused</strong>. Reversible.</td>
              <td>Small (salary + token signing)</td>
            </tr>
            <tr>
              <td><strong>2. Planet JV (6–18 mo)</strong></td>
              <td>You take control (80–90%) mostly via <strong>resources</strong> + modest cash; founder keeps 10–20% vesting over 4 years + performance. Present valuation set modestly ($50–150M, not $1B) — diligence-friendly.</td>
              <td>Still little; wealth = vesting equity</td>
            </tr>
            <tr>
              <td><strong>3. Scale &amp; liquidity (18+ mo)</strong></td>
              <td>Earnouts on real metrics (MAU, planet GMV, modules in prod). Liquidity via your IPO / secondary / the planet’s own monetization.</td>
              <td><strong>Large</strong> — but earned on success</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: "9.5pt", color: "#555" }}>
          The trillion is a <strong>trajectory</strong>, not today’s price. Shares are struck off a modest present
          valuation; the path toward a trillion accrues mostly to the controlling side — that is the incentive.
        </p>

        <h3>And if your instinct is “we could build this ourselves”</h3>
        <ul>
          <li>The asset is already live today — rebuilding it is 200+ engineer-years and 36+ months.</li>
          <li>The value isn’t the 30 modules (those copy); it is the person who produced them in six months and will produce the next 30. That is what you retain — cheaply.</li>
          <li>Your brand is trustworthy, non-predatory AI. Taking an openly-shared idea without its author is exactly what your values forbid — the open trust is the protection.</li>
          <li>The window is now: partnering with what is already live beats an internal project that competes for roadmap priority.</li>
        </ul>

        <p>
          So whatever brought you here — a proof of your own platform, a piece of the future, or the trust
          infrastructure the AI age needs anyway — none of these doors asks you to be afraid of the number.
        </p>

        <div className="footer">
          Full structures · promo/25_ANTHROPIC_DEAL_VARIANTS.md · Live brief · aevion.app/acquire<br />
          Contact · yahiin1978@gmail.com — Dosymbek Zhakiya, Founder &amp; Chief Idea Officer, AEVION
        </div>
      </div>
    </>
  );
}
