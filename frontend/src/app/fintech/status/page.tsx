import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getApiBase, getBackendOrigin } from "@/lib/apiBase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "AEVION Fintech Status",
  description:
    "Live health probes of the 5 AEVION fintech modules (QGood, QMaskCard, VeilNetX Ledger, Z-Tide, QChainGov) plus the root backend. Refresh to retry.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "AEVION Fintech Status",
    description: "Live health probes of the 5 fintech modules. Refresh to retry.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AEVION Fintech Status",
    description: "Live health probes of the 5 fintech modules. Refresh to retry.",
  },
};

type Probe = { name: string; path: string; color: string };
type ProbeStatus = "ok" | "degraded" | "down";
type ProbeResult = Probe & {
  status: ProbeStatus;
  ms: number;
  error: string | null;
  body: { status?: string; service?: string } | null;
  probedAt: string;
};

const PROBES: Probe[] = [
  { name: "AEVION root",     path: "/api/health",                 color: "#f1f5f9" },
  { name: "QGood",           path: "/api/qgood/health",           color: "#34d399" },
  { name: "QMaskCard",       path: "/api/qmaskcard/health",       color: "#a78bfa" },
  { name: "VeilNetX Ledger", path: "/api/veilnetx-ledger/health", color: "#a78bfa" },
  { name: "Z-Tide",          path: "/api/ztide/health",           color: "#34d399" },
  { name: "QChainGov",       path: "/api/qchaingov/health",       color: "#f472b6" },
];

const STATUS_COLOR: Record<ProbeStatus, string> = {
  ok: "#34d399",
  degraded: "#fbbf24",
  down: "#ef4444",
};

const STATUS_LABEL: Record<ProbeStatus, string> = {
  ok: "OK",
  degraded: "DEGRADED",
  down: "DOWN",
};

const FONT_SANS =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_MONO =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const GRID_COLS = "1.4fr 2fr 100px 80px 160px";

async function probe(p: Probe, base: string): Promise<ProbeResult> {
  const url = `${base}${p.path}`;
  const startedAt = Date.now();
  let status: ProbeStatus = "down";
  let error: string | null = null;
  let body: { status?: string; service?: string } | null = null;
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3500) });
    if (r.ok) {
      try {
        body = (await r.json()) as { status?: string; service?: string };
        status = body?.status === "ok" ? "ok" : "degraded";
      } catch {
        status = "degraded";
        error = "non-JSON body";
      }
    } else {
      status = "down";
      error = `HTTP ${r.status}`;
    }
  } catch (e: unknown) {
    status = "down";
    error = e instanceof Error ? e.message : String(e);
  }
  return { ...p, status, ms: Date.now() - startedAt, error, body, probedAt: new Date().toISOString() };
}

function overallVerdict(results: ProbeResult[]): { status: ProbeStatus; label: string; hint: string } {
  const down = results.filter((r) => r.status === "down").length;
  const degraded = results.filter((r) => r.status === "degraded").length;
  const bad = down + degraded;
  if (down >= 3) return { status: "down", label: "Major outage", hint: `${down} services unreachable` };
  if (bad >= 1 && bad <= 2) {
    return { status: "degraded", label: "Partial degradation", hint: `${bad} service${bad === 1 ? "" : "s"} not fully OK` };
  }
  if (down === 0 && degraded === 0) {
    return { status: "ok", label: "All systems operational", hint: "6/6 probes healthy" };
  }
  return { status: "down", label: "Major outage", hint: `${down} down, ${degraded} degraded` };
}

function fmtLocalTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  } catch {
    return iso;
  }
}

const S: Record<string, CSSProperties> = {
  main: { minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: FONT_SANS, padding: "48px 16px 80px" },
  wrap: { maxWidth: 900, margin: "0 auto" },
  kicker: { fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 },
  h1: { fontSize: 36, fontWeight: 700, lineHeight: 1.15, margin: 0, color: "#f8fafc" },
  sub: { marginTop: 12, marginBottom: 0, color: "#94a3b8", fontSize: 16, lineHeight: 1.5 },
  card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20, marginBottom: 24 },
  verdictRow: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  refreshBtn: { background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 },
  table: { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, overflow: "hidden", marginBottom: 24 },
  thead: { display: "grid", gridTemplateColumns: GRID_COLS, gap: 12, padding: "12px 16px", borderBottom: "1px solid #334155", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", fontWeight: 600 },
  trBase: { display: "grid", gridTemplateColumns: GRID_COLS, gap: 12, padding: "14px 16px", alignItems: "center", fontSize: 14 },
  serviceCell: { display: "flex", alignItems: "center", gap: 10 },
  serviceName: { color: "#f1f5f9", fontWeight: 600 },
  pathCell: { fontFamily: FONT_MONO, fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  msCell: { textAlign: "right", fontFamily: FONT_MONO, fontSize: 13 },
  tsCell: { fontFamily: FONT_MONO, fontSize: 11, color: "#94a3b8", lineHeight: 1.3 },
  diagTitle: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#fbbf24", fontWeight: 700, marginBottom: 10 },
  diagList: { margin: 0, padding: 0, listStyle: "none", fontSize: 12, fontFamily: FONT_MONO, color: "#cbd5e1", lineHeight: 1.6 },
  h2: { fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 12, color: "#f1f5f9" },
  para: { margin: 0, marginBottom: 12, color: "#cbd5e1", fontSize: 14, lineHeight: 1.6 },
  meta: { margin: 0, marginBottom: 12, color: "#94a3b8", fontSize: 13, lineHeight: 1.6 },
  links: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 },
  linkBtn: { color: "#60a5fa", textDecoration: "none", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a" },
  linkBtnMuted: { color: "#94a3b8", textDecoration: "none", fontSize: 13, fontWeight: 500, padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a" },
  footer: { marginTop: 32, fontSize: 11, color: "#64748b", textAlign: "center", lineHeight: 1.6 },
  code: { fontFamily: FONT_MONO, color: "#e2e8f0" },
  codeDim: { fontFamily: FONT_MONO, color: "#cbd5e1" },
};

function dot(color: string, size = 10, glow = true): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    boxShadow: glow ? `0 0 ${Math.max(6, size)}px ${color}80` : undefined,
    flexShrink: 0,
  };
}

