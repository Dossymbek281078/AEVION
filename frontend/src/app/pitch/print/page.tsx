"use client";

import { useEffect } from "react";
import {
  ask,
  billionDefense,
  competitive,
  customerVoice,
  ecosystemNodes,
  financials,
  gtm,
  launchedModules,
  market,
  networkForces,
  press,
  risks,
  team,
  thesis,
  useCases,
} from "@/data/pitchModel";

// Print-only flat layout. Black-on-white, no hero gradients, no animations,
// no sticky chrome. Auto-opens the print dialog on mount so this page IS the
// PDF export.
export default function PitchPrintPage() {
  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(t);
  }, []);

  const liveCount = launchedModules.filter((m) => m.stage === "live").length;
  const totalNodes = launchedModules.length + ecosystemNodes.length;

  return (
    <div className="pitch-print-root" style={{ background: "#fff", color: "#0f172a", padding: "32px 40px" }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 14mm; }
          .pitch-print-root { padding: 0 !important; }
        }
        .pitch-print-root h1, .pitch-print-root h2, .pitch-print-root h3 { page-break-after: avoid; }
        .pitch-print-root section, .pitch-print-root article { page-break-inside: avoid; }
        .pitch-print-root a { color: #0d9488; text-decoration: none; }
      `}</style>

      <header style={{ borderBottom: "2px solid #0f172a", paddingBottom: 16, marginBottom: 28 }}>
        <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#64748b", margin: 0 }}>
          {thesis.badge}
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.15, letterSpacing: "-0.03em", margin: "8px 0 14px" }}>
          {thesis.title}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#334155", margin: "0 0 14px" }}>{thesis.lead}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12 }}>
          <Stat value={`${liveCount}`} unit="live MVPs" hint={`of ${totalNodes} planned`} />
          <Stat value="$340B" unit="addressable market" hint="IP + creators + payments" />
          <Stat value="$2B+" unit="modelled ARR" hint="year 5" />
          <Stat value="$1B+" unit="defensible valuation" hint="five-axis defense" />
        </div>
      </header>

      <PrintSection title="Three architectural pillars">
        {thesis.pillars.map((p) => (
          <Card key={p.kicker}>
            <Eyebrow>{p.kicker}</Eyebrow>
            <CardTitle>{p.title}</CardTitle>
            <Body>{p.body}</Body>
          </Card>
        ))}
      </PrintSection>

      <PrintSection title={market.title}>
        <Grid>
          {market.buckets.map((b) => (
            <Card key={b.name}>
              <BigNumber>{b.tam}</BigNumber>
              <CardTitle>{b.name}</CardTitle>
              <Body>{b.note}</Body>
            </Card>
          ))}
        </Grid>
        <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: "12px 0 0", fontStyle: "italic" }}>
          {market.closing}
        </p>
      </PrintSection>

      <PrintSection title="Four network effects">
        <Grid>
          {networkForces.map((f) => (
            <Card key={f.code}>
              <Eyebrow>{f.code}</Eyebrow>
              <CardTitle>{f.title}</CardTitle>
              <Body>{f.body}</Body>
              <p style={{ fontSize: 11, color: "#0d9488", margin: "8px 0 0", fontWeight: 700 }}>↻ {f.flywheel}</p>
            </Card>
          ))}
        </Grid>
      </PrintSection>

      <PrintSection title={`${liveCount} live modules · ${totalNodes - liveCount} on roadmap`}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
              <th style={{ padding: "8px 6px", fontWeight: 800 }}>Module</th>
              <th style={{ padding: "8px 6px", fontWeight: 800 }}>Tagline</th>
              <th style={{ padding: "8px 6px", fontWeight: 800 }}>$$$ contribution</th>
            </tr>
          </thead>
          <tbody>
            {launchedModules.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 6px", fontWeight: 800, verticalAlign: "top" }}>{m.code}<br /><span style={{ color: "#64748b", fontWeight: 600 }}>{m.name}</span></td>
                <td style={{ padding: "8px 6px", verticalAlign: "top", color: "#334155" }}>{m.tagline}</td>
                <td style={{ padding: "8px 6px", verticalAlign: "top", color: "#b45309" }}>{m.valueLine}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintSection>

      <PrintSection title={useCases.title}>
        {useCases.rows.map((u) => (
          <Card key={u.persona}>
            <CardTitle>{u.avatar} {u.persona}</CardTitle>
            <Body>{u.story}</Body>
            <p style={{ fontSize: 11, color: "#0d9488", margin: "6px 0 0", fontWeight: 700 }}>
              {u.modulesUsed.join(" · ")} — {u.revenueLine}
            </p>
          </Card>
        ))}
      </PrintSection>

      <PrintSection title={customerVoice.title}>
        {customerVoice.quotes.map((q) => (
          <Card key={q.handle}>
            <Eyebrow>{q.handle}</Eyebrow>
            <Body>{`"${q.quote}"`}</Body>
            <p style={{ fontSize: 10, color: "#64748b", margin: "4px 0 0", letterSpacing: "0.1em" }}>{q.moduleHint}</p>
          </Card>
        ))}
        <p style={{ fontSize: 10, color: "#64748b", marginTop: 10, fontStyle: "italic" }}>{customerVoice.disclosure}</p>
      </PrintSection>

      <PrintSection title={competitive.title}>
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 14px", lineHeight: 1.6 }}>{competitive.intro}</p>
        {competitive.alternatives.map((c) => (
          <Card key={c.name}>
            <Eyebrow>{c.category}</Eyebrow>
            <CardTitle>{c.name}</CardTitle>
            <p style={{ fontSize: 12, color: "#334155", margin: "6px 0 4px" }}><strong>Their gap:</strong> {c.weakness}</p>
            <p style={{ fontSize: 12, color: "#0d9488", margin: 0 }}><strong>AEVION wins:</strong> {c.aevionWin}</p>
          </Card>
        ))}
      </PrintSection>

      <PrintSection title={billionDefense.title}>
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 14px", lineHeight: 1.6 }}>{billionDefense.intro}</p>
        {billionDefense.axes.map((a) => (
          <Card key={a.number}>
            <BigNumber small>{a.number}</BigNumber>
            <CardTitle>{a.title}</CardTitle>
            <Body>{a.body}</Body>
          </Card>
        ))}
      </PrintSection>

      <PrintSection title={risks.title}>
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 14px", lineHeight: 1.6 }}>{risks.intro}</p>
        {risks.rows.map((r) => (
          <Card key={r.risk}>
            <Eyebrow>{r.severity.toUpperCase()}</Eyebrow>
            <CardTitle>{r.risk}</CardTitle>
            <p style={{ fontSize: 12, color: "#334155", margin: "4px 0 0", lineHeight: 1.55 }}>
              <strong style={{ color: "#0d9488" }}>Mitigation: </strong>
              {r.mitigation}
            </p>
          </Card>
        ))}
      </PrintSection>

      <PrintSection title={gtm.title}>
        {gtm.steps.map((s, i) => (
          <Card key={s.phase}>
            <CardTitle>{i + 1}. {s.phase}</CardTitle>
            <Body>{s.body}</Body>
          </Card>
        ))}
      </PrintSection>

      <PrintSection title={financials.title}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 8 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
              <th style={{ padding: "6px", textAlign: "left", fontWeight: 800 }}>Year</th>
              <th style={{ padding: "6px", textAlign: "left", fontWeight: 800 }}>ARR</th>
              <th style={{ padding: "6px", textAlign: "left", fontWeight: 800 }}>Drivers</th>
            </tr>
          </thead>
          <tbody>
            {financials.rows.map((r) => (
              <tr key={r.year} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px", fontWeight: 700 }}>{r.year}</td>
                <td style={{ padding: "6px", fontWeight: 800, color: "#b45309" }}>{r.arr}</td>
                <td style={{ padding: "6px", color: "#334155" }}>{r.drivers}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 10, color: "#64748b", fontStyle: "italic" }}>{financials.disclaimer}</p>
      </PrintSection>

      <PrintSection title={team.title}>
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 12px", lineHeight: 1.6 }}>{team.intro}</p>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#334155", lineHeight: 1.7 }}>
          {team.slots.map((s) => (
            <li key={s.role}><strong>{s.role}</strong> — {s.note}</li>
          ))}
        </ul>
        <p style={{ marginTop: 10, fontSize: 12, color: "#0d9488", lineHeight: 1.6 }}>
          <strong>Velocity proof:</strong> {team.proof}
        </p>
      </PrintSection>

      <footer style={{ marginTop: 36, paddingTop: 14, borderTop: "1px solid #cbd5e1", fontSize: 11, color: "#64748b" }}>
        <p style={{ margin: "0 0 6px" }}>
          <strong>{ask.title}.</strong> {ask.body}
        </p>
        <p style={{ margin: 0 }}>
          To follow up: <a href={ask.ctaPrimary.href}>{ask.ctaPrimary.label}</a>. Live product:{" "}
          <a href="https://github.com/Dossymbek281078/AEVION">github.com/Dossymbek281078/AEVION</a>.
          AEVION · {totalNodes} nodes · {liveCount} live MVPs · one Trust Graph.
        </p>
      </footer>
    </div>
  );
}

/* helpers */
function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em", color: "#0f172a", margin: "0 0 12px", borderBottom: "1px solid #cbd5e1", paddingBottom: 6 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #e2e8f0", marginBottom: 8 }}>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
      {children}
    </div>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>{children}</div>;
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 4, lineHeight: 1.3 }}>{children}</div>;
}
function Body({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.55, margin: 0 }}>{children}</p>;
}
function BigNumber({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <div style={{ fontSize: small ? 18 : 22, fontWeight: 900, color: "#b45309", letterSpacing: "-0.02em", marginBottom: 4 }}>{children}</div>;
}
function Stat({ value, unit, hint }: { value: string; unit: string; hint: string }) {
  return (
    <div style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0", minWidth: 130 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", lineHeight: 1.05 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 800, color: "#0d9488", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{unit}</div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{hint}</div>
    </div>
  );
}
