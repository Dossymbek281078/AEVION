"use client";

import { useReportWebVitals } from "next/web-vitals";

// Web Vitals reporter — собирает Core Web Vitals (CLS / FCP / LCP / FID / TTFB
// / INP) и логирует в console. Production-ready hook для analytics:
// заменить console.log на send-to-endpoint когда подключим backend.

type Metric = {
  id: string;
  name: string;
  label: string;
  value: number;
  delta?: number;
  rating?: "good" | "needs-improvement" | "poor";
};

const RATING_COLOR: Record<string, string> = {
  good: "#16a34a",
  "needs-improvement": "#ca8a04",
  poor: "#dc2626",
};

const FORMAT_MS = new Set(["FCP", "LCP", "FID", "TTFB", "INP"]);

function fmtValue(name: string, value: number): string {
  if (FORMAT_MS.has(name)) return `${value.toFixed(0)}ms`;
  if (name === "CLS") return value.toFixed(3);
  return String(value);
}

export function WebVitals() {
  useReportWebVitals((metric: Metric) => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    const color = metric.rating ? RATING_COLOR[metric.rating] : "#64748b";
    const value = fmtValue(metric.name, metric.value);
    // Single console.log с цветом для DevTools — лёгкий, не блокирует.
    // eslint-disable-next-line no-console
    console.log(
      `%c[web-vitals] ${metric.name}%c ${value}${metric.rating ? ` · ${metric.rating}` : ""}`,
      `color:${color};font-weight:bold`,
      "color:inherit;font-weight:normal",
    );
    // Forward to backend через beacon API (если future endpoint появится)
    // try {
    //   navigator.sendBeacon("/api/metrics", JSON.stringify({ ...metric, ts: Date.now() }));
    // } catch {}
  });
  return null;
}
