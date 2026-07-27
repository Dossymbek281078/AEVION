"use client";

import Link from "next/link";
import { BAND_STYLE, TIER_ACCENT, dealHeadline, usd, type Listing } from "../lib";

/**
 * One row of the feed. An investor scanning this must be able to answer three
 * questions without opening anything: what stage is it, what is being offered,
 * and how did the free assessment rate it.
 */
export function ListingCard({ listing, onInterest }: { listing: Listing; onInterest: (l: Listing) => void }) {
  const accent = TIER_ACCENT[listing.tier];
  const a = listing.assessment;
  const band = a ? BAND_STYLE[a.band] : null;
  const highFlags = a?.redFlags.filter((f) => f.severity === "high").length ?? 0;
  const ratio = a?.deal.implied.ratioToBandHigh ?? null;

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ padding: "2px 9px", borderRadius: 20, background: `${accent}14`, color: accent, fontSize: 11, fontWeight: 800 }}>
              {listing.tierLabel}
            </span>
            {listing.qright_protected && (
              <span style={{ fontSize: 10.5, color: "#64748b", fontFamily: "monospace" }} title="SHA-256 отпечаток текста заявки">
                sha256:{listing.content_hash?.slice(0, 10)}
              </span>
            )}
            {listing.geography && <span style={{ fontSize: 11, color: "#64748b" }}>· {listing.geography}</span>}
          </div>

          <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
            <Link href={`/startup-exchange/${listing.id}`} style={{ color: "inherit", textDecoration: "none" }}>
              {listing.title}
            </Link>
          </h3>

          <div style={{ fontSize: 13.5, fontWeight: 700, color: accent, marginBottom: 6 }}>
            {dealHeadline(listing.deal)}
            {listing.deal?.intent === "raise" && a?.deal.implied.postMoneyUsd && (
              // «Оценка» на карточке читалась как наша оценка проекта — а биржа
              // ровно этого не делает и говорит об этом на каждом экране. Число
              // здесь — арифметика самого основателя: сколько просит за какую
              // долю. Подпись должна называть именно это.
              <span style={{ fontWeight: 500, color: "#64748b", fontSize: 12 }} title="Пост-оценка по условиям самого основателя: сколько он просит за какую долю">
                {" "}· по его условиям — {usd(a.deal.implied.postMoneyUsd)}
              </span>
            )}
          </div>

          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
            {listing.description.length > 240 ? `${listing.description.slice(0, 240)}…` : listing.description}
          </p>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "#64748b" }}>
            {listing.metrics?.mrrUsd ? <span>MRR {usd(listing.metrics.mrrUsd)}</span> : null}
            {listing.metrics?.users ? <span>{listing.metrics.users} польз.</span> : null}
            {listing.metrics?.growthMomPct ? <span>рост {listing.metrics.growthMomPct}%/мес</span> : null}
            {listing.demo_url && (
              <a
                href={listing.demo_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", minHeight: 34, padding: "6px 2px", color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}
              >
                демо ↗
              </a>
            )}
            {listing.interest_count !== undefined && <span>{listing.interest_count} откликов</span>}
          </div>
        </div>

        {/* Score block */}
        <div style={{ width: 132, flexShrink: 0 }}>
          {a && band ? (
            <div style={{ border: "1px solid #f1f5f9", borderRadius: 12, padding: "10px 12px", background: "#fcfcfd" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{a.score}</div>
              <div style={{ fontSize: 10, color: band.color, fontWeight: 700, marginTop: 3 }}>{band.label}</div>
              {ratio !== null && ratio > 1 && (
                <div style={{ fontSize: 10.5, color: "#b45309", marginTop: 5, lineHeight: 1.35 }}>
                  цена выше рынка в {ratio.toFixed(1)}×
                </div>
              )}
              {highFlags > 0 && (
                <div style={{ fontSize: 10.5, color: "#991b1b", marginTop: 4, lineHeight: 1.35 }}>
                  {highFlags} серьёзн. замечани{highFlags === 1 ? "е" : "я"}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>Анализ не проводился</div>
          )}

          <button
            type="button"
            onClick={() => onInterest(listing)}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "8px 10px",
              borderRadius: 9,
              border: "none",
              background: "#0f172a",
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Предложить сделку
          </button>
          <Link
            href={`/startup-exchange/${listing.id}`}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 34, marginTop: 4, fontSize: 12, color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}
          >
            Разбор целиком
          </Link>
        </div>
      </div>
    </article>
  );
}
