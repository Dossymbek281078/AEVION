const css = `
  @page { size: A4; margin: 16mm 14mm; }
  html, body { background: #fff !important; color: #111 !important; font-family: Inter, Helvetica, Arial, sans-serif; }
  .root { color: #111; max-width: 720px; margin: 0 auto; font-size: 11.5pt; line-height: 1.45; }
  .root h1 { font-size: 28pt; font-weight: 900; line-height: 1.05; margin: 0 0 10pt; letter-spacing: -0.01em; }
  .root h2 { font-size: 15pt; font-weight: 800; margin: 16pt 0 8pt; border-bottom: 1px solid #111; padding-bottom: 3pt; }
  .root h3 { font-size: 11.5pt; font-weight: 800; margin: 10pt 0 4pt; }
  .root p { margin: 0 0 7pt; }
  .root .eyebrow { font-size: 8pt; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #555; margin-bottom: 6pt; }
  .root .roi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 0; border: 1.5pt solid #111; border-radius: 4pt; overflow: hidden; margin: 10pt 0; }
  .root .roi-cell { padding: 9pt 10pt; border-right: 1pt solid #ddd; }
  .root .roi-cell:last-child { border-right: none; }
  .root .roi-label { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 3pt; }
  .root .roi-val { font-size: 22pt; font-weight: 900; line-height: 1; color: #0f172a; }
  .root .roi-sub { font-size: 7.5pt; color: #666; margin-top: 3pt; line-height: 1.3; }
  .root table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 5pt 0; }
  .root th, .root td { border: 1px solid #999; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  .root th { background: #f1f5f9; font-weight: 800; }
  .root ul { padding-left: 14pt; margin: 3pt 0 8pt; }
  .root li { margin-bottom: 3pt; }
  .root .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; margin: 8pt 0; }
  .root .card { border: 1px solid #ccc; border-radius: 4pt; padding: 8pt 10pt; }
  .root .card-label { font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 3pt; }
  .root .card-arr { font-size: 13pt; font-weight: 900; color: #0d9488; }
  .root .footer { font-size: 8pt; color: #888; margin-top: 12pt; border-top: 1px solid #ccc; padding-top: 5pt; }
  .root .pb { page-break-before: always; break-before: page; }
  @media screen { body { background: #f0f0f0; } .root { background: #fff; padding: 48px; margin: 24px auto; box-shadow: 0 1px 8px rgba(0,0,0,0.1); } }
`;

