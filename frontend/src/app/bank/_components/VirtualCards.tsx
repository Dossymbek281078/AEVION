"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  brandLabel,
  loadCards,
  newCard,
  saveCards,
  summariseCards,
  type VCardBrand,
  type VCardPurpose,
  type VirtualCard,
  VCARDS_EVENT,
} from "../_lib/virtualCards";
import type { Operation } from "../_lib/types";
import { InfoTooltip } from "./InfoTooltip";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

const PURPOSES: VCardPurpose[] = ["default", "online", "subscriptions", "travel", "shared"];
const BRANDS: VCardBrand[] = ["visa", "mastercard", "aevion"];

export function VirtualCards({
  myAccountId,
  operations,
  notify,
}: {
  myAccountId: string;
  operations: Operation[];
  notify: Notify;
}) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const reload = () => setCards(loadCards());
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(VCARDS_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(VCARDS_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const summaries = useMemo(
    () => summariseCards(cards, operations, myAccountId),
    [cards, operations, myAccountId],
  );

  const remove = (id: string) => {
    const updated = cards.filter((c) => c.id !== id);
    saveCards(updated);
    setCards(updated);
    notify(t("vcards.toast.removed"), "info");
  };

  const toggleFreeze = (id: string) => {
    let nextLabel = "";
    const updated = cards.map((c) => {
      if (c.id !== id) return c;
      const flipped = { ...c, frozen: !c.frozen };
      nextLabel = flipped.frozen ? c.label : c.label;
      return flipped;
    });
    saveCards(updated);
    setCards(updated);
    const target = updated.find((c) => c.id === id);
    if (target) {
      notify(
        t(target.frozen ? "vcards.toast.frozen" : "vcards.toast.unfrozen", { label: nextLabel || target.label }),
        target.frozen ? "info" : "success",
      );
    }
  };

  const updateLimit = (id: string, limit: number | null) => {
    const updated = cards.map((c) => (c.id === id ? { ...c, limit } : c));
    saveCards(updated);
    setCards(updated);
    notify(t("vcards.toast.limitUpdated"), "success");
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("vcards.title")}</div>
            <InfoTooltip text={t("vcards.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("vcards.subtitle")}
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
          {showForm ? t("vcards.cancel") : `+ ${t("vcards.add")}`}
        </button>
      </div>

      {showForm ? (
        <CardForm
          index={cards.length}
          onCancel={() => setShowForm(false)}
          onCreate={(c) => {
            const updated = [...cards, c];
            saveCards(updated);
            setCards(updated);
            setShowForm(false);
            notify(t("vcards.toast.created", { label: c.label }), "success");
          }}
        />
      ) : null}

      {summaries.length === 0 ? (
        <div
          style={{
            padding: 18,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
            background: "rgba(124,58,237,0.05)",
            borderRadius: 12,
            marginTop: showForm ? 12 : 0,
          }}
        >
          {t("vcards.empty")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            marginTop: showForm ? 12 : 0,
          }}
        >
          {summaries.map((s) => (
            <CardTile
              key={s.card.id}
              status={s}
              code={code}
              onFreeze={() => toggleFreeze(s.card.id)}
              onRemove={() => {
                if (typeof window !== "undefined" && window.confirm(t("vcards.confirmDelete"))) remove(s.card.id);
              }}
              onLimitChange={(lim) => updateLimit(s.card.id, lim)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CardTile({
  status,
  code,
  onFreeze,
  onRemove,
  onLimitChange,
}: {
  status: ReturnType<typeof summariseCards>[number];
  code: ReturnType<typeof useCurrency>["code"];
  onFreeze: () => void;
  onRemove: () => void;
  onLimitChange: (limit: number | null) => void;
}) {
  const { t } = useI18n();
  const { card, spent, ratio, state } = status;
  const [editLimit, setEditLimit] = useState(false);
  const [tempLimit, setTempLimit] = useState(card.limit?.toString() ?? "");

  const stateColor: Record<typeof state, string> = {
    ok: "#0d9488",
    warning: "#d97706",
    over: "#dc2626",
    frozen: "#64748b",
    unlimited: "#475569",
  };
  const accent = stateColor[state];

  const submitLimit = () => {
    const v = tempLimit.trim();
    if (v === "") {
      onLimitChange(null);
    } else {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) onLimitChange(n);
    }
    setEditLimit(false);
  };

  const pct = card.limit ? Math.min(100, ratio * 100) : 0;

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: card.frozen
          ? "linear-gradient(135deg, #f1f5f9, #e2e8f0)"
          : `linear-gradient(135deg, ${card.color}, ${card.color}cc)`,
        color: "#fff",
        boxShadow: `0 8px 18px ${card.color}33`,
        opacity: card.frozen ? 0.65 : 1,
        position: "relative" as const,
        overflow: "hidden" as const,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 0.6,
            textTransform: "uppercase" as const,
            opacity: 0.85,
          }}
        >
          {brandLabel(card.brand)} · {t(`vcards.purpose.${card.purpose}`)}
        </div>
        {card.frozen ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 0.5,
              textTransform: "uppercase" as const,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(15,23,42,0.7)",
              color: "#fff",
            }}
          >
            ❄ {t("vcards.frozen")}
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, color: card.frozen ? "#1e293b" : "#fff" }}>
        {card.label}
      </div>
      <div
        style={{
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          opacity: 0.85,
          letterSpacing: "0.1em",
          color: card.frozen ? "#475569" : "#fff",
        }}
      >
        •••• •••• •••• {card.last4}
      </div>

      <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.18)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.85, marginBottom: 4, color: card.frozen ? "#475569" : "#fff" }}>
          {t("vcards.spent.label")}
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: card.frozen ? "#1e293b" : "#fff" }}>
          {formatCurrency(spent, code)}
          {card.limit !== null ? (
            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, marginLeft: 4 }}>
              / {formatCurrency(card.limit, code)}
            </span>
          ) : null}
        </div>
        {card.limit !== null ? (
          <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: "rgba(15,23,42,0.18)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: state === "over" ? "#dc2626" : state === "warning" ? "#fbbf24" : "#fff",
                transition: "width 320ms ease",
              }}
            />
          </div>
        ) : (
          <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, color: card.frozen ? "#475569" : "#fff" }}>
            {t("vcards.noLimit")}
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={onFreeze} style={cardBtnStyle(card.frozen)}>
          {card.frozen ? `☀ ${t("vcards.unfreeze")}` : `❄ ${t("vcards.freeze")}`}
        </button>
        <button onClick={() => setEditLimit((v) => !v)} style={cardBtnStyle(false)}>
          {editLimit ? t("vcards.cancel") : t("vcards.editLimit")}
        </button>
        <button
          onClick={onRemove}
          style={{ ...cardBtnStyle(false), background: "rgba(220,38,38,0.85)" }}
          aria-label={t("vcards.delete")}
          title={t("vcards.delete")}
        >
          ✕
        </button>
      </div>

      {editLimit ? (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 8,
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <input
            type="number"
            min="0"
            placeholder={t("vcards.field.limit")}
            value={tempLimit}
            onChange={(e) => setTempLimit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitLimit();
              if (e.key === "Escape") setEditLimit(false);
            }}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 6,
              border: "none",
              fontSize: 12,
              color: "#0f172a",
              fontWeight: 700,
            }}
            autoFocus
          />
          <button onClick={submitLimit} style={cardBtnStyle(false)}>
            {t("vcards.save")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CardForm({
  index,
  onCancel,
  onCreate,
}: {
  index: number;
  onCancel: () => void;
  onCreate: (c: VirtualCard) => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState("");
  const [brand, setBrand] = useState<VCardBrand>("aevion");
  const [purpose, setPurpose] = useState<VCardPurpose>("default");
  const [limit, setLimit] = useState("");

  const submit = () => {
    if (!label.trim()) return;
    const lim = limit.trim() === "" ? null : Number(limit);
    if (lim !== null && (!Number.isFinite(lim) || lim < 0)) return;
    onCreate(newCard({ label: label.trim(), brand, purpose, limit: lim, index }));
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(124,58,237,0.05)",
        border: "1px solid rgba(124,58,237,0.2)",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <input
          placeholder={t("vcards.field.label")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={inputStyle}
        />
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>
            {t("vcards.field.brand")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {BRANDS.map((b) => (
              <button
                key={b}
                onClick={() => setBrand(b)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: brand === b ? "#0f172a" : "#fff",
                  color: brand === b ? "#fff" : "#475569",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {brandLabel(b)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>
            {t("vcards.field.purpose")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PURPOSES.map((p) => (
              <button
                key={p}
                onClick={() => setPurpose(p)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: purpose === p ? "#7c3aed" : "#fff",
                  color: purpose === p ? "#fff" : "#475569",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t(`vcards.purpose.${p}`)}
              </button>
            ))}
          </div>
        </div>
        <input
          type="number"
          min="0"
          placeholder={t("vcards.field.limit")}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
        <button onClick={onCancel} style={btnSecondary}>
          {t("vcards.cancel")}
        </button>
        <button onClick={submit} style={btnPrimary}>
          {t("vcards.create")}
        </button>
      </div>
    </div>
  );
}

const cardBtnStyle = (active: boolean) =>
  ({
    padding: "5px 10px",
    borderRadius: 6,
    border: "none",
    background: active ? "#0f172a" : "rgba(255,255,255,0.22)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  }) as const;

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
  background: "linear-gradient(135deg, #7c3aed, #0ea5e9)",
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
  border: "1px solid rgba(124,58,237,0.2)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(124,58,237,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
