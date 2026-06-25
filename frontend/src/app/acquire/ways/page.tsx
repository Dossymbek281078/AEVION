/**
 * Print-friendly "Ways to participate" — money policy tuned for a platform
 * partner (Anthropic / AI lab). Open in browser → Ctrl/Cmd+P → "Save as PDF".
 * Attach to outbound email or show on a call. B/W, A4, high contrast.
 *
 * Core message: one offer, a partnership, not a buyout. A $10M repayable
 * advance + a 51/49 revenue split in the founder's favour. Founder keeps 51%
 * and stays Chief Idea Officer; partner pays mostly in resources, not capital.
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
        <h1>One offer.<br />A partnership, not a buyout.</h1>
        <p>
          AEVION is the first self-contained planet built on your base — AI tools, games, a bank, payments,
          IP, identity and commerce under one login, where the user never needs to leave. There is one offer,
          and it costs almost no cash: the partner pays in what it already has in
          abundance — <strong>compute, engineers, distribution, brand</strong> — plus a small repayable advance,
          not scarce capital.
        </p>

        <div className="ask-box">
          <div className="eyebrow">The headline ask · small and recoverable</div>
          <div className="price">$10M now — a repayable advance. We split AEVION&apos;s revenue 51/49 in my favour (for now).</div>
          <p style={{ margin: 0 }}>
            The $10M is returned to the partner out of the founder&apos;s share as the project grows; it frees the
            founder from current companies and salaried work to go full-time on AEVION&apos;s ideas. The founder keeps
            <strong> 51%</strong> and stays Chief Idea Officer — author and driver of the next ideas. The partner
            contributes mostly in <strong>compute, engineers, distribution, brand</strong> + the small repayable
            advance. A small, recoverable check; the partner risks resources and time, not capital up front.
          </p>
        </div>

        <h2>The single offer</h2>
        <table>
          <thead>
            <tr><th style={{ width: "22%" }}>Element</th><th>What the partner contributes</th><th>What the partner gets</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>$10M repayable advance</strong></td><td>Compute, engineers, distribution, brand + a small repayable advance</td><td>49% of AEVION&apos;s revenue (starting frame); advance returned from the founder&apos;s share as the project grows</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: "9.5pt", color: "#555" }}>
          The trillion is a <strong>trajectory</strong>, not today&apos;s price. The founder keeps 51% and stays
          Chief Idea Officer; the big money comes on real growth, not at the start — that is the incentive for both sides.
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

        {/* PAGE 3 — who it serves + sovereign + urgency */}
        <div className="page-break" />
        <div className="eyebrow">Why the planet is bigger than apps</div>
        <h2>Sovereign territory, and who it serves</h2>
        <p>
          The habitat is not only for individuals. A <strong>government can hold its own sovereign territory
          on the globe</strong> — a sealed enclave only its authorized officials may enter, post-quantum-
          protected, where the nation’s data never leaves its own contour. This is how you establish at the
          level of states, not vendors. Kazakhstan — whose government is pushing AI hard right now — is a
          natural first beachhead.
        </p>
        <table>
          <thead><tr><th style={{ width: "24%" }}>Who</th><th>What the planet gives</th><th style={{ width: "26%" }}>Why it is money / value</th></tr></thead>
          <tbody>
            <tr><td><strong>Governments</strong></td><td>Sovereign enclave, e-gov, identity, document attestation, transparent (corruption-resistant) procurement</td><td>State budgets, national security, anti-corruption</td></tr>
            <tr><td><strong>Education</strong></td><td>An account per child: every subject + AI literacy, a Claude tutor, credential attestation</td><td>~$100/child/year recurring — one country’s schools ≈ $350M/yr</td></tr>
            <tr><td><strong>Banks</strong></td><td>Payment rail, KYC, <strong>post-quantum transaction signing</strong>, settlement, contract attestation</td><td>Banks must move to post-quantum now (harvest-now-decrypt-later)</td></tr>
            <tr><td><strong>Healthcare / creators / devs</strong></td><td>Secure records; authorship attestation; one developer cabinet vs 15 subscriptions</td><td>Trust, provenance, efficiency</td></tr>
          </tbody>
        </table>
        <h3>Why it needed to exist yesterday</h3>
        <ul>
          <li>AI content is already flooding — the provenance crisis is now, not later.</li>
          <li>The quantum clock is already running — signatures must be reissued today (ML-DSA-65, FIPS 204, in prod).</li>
          <li>Every state is reaching for AI sovereignty at once — first to set the standard anchors nations for a generation.</li>
          <li>Tools are commoditizing — the window to own the place, not just a tool, is closing.</li>
        </ul>
        <p style={{ fontSize: "9.5pt", color: "#555" }}>
          Figures illustrative; the order of magnitude is the point — one vertical of one country is hundreds
          of millions a year, recurring. That is why “a sketch of direction today, a trillion as trajectory” is
          arithmetic, not a slogan. Full detail: promo/26_PLANET_UTILITY_SOVEREIGN.md.
        </p>

        <div className="footer">
          Full structures · promo/25_ANTHROPIC_DEAL_VARIANTS.md · Live brief · aevion.app/acquire<br />
          Contact · yahiin1978@gmail.com — Dosymbek Zhakiya, Founder &amp; Chief Idea Officer, AEVION
        </div>
      </div>
    </>
  );
}
