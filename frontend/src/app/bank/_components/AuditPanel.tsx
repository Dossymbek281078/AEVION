"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSignatures } from "../_hooks/useSignatures";
import { formatRelative } from "../_lib/format";
import type { SignedOperation, VerifyState } from "../_lib/signatures";

const STATE_COLOR: Record<VerifyState, string> = {
  unknown: "#94a3b8",
  valid: "#059669",
  invalid: "#dc2626",
  error: "#d97706",
};

const STATE_LABEL_KEY: Record<VerifyState, string> = {
  unknown: "audit.state.unknown",
  valid: "audit.state.valid",
  invalid: "audit.state.invalid",
  error: "audit.state.error",
};

export function AuditPanel({
  notify,
}: {
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const { t } = useI18n();
  const { items, verifyOne, verifyAll, verifying, clear } = useSignatures();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        background: "#fff",
      }}
      aria-labelledby="audit-heading"
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
          <span
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(15,118,110,0.12)",
              color: "#0f766e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 900,
            }}
          >
            ✎
          </span>
          <div>
            <h2
              id="audit-heading"
              style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
            >
              {t("audit.title")}
            </h2>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              {t("audit.subtitle")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={async () => {
              if (items.length === 0) {
                notify(t("audit.toast.empty"), "info");
                return;
              }
              await verifyAll();
              notify(t("audit.toast.verified", { n: items.length }), "success");
            }}
            disabled={verifying || items.length === 0}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(15,118,110,0.3)",
              background: verifying || items.length === 0 ? "rgba(15,23,42,0.04)" : "#0f766e",
              color: verifying || items.length === 0 ? "#94a3b8" : "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: verifying || items.length === 0 ? "default" : "pointer",
            }}
          >
            {verifying ? t("audit.btn.verifying") : t("audit.btn.verifyAll")}
          </button>
          {items.length > 0 ? (
            <button
              onClick={() => {
                try {
                  const payload = {
                    exportedAt: new Date().toISOString(),
                    count: items.length,
                    signatures: items,
                  };
                  const blob = new Blob([JSON.stringify(payload, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `aevion-audit-${new Date().toISOString().slice(0, 10)}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  notify(t("audit.toast.exported", { n: items.length }), "success");
                } catch {
                  notify(t("audit.toast.exportFail"), "error");
                }
              }}
              aria-label={t("audit.btn.export.aria")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(15,118,110,0.3)",
                background: "#fff",
                color: "#0f766e",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("audit.btn.export")}
            </button>
          ) : null}
          {items.length > 0 ? (
            <button
              onClick={() => {
                if (confirm(t("audit.confirm.clear"))) {
                  clear();
                  notify(t("audit.toast.cleared"), "info");
                }
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "#fff",
                fontSize: 12,
                fontWeight: 700,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              {t("audit.btn.clear")}
            </button>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center" as const,
            fontSize: 13,
            color: "#94a3b8",
            border: "1px dashed rgba(15,23,42,0.1)",
            borderRadius: 10,
          }}
        >
          {t("audit.empty")}
        </div>
      ) : (
        <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {items.slice(0, 20).map((sig) => (
            <SignatureRow
              key={sig.id}
              sig={sig}
              expanded={expanded === sig.id}
              onToggle={() => setExpanded((v) => (v === sig.id ? null : sig.id))}
              onVerify={async () => {
                await verifyOne(sig);
                notify(t("audit.toast.reverified", { idShort: sig.id.slice(0, 12) }), "info");
              }}
            />
          ))}
        </ul>
      )}

      {items.length > 20 ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "#94a3b8",
            textAlign: "center" as const,
          }}
        >
          {t("audit.more", { n: items.length })}
        </div>
      ) : null}
    </section>
  );
}

function SignatureRow({
  sig,
  expanded,
  onToggle,
  onVerify,
}: {
  sig: SignedOperation;
  expanded: boolean;
  onToggle: () => void;
  onVerify: () => void;
}) {
  const { t } = useI18n();
  const color = STATE_COLOR[sig.verified];
  return (
    <li
      style={{
        border: `1px solid ${color}33`,
        borderRadius: 10,
        background: sig.verified === "invalid" ? "rgba(220,38,38,0.04)" : "#fff",
        overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          textAlign: "left" as const,
          cursor: "pointer",
        }}
      >
        <span
          aria-label={t(STATE_LABEL_KEY[sig.verified])}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {sig.id}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
            {sig.kind} · {sig.algo} · {t("audit.row.signed", { when: formatRelative(sig.signedAt) })}{sig.verifiedAt ? t("audit.row.checked", { when: formatRelative(sig.verifiedAt) }) : ""}
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
          }}
        >
          {t(STATE_LABEL_KEY[sig.verified])}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded ? (
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid rgba(15,23,42,0.05)",
            background: "rgba(15,23,42,0.02)",
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              fontSize: 11,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "#64748b", fontWeight: 700, minWidth: 80 }}>{t("audit.row.signature")}</span>
            <code
              style={{
                flex: 1,
                fontFamily: "ui-monospace, monospace",
                color: "#0f172a",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
              }}
            >
              {sig.signature}
            </code>
          </div>
          <div style={{ fontSize: 11 }}>
            <span style={{ color: "#64748b", fontWeight: 700, minWidth: 80, display: "inline-block" }}>
              {t("audit.row.payload")}
            </span>
            <pre
              style={{
                fontFamily: "ui-monospace, monospace",
                background: "#fff",
                padding: 8,
                borderRadius: 6,
                border: "1px solid rgba(15,23,42,0.08)",
                marginTop: 4,
                overflow: "auto",
                maxHeight: 140,
                fontSize: 11,
              }}
            >
{JSON.stringify(sig.payload, null, 2)}
            </pre>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              onClick={onVerify}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid rgba(15,118,110,0.3)",
                background: "#fff",
                color: "#0f766e",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("audit.row.verifyNow")}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
