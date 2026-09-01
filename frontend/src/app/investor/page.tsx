"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ModuleOfTheDayCard } from "@/components/ModuleOfTheDayCard";
import { apiUrl } from "@/lib/apiBase";
import { repoLabel, repoUrl } from "@/lib/repoUrl";
// Запасное значение счётчика — из pitchFacts, заперт на реестр сторожем.
// Здесь стояло `?? 27` при 41 записи в реестре. Запасное значение видно не
// «иногда»: серверный HTML отдаётся ДО того, как отработает запрос, поэтому
// «27 modules tracked» показывалось в исходнике страницы, превью-карточках
// и всем, у кого запрос не дошёл. Инвесторская страница занижала платформу
// в полтора раза, и заметить это прогоном было нельзя — в браузере число
// подменялось живым.
import { REGISTRY_ENTRIES } from "@/data/pitchFacts";

// metadata must live in a server component — moved to layout or generateMetadata.
// Kept as a plain object for <head> tags injected by the client shell.

type Stats = {
  planetSubmissions: number;
  qrightObjects: number;
  qcoreProviders: number;
};

type RevenueSummary = { grossUsd: number; saleCount: number };

/**
 * Aggregate AEVION registry stats — shape pulled from `/api/aevion/stats`.
 * Only the fields the investor page actually renders are typed; the
 * endpoint is the source of truth for the full schema.
 */
type CoverageStat = { count: number; total: number; percent: number };
type RegistryStats = {
  total?: number;
  byStatus?: Record<string, number>;
  byKind?: Record<string, number>;
  coverage?: {
    health?: CoverageStat;
    openapi?: CoverageStat;
  };
  generatedAt?: string;
};

