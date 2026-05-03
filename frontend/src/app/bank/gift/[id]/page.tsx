"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, loadCurrency, type CurrencyCode } from "../../_lib/currency";
import { decodeGiftLink } from "../../_lib/giftLink";
import {
  GIFTS_EVENT,
  getTheme,
  loadGifts,
  type Gift,
  type GiftThemeId,
} from "../../_lib/gifts";

type Status = Gift["status"];

const TOKEN_KEY = "aevion_auth_token_v1";

export default function GiftPickupPage() {
  const params = useParams();
  const search = useSearchParams();
  const { t } = useI18n();

  const id = typeof params?.id === "string" ? params.id : "";
  const payloadParam = search?.get("p") ?? null;

  const [gift, setGift] = useState<Gift | null>(null);
  const [fromName, setFromName] = useState<string | null>(null);
  const [source, setSource] = useState<"link" | "local" | "missing">("missing");
  const [code, setCode] = useState<CurrencyCode>("AEC");
  const [now, setNow] = useState<number>(() => Date.now());
  const [authed, setAuthed] = useState<boolean>(false);
  const [revealed, setRevealed] = useState<boolean>(false);

  // Resolve gift from URL payload first (cross-device), then local lookup.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCode(loadCurrency());
    setAuthed(Boolean(localStorage.getItem(TOKEN_KEY)));

    if (payloadParam) {
      const decoded = decodeGiftLink(payloadParam);
      if (decoded?.g) {
        setGift(decoded.g);
        setFromName(decoded.from ?? null);
        setSource("link");
        return;
      }
    }
    const local = loadGifts().find((g) => g.id === id);
    if (local) {
      setGift(local);
      setSource("local");
      return;
    }
    setSource("missing");
  }, [id, payloadParam]);

  // Live-refresh local gift if its status changes (sender flips it).
  useEffect(() => {
    if (source !== "local") return;
    const sync = () => {
      const local = loadGifts().find((g) => g.id === id);
      if (local) setGift(local);
    };
    window.addEventListener(GIFTS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(GIFTS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [id, source]);

  // Tick once a second if the gift is still pending — drives the countdown.
  useEffect(() => {
    if (!gift) return;
    const status = effectiveStatus(gift, now);
    if (status !== "pending") return;
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, [gift, now]);

  // Reveal animation: small delay so users see the closed envelope first.
  useEffect(() => {
    if (!gift) return;
    const handle = window.setTimeout(() => setRevealed(true), 350);
    return () => window.clearTimeout(handle);
  }, [gift]);

  const status: Status | undefined = useMemo(
    () => (gift ? effectiveStatus(gift, now) : undefined),
    [gift, now],
  );

  if (!gift) {
    return <NotFound t={t} hasPayload={Boolean(payloadParam)} />;
  }

  const theme = getTheme(gift.themeId as GiftThemeId);
  const remainingMs = gift.unlockAt ? Math.max(0, Date.parse(gift.unlockAt) - now) : 0;
  const amountText = formatCurrency(gift.amount, code);
  const aecAlt = code !== "AEC" ? formatCurrency(gift.amount, "AEC") : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        padding: "32px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      <Link
        href="/bank"
        style={{
          fontSize: 12,
          color: "#475569",
          textDecoration: "none",
          marginBottom: 18,
          fontWeight: 700,
        }}
      >
        ← {t("giftPickup.backToBank")}
      </Link>

      <div
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 24,
          overflow: "hidden",
          background: theme.gradient,
          color: theme.textColor,
          boxShadow:
            "0 20px 60px rgba(15,23,42,0.20), 0 4px 14px rgba(15,23,42,0.10)",
          transform: revealed ? "translateY(0) scale(1)" : "translateY(20px) scale(0.96)",
          opacity: revealed ? 1 : 0,
          transition:
            "transform 480ms cubic-bezier(0.18, 0.9, 0.3, 1.0), opacity 480ms ease",
          position: "relative",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            fontSize: 56,
            opacity: 0.22,
            lineHeight: 1,
          }}
        >
          {theme.icon}
        </div>

        <div style={{ padding: "28px 24px 22px 24px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {t("giftPickup.kicker")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>
            {fromName ? t("giftPickup.fromName", { name: fromName }) : t("giftPickup.fromAnon")}
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(6px)",
            padding: "24px 24px 28px 24px",
            borderTop: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {t("giftPickup.amountLabel")}
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, marginTop: 4, letterSpacing: -0.5 }}>
            {amountText}
          </div>
          {aecAlt ? (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>≈ {aecAlt}</div>
          ) : null}

          {gift.message ? (
            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.20)",
                fontSize: 14,
                lineHeight: 1.55,
                fontWeight: 600,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {gift.message}
            </div>
          ) : null}
        </div>

        <div
          style={{
            background: "rgba(15,23,42,0.55)",
            color: "#fff",
            padding: "14px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <StatusBadge status={status} t={t} />
          {status === "pending" && remainingMs > 0 ? (
            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.92 }}>
              {t("giftPickup.unlocksIn", { time: formatRemaining(remainingMs) })}
            </span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 520,
          marginTop: 18,
          padding: 18,
          borderRadius: 16,
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 6px 16px rgba(15,23,42,0.06)",
        }}
      >
        {!authed ? (
          <ClaimCallout
            t={t}
            href={`/auth?next=${encodeURIComponent(`/bank/gift/${encodeURIComponent(gift.id)}${payloadParam ? `?p=${payloadParam}` : ""}`)}`}
          />
        ) : status === "sent" ? (
          <SentCallout t={t} />
        ) : status === "cancelled" ? (
          <CancelledCallout t={t} />
        ) : (
          <PendingCallout t={t} unlockAt={gift.unlockAt} />
        )}
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 11,
          color: "#64748b",
          textAlign: "center",
          maxWidth: 520,
          lineHeight: 1.55,
        }}
      >
        {source === "link"
          ? t("giftPickup.viaLink")
          : source === "local"
            ? t("giftPickup.viaLocal")
            : ""}
      </div>
    </div>
  );
}

