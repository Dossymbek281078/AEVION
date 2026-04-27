"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { useEcosystemData } from "../_lib/EcosystemDataContext";
import { formatRelative } from "../_lib/format";
import {
  KIND_COLOR,
  KIND_ICON,
  KIND_LABEL_KEY,
  simulateRoyaltyEvent,
  type RoyaltyEvent,
} from "../_lib/royalties";
import { SkeletonBlock } from "./Skeleton";

function usePrefersReducedMotion(): boolean {
  const [prm, setPrm] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrm(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return prm;
}

function LivePulse({ active, color = "#dc2626" }: { active: boolean; color?: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
      <circle cx={6} cy={6} r={3} fill={color} />
      {active ? (
        <circle cx={6} cy={6} r={3} fill="none" stroke={color} strokeWidth={1.5}>
          <animate attributeName="r" values="3;6;3" dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0;0.9" dur="1.4s" repeatCount="indefinite" />
        </circle>
      ) : null}
    </svg>
  );
}

function EventRow({ ev, highlight }: { ev: RoyaltyEvent; highlight?: boolean }) {
  const { t } = useI18n();
  const color = KIND_COLOR[ev.workKind];
  const { code } = useCurrency();
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${color}22`,
        background: highlight ? `${color}14` : "#fff",
        transition: "background 600ms ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: `${color}22`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {KIND_ICON[ev.workKind]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const,
          }}
        >
          {ev.workTitle}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
          {t("rs.event.subtitle", { kind: t(KIND_LABEL_KEY[ev.workKind]), verifier: ev.verifier, when: formatRelative(ev.timestamp) })}
        </div>
      </div>
      <div style={{ fontWeight: 900, fontSize: 13, color, whiteSpace: "nowrap" as const }}>
        {formatCurrency(ev.amount, code, { sign: true })}
      </div>
    </li>
  );
}

export function RoyaltyStream() {
  const { t } = useI18n();
  const { royalty: data } = useEcosystemData();
  const [liveEvents, setLiveEvents] = useState<RoyaltyEvent[]>([]);
  const [paused, setPaused] = useState<boolean>(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const prm = usePrefersReducedMotion();
  const { code } = useCurrency();
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!data || paused) return;
    const schedule = () => {
      const delay = 7000 + Math.random() * 5000;
      tickRef.current = window.setTimeout(() => {
        const ev = simulateRoyaltyEvent(data.works);
        setLiveEvents((prev) => [ev, ...prev].slice(0, 10));
        setHighlightId(ev.id);
        window.setTimeout(() => setHighlightId(null), 1200);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      if (tickRef.current != null) window.clearTimeout(tickRef.current);
    };
  }, [data, paused]);

  const feed = useMemo(() => {
    if (!data) return [] as RoyaltyEvent[];
    const merged = [...liveEvents, ...data.recentEvents];
    const seen = new Set<string>();
    const deduped: RoyaltyEvent[] = [];
    for (const ev of merged) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      deduped.push(ev);
      if (deduped.length === 10) break;
    }
    return deduped;
  }, [liveEvents, data]);

  const topWorks = useMemo(() => {
    if (!data) return [];
    return [...data.works].sort((a, b) => b.totalRoyalties - a.totalRoyalties).slice(0, 5);
  }, [data]);

  const maxTop = topWorks[0]?.totalRoyalties ?? 1;

  if (!data) {
    return (
      <section
        style={{
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          background: "linear-gradient(180deg, rgba(124,58,237,0.03) 0%, #ffffff 100%)",
        }}
      >
        <SkeletonBlock label={t("rs.loading")} />
      </section>
    );
  }

  const totalRoyalties = data.works.reduce((s, w) => s + w.totalRoyalties, 0);
  const totalVerifications = data.works.reduce((s, w) => s + w.verifications, 0);

  return (
    <section
      style={{
        border: "1px solid rgba(124,58,237,0.25)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "linear-gradient(180deg, rgba(124,58,237,0.04) 0%, #ffffff 100%)",
      }}
      aria-labelledby="royalty-stream-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 999,
              background: paused ? "rgba(15,23,42,0.06)" : "rgba(220,38,38,0.1)",
              color: paused ? "#64748b" : "#991b1b",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
            }}
          >
            <LivePulse active={!paused && !prm} color={paused ? "#64748b" : "#dc2626"} />
            {paused ? t("rs.paused") : t("rs.live")}
          </div>
          <h2
            id="royalty-stream-heading"
            style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#4c1d95" }}
          >
            {t("rs.title")}
          </h2>
        </div>
        <button
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(124,58,237,0.3)",
            background: "#fff",
            color: "#4c1d95",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {paused ? t("rs.btn.resume") : t("rs.btn.pause")}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(124,58,237,0.06)",
            border: "1px solid rgba(124,58,237,0.15)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
            {t("rs.tile.total")}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#4c1d95", letterSpacing: "-0.02em" }}>
            {formatCurrency(totalRoyalties, code)}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {t("rs.tile.total.hint", { verifications: totalVerifications, works: data.works.length })}
          </div>
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(5,150,105,0.06)",
            border: "1px solid rgba(5,150,105,0.18)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
            {t("rs.tile.avg")}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#047857", letterSpacing: "-0.02em" }}>
            {formatCurrency(data.avgPerDay7d, code)}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {t("rs.tile.avg.hint", { amt: formatCurrency(data.avgPerDay30d, code) })}
          </div>
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(14,165,233,0.08), rgba(124,58,237,0.06))",
            border: "1px solid rgba(14,165,233,0.2)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em" }}>
            {t("rs.tile.next")}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0369a1", letterSpacing: "-0.02em" }}>
            ~{formatCurrency(data.estimated30d, code)}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {t("rs.tile.next.hint")}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#64748b",
              marginBottom: 8,
            }}
          >
            {t("rs.recent")}
          </div>
          <ul
            aria-live="polite"
            aria-label={t("rs.live.aria")}
            style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}
          >
            {feed.length === 0 ? (
              <li style={{ fontSize: 12, color: "#64748b", padding: "8px 0" }}>
                {t("rs.recent.empty")}
              </li>
            ) : (
              feed.map((ev) => (
                <EventRow key={ev.id} ev={ev} highlight={!prm && ev.id === highlightId} />
              ))
            )}
          </ul>
        </div>

        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#64748b",
              marginBottom: 8,
            }}
          >
            {t("rs.top")}
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {topWorks.map((w, i) => {
              const color = KIND_COLOR[w.kind];
              const pct = (w.totalRoyalties / maxTop) * 100;
              return (
                <li key={w.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      marginBottom: 3,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        background: `${color}22`,
                        color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {KIND_ICON[w.kind]}
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      #{i + 1} {w.title}
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>
                      {w.verifications}×
                    </span>
                    <span style={{ fontWeight: 900, fontSize: 12, color, flexShrink: 0 }}>
                      {formatCurrency(w.totalRoyalties, code, { decimals: code === "KZT" ? 0 : 2 })}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t("rs.top.aria", { title: w.title, amt: w.totalRoyalties.toFixed(2) })}
                    style={{
                      height: 5,
                      borderRadius: 999,
                      background: "rgba(15,23,42,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: color,
                        transition: "width 400ms ease",
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {t("rs.footer")}
        </div>
        <Link
          href="/qright"
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #7c3aed, #0ea5e9)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            textDecoration: "none",
            whiteSpace: "nowrap" as const,
          }}
        >
          {t("rs.cta")}
        </Link>
      </div>
    </section>
  );
}