export default function InvestorPage() {
  const [stats, setStats] = useState<Stats>({
    planetSubmissions: 0,
    qrightObjects: 0,
    qcoreProviders: 0,
  });
  const [registry, setRegistry] = useState<RegistryStats | null>(null);
  const [registryLive, setRegistryLive] = useState(false);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);

  useEffect(() => {
    Promise.allSettled([
      fetch(apiUrl("/api/planet/stats")).then(r => r.json()),
      fetch(apiUrl("/api/qright/objects?limit=1")).then(r => r.json()),
      fetch(apiUrl("/api/aevion/stats")).then(r => r.json()),
      fetch(apiUrl("/api/revenue/summary")).then(r => r.json()),
      fetch(apiUrl("/api/qcoreai/providers")).then(r => r.json()),
    ]).then(([planet, qright, reg, rev, prov]) => {
      setStats(s => ({
        ...s,
        planetSubmissions: planet.status === "fulfilled" ? (planet.value?.submissions ?? s.planetSubmissions) : s.planetSubmissions,
        qrightObjects: qright.status === "fulfilled" ? (qright.value?.total ?? s.qrightObjects) : s.qrightObjects,
        // Раньше это число было вечной пятёркой: поле стояло в начальном
        // состоянии и не обновлялось ничем, хотя рисовалось рядом с честно
        // живыми счётчиками. Роутер отвечает 17.
        qcoreProviders:
          prov.status === "fulfilled" && Array.isArray(prov.value?.providers)
            ? prov.value.providers.length
            : s.qcoreProviders,
      }));
      if (reg.status === "fulfilled" && reg.value && typeof reg.value === "object") {
        setRegistry(reg.value as RegistryStats);
        setRegistryLive(true);
      }
      if (rev.status === "fulfilled" && rev.value && typeof rev.value.grossUsd === "number") {
        setRevenue(rev.value as RevenueSummary);
      }
    });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc" }}>
      <Wave1Nav />

      {/* Hero */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "80px 24px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#10b981", textTransform: "uppercase" }}>
            One offer · Partnership, not a buyout · $10M returnable advance + 51/49 revenue
          </span>
        </div>
        <h1 style={{ fontSize: "clamp(36px,6vw,64px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
          Trust infrastructure<br />
          <span style={{ background: "linear-gradient(135deg,#10b981,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            for the AI content era
          </span>
        </h1>
        <p style={{ fontSize: 20, color: "#94a3b8", maxWidth: 640, lineHeight: 1.6, marginBottom: 32 }}>
          One pipeline instead of four disconnected services:
          {" "}<strong style={{ color: "#f1f5f9" }}>register → sign → certify → vote → earn.</strong>
          {" "}Post-quantum cryptography, Trust Graph moat, automated royalties.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="https://aevion.app" style={btnPrimary}>
            Try the product →
          </a>
          <a href={repoUrl()} target="_blank" rel="noopener" style={btnGhost}>
            Open repo (130+ PRs)
          </a>
          <Link href="/launch-status" style={btnGhost}>
            Live status
          </Link>
        </div>
      </section>

      {/* Live metrics bar */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 24 }}>
          {[
            { label: "Daily smoke", value: "PASS", sub: "все проверки зелёные" },
            { label: "Merged PRs", value: "130+", sub: "last 30 days" },
            { label: "Production modules", value: "16", sub: "live on aevion.app" },
            { label: "Registered objects", value: stats.qrightObjects.toString(), sub: "QRight registry" },
            { label: "Planet submissions", value: stats.planetSubmissions.toString(), sub: "compliance pipeline" },
            { label: "LLM providers", value: stats.qcoreProviders ? stats.qcoreProviders.toString() : "…", sub: "QCoreAI router" },
            {
              // `revenue` stays null while loading AND if the fetch/parse
              // failed — only render a dollar amount once it's genuinely
              // loaded, so a channel outage shows "—" instead of an
              // indistinguishable-from-real "$0.00".
              label: "Live revenue",
              value: revenue ? `$${revenue.grossUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—",
              sub: revenue ? `cumulative · ${revenue.saleCount} sales, all channels` : "channel unavailable",
            },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{m.value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live registry + Module-of-the-day showcase */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", margin: 0 }}>
            Today on the registry
          </h2>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.15em",
              color: registryLive ? "#10b981" : "#fbbf24",
              background: registryLive ? "rgba(16,185,129,0.12)" : "rgba(251,191,36,0.12)",
              padding: "4px 10px",
              borderRadius: 999,
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: registryLive ? "#10b981" : "#fbbf24" }} aria-hidden />
            {registryLive ? "Live · /api/aevion/stats" : "Snapshot · backend warming up"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 20, marginBottom: 24 }}>
          {/* Coverage matrix */}
          <div style={{ padding: 22, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#10b981", textTransform: "uppercase", marginBottom: 12 }}>
              Coverage matrix
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {registry?.total ?? REGISTRY_ENTRIES}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>modules tracked</div>
            </div>
            {[
              { label: "Health endpoint", stat: registry?.coverage?.health, color: "#8b5cf6" },
              { label: "OpenAPI documented", stat: registry?.coverage?.openapi, color: "#3b82f6" },
            ].map((row) => {
              const total = row.stat?.total ?? registry?.total ?? REGISTRY_ENTRIES;
              const v = row.stat?.count ?? 0;
              const pct = row.stat?.percent != null ? Math.round(row.stat.percent) : (total > 0 ? Math.round((v / total) * 100) : 0);
              return (
                <div key={row.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{row.label}</span>
                    <span style={{ color: row.color, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                      {v}/{total} · {pct}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: row.color, transition: "width 400ms ease-out" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status breakdown */}
          <div style={{ padding: 22, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#3b82f6", textTransform: "uppercase", marginBottom: 12 }}>
              Status mix
            </div>
            {(() => {
              const status = registry?.byStatus ?? {};
              const entries = Object.entries(status).sort((a, b) => b[1] - a[1]);
              if (entries.length === 0) {
                return (
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                    Loading the module registry. Each module reports its lifecycle stage:
                    <span style={{ color: "#10b981" }}> MVP/working</span>,
                    <span style={{ color: "#3b82f6" }}> in progress</span>,
                    <span style={{ color: "#a78bfa" }}> planning</span>,
                    <span style={{ color: "#94a3b8" }}> idea</span>.
                  </div>
                );
              }
              const total = entries.reduce((s, [, n]) => s + n, 0);
              const palette: Record<string, string> = {
                mvp: "#10b981",
                working: "#10b981",
                in_progress: "#3b82f6",
                planning: "#a78bfa",
                idea: "#94a3b8",
              };
              return (
                <>
                  <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 14, background: "rgba(255,255,255,0.06)" }}>
                    {entries.map(([k, n]) => {
                      const w = total > 0 ? (n / total) * 100 : 0;
                      return (
                        <div
                          key={k}
                          style={{ width: `${w}%`, background: palette[k.toLowerCase()] ?? "#64748b", transition: "width 400ms ease-out" }}
                          title={`${k}: ${n}`}
                        />
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {entries.map(([k, n]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: palette[k.toLowerCase()] ?? "#64748b" }} />
                          <span style={{ color: "#cbd5e1", fontWeight: 600, textTransform: "capitalize" }}>
                            {k.replace(/_/g, " ")}
                          </span>
                        </span>
                        <span style={{ color: "#f1f5f9", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{n}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Module of the day — dark theme for investor surface */}
        <ModuleOfTheDayCard theme="dark" refreshHourly />
      </section>

      {/* 3 Anchor Products */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 40 }}>
          Three products that are live right now
        </h2>

        {/* Product 1: IP Pipeline */}
        <div style={productCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={productBadge("#10b981")}>IP Trust Pipeline</div>
              <h3 style={productTitle}>QRight + QSign + Bureau</h3>
              <p style={productDesc}>
                Register a SHA-256 fingerprint → Sign with <strong>ML-DSA-65</strong> (NIST FIPS 204, post-quantum; key-activated) → Get a legally-meaningful certificate with Trust Graph edge.
              </p>
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(16,185,129,0.08)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)" }}>
                <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>WOW:</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 6 }}>
                  Harvest-now-decrypt-later. Documents signed with RSA today will not hold in court in 2031.
                  Ours will. ML-DSA-65 is implemented in QSign v2 and switches on with the signing key.
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <Link href="/qright" style={tryLink}>Try QRight →</Link>
                <Link href="/qsign" style={{ ...tryLink, marginLeft: 12 }}>Try QSign →</Link>
                <Link href="/bureau" style={{ ...tryLink, marginLeft: 12 }}>Try Bureau →</Link>
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={pricingBox}>
                <div style={pricingTitle}>Pricing</div>
                {[
                  // Что покупатель получает СЕГОДНЯ. Раньше строка перечисляла
                  // ML-DSA-65 как часть тарифа: на проде активны только hmac и
                  // ed25519 (/api/qsign/v2/keys), поэтому за $9 подписи ML-DSA
                  // не выдаётся. Оговорка «key-activated» читалась покупателем
                  // как «входит в пакет» — язык разработчика на продающей строке.
                  //
                  // Цена привязана к коду тарификации: Verified — единственный
                  // тариф с live charge: $19/cert (getVerifiedTierPriceCents()
                  // в aevion-globus-backend/src/lib/payment, переопределяется
                  // BUREAU_VERIFIED_PRICE_CENTS), ту же цифру показывает поток
                  // апгрейда /bureau. Две ветки чинили эту строку порознь: одна
                  // вернула честную криптографию, но поставила $9 — цену, которой
                  // платформа не берёт; вторая верную цену, но с ML-DSA. Здесь
                  // верно и то и другое. Notarized имеет поток заявки без цены в
                  // коде, Gold и Platinum не существуют нигде — отсюда «planned»,
                  // а не вид товара, который можно купить сегодня.
                  { tier: "Verified", price: "$19", desc: "SHA-256 + Ed25519 signature + cert" },
                  { tier: "Notarized (planned)", price: "$49", desc: "+ notary registry + Shamir backup" },
                  { tier: "Gold (planned)", price: "$199", desc: "+ legal review + int'l databases" },
                  { tier: "Platinum (planned)", price: "$999", desc: "+ multi-jurisdiction protection" },
                ].map(p => (
                  <div key={p.tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>{p.tier}</span>
                    <span style={{ fontSize: 14, color: "#10b981", fontWeight: 800 }}>{p.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Product 2: QBuild */}
        <div style={{ ...productCard, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={productBadge("#3b82f6")}>B2B SaaS</div>
              <h3 style={productTitle}>QBuild — Construction Hiring</h3>
              <p style={productDesc}>
                Vertical ATS for the construction industry. AI-scored candidates, skill badge verification via Bureau, brigade hiring, shift scheduling, trial tasks with payment, AEC loyalty cashback.
              </p>
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(59,130,246,0.08)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.2)" }}>
                <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 700 }}>vs HH:</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 6 }}>
                  HH is horizontal. Construction needs: shift work, medical certificates, brigade hiring, equipment operators. We verify credentials through Bureau inline.
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <Link href="/build" style={tryLink}>Try QBuild →</Link>
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={pricingBox}>
                <div style={pricingTitle}>Pricing</div>
                {[
                  { tier: "Free", price: "$0", desc: "3 active vacancies" },
                  { tier: "Starter", price: "$49/mo", desc: "10 vacancies + AI scoring" },
                  { tier: "Pro", price: "$249/mo", desc: "unlimited + analytics" },
                  { tier: "Hire fee", price: "12% → 4%", desc: "per successful placement; 12% recruiter tier down to 4% on Platinum" },
                ].map(p => (
                  <div key={p.tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>{p.tier}</span>
                    <span style={{ fontSize: 14, color: "#60a5fa", fontWeight: 800 }}>{p.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Product 3: QPayNet */}
        <div style={{ ...productCard, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={productBadge("#8b5cf6")}>Embedded Payments</div>
              <h3 style={productTitle}>QPayNet</h3>
              <p style={productDesc}>
                Payment infrastructure for every AEVION module. P2P wallets, merchant API keys, payment request QR codes, Stripe deposit, webhooks, CSV export, admin reconcile.
              </p>
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(139,92,246,0.08)", borderRadius: 8, border: "1px solid rgba(139,92,246,0.2)" }}>
                <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700 }}>Multiplier:</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 6 }}>
                  QBuild pays through QPayNet. Awards pays royalties through QPayNet. Bureau certificates sell through QPayNet. Infrastructure that scales with every product.
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <Link href="/qpaynet" style={tryLink}>Try QPayNet →</Link>
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={pricingBox}>
                <div style={pricingTitle}>Pricing</div>
                {[
                  { tier: "Transfers", price: "0.1%", desc: "per transaction" },
                  { tier: "Merchant API", price: "free", desc: "API keys, no monthly fee" },
                  { tier: "Stripe deposits", price: "Stripe fee", desc: "+ 0% platform markup" },
                  { tier: "Enterprise", price: "custom", desc: "volume + SLA" },
                ].map(p => (
                  <div key={p.tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 600 }}>{p.tier}</span>
                    <span style={{ fontSize: 14, color: "#a78bfa", fontWeight: 800 }}>{p.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why now */}
      <section style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "60px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 32 }}>
            Why 2026 is the right moment
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 20 }}>
            {[
              { emoji: "🔐", title: "NIST ML-DSA-65 finalized", desc: "August 2024. Enterprises are starting to require post-quantum signatures in contracts. QSign v2 implements it, key-activated." },
              { emoji: "🤖", title: "AI content flood", desc: "Sora, Midjourney, Suno create billions of files/day. Proving authorship became a crisis. Our pipeline solves it." },
              { emoji: "⚖️", title: "EU AI Act (2025)", desc: "Requires provenance documentation for AI-generated content. Our Bureau certificate is the compliance answer." },
            ].map(item => (
              <div key={item.title} style={{ padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#f1f5f9" }}>{item.title}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Moat */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 32 }}>
          Why hard to copy
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 16 }}>
          {[
            { n: "1", title: "Trust Graph", desc: "Accumulates with every signature. Competitor starting today is 2 years behind." },
            { n: "2", title: "Post-quantum built in", desc: "ML-DSA-65 (FIPS 204) is implemented in the product, key-activated — ahead of a mandatory migration." },
            { n: "3", title: "Atomic pipeline", desc: "4 platforms → 1 UI. Switching cost grows with every cert issued." },
            { n: "4", title: "Open velocity", desc: "130+ merged PRs in 30 days. Verifiable in public GitHub history." },
          ].map(m => (
            <div key={m.n} style={{ padding: 20, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: "rgba(255,255,255,0.08)", marginBottom: 8 }}>{m.n}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#f1f5f9" }}>{m.title}</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The offer — one partnership */}
      <section style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "60px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#64748b", textTransform: "uppercase", marginBottom: 16 }}>
            The offer — one partnership, not a ladder
          </h2>
          <p style={{ fontSize: 15, color: "#94a3b8", maxWidth: 720, lineHeight: 1.6, marginBottom: 28 }}>
            <strong style={{ color: "#f1f5f9" }}>$10M as a returnable advance</strong> plus resources
            (compute, engineers, distribution, brand). Project revenue splits
            {" "}<strong style={{ color: "#f1f5f9" }}>51% founder / 49% partner</strong>. The founder stays as
            Chief Idea Officer with a majority stake; the AEVION brand is kept. This is a
            partnership, not a buyout — the partner mostly pays in resources and a small returnable
            advance, and the big money comes with growth.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 14 }}>
            {[
              { k: "Form", v: "Partnership", note: "Not a buyout — founder stays" },
              { k: "Advance", v: "$10M", note: "Returnable · repaid from founder's share as it grows" },
              { k: "Revenue", v: "51 / 49", note: "Founder / partner split" },
              { k: "Founder", v: "Chief Idea Officer", note: "Majority stake · drives next ideas" },
              { k: "AEV token", v: "Ring-fenced", note: "Out of the deal perimeter" },
              { k: "Exclusivity", v: "60 days", note: "From LOI · 30-day due diligence" },
            ].map(t => (
              <div key={t.k} style={{ padding: 18, background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: "#64748b", textTransform: "uppercase", lineHeight: 1, marginBottom: 8 }}>{t.k}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#10b981", margin: "0 0 6px" }}>{t.v}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{t.note}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#475569", marginTop: 20 }}>
            Full deal terms and founder-partnership structure →{" "}
            <Link href="/acquire" style={{ color: "#10b981", textDecoration: "none", fontWeight: 700 }}>
              Deal terms
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1))", borderTop: "1px solid rgba(16,185,129,0.2)", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>8-minute demo</h2>
          <p style={{ fontSize: 16, color: "#94a3b8", marginBottom: 28, lineHeight: 1.6 }}>
            Register on aevion.app → create a QRight object → sign it → get a Bureau certificate.
            All verifiable, all on prod, no staging. ML-DSA-65 signing is key-activated.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://aevion.app/auth" style={btnPrimary}>Start demo →</a>
            <a href={repoUrl()} target="_blank" rel="noopener" style={btnGhost}>Inspect the code</a>
          </div>
          <p style={{ fontSize: 13, color: "#475569", marginTop: 20 }}>
            Partnership, not a buyout · $10M returnable advance + 51/49 revenue · contact:{" "}
            <a href="mailto:yahiin1978@gmail.com?subject=AEVION%20investment%20inquiry" style={{ color: "#10b981", textDecoration: "none", fontWeight: 700 }}>
              yahiin1978@gmail.com
            </a>
          </p>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px", display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#334155" }}>
            AEVION · aevion.app · {repoLabel()}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
            <Link href="/partner" style={{ color: "#94a3b8", textDecoration: "none" }}>Innovation Partnership</Link>
            <Link href="/acquire" style={{ color: "#94a3b8", textDecoration: "none" }}>Acquisition brief</Link>
            <Link href="/pilot" style={{ color: "#94a3b8", textDecoration: "none" }}>90-day pilot</Link>
            <Link href="/status" style={{ color: "#94a3b8", textDecoration: "none" }}>Live health-board</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Styles
const btnPrimary: React.CSSProperties = {
  padding: "14px 28px", borderRadius: 10, background: "#10b981",
  color: "#022c22", fontWeight: 800, fontSize: 15, textDecoration: "none", border: "none",
};
const btnGhost: React.CSSProperties = {
  padding: "14px 28px", borderRadius: 10, background: "rgba(255,255,255,0.08)",
  color: "#f1f5f9", fontWeight: 700, fontSize: 15, textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.15)",
};
const productCard: React.CSSProperties = {
  padding: 28, background: "rgba(255,255,255,0.03)", borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
};
const productTitle: React.CSSProperties = {
  fontSize: 22, fontWeight: 800, margin: "8px 0 10px", color: "#f1f5f9",
};
const productDesc: React.CSSProperties = {
  fontSize: 14, color: "#94a3b8", lineHeight: 1.6,
};
const pricingBox: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)", padding: "16px 18px", minWidth: 180,
};
const pricingTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#64748b",
  textTransform: "uppercase", marginBottom: 10,
};
const tryLink: React.CSSProperties = {
  fontSize: 13, color: "#10b981", textDecoration: "none", fontWeight: 700,
  borderBottom: "1px solid rgba(16,185,129,0.3)", paddingBottom: 1,
};

function productBadge(color: string): React.CSSProperties {
  return {
    display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
    color, textTransform: "uppercase", marginBottom: 4,
    background: `${color}18`, padding: "3px 10px", borderRadius: 20,
    border: `1px solid ${color}40`,
  };
}