function effectiveStatus(g: Gift, now: number): NonNullable<Status> {
  if (g.status === "cancelled") return "cancelled";
  if (g.status === "sent") return "sent";
  if (!g.unlockAt) return "sent"; // legacy immediate gift
  const t = Date.parse(g.unlockAt);
  if (!Number.isFinite(t)) return "sent";
  return t <= now ? "sent" : "pending";
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86_400);
  const h = Math.floor((totalSec % 86_400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StatusBadge({ status, t }: { status: Status | undefined; t: (k: string) => string }) {
  const map: Record<NonNullable<Status>, { label: string; color: string }> = {
    pending: { label: t("giftPickup.status.pending"), color: "#fbbf24" },
    sent: { label: t("giftPickup.status.sent"), color: "#34d399" },
    cancelled: { label: t("giftPickup.status.cancelled"), color: "#f87171" },
  };
  const v = status ? map[status] : { label: t("giftPickup.status.unknown"), color: "#94a3b8" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.04em",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: v.color,
          boxShadow: `0 0 0 3px ${v.color}33`,
        }}
      />
      {v.label}
    </span>
  );
}

function ClaimCallout({ t, href }: { t: (k: string) => string; href: string }) {
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
        {t("giftPickup.claim.title")}
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
        {t("giftPickup.claim.body")}
      </div>
      <Link
        href={href}
        style={{
          display: "inline-block",
          marginTop: 12,
          padding: "10px 18px",
          borderRadius: 10,
          background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        {t("giftPickup.claim.cta")}
      </Link>
    </>
  );
}

function SentCallout({ t }: { t: (k: string) => string }) {
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
        {t("giftPickup.sent.title")}
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
        {t("giftPickup.sent.body")}
      </div>
      <Link
        href="/bank"
        style={{
          display: "inline-block",
          marginTop: 12,
          padding: "10px 18px",
          borderRadius: 10,
          background: "#0f172a",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        {t("giftPickup.sent.cta")}
      </Link>
    </>
  );
}

function PendingCallout({ t, unlockAt }: { t: (k: string) => string; unlockAt?: string }) {
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
        {t("giftPickup.pending.title")}
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
        {t("giftPickup.pending.body")}
        {unlockAt ? ` · ${new Date(unlockAt).toLocaleString()}` : ""}
      </div>
    </>
  );
}

function CancelledCallout({ t }: { t: (k: string) => string }) {
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
        {t("giftPickup.cancelled.title")}
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
        {t("giftPickup.cancelled.body")}
      </div>
    </>
  );
}

function NotFound({ t, hasPayload }: { t: (k: string) => string; hasPayload: boolean }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f8fafc",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }} aria-hidden="true">
        ⊘
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
        {t("giftPickup.missing.title")}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#475569",
          marginTop: 6,
          maxWidth: 420,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {hasPayload ? t("giftPickup.missing.bodyBadLink") : t("giftPickup.missing.bodyUnknown")}
      </div>
      <Link
        href="/bank"
        style={{
          display: "inline-block",
          marginTop: 18,
          padding: "10px 18px",
          borderRadius: 10,
          background: "#0f172a",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        {t("giftPickup.missing.cta")}
      </Link>
    </div>
  );
}
