"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  expiringSoonCount,
  loadLoyalty,
  LOYALTY_EVENT,
  type LoyaltyAccount,
  type LoyaltyKind,
  maskedRef,
  newLoyalty,
  saveLoyalty,
  statusOf,
  totalEstimatedValue,
} from "../_lib/loyaltyVault";
import { InfoTooltip } from "./InfoTooltip";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

const KINDS: LoyaltyKind[] = ["airline", "hotel", "retail", "cashback", "other"];
const KIND_EMOJI: Record<LoyaltyKind, string> = {
  airline: "✈",
  hotel: "🏨",
  retail: "🛍",
  cashback: "💰",
  other: "🎁",
};

export function LoyaltyVaultPanel({ notify }: { notify: Notify }) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [items, setItems] = useState<LoyaltyAccount[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const reload = () => setItems(loadLoyalty());
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(LOYALTY_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(LOYALTY_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const sa = statusOf(a);
      const sb = statusOf(b);
      const rank: Record<ReturnType<typeof statusOf>, number> = {
        expiringSoon: 0,
        expired: 1,
        active: 2,
        fresh: 3,
        noExpiry: 4,
      };
      return rank[sa] - rank[sb];
    });
  }, [items]);

  const totalValue = totalEstimatedValue(items);
  const expiring = expiringSoonCount(items);

  const remove = (id: string) => {
    const updated = items.filter((a) => a.id !== id);
    saveLoyalty(updated);
    setItems(updated);
    notify(t("loyalty.toast.removed"), "info");
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("loyalty.title")}</div>
            <InfoTooltip text={t("loyalty.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("loyalty.subtitle")}
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.12)",
            background: showForm ? "#0f172a" : "transparent",
            color: showForm ? "#fff" : "#0f172a",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {showForm ? t("loyalty.cancel") : `+ ${t("loyalty.add")}`}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
        <Stat label={t("loyalty.statValue")} value={totalValue > 0 ? formatCurrency(totalValue, code) : "—"} accent="#0d9488" />
        <Stat label={t("loyalty.statPrograms")} value={String(items.length)} accent="#7c3aed" />
        <Stat label={t("loyalty.statExpiring")} value={String(expiring)} accent={expiring > 0 ? "#dc2626" : "#64748b"} />
      </div>

      {showForm ? (
        <LoyaltyForm
          index={items.length}
          onCancel={() => setShowForm(false)}
          onCreate={(account) => {
            const updated = [...items, account];
            saveLoyalty(updated);
            setItems(updated);
            setShowForm(false);
            notify(t("loyalty.toast.added", { brand: account.brand }), "success");
          }}
        />
      ) : null}

      {sorted.length === 0 ? (
        <div
          style={{
            padding: 18,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
            background: "rgba(13,148,136,0.05)",
            borderRadius: 12,
            marginTop: showForm ? 12 : 0,
          }}
        >
          {t("loyalty.empty")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            marginTop: showForm ? 12 : 0,
          }}
        >
          {sorted.map((a) => (
            <LoyaltyTile
              key={a.id}
              account={a}
              code={code}
              onRemove={() => {
                if (typeof window !== "undefined" && window.confirm(t("loyalty.confirmDelete"))) remove(a.id);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LoyaltyTile({
  account,
  code,
  onRemove,
}: {
  account: LoyaltyAccount;
  code: ReturnType<typeof useCurrency>["code"];
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const status = statusOf(account);
  const STATUS_COLOR: Record<typeof status, string> = {
    fresh: "#0d9488",
    active: "#0284c7",
    expiringSoon: "#dc2626",
    expired: "#64748b",
    noExpiry: "#475569",
  };
  const accent = STATUS_COLOR[status];
  const value =
    account.pointValue != null && status !== "expired"
      ? account.points * account.pointValue
      : null;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${account.color}40`,
        background: status === "expired" ? "rgba(15,23,42,0.04)" : `linear-gradient(135deg, ${account.color}10, ${account.color}04)`,
        opacity: status === "expired" ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a" }}>
            {KIND_EMOJI[account.kind]} {account.brand}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, fontFamily: "ui-monospace, monospace" }}>
            {maskedRef(account.memberRef)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: accent,
              padding: "2px 6px",
              borderRadius: 4,
              background: `${accent}1a`,
              letterSpacing: 0.4,
              textTransform: "uppercase" as const,
              whiteSpace: "nowrap" as const,
            }}
          >
            {t(`loyalty.status.${status}`)}
          </span>
          <button
            onClick={onRemove}
            style={{
              border: "none",
              background: "transparent",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 12,
              padding: "2px 4px",
            }}
            aria-label={t("loyalty.delete")}
            title={t("loyalty.delete")}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums", marginBottom: 4 }}>
        {account.points.toLocaleString()}
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginLeft: 4 }}>
          {t("loyalty.pointsUnit")}
        </span>
      </div>

      {value != null ? (
        <div style={{ fontSize: 11, color: "#475569" }}>
          ≈ <span style={{ fontWeight: 700, color: "#0d9488" }}>{formatCurrency(value, code)}</span>
        </div>
      ) : null}

      {account.expiresOn ? (
        <div style={{ fontSize: 10, color: status === "expired" || status === "expiringSoon" ? accent : "#64748b", marginTop: 4 }}>
          {status === "expired"
            ? t("loyalty.expiredOn", { date: account.expiresOn })
            : t("loyalty.expiresOn", { date: account.expiresOn })}
        </div>
      ) : null}
      {account.notes ? (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontStyle: "italic", lineHeight: 1.3 }}>
          {account.notes}
        </div>
      ) : null}
    </div>
  );
}

function LoyaltyForm({
  index,
  onCancel,
  onCreate,
}: {
  index: number;
  onCancel: () => void;
  onCreate: (a: LoyaltyAccount) => void;
}) {
  const { t } = useI18n();
  const [brand, setBrand] = useState("");
  const [kind, setKind] = useState<LoyaltyKind>("airline");
  const [points, setPoints] = useState("");
  const [pointValue, setPointValue] = useState("");
  const [memberRef, setMemberRef] = useState("");
  const [expires, setExpires] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!brand.trim()) return;
    const p = Number(points);
    if (!Number.isFinite(p) || p < 0) return;
    const pv = pointValue.trim() === "" ? null : Number(pointValue);
    if (pv !== null && (!Number.isFinite(pv) || pv < 0)) return;
    onCreate(
      newLoyalty({
        brand: brand.trim(),
        kind,
        points: Math.floor(p),
        pointValue: pv,
        expiresOn: expires || null,
        memberRef: memberRef.trim(),
        notes: notes.trim(),
        index,
      }),
    );
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(13,148,136,0.05)",
        border: "1px solid rgba(13,148,136,0.2)",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <input
          placeholder={t("loyalty.field.brand")}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          style={inputStyle}
        />
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>
            {t("loyalty.field.kind")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: kind === k ? "#0d9488" : "#fff",
                  color: kind === k ? "#fff" : "#475569",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {KIND_EMOJI[k]} {t(`loyalty.kind.${k}`)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            type="number"
            min="0"
            placeholder={t("loyalty.field.points")}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            style={inputStyle}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder={t("loyalty.field.pointValue")}
            value={pointValue}
            onChange={(e) => setPointValue(e.target.value)}
            style={inputStyle}
          />
        </div>
        <input
          placeholder={t("loyalty.field.memberRef")}
          value={memberRef}
          onChange={(e) => setMemberRef(e.target.value)}
          style={inputStyle}
        />
        <label style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
          {t("loyalty.field.expires")}
          <input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
        <input
          placeholder={t("loyalty.field.notes")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
        <button onClick={onCancel} style={btnSecondary}>
          {t("loyalty.cancel")}
        </button>
        <button onClick={submit} style={btnPrimary}>
          {t("loyalty.create")}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: `1px solid ${accent}33`,
        background: `${accent}0d`,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: accent,
          letterSpacing: 0.5,
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  boxSizing: "border-box" as const,
};

const btnPrimary = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #0d9488, #059669)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
} as const;

const btnSecondary = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "#fff",
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const containerStyle = {
  border: "1px solid rgba(13,148,136,0.2)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(13,148,136,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