export default function PartnerPrintPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="root">

        {/* PAGE 1 — Partnership offer */}
        <div className="eyebrow">Innovation Partnership Brief · Confidential · 2026</div>
        <h1>AEVION Partnership.<br />$10M advance · 51/49 revenue · not a buyout.</h1>
        <p>
          AEVION is an innovation lab with a completed technical foundation across five domains:
          post-quantum signatures (FIPS 204, opt-in), AI routing, digital banking, IP registry,
          developer platform. One founder, 30+ live modules, zero revenue today.
          The bottleneck is execution — team and resources.
        </p>
        <p>
          <strong>The offer: one partnership, not a buyout. The partner brings $10M as a returnable
          advance plus resources (compute, engineers, distribution, brand). Project revenue splits
          51% founder / 49% partner. The founder stays as Chief Idea Officer with a majority stake;
          the AEVION brand is kept.</strong>
        </p>

        {/* Offer terms */}
        <div className="roi-grid">
          <div className="roi-cell">
            <div className="roi-label">Advance</div>
            <div className="roi-val">$10M</div>
            <div className="roi-sub">returnable · repaid from founder&apos;s share as it grows</div>
          </div>
          <div className="roi-cell">
            <div className="roi-label">Revenue split</div>
            <div className="roi-val">51 / 49</div>
            <div className="roi-sub">founder / partner</div>
          </div>
          <div className="roi-cell">
            <div className="roi-label">Founder</div>
            <div className="roi-val">Chief Idea Officer</div>
            <div className="roi-sub">majority stake · stays, drives next ideas</div>
          </div>
          <div className="roi-cell">
            <div className="roi-label">Partner pays</div>
            <div className="roi-val">mostly resources</div>
            <div className="roi-sub">compute, engineers, distribution, brand</div>
          </div>
        </div>

        <h2>Deal structure</h2>
        <table>
          <tbody>
            <tr><th style={{ width: "38%" }}>Form</th><td><strong>Partnership, not a buyout — founder stays</strong></td></tr>
            <tr><th>Financing</th><td>$10M returnable advance from the partner</td></tr>
            <tr><th>Purpose of advance</th><td>Frees the founder from current companies → full-time on AEVION ideas; repaid from founder&apos;s share as it grows</td></tr>
            <tr><th>Revenue split</th><td><strong>51% founder / 49% partner</strong> (starting frame)</td></tr>
            <tr><th>What the partner brings</th><td>Mostly resources (compute, engineers, distribution, brand) + a small returnable advance</td></tr>
            <tr><th>Founder role</th><td>Chief Idea Officer — majority stake, stays (not Senior Advisor)</td></tr>
            <tr><th>Brand</th><td>AEVION is kept (not merged into the partner)</td></tr>
            <tr><th>AEV token</th><td>Ring-fenced (out of the deal perimeter)</td></tr>
            <tr><th>Founder veto</th><td>Constitution v1 — changes only with the founder&apos;s written consent</td></tr>
            <tr><th>Due diligence</th><td>Tech + legal + financial, 30 days</td></tr>
            <tr><th>Exclusivity</th><td>60 days from LOI signing</td></tr>
            <tr><th>Contact</th><td><strong>yahiin1978@gmail.com</strong></td></tr>
          </tbody>
        </table>

        <div className="footer">
          aevion.app/partner · aevion.app/transparency · yahiin1978@gmail.com
        </div>

        {/* PAGE 2 — Innovation pipeline */}
        <div className="pb" />
        <div className="eyebrow">Innovation pipeline</div>
        <h2>5 products · illustrative ~$490M ARR by year 5 (pre-revenue — not a forecast)</h2>
        <p>Each exists today as a prototype or MVP; the company is pre-revenue. The figures below are illustrative potential under stated assumptions, not forecasts. With a team of 80-100 engineers, each becomes a market product.</p>

        <div className="grid2">
          <div className="card">
            <div className="card-label">In production · QSign</div>
            <h3>Post-quantum e-signature infrastructure</h3>
            <p style={{ fontSize: "10pt", color: "#444", margin: "4pt 0 6pt" }}>
              ML-DSA-65 FIPS 204 GA — only commercial product of this type in the region.
              National infrastructure potential: KZ, UAE, Saudi Arabia.
            </p>
            <div className="card-arr">$20-100M/year</div>
          </div>
          <div className="card">
            <div className="card-label">Foundation ready · AEVION Bank</div>
            <h3>Licensed digital bank</h3>
            <p style={{ fontSize: "10pt", color: "#444", margin: "4pt 0 6pt" }}>
              DIFC-licenseable. Shariah-compliant structure available.
              QSign attestation on every transaction.
            </p>
            <div className="card-arr">$200M+/year by year 5</div>
          </div>
          <div className="card">
            <div className="card-label">MVP live · QRight</div>
            <h3>IP Bureau v2</h3>
            <p style={{ fontSize: "10pt", color: "#444", margin: "4pt 0 6pt" }}>
              IP attestation for AI-generated content. National patent office
              integration = recurring government revenue.
            </p>
            <div className="card-arr">$10-50M/year</div>
          </div>
          <div className="card">
            <div className="card-label">9 integrations live · DevHub</div>
            <h3>Zapier for MENA/CIS</h3>
            <p style={{ fontSize: "10pt", color: "#444", margin: "4pt 0 6pt" }}>
              15 SaaS tabs → 1 workspace. Zapier / Make don't work reliably
              in MENA compliance environments. First-mover available now.
            </p>
            <div className="card-arr">$50-150M/year</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-label">364 vitest · 5+ AI providers · QCoreAI</div>
          <h3>AI API for MENA/CIS government sector</h3>
          <p style={{ fontSize: "10pt", color: "#444", margin: "4pt 0 6pt" }}>
            Anthropic and OpenAI have no compliance-friendly presence in KZ/UZ/AZ.
            QCoreAI is the last-mile AI for these markets.
          </p>
          <div className="card-arr">$30-80M/year</div>
        </div>

        <p style={{ marginTop: 10, fontSize: "10pt", color: "#555", fontStyle: "italic" }}>
          + 5 unrevealed product concepts — disclosed under NDA at LOI stage.
          This is the next wave of ideas the founder has already developed.
        </p>

        {/* PAGE 3 — Financial + Why you can't build this faster */}
        <div className="pb" />
        <div className="eyebrow">Financial scenario</div>
        <h2>ARR projection with 80-100 person team</h2>
        <p style={{ fontSize: "10pt", color: "#555", fontStyle: "italic" }}>Illustrative potential under stated assumptions — the company is currently pre-revenue ($0). Not a forecast or guarantee.</p>
        <table>
          <thead>
            <tr><th>Product</th><th>Year 3 ARR</th><th>Year 5 ARR</th></tr>
          </thead>
          <tbody>
            <tr><td>QSign (gov + enterprise)</td><td>$30M</td><td>$80M</td></tr>
            <tr><td>AEVION Bank</td><td>$50M</td><td>$200M</td></tr>
            <tr><td>QRight (IP Bureau)</td><td>$10M</td><td>$40M</td></tr>
            <tr><td>DevHub (MENA/CIS)</td><td>$20M</td><td>$80M</td></tr>
            <tr><td>QCoreAI</td><td>$15M</td><td>$60M</td></tr>
            <tr><td>Other modules</td><td>$5M</td><td>$30M</td></tr>
            <tr style={{ fontWeight: 800 }}><td><strong>Total ARR</strong></td><td><strong>$130M</strong></td><td><strong>$490M</strong></td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: "10pt", color: "#555" }}>
          At 8-12× SaaS+fintech multiple: year 3 valuation $1.0-1.6B · year 5 valuation $3.9-5.9B.<br />
          Partner's 49% of revenue at year 5: ≈ $176–240M/year on $360–490M ARR. Partnership, not a buyout — forward projection, not a guarantee.
        </p>

        <h2>Why you can't build this faster on your own</h2>
        <table>
          <thead><tr><th>Factor</th><th>Build from scratch</th><th>Partner with AEVION</th></tr></thead>
          <tbody>
            <tr><td>Time to first product</td><td>18-24 months</td><td><strong>Now</strong> — QSign in production</td></tr>
            <tr><td>Foundation cost</td><td>$15-30M</td><td><strong>Already done</strong></td></tr>
            <tr><td>Innovation pipeline</td><td>Hire product visionary ($2-5M/yr)</td><td><strong>Included</strong> — Chief Idea Officer in the deal</td></tr>
            <tr><td>QSign FIPS 204 compliance</td><td>12-18 months of regulatory work</td><td><strong>Completed</strong>, SDK published</td></tr>
            <tr><td>MENA first-mover on DevHub</td><td>Available 18+ months later</td><td><strong>Available now</strong></td></tr>
          </tbody>
        </table>

        <h2>Verification — check yourself</h2>
        <ul>
          <li><strong>aevion.app/transparency</strong> — live health-board, daily smoke 24/24</li>
          <li><strong>aevion.app/constitution</strong> — Constitution v1, QSign-attested, 3 languages</li>
          <li><strong>aevion.app/partner</strong> — full visual brief</li>
          <li><strong>/api/aevion/registry</strong> — JSON registry of all 30+ modules</li>
        </ul>

        <div className="footer">
          AEVION · Innovation Partnership · Confidential · 2026 ·
          yahiin1978@gmail.com · aevion.app/partner
        </div>

      </div>
    </>
  );
}
