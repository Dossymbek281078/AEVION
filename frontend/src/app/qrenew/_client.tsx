"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import ModulePricingChip from "@/components/ModulePricingChip";
import { BuyLink } from "@/components/BuyLink";
import { HealthDisclaimer } from "@/components/HealthDisclaimer";
import { channelFrom, productById, withChannel } from "@/lib/products";

// QRenew — cellular-renewal program. Two live tools over the deterministic
// backend: a biological-age calculator (PhenoAge / Levine 2018) and the
// evidence-tiered intervention stack. Honest framing: only Tier A + B are
// recommendations; C is "discuss with a doctor"; D is science-horizon only.

interface BioField { key: string; label: string; unit: string; placeholder: string; }
const BIO_FIELDS: BioField[] = [
  { key: "age", label: "Возраст", unit: "лет", placeholder: "40" },
  { key: "albumin", label: "Альбумин", unit: "г/л", placeholder: "45" },
  { key: "creatinine", label: "Креатинин", unit: "мкмоль/л", placeholder: "80" },
  { key: "glucose", label: "Глюкоза", unit: "ммоль/л", placeholder: "5.0" },
  { key: "crp", label: "CRP (СРБ)", unit: "мг/л", placeholder: "1.0" },
  { key: "lymphocytePct", label: "Лимфоциты", unit: "%", placeholder: "35" },
  { key: "mcv", label: "MCV", unit: "фл", placeholder: "90" },
  { key: "rdw", label: "RDW", unit: "%", placeholder: "13" },
  { key: "alp", label: "Щёлочная фосфатаза", unit: "Ед/л", placeholder: "70" },
  { key: "wbc", label: "Лейкоциты", unit: "×10⁹/л", placeholder: "6" },
];

interface BioResult {
  chronologicalAge: number;
  phenotypicAge: number;
  ageDelta: number;
  interpretation: string;
  method: string;
}

interface StackItem { id?: string; name: string; tier: string; mechanism?: string; hallmark?: string; evidence: string; foods?: string[] | null; }
interface Hallmark { name: string; targeted: boolean; }
interface StackResponse {
  hallmarks: Hallmark[];
  tiers: Record<string, { label: string; items: StackItem[] }>;
  disclaimer: string;
}

/** Покупаемые PDF по этой теме — позиции каталога, а не хардкод цен и ссылок.
 *  filter(Boolean) на случай, если позицию из каталога уберут. */
const BUY = [productById("oijxmq"), productById("tmuyxw")].filter(
  (p): p is NonNullable<typeof p> => Boolean(p),
);

const TIER_COLOR: Record<string, string> = { A: "#55C093", B: "#5BB6D0", C: "#DDB253", D: "#E0787F" };