function verdictPill(status: ProbeStatus, label: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 14px",
    borderRadius: 999,
    background: `${STATUS_COLOR[status]}1a`,
    border: `1px solid ${STATUS_COLOR[status]}`,
    color: STATUS_COLOR[status],
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.5,
  };
}

function statusPill(status: ProbeStatus): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: `${STATUS_COLOR[status]}1a`,
    border: `1px solid ${STATUS_COLOR[status]}`,
    color: STATUS_COLOR[status],
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
  };
}

export default async function FintechStatusPage() {
  const base = getApiBase();
  const backendOrigin = getBackendOrigin();
  const results = await Promise.all(PROBES.map((p) => probe(p, base)));
  const verdict = overallVerdict(results);
  const probedAtIso = new Date().toISOString();
  const errored = results.filter((r) => r.error);

  return (
    <main style={S.main}>
      <div style={S.wrap}>
        <header style={{ marginBottom: 32 }}>
          <div style={S.kicker}>AEVION / Fintech</div>
          <h1 style={S.h1}>Fintech ecosystem status</h1>
          <p style={S.sub}>Live health probes of the 5 fintech modules. Refresh to retry.</p>
        </header>

        <section style={{ ...S.card, ...S.verdictRow }}>
          <div style={verdictPill(verdict.status, verdict.label)}>
            <span style={dot(STATUS_COLOR[verdict.status], 10, true)} aria-hidden />
            {verdict.label.toUpperCase()}
          </div>
          <div style={{ color: "#cbd5e1", fontSize: 14 }}>{verdict.hint}</div>
          <div style={{ flex: 1 }} />
          <form action="" method="get">
            <button type="submit" style={S.refreshBtn}>Refresh probes</button>
          </form>
        </section>

        <section style={S.table}>
          <div style={S.thead}>
            <div>Service</div>
            <div>Path</div>
            <div>Status</div>
            <div style={{ textAlign: "right" }}>Time</div>
            <div>Probed at</div>
          </div>
          {results.map((r, idx) => (
            <div
              key={r.path}
              style={{ ...S.trBase, borderBottom: idx < results.length - 1 ? "1px solid #334155" : "none" }}
            >
              <div style={S.serviceCell}>
                <span style={dot(r.color, 10, true)} aria-hidden />
                <span style={S.serviceName}>{r.name}</span>
              </div>
              <div style={S.pathCell} title={r.path}>{r.path}</div>
              <div>
                <span style={statusPill(r.status)} title={r.error ?? undefined}>
                  <span style={dot(STATUS_COLOR[r.status], 6, false)} aria-hidden />
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <div style={{ ...S.msCell, color: r.status === "down" ? "#94a3b8" : "#e2e8f0" }}>
                {r.ms} ms
              </div>
              <div style={S.tsCell} title={r.probedAt}>
                <div style={{ color: "#cbd5e1" }}>{fmtLocalTime(r.probedAt)}</div>
                <div style={{ fontSize: 10 }}>{r.probedAt}</div>
              </div>
            </div>
          ))}
        </section>

        {errored.length > 0 && (
          <section style={S.card}>
            <div style={S.diagTitle}>Probe diagnostics</div>
            <ul style={S.diagList}>
              {errored.map((r) => (
                <li key={r.path} style={{ marginBottom: 4 }}>
                  <span style={{ color: STATUS_COLOR[r.status] }}>[{STATUS_LABEL[r.status]}]</span>{" "}
                  <span style={{ color: "#f1f5f9" }}>{r.name}</span>{" "}
                  <span style={{ color: "#94a3b8" }}>{r.path}</span> — {r.error}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section style={S.card}>
          <h2 style={S.h2}>What this means</h2>
          <p style={S.para}>
            Each row above is a fresh server-side probe against the upstream backend with a 3.5s timeout and no caching.{" "}
            <strong style={{ color: STATUS_COLOR.ok }}>OK</strong> means the service returned HTTP 200 with a JSON body containing{" "}
            <code style={S.code}>{`{ "status": "ok" }`}</code>.{" "}
            <strong style={{ color: STATUS_COLOR.degraded }}>DEGRADED</strong> means HTTP 200 but the body did not match the expected shape.{" "}
            <strong style={{ color: STATUS_COLOR.down }}>DOWN</strong> means a non-200 response, a timeout, or a network error. Refresh to re-run all six probes.
          </p>
          <p style={S.meta}>
            Probe base: <code style={S.codeDim}>{base}</code> · last full run:{" "}
            <code style={S.codeDim}>{probedAtIso}</code>
          </p>
          <div style={S.links}>
            <a href="/developers/fintech" style={S.linkBtn}>Full API reference →</a>
            <a href={`${backendOrigin}/api/openapi.json`} target="_blank" rel="noopener noreferrer" style={S.linkBtn}>
              Raw OpenAPI ↗
            </a>
            <a
              href="https://aevion-production-a70c.up.railway.app/api/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              style={S.linkBtnMuted}
            >
              Production OpenAPI ↗
            </a>
          </div>
        </section>

        <footer style={S.footer}>
          AEVION Fintech · Probes run server-side from RSC · No client JS required
        </footer>
      </div>
    </main>
  );
}
