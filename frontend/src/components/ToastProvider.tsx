"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";

export type ToastVariant = "success" | "error" | "info" | "warning";

// Optional call-to-action rendered inside the toast (e.g. "Тарифы →" pointing
// at an upgrade page). href is treated as an in-app route via next/link.
export type ToastAction = { label: string; href: string };

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: (
    message: string,
    variant?: ToastVariant,
    durationMs?: number,
    action?: ToastAction,
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const removeToast = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((x) => x.id !== id));
    },
    [clearTimer],
  );

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", durationMs?: number, action?: ToastAction) => {
      const id = nextId();
      const fallback =
        variant === "error" ? 7000 : variant === "warning" ? 6000 : variant === "success" ? 4800 : 5200;
      // A toast with an action gets a little longer on screen so it stays
      // clickable; explicit durationMs still wins.
      const base = action ? Math.max(fallback, 8000) : fallback;
      const ms = typeof durationMs === "number" && durationMs > 0 ? durationMs : base;
      setToasts((prev) => [...prev, { id, message, variant, action }]);
      const t = setTimeout(() => removeToast(id), ms);
      timers.current.set(id, t);
    },
    [removeToast],
  );

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="aevion-toast-stack"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: "min(420px, calc(100vw - 32px))",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const palette =
            t.variant === "success"
              ? { bg: "linear-gradient(135deg, rgba(6,95,70,0.96), rgba(15,118,110,0.96))", border: "rgba(16, 185, 129, 0.55)", icon: "✓", iconBg: "rgba(16,185,129,0.25)" }
              : t.variant === "error"
                ? { bg: "linear-gradient(135deg, rgba(127,29,29,0.96), rgba(153,27,27,0.96))", border: "rgba(248, 113, 113, 0.6)", icon: "✕", iconBg: "rgba(248,113,113,0.25)" }
                : t.variant === "warning"
                  ? { bg: "linear-gradient(135deg, rgba(120,53,15,0.96), rgba(146,64,14,0.96))", border: "rgba(245, 158, 11, 0.6)", icon: "!", iconBg: "rgba(245,158,11,0.25)" }
                  : { bg: "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.94))", border: "rgba(148, 163, 184, 0.5)", icon: "i", iconBg: "rgba(148,163,184,0.2)" };
          return (
            <div
              key={t.id}
              className="aevion-toast-enter"
              role="status"
              style={{
                pointerEvents: "auto",
                padding: "12px 14px",
                paddingRight: 36,
                borderRadius: 14,
                color: "#f8fafc",
                fontSize: 14,
                lineHeight: 1.45,
                fontWeight: 600,
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                boxShadow: "0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                position: "relative",
              }}
            >
              <div style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: palette.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 900,
                fontFamily: t.variant === "info" ? "Georgia, serif" : "system-ui",
                fontStyle: t.variant === "info" ? "italic" : "normal",
              }}>{palette.icon}</div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <span>{t.message}</span>
                {t.action && (
                  <Link
                    href={t.action.href}
                    onClick={() => removeToast(t.id)}
                    style={{
                      alignSelf: "flex-start",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.14)",
                      border: "1px solid rgba(255,255,255,0.28)",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: "none",
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.26)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.14)"; }}
                  >
                    {t.action.label}
                  </Link>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                aria-label={`Закрыть: ${t.message}`}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 10,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.65)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 900,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  transition: "background 120ms ease, color 120ms ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.18)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)"; }}
              >×</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
