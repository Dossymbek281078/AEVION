"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import {
  activeItems,
  loadWishlist,
  newItem,
  paceHint,
  PRIORITY_RANK,
  readyCount,
  refreshStatus,
  saveWishlist,
  totalGoalPrice,
  totalSaved,
  type WishItem,
  type WishPriority,
  WISHLIST_EVENT,
} from "../_lib/wishlist";
import { InfoTooltip } from "./InfoTooltip";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

const PRIORITIES: WishPriority[] = ["must", "nice", "dream"];

export function Wishlist({ notify }: { notify: Notify }) {
  const { t } = useI18n();
  const { code } = useCurrency();
  const [items, setItems] = useState<WishItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "ready" | "saving" | "closed">("all");

  useEffect(() => {
    const reload = () => setItems(refreshStatus(loadWishlist()));
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(WISHLIST_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.status === "ready" && b.status !== "ready") return -1;
      if (b.status === "ready" && a.status !== "ready") return 1;
      const pa = PRIORITY_RANK[a.priority];
      const pb = PRIORITY_RANK[b.priority];
      if (pa !== pb) return pa - pb;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [items]);

  const visible = useMemo(() => {
    if (filter === "all") return sorted.filter((i) => i.status === "saving" || i.status === "ready");
    if (filter === "ready") return sorted.filter((i) => i.status === "ready");
    if (filter === "saving") return sorted.filter((i) => i.status === "saving");
    return sorted.filter((i) => i.status === "purchased" || i.status === "dropped");
  }, [sorted, filter]);

  const totalSavedAec = totalSaved(items);
  const totalPrice = totalGoalPrice(items);
  const ready = readyCount(items);

  const remove = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    saveWishlist(updated);
    setItems(updated);
    notify(t("wishlist.toast.removed"), "info");
  };

  const updateSaved = (id: string, delta: number) => {
    const updated = refreshStatus(
      items.map((i) =>
        i.id === id ? { ...i, savedSoFar: Math.max(0, i.savedSoFar + delta) } : i,
      ),
    );
    saveWishlist(updated);
    setItems(updated);
  };

  const closeItem = (id: string, kind: "purchased" | "dropped") => {
    const updated = items.map((i) =>
      i.id === id ? { ...i, status: kind, closedAt: new Date().toISOString() } : i,
    );
    saveWishlist(updated);
    setItems(updated);
    notify(t(kind === "purchased" ? "wishlist.toast.purchased" : "wishlist.toast.dropped"), "success");
  };

  return (
    <section style={containerStyle}>
      <div style={titleRowStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{t("wishlist.title")}</div>
            <InfoTooltip text={t("wishlist.tooltip")} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {t("wishlist.subtitle")}
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
          {showForm ? t("wishlist.cancel") : `+ ${t("wishlist.add")}`}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
        <Stat
          label={t("wishlist.statSaved")}
          value={formatCurrency(totalSavedAec, code)}
          accent="#0d9488"
        />
        <Stat
          label={t("wishlist.statTarget")}
          value={formatCurrency(totalPrice, code)}
          accent="#475569"
        />
        <Stat
          label={t("wishlist.statReady")}
          value={String(ready)}
          accent={ready > 0 ? "#059669" : "#64748b"}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {(["all", "ready", "saving", "closed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.12)",
              background: filter === f ? "#0f172a" : "transparent",
              color: filter === f ? "#fff" : "#475569",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t(`wishlist.filter.${f}`)}
          </button>
        ))}
      </div>

      {showForm ? (
        <WishForm
          onCancel={() => setShowForm(false)}
          onCreate={(it) => {
            const updated = [...items, it];
            saveWishlist(updated);
            setItems(updated);
            setShowForm(false);
            notify(t("wishlist.toast.created", { label: it.label }), "success");
          }}
        />
      ) : null}

      {visible.length === 0 ? (
        <div
          style={{
            padding: 18,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
            background: "rgba(219,39,119,0.05)",
            borderRadius: 12,
            marginTop: showForm ? 12 : 0,
          }}
        >
          {filter === "closed" ? t("wishlist.emptyClosed") : t("wishlist.empty")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 10,
            marginTop: showForm ? 12 : 0,
          }}
        >
          {visible.map((it) => (
            <WishTile
              key={it.id}
              item={it}
              code={code}
              onAdd={(amt) => updateSaved(it.id, amt)}
              onPurchased={() => closeItem(it.id, "purchased")}
              onDropped={() => closeItem(it.id, "dropped")}
              onRemove={() => {
                if (typeof window !== "undefined" && window.confirm(t("wishlist.confirmDelete"))) remove(it.id);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function WishTile({
  item,
  code,
  onAdd,
  onPurchased,
  onDropped,
  onRemove,
}: {
  item: WishItem;
  code: ReturnType<typeof useCurrency>["code"];
  onAdd: (delta: number) => void;
  onPurchased: () => void;
  onDropped: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const [contribStr, setContribStr] = useState("");
  const PRIORITY_COLOR: Record<WishPriority, string> = {
    must: "#dc2626",
    nice: "#0284c7",
    dream: "#7c3aed",
  };
  const accent = PRIORITY_COLOR[item.priority];
  const pct = item.priceAec > 0 ? Math.min(100, (item.savedSoFar / item.priceAec) * 100) : 0;
  const ready = item.status === "ready";
  const closed = item.status === "purchased" || item.status === "dropped";
  const pace = paceHint(item);

  const submit = () => {
    const v = Number(contribStr);
    if (!Number.isFinite(v) || v === 0) return;
    onAdd(v);
    setContribStr("");
  };

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${ready ? "#059669" : `${accent}40`}`,
        background: ready
          ? "linear-gradient(135deg, rgba(5,150,105,0.08), rgba(5,150,105,0.02))"
          : closed
            ? "rgba(15,23,42,0.04)"
            : `linear-gradient(135deg, ${accent}10, ${accent}04)`,
        opacity: closed ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a" }}>
            {item.emoji} {item.label}
          </div>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 10,
                color: "#0284c7",
                textDecoration: "none",
                display: "inline-block",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
                marginTop: 2,
              }}
            >
              {item.url.replace(/^https?:\/\//, "").slice(0, 36)}…
            </a>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: ready ? "#059669" : accent,
              padding: "2px 6px",
              borderRadius: 4,
              background: ready ? "rgba(5,150,105,0.12)" : `${accent}1a`,
              letterSpacing: 0.4,
              textTransform: "uppercase" as const,
              whiteSpace: "nowrap" as const,
            }}
          >
            {ready ? t("wishlist.statusReady") : t(`wishlist.priority.${item.priority}`)}
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
            aria-label={t("wishlist.delete")}
            title={t("wishlist.delete")}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
        {formatCurrency(item.savedSoFar, code)}
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginLeft: 4 }}>
          / {formatCurrency(item.priceAec, code)}
        </span>
      </div>

      <div style={{ height: 6, borderRadius: 3, background: "rgba(15,23,42,0.06)", overflow: "hidden", marginTop: 6 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: ready ? "#059669" : accent,
            transition: "width 320ms ease",
          }}
        />
      </div>

      {!closed && pace.daysToTarget != null && pace.daysToTarget > 0 && pace.daysToTarget < 9999 ? (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
          {t("wishlist.pace", { days: Math.ceil(pace.daysToTarget), perDay: pace.perDay.toFixed(2) })}
        </div>
      ) : null}

      {item.targetDateISO ? (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
          {t("wishlist.targetDate", { date: item.targetDateISO })}
        </div>
      ) : null}

      {item.notes ? (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontStyle: "italic", lineHeight: 1.3 }}>
          {item.notes}
        </div>
      ) : null}

      {!closed ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <input
            type="number"
            placeholder={t("wishlist.contribPlaceholder")}
            value={contribStr}
            onChange={(e) => setContribStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            style={{
              flex: 1,
              minWidth: 80,
              padding: "5px 8px",
              borderRadius: 6,
              border: "1px solid rgba(15,23,42,0.15)",
              fontSize: 11,
              boxSizing: "border-box" as const,
            }}
          />
          <button onClick={submit} style={smallBtn(accent)}>
            +
          </button>
          {ready ? (
            <button onClick={onPurchased} style={smallBtn("#059669")}>
              {t("wishlist.buy")}
            </button>
          ) : (
            <button onClick={onDropped} style={smallBtnGhost}>
              {t("wishlist.skip")}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function WishForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (it: WishItem) => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [priority, setPriority] = useState<WishPriority>("nice");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!label.trim()) return;
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return;
    onCreate(
      newItem({
        label: label.trim(),
        url: url.trim(),
        priceAec: p,
        priority,
        targetDateISO: targetDate || null,
        notes: notes.trim(),
        emoji: emoji.trim(),
      }),
    );
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(219,39,119,0.04)",
        border: "1px solid rgba(219,39,119,0.2)",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder={t("wishlist.field.emoji")}
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
            style={{ ...inputStyle, width: 60, textAlign: "center" as const, fontSize: 18 }}
          />
          <input
            placeholder={t("wishlist.field.label")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
        <input
          placeholder={t("wishlist.field.url")}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={inputStyle}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder={t("wishlist.field.price")}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={inputStyle}
        />
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>
            {t("wishlist.field.priority")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: priority === p ? "#db2777" : "#fff",
                  color: priority === p ? "#fff" : "#475569",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t(`wishlist.priority.${p}`)}
              </button>
            ))}
          </div>
        </div>
        <label style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
          {t("wishlist.field.targetDate")}
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
        <input
          placeholder={t("wishlist.field.notes")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
        <button onClick={onCancel} style={btnSecondary}>
          {t("wishlist.cancel")}
        </button>
        <button onClick={submit} style={btnPrimary}>
          {t("wishlist.create")}
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

const smallBtn = (color: string) =>
  ({
    padding: "5px 10px",
    borderRadius: 6,
    border: "none",
    background: color,
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  }) as const;

const smallBtnGhost = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "#fff",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
} as const;

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
  background: "linear-gradient(135deg, #db2777, #7c3aed)",
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
  border: "1px solid rgba(219,39,119,0.2)",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff 0%, rgba(219,39,119,0.04) 100%)",
};

const titleRowStyle = {
  display: "flex",
  justifyContent: "space-between" as const,
  alignItems: "flex-start" as const,
  marginBottom: 12,
  gap: 12,
  flexWrap: "wrap" as const,
};
