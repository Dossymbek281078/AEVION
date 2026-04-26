"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSavings } from "../_hooks/useSavings";
import { absoluteRequestUrl } from "../_lib/paymentRequest";
import {
  forecastGoal,
  ICON_COLOR,
  ICON_LABEL_KEY,
  ICON_SYMBOL,
  type GoalForecast,
  type GoalIcon,
  type SavingsGoal,
} from "../_lib/savings";
import { btnSecondary, Field, inputStyle } from "./formPrimitives";
import { Money } from "./Money";
import { QRCodeView } from "./QRCode";

type Props = {
  accountId: string;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
};

const ICON_CHOICES: GoalIcon[] = ["travel", "vacation", "home", "gear", "star", "heart", "coffee", "music"];

export function SavingsGoals({ accountId, notify }: Props) {
  const { t } = useI18n();
  const { goals, add, remove, contribute, reset } = useSavings();
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [label, setLabel] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [icon, setIcon] = useState<GoalIcon>("star");
  const [deadline, setDeadline] = useState<string>("");
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (formOpen) firstInputRef.current?.focus();
  }, [formOpen]);

  const resetForm = () => {
    setLabel("");
    setTarget("");
    setIcon("star");
    setDeadline("");
  };

  const save = () => {
    const n = parseFloat(target);
    if (!label.trim()) {
      notify(t("savings.toast.name"), "error");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      notify(t("savings.toast.target"), "error");
      return;
    }
    let deadlineISO: string | null = null;
    if (deadline) {
      const d = new Date(deadline);
      if (!Number.isNaN(d.getTime())) deadlineISO = d.toISOString();
    }
    add({ label: label.trim(), icon, targetAec: n, deadlineISO });
    notify(t("savings.toast.created", { label: label.trim() }), "success");
    resetForm();
    setFormOpen(false);
  };

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "#fff",
      }}
      aria-labelledby="savings-heading"
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
        <h2
          id="savings-heading"
          style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
        >
          {t("savings.title")}
          {goals.length > 0 ? (
            <span
              style={{
                marginLeft: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(5,150,105,0.12)",
                color: "#047857",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {t("savings.activePill", { n: goals.filter((g) => !g.completedAt).length })}
            </span>
          ) : null}
        </h2>
        <button
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          aria-controls="goal-form"
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: formOpen ? "#64748b" : "linear-gradient(135deg, #059669, #0d9488)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {formOpen ? t("savings.cta.cancel") : t("savings.cta.new")}
        </button>
      </div>

      {formOpen ? (
        <div
          id="goal-form"
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(5,150,105,0.2)",
            background: "rgba(5,150,105,0.04)",
            marginBottom: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Field label={t("savings.field.name")}>
              <input
                ref={firstInputRef}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("savings.field.name.placeholder")}
                maxLength={60}
                style={inputStyle}
              />
            </Field>
            <Field label={t("savings.field.target")}>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                type="number"
                min="0"
                step="1"
                placeholder="1000"
                style={inputStyle}
              />
            </Field>
            <Field label={t("savings.field.deadline")}>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>{t("savings.field.icon")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="radiogroup" aria-label="Icon">
              {ICON_CHOICES.map((ic) => {
                const active = icon === ic;
                return (
                  <button
                    key={ic}
                    role="radio"
                    aria-checked={active}
                    aria-label={t(ICON_LABEL_KEY[ic])}
                    onClick={() => setIcon(ic)}
                    title={t(ICON_LABEL_KEY[ic])}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: active ? `2px solid ${ICON_COLOR[ic]}` : "1px solid rgba(15,23,42,0.12)",
                      background: active ? `${ICON_COLOR[ic]}14` : "#fff",
                      color: ICON_COLOR[ic],
                      fontSize: 16,
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {ICON_SYMBOL[ic]}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
              style={btnSecondary}
            >
              {t("savings.cta.cancel")}
            </button>
            <button
              onClick={save}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #059669, #0d9488)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("savings.cta.create")}
            </button>
          </div>
        </div>
      ) : null}

      {goals.length === 0 ? (
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
          {t("savings.empty")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {[...goals]
            .sort((a, b) => {
              if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? 1 : -1;
              const ad = a.deadlineISO ? new Date(a.deadlineISO).getTime() : Infinity;
              const bd = b.deadlineISO ? new Date(b.deadlineISO).getTime() : Infinity;
              return ad - bd;
            })
            .map((g) => (
              <GoalCard
                key={g.id}
                g={g}
                accountId={accountId}
                notify={notify}
                onAdd={(amt) => {
                  contribute(g.id, amt);
                  notify(t("savings.toast.added", { amt: amt.toFixed(2), label: g.label }), "success");
                }}
                onWithdraw={(amt) => {
                  contribute(g.id, -amt);
                  notify(t("savings.toast.withdrew", { amt: amt.toFixed(2), label: g.label }), "info");
                }}
                onReset={() => {
                  if (confirm(t("savings.confirm.reset", { label: g.label }))) {
                    reset(g.id);
                    notify(t("savings.toast.reset", { label: g.label }), "info");
                  }
                }}
                onDelete={() => {
                  if (confirm(t("savings.confirm.delete", { label: g.label }))) {
                    remove(g.id);
                    notify(t("savings.toast.deleted", { label: g.label }), "info");
                  }
                }}
              />
            ))}
        </div>
      )}
    </section>
  );
}

function GoalCard({
  g,
  accountId,
  notify,
  onAdd,
  onWithdraw,
  onReset,
  onDelete,
}: {
  g: SavingsGoal;
  accountId: string;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
  onAdd: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [amt, setAmt] = useState<string>("");
  const [shareOpen, setShareOpen] = useState<boolean>(false);
  const forecast: GoalForecast = forecastGoal(g, t);
  const color = ICON_COLOR[g.icon];
  const completed = forecast.status === "completed";
  const remainingAec = Math.max(0, g.targetAec - g.currentAec);
  const suggestedContributionAec = Math.max(
    1,
    Math.min(remainingAec || 10, Math.round(remainingAec / 4) || 5),
  );
  const shareUrl = useMemo(
    () =>
      absoluteRequestUrl({
        to: accountId,
        amount: suggestedContributionAec,
        memo: t("savings.share.memo", { label: g.label }),
      }),
    [accountId, suggestedContributionAec, g.label, t],
  );

  // Celebrate the null → set transition on completedAt.
  const prevCompleted = useRef<boolean>(!!g.completedAt);
  const [celebrate, setCelebrate] = useState<boolean>(false);
  useEffect(() => {
    const now = !!g.completedAt;
    if (now && !prevCompleted.current) {
      setCelebrate(true);
      const id = window.setTimeout(() => setCelebrate(false), 1800);
      return () => window.clearTimeout(id);
    }
    prevCompleted.current = now;
  }, [g.completedAt]);

  const statusColor =
    forecast.status === "completed"
      ? "#059669"
      : forecast.status === "onTrack"
        ? "#0f766e"
        : forecast.status === "behind"
          ? "#dc2626"
          : "#94a3b8";

  const apply = (mode: "add" | "withdraw") => {
    const n = parseFloat(amt);
    if (!Number.isFinite(n) || n <= 0) return;
    if (mode === "add") onAdd(n);
    else onWithdraw(n);
    setAmt("");
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${color}33`,
        background: completed
          ? `linear-gradient(135deg, ${color}10, rgba(5,150,105,0.06))`
          : "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative" as const,
        overflow: "hidden",
      }}
    >
      {celebrate ? <ConfettiBurst color={color} /> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${color}18`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          {ICON_SYMBOL[g.icon]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
            }}
          >
            {g.label}
          </div>
          <div style={{ fontSize: 11, color: statusColor, fontWeight: 700, marginTop: 1 }}>
            {forecast.hint}
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <button
            onClick={() => setShareOpen(true)}
            aria-label={t("savings.card.aria.share", { label: g.label })}
            title={t("savings.card.share")}
            style={{
              background: "transparent",
              border: "none",
              color: color,
              fontSize: 14,
              cursor: "pointer",
              padding: 4,
              fontWeight: 900,
            }}
          >
            ⇱
          </button>
          <button
            onClick={onDelete}
            aria-label={t("savings.card.aria.delete", { label: g.label })}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: 16,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {shareOpen ? (
        <GoalShareModal
          goal={g}
          shareUrl={shareUrl}
          suggestedAec={suggestedContributionAec}
          color={color}
          onClose={() => setShareOpen(false)}
          notify={notify}
        />
      ) : null}

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            marginBottom: 4,
          }}
        >
          <span style={{ fontWeight: 700, color: "#0f172a" }}>
            <Money aec={g.currentAec} />
            <span style={{ color: "#94a3b8" }}> / <Money aec={g.targetAec} decimals={0} /></span>
          </span>
          <span style={{ fontWeight: 800, color }}>{forecast.progressPct.toFixed(0)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(forecast.progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${g.label}: ${forecast.progressPct.toFixed(0)}%`}
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(15,23,42,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${forecast.progressPct}%`,
              height: "100%",
              background: completed
                ? "linear-gradient(90deg, #059669, #10b981)"
                : `linear-gradient(90deg, ${color}, ${color}bb)`,
              transition: "width 400ms ease",
            }}
          />
        </div>
      </div>

      {completed ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onReset} style={{ ...btnSecondary, flex: 1 }}>
            {t("savings.card.withdrawAll")}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            onKeyDown={(e) => {
              if (e.key === "Enter") apply("add");
            }}
            style={{ ...inputStyle, flex: 1 }}
            aria-label={t("savings.card.aria.amount")}
          />
          <button
            onClick={() => apply("add")}
            aria-label={t("savings.card.aria.add", { label: g.label })}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              background: color,
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {t("savings.card.add")}
          </button>
          <button
            onClick={() => apply("withdraw")}
            aria-label={t("savings.card.aria.withdraw", { label: g.label })}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${color}`,
              background: "#fff",
              color,
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            −
          </button>
        </div>
      )}
    </div>
  );
}

function ConfettiBurst({ color }: { color: string }) {
  const [prm, setPrm] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrm(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const pieces = useMemo(() => {
    const palette = [color, "#059669", "#d97706", "#0ea5e9", "#db2777"];
    return Array.from({ length: 14 }, (_, i) => ({
      key: i,
      left: 50 + (Math.random() - 0.5) * 40,
      tx: (Math.random() - 0.5) * 220,
      ty: -60 - Math.random() * 140,
      rot: (Math.random() - 0.5) * 520,
      size: 6 + Math.random() * 6,
      delay: Math.random() * 120,
      color: palette[i % palette.length],
    }));
  }, [color]);

  if (prm) return null;

  return (
    <>
      <style>{`
        @keyframes aevion-goal-confetti {
          0%   { transform: translate(-50%, -50%) translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        {pieces.map((p) => (
          <span
            key={p.key}
            style={
              {
                position: "absolute",
                top: "62%",
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                borderRadius: 2,
                background: p.color,
                transform: "translate(-50%, -50%)",
                animation: `aevion-goal-confetti 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) ${p.delay}ms forwards`,
                "--tx": `${p.tx}px`,
                "--ty": `${p.ty}px`,
                "--rot": `${p.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}

function GoalShareModal({
  goal,
  shareUrl,
  suggestedAec,
  color,
  onClose,
  notify,
}: {
  goal: SavingsGoal;
  shareUrl: string;
  suggestedAec: number;
  color: string;
  onClose: () => void;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      notify(t("savings.share.toast.copied"), "success");
    } catch {
      notify(t("savings.share.toast.blocked"), "error");
    }
  };

  const doNativeShare = async () => {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (!nav.share) {
      await doCopy();
      return;
    }
    try {
      await nav.share({
        title: t("savings.share.native.title", { label: goal.label }),
        text: t("savings.share.native.text"),
        url: shareUrl,
      });
    } catch {
      // User cancelled — don't bother them with a toast.
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${goal.label}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 24px 48px rgba(15,23,42,0.22)",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>
              {t("savings.share.title", { label: goal.label })}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              {t("savings.share.subtitle", { amt: suggestedAec.toFixed(0) })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("savings.share.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: 18,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <QRCodeView value={shareUrl} size={200} />
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#475569",
            fontFamily: "ui-monospace, monospace",
            padding: "6px 10px",
            background: "rgba(15,23,42,0.04)",
            borderRadius: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={shareUrl}
        >
          {shareUrl}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => void doCopy()}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${color}44`,
              background: "#fff",
              color,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t("savings.share.copy")}
          </button>
          <button
            type="button"
            onClick={() => void doNativeShare()}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: color,
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t("savings.share.share")}
          </button>
        </div>

        <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.45 }}>
          {t("savings.share.footer")}
        </div>
      </div>
    </div>
  );
}
