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

export type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant, durationMs?: number) => void;
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
    (message: string, variant: ToastVariant = "info", durationMs?: number) => {
      const id = nextId();
      const fallback =
        variant === "error" ? 7000 : variant === "success" ? 4800 : 5200;
      const ms = typeof durationMs === "number" && durationMs > 0 ? durationMs : fallback;
      setToasts((prev) => [...prev, { id, message, variant }]);
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
              ? { bg: "rgba(6, 95, 70, 0.94)", border: "rgba(16, 185, 129, 0.45)" }
              : t.variant === "error"
                ? { bg: "rgba(127, 29, 29, 0.94)", border: "rgba(248, 113, 113, 0.5)" }
                : { bg: "rgba(15, 23, 42, 0.92)", border: "rgba(148, 163, 184, 0.45)" };
          return (
            <div
              key={t.id}
              className="aevion-toast-enter"
              role="status"
              style={{
                pointerEvents: "auto",
                padding: "12px 14px",
                borderRadius: 12,
                color: "#f8fafc",
                fontSize: 14,
                lineHeight: 1.45,
                fontWeight: 600,
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
              }}
            >
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
