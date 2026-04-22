"use client";

import { useMemo, useState } from "react";
import * as contactsLib from "../_lib/contacts";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { describeOp, formatRelative } from "../_lib/format";
import type { Operation } from "../_lib/types";

type Filter = "all" | "in" | "out";

const typeIcon: Record<string, string> = {
  topup: "+",
  transfer: "⇄",
};

const typeColor: Record<string, { bg: string; fg: string; border: string }> = {
  topup: { bg: "rgba(16,185,129,0.08)", fg: "#065f46", border: "rgba(16,185,129,0.25)" },
  transfer: { bg: "rgba(59,130,246,0.08)", fg: "#1e40af", border: "rgba(59,130,246,0.25)" },
};

export function TransactionList({
  myId,
  operations,
  loading,
  onRefresh,
  csvUrl,
  onCopyId,
}: {
  myId: string;
  operations: Operation[];
  loading: boolean;
  onRefresh: () => void;
  csvUrl: string;
  onCopyId: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const { code } = useCurrency();

  const contactMap = useMemo(() => contactsLib.contactsById(), [operations]);

  const sorted = useMemo(
    () =>
      [...operations].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [operations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((op) => {
      const d = describeOp(op, myId);
      if (filter === "in" && d.signed < 0) return false;
      if (filter === "out" && d.signed > 0) return false;
      if (!q) return true;
      const idMatch = op.id.toLowerCase().includes(q);
      const cpId = d.counterparty || "";
      const cpMatch = cpId.toLowerCase().includes(q);
      const nick = contactMap.get(cpId) || "";
      const nickMatch = nick.toLowerCase().includes(q);
      return idMatch || cpMatch || nickMatch;
    });
  }, [sorted, filter, search, myId, contactMap]);

  const filterBtn = (key: Filter, label: string) => (
    <button
      onClick={() => setFilter(key)}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: filter === key ? "1px solid #0f172a" : "1px solid rgba(15,23,42,0.12)",
        background: filter === key ? "#0f172a" : "#fff",
        color: filter === key ? "#fff" : "#334155",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>Transaction history</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <a
            href={csvUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.12)",
              background: "#fff",
              fontSize: 12,
              fontWeight: 700,
              color: "#334155",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Export CSV
          </a>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.12)",
              background: "#fff",
              fontSize: 12,
              fontWeight: 700,
              color: "#334155",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {filterBtn("all", `All (${sorted.length})`)}
        {filterBtn("in", "Incoming")}
        {filterBtn("out", "Outgoing")}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ID, contact, nickname…"
          style={{
            flex: "1 1 160px",
            minWidth: 160,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.12)",
            fontSize: 12,
          }}
        />
      </div>
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center" as const,
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          {sorted.length === 0 ? "No transactions yet. Top up to see your first operation." : "No matches."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.slice(0, 50).map((op) => {
            const d = describeOp(op, myId);
            const colors = typeColor[d.typeKey] || typeColor.transfer;
            const positive = d.signed >= 0;
            const isExpanded = expanded === op.id;
            const cpNick = d.counterparty ? contactMap.get(d.counterparty) : null;
            return (
              <div key={op.id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : op.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    textAlign: "left" as const,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 900,
                      background: colors.border,
                      color: colors.fg,
                      flexShrink: 0,
                    }}
                  >
                    {typeIcon[d.typeKey] || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#0f172a",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {cpNick ? `${d.label} · ${cpNick}` : d.description}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {d.label} · {formatRelative(op.createdAt)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 15,
                      color: positive ? "#059669" : "#dc2626",
                      whiteSpace: "nowrap" as const,
                      flexShrink: 0,
                    }}
                  >
                    {formatCurrency(d.signed, code, { sign: true })}
                  </div>
                </button>
                {isExpanded ? (
                  <div
                    style={{
                      marginTop: 4,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(15,23,42,0.08)",
                      background: "rgba(15,23,42,0.02)",
                      display: "grid",
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <KV label="Operation ID" value={op.id} copyable onCopy={() => onCopyId(op.id)} />
                    {d.counterparty ? (
                      <KV
                        label={d.signed >= 0 ? "From" : "To"}
                        value={d.counterparty}
                        copyable
                        onCopy={() => onCopyId(d.counterparty || "")}
                      />
                    ) : null}
                    <KV label="Timestamp" value={new Date(op.createdAt).toLocaleString()} />
                    <KV label="Kind" value={op.kind} />
                    <KV label="Amount" value={`${formatCurrency(op.amount, code)} (${op.amount.toFixed(2)} AEC)`} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {filtered.length > 50 ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "#94a3b8",
            textAlign: "center" as const,
          }}
        >
          Showing 50 of {filtered.length}. Backend pagination coming soon.
        </div>
      ) : null}
    </section>
  );
}

function KV({
  label,
  value,
  copyable,
  onCopy,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ color: "#94a3b8", fontWeight: 600, minWidth: 100, fontSize: 11 }}>{label}</div>
      <code
        style={{
          flex: 1,
          fontFamily: "ui-monospace, monospace",
          color: "#0f172a",
          overflow: "hidden" as const,
          textOverflow: "ellipsis" as const,
          whiteSpace: "nowrap" as const,
        }}
      >
        {value}
      </code>
      {copyable ? (
        <button
          onClick={onCopy}
          style={{
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 6,
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            color: "#334155",
            cursor: "pointer",
          }}
        >
          Copy
        </button>
      ) : null}
    </div>
  );
}