export default function QRenewClient() {
  // Метка канала для ссылок в кассу. Ролики ведут именно сюда, поэтому
  // потеря метки на этой странице стоит дороже всего: покупка приходит
  // как пришедшая ниоткуда. Держится в состоянии и заполняется после
  // отрисовки — на сервере адреса ещё нет, и чтение из window разошлось
  // бы с серверной разметкой.
  const [channel, setChannel] = useState<string | null>(null);
  useEffect(() => {
    setChannel(channelFrom(new URLSearchParams(window.location.search).get("c") ?? undefined));
  }, []);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [bio, setBio] = useState<BioResult | null>(null);
  const [bioErr, setBioErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stack, setStack] = useState<StackResponse | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/qrenew/stack"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStack(d as StackResponse))
      .catch(() => {});
  }, []);

  function setVal(k: string, v: string) {
    setVals((prev) => ({ ...prev, [k]: v }));
  }

  async function calcBioAge() {
    setLoading(true);
    setBioErr(null);
    try {
      const body: Record<string, number> = {};
      for (const [k, v] of Object.entries(vals)) {
        const n = parseFloat(v);
        if (Number.isFinite(n)) body[k] = n;
      }
      const res = await fetch(apiUrl("/api/qrenew/bioage"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const miss = Array.isArray(data?.missing) ? data.missing.join(", ") : "";
        throw new Error(miss ? `Не хватает показателей: ${miss}` : `Сервер вернул ${res.status}`);
      }
      setBio(data as BioResult);
    } catch (e) {
      setBioErr(e instanceof Error ? e.message : "Не удалось рассчитать");
    } finally {
      setLoading(false);
    }
  }

  const deltaColor = bio ? (bio.ageDelta <= -1 ? "#55C093" : bio.ageDelta >= 1 ? "#E0787F" : "#c3d0e0") : "#c3d0e0";

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.eyebrow}>AEVION · QRenew</div>
        <h1 style={styles.h1}>Программа клеточного обновления</h1>
        <HealthDisclaimer />
        <p style={styles.lede}>
          Седина — видимый маркер старения стволовых клеток и митохондрий. Здесь два инструмента:
          рассчитать биологический возраст по обычным анализам и увидеть стек вмешательств,
          честно отсортированный по уровню доказательности.
        </p>
        <div style={{ marginTop: 14 }}>
          <ModulePricingChip moduleId="qrenew" theme="dark" />
        </div>

        <section style={styles.card}>
          <h2 style={styles.h2}>Калькулятор биологического возраста</h2>
          <p style={styles.sub}>Метод PhenoAge (Levine, 2018) — по 9 рутинным биомаркерам + возраст.</p>
          <div style={styles.grid}>
            {BIO_FIELDS.map((f) => (
              <label key={f.key} style={styles.field}>
                <span style={styles.fieldLabel}>{f.label} <span style={styles.unit}>{f.unit}</span></span>
                <input
                  type="number" inputMode="decimal" placeholder={f.placeholder}
                  value={vals[f.key] ?? ""} onChange={(e) => setVal(f.key, e.target.value)}
                  style={styles.input}
                />
              </label>
            ))}
          </div>
          <button onClick={calcBioAge} disabled={loading} style={styles.btn}>
            {loading ? "Считаю…" : "Рассчитать биовозраст"}
          </button>
          {bioErr && <p style={styles.error}>{bioErr}</p>}

          {bio && (
            <div style={styles.bioResult}>
              <div style={styles.bioRow}>
                <div><div style={styles.bioNum}>{bio.chronologicalAge}</div><div style={styles.bioCap}>паспортный</div></div>
                <div style={styles.bioArrow}>→</div>
                <div><div style={{ ...styles.bioNum, color: deltaColor }}>{bio.phenotypicAge}</div><div style={styles.bioCap}>биологический</div></div>
                <div style={{ ...styles.bioDelta, color: deltaColor }}>
                  {bio.ageDelta > 0 ? "+" : ""}{bio.ageDelta} лет
                </div>
              </div>
              <p style={styles.bioInterp}>{bio.interpretation}</p>
              <div style={styles.method}>{bio.method}</div>
            </div>
          )}
        </section>

        {stack && (
          <section style={styles.card}>
            <h2 style={styles.h2}>Стек вмешательств по доказательности</h2>
            <div style={styles.hallmarks}>
              {stack.hallmarks.map((h) => (
                <span key={h.name} style={{ ...styles.hallChip, ...(h.targeted ? styles.hallOn : {}) }}>
                  {h.name}
                </span>
              ))}
            </div>
            <p style={styles.sub}>Подсвечены 4 признака старения, которые напрямую производят седину.</p>

            {(["A", "B", "C", "D"] as const).map((t) => {
              const tier = stack.tiers[t];
              if (!tier) return null;
              return (
                <div key={t} style={styles.tier}>
                  <div style={{ ...styles.tierHead, borderLeft: `4px solid ${TIER_COLOR[t]}` }}>
                    <span style={{ ...styles.tierLetter, color: TIER_COLOR[t] }}>{t}</span>
                    <span style={styles.tierLabel}>{tier.label}</span>
                  </div>
                  {tier.items.map((it) => (
                    <div key={it.name} style={styles.tierItem}>
                      <div style={styles.tierItemName}>{it.name}</div>
                      <div style={styles.tierItemMeta}>
                        {it.mechanism && <span>{it.mechanism} · </span>}{it.evidence}
                      </div>
                      {it.foods && it.foods.length > 0 && (
                        <div style={styles.foods}>
                          {it.foods.map((f) => <span key={f} style={styles.chip}>{f}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            <p style={styles.disclaimer}>{stack.disclaimer}</p>
          </section>
        )}

        {/* Два PDF по этой теме. Цены и ссылки — из каталога @/lib/products,
            здесь не дублируются. */}
        <div style={styles.buyRow}>
          {BUY.map((p) => (
            <BuyLink
              key={p.id}
              href={withChannel(p.href, channel, "qrenew")}
              source="qrenew"
              productId={p.id}
              priceUsd={p.priceUsd}
              style={styles.buyCard}
            >
              <div style={styles.buyKicker}>{p.format}</div>
              <div style={styles.buyTitle}>{p.title}</div>
              <div style={styles.buyFoot}>
                <span style={styles.buyPrice}>${p.priceUsd}</span>
                <span style={styles.buyBtn}>Купить&nbsp;→</span>
              </div>
            </BuyLink>
          ))}
        </div>

        <p style={styles.foot}>
          Связанный модуль: <a href="/qmelanin" style={styles.link}>QMelanin</a> — видимый дашборд седины
          и пищевой протокол против дефицитов пигмента.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#070b14", color: "#e8eef6", padding: "48px 20px" },
  wrap: { maxWidth: 860, margin: "0 auto" },
  eyebrow: { fontFamily: "monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#c8823f" },
  h1: { fontSize: 34, margin: "10px 0 0", fontWeight: 700 },
  lede: { color: "#9fb0c4", marginTop: 14, lineHeight: 1.6, maxWidth: 640 },
  card: { background: "#0d1422", border: "1px solid #1c2942", borderRadius: 16, padding: 24, marginTop: 26 },
  h2: { fontSize: 20, margin: "0 0 6px" },
  sub: { color: "#8b9bb0", fontSize: 13.5, margin: "0 0 16px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 13, color: "#c3d0e0" },
  unit: { color: "#6c7d92", fontSize: 11 },
  input: { background: "#0a101c", border: "1px solid #24344f", borderRadius: 8, padding: "9px 11px", color: "#e8eef6", fontSize: 14 },
  btn: { marginTop: 20, background: "#c8823f", color: "#0a0a0a", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  error: { color: "#e0787f", marginTop: 12 },
  bioResult: { marginTop: 20, background: "#0a101c", border: "1px solid #1c2942", borderRadius: 12, padding: 18 },
  bioRow: { display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" },
  bioNum: { fontSize: 38, fontWeight: 700, lineHeight: 1 },
  bioCap: { fontSize: 11, color: "#6c7d92", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 },
  bioArrow: { fontSize: 24, color: "#6c7d92" },
  bioDelta: { marginLeft: "auto", fontSize: 20, fontWeight: 700, fontFamily: "monospace" },
  bioInterp: { marginTop: 14, color: "#c3d0e0", lineHeight: 1.6 },
  method: { marginTop: 8, fontFamily: "monospace", fontSize: 11.5, color: "#6c7d92" },
  hallmarks: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  hallChip: { fontSize: 11.5, padding: "4px 9px", borderRadius: 7, background: "#0a101c", border: "1px solid #1c2942", color: "#8b9bb0" },
  hallOn: { background: "#2a1c10", border: "1px solid #c8823f", color: "#e8eef6" },
  tier: { marginTop: 16 },
  tierHead: { display: "flex", alignItems: "center", gap: 12, paddingLeft: 12, marginBottom: 8 },
  tierLetter: { fontSize: 24, fontWeight: 700 },
  tierLabel: { fontSize: 14, color: "#c3d0e0" },
  tierItem: { background: "#0a101c", border: "1px solid #1c2942", borderRadius: 10, padding: 13, marginTop: 8 },
  tierItemName: { fontWeight: 600 },
  tierItemMeta: { fontSize: 12.5, color: "#8b9bb0", marginTop: 3 },
  foods: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 },
  chip: { fontFamily: "monospace", fontSize: 12, background: "#13203a", border: "1px solid #24344f", borderRadius: 7, padding: "4px 9px", color: "#c3d0e0" },
  disclaimer: { marginTop: 18, fontSize: 12.5, color: "#8b9bb0", borderTop: "1px solid #1c2942", paddingTop: 14 },
  foot: { marginTop: 26, color: "#8b9bb0", fontSize: 14 },
  link: { color: "#c8823f" },
  buyRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
    marginTop: 26,
  },
  buyCard: {
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(135deg,#161222 0%,#0d1422 100%)",
    border: "1px solid #3a2f22",
    borderRadius: 16,
    padding: 22,
    textDecoration: "none",
    color: "#e8eef6",
  },
  buyKicker: {
    fontFamily: "monospace",
    fontSize: 11.5,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#c8823f",
  },
  buyTitle: { fontSize: 17, fontWeight: 700, margin: "10px 0 0", lineHeight: 1.3, flex: 1 },
  buyFoot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 18,
  },
  buyPrice: { fontSize: 21, fontWeight: 700 },
  buyBtn: {
    background: "#c8823f",
    color: "#1a1206",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 13.5,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
};
