"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; text: string; tone: ToastTone; createdAt: number };

type ToastContextValue = {
  push: (text: string, tone?: ToastTone) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
};

const ToastCtx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((text: string, tone: ToastTone = "info") => {
    if (!text || typeof text !== "string") return;
    idRef.current += 1;
    const id = idRef.current;
    setItems((prev) => [...prev, { id, text, tone, createdAt: Date.now() }]);
    // auto-dismiss after 5s; errors stay 8s
    const ttl = tone === "error" ? 8000 : 5000;
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  }, []);

  const value: ToastContextValue = {
    push,
    success: (t) => push(t, "success"),
    error: (t) => push(t, "error"),
    info: (t) => push(t, "info"),
  };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={(id) =>
        setItems((prev) => prev.filter((t) => t.id !== id))
      } />
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx);
  // No-op fallback so callers don't need to be inside a provider in tests.
  if (!ctx) {
    return {
      push: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: Toast[];
  onDismiss: (id: number) => void;
}) {
  // Skip during SSR — we render nothing on server, then mount once on client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tone =
    toast.tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
      : toast.tone === "error"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
        : "border-white/15 bg-white/5 text-slate-100";
  const icon = toast.tone === "success" ? "✓" : toast.tone === "error" ? "✕" : "ℹ";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2 text-sm shadow-lg shadow-black/30 backdrop-blur ${tone}`}
    >
      <span className="mt-0.5 select-none text-base leading-none">{icon}</span>
      <div className="flex-1 whitespace-pre-wrap break-words">{toast.text}</div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-1 rounded text-xs opacity-60 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
