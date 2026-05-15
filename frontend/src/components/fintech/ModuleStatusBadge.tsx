"use client";

/**
 * ModuleStatusBadge — small reusable badge showing health status of a fintech module.
 * Used across /fintech/status, /fintech/modules, /fintech/analytics.
 */

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type Status = "ok" | "degraded" | "down" | "loading";

interface Props {
  module: "qpaynet" | "veilnetx" | "qmaskcard" | "qgood" | "ztide" | "qchaingov";
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const HEALTH_PATH: Record<Props["module"], string> = {
  qpaynet:   "/api/qpaynet/health",
  veilnetx:  "/api/veilnetx/health",
  qmaskcard: "/api/qmaskcard/health",
  qgood:     "/api/qgood/health",
  ztide:     "/api/ztide/health",
  qchaingov: "/api/qchaingov/health",
};

const STATUS_CONFIG: Record<Status, { dot: string; label: string; text: string }> = {
  ok:       { dot: "bg-emerald-500 animate-pulse", label: "Live",     text: "text-emerald-400" },
  degraded: { dot: "bg-amber-500",                 label: "Degraded", text: "text-amber-400" },
  down:     { dot: "bg-red-500",                   label: "Down",     text: "text-red-400" },
  loading:  { dot: "bg-slate-600 animate-pulse",   label: "…",        text: "text-slate-500" },
};

export function ModuleStatusBadge({ module, size = "md", showLabel = true, className = "" }: Props) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(HEALTH_PATH[module]), { signal: AbortSignal.timeout(4000) })
      .then(r => { if (!cancelled) setStatus(r.ok ? "ok" : "degraded"); })
      .catch(() => { if (!cancelled) setStatus("down"); });
    return () => { cancelled = true; };
  }, [module]);

  const cfg = STATUS_CONFIG[status];
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`${dotSize} rounded-full ${cfg.dot}`} />
      {showLabel && (
        <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
      )}
    </span>
  );
}

/**
 * FintechModuleRow — compact row with module name + live status badge.
 * Useful for dashboards and sidebar lists.
 */
export function FintechModuleRow({ module, label, href }: { module: Props["module"]; label: string; href?: string }) {
  const content = (
    <span className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
      <span className="text-sm text-slate-300">{label}</span>
      <ModuleStatusBadge module={module} size="sm" />
    </span>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline">{content}</a>
    );
  }
  return <div>{content}</div>;
}
