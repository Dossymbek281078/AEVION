"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

type PillarStatus = "loading" | "ok" | "down" | "unknown";

interface Pillar {
  key: string;
  emoji: string;
  label: string;
  endpoint: string;
  href: string;
  desc: string;
}

const PILLARS: Pillar[] = [
  {
    key: "finance",
    emoji: "💰",
    label: "Finance",
    endpoint: "/api/qpaynet/health",
    href: "/qpaynet",
    desc: "QPayNet — платежи, выплаты, депозиты.",
  },
  {
    key: "health",
    emoji: "🩺",
    label: "Health",
    endpoint: "/api/healthai/health",
    href: "/healthai",
    desc: "HealthAI — триаж, screener, план.",
  },
  {
    key: "communication",
    emoji: "💬",
    label: "Communication",
    endpoint: "/api/multichat/health",
    href: "/multichat-engine",
    desc: "Multichat — диалоги через несколько LLM.",
  },
  {
    key: "ai",
    emoji: "🧠",
    label: "AI",
    endpoint: "/api/qcoreai/health",
    href: "/qcoreai",
    desc: "QCoreAI — единый AI-провайдер AEVION.",
  },
  {
    key: "data",
    emoji: "📊",
    label: "Data",
    endpoint: "/api/aevion/health",
    href: "/modules",
    desc: "AEVION registry — статус 27 модулей.",
  },
  {
    key: "identity",
    emoji: "🪪",
    label: "Identity",
    endpoint: "/api/auth/health",
    href: "/auth",
    desc: "Auth — сессии, верификация, audit.",
  },
];

const INSIGHTS = [
  {
    emoji: "🌙",
    title: "Sleep 6h tonight — skip late call at 22:30",
    body: "HealthAI HRV ↓ 18%, Multichat показывает звонок с +7… в 22:30. Перенесём на 09:00?",
    src: "HealthAI × Multichat",
  },
  {
    emoji: "💸",
    title: "Spend on coffee = 23% of food budget",
    body: "QPayNet видит 14 транзакций ☕ за неделю. QCoreAI предлагает лимит 2/день.",
    src: "QPayNet × QCoreAI",
  },
  {
    emoji: "📞",
    title: "Вы реже звоните, когда HRV падает",
    body: "Корреляция 0.71 за 30 дней. Multichat подскажет 1 звонок другу когда метрика просядет снова.",
    src: "HealthAI × Multichat",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AEVION QLife",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  description:
    "Personal OS — shell над работающими модулями AEVION (Finance, Health, Communication, AI, Data, Identity).",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

function StatusPill({ status, sub }: { status: PillarStatus; sub?: string }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700/60 px-2 py-0.5 text-[11px] font-medium text-slate-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
        loading…
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/40">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        live{sub ? ` · ${sub}` : ""}
      </span>
    );
  }
  if (status === "down") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300 ring-1 ring-rose-500/40">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        down
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/40">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      unknown
    </span>
  );
}

export default function QLifePage() {
  const [statuses, setStatuses] = useState<Record<string, { status: PillarStatus; sub?: string }>>(
    () => Object.fromEntries(PILLARS.map((p) => [p.key, { status: "loading" as PillarStatus }])),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        PILLARS.map(async (p) => {
          const r = await fetch(apiUrl(p.endpoint), { cache: "no-store" });
          let body: any = null;
          try {
            body = await r.json();
          } catch {
            /* ignore */
          }
          return { key: p.key, ok: r.ok, body };
        }),
      );
      if (cancelled) return;
      const next: Record<string, { status: PillarStatus; sub?: string }> = {};
      results.forEach((res, i) => {
        const p = PILLARS[i];
        if (res.status !== "fulfilled") {
          next[p.key] = { status: "down" };
          return;
        }
        const { ok, body } = res.value;
        if (!ok) {
          next[p.key] = { status: "down" };
          return;
        }
        // /api/aevion/health → "X/Y healthy"
        if (p.key === "data" && body && typeof body === "object") {
          const healthy = body.healthy ?? body.summary?.healthy;
          const total = body.total ?? body.summary?.total ?? body.count;
          if (typeof healthy === "number" && typeof total === "number") {
            next[p.key] = { status: "ok", sub: `${healthy}/${total} healthy` };
            return;
          }
        }
        const flag =
          body?.ok ?? body?.status ?? (typeof body === "object" && body !== null ? "ok" : null);
        if (flag === false || flag === "down" || flag === "error") {
          next[p.key] = { status: "down" };
          return;
        }
        if (flag === null) {
          next[p.key] = { status: "unknown" };
          return;
        }
        next[p.key] = { status: "ok" };
      });
      setStatuses(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="text-sm text-slate-400 transition hover:text-emerald-300"
          >
            ← AEVION · <span className="font-semibold text-emerald-300">QLife</span> ·{" "}
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
              MVP
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="/modules" className="hover:text-emerald-300">
              Modules
            </Link>
            <Link href="/globus" className="hover:text-emerald-300">
              Globus
            </Link>
            <Link href="/pitch" className="hover:text-emerald-300">
              Pitch
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Personal Operating System
        </p>
        <h1 className="text-balance text-4xl font-bold leading-tight md:text-5xl">
          Your entire life in{" "}
          <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
            one OS.
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          QLife — это shell над работающими модулями AEVION. Один интерфейс над 6 столпами
          цифровой жизни: финансы, здоровье, коммуникации, AI, данные, identity. Live-статус
          ниже.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          6 Pillars · Live
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const s = statuses[p.key] ?? { status: "loading" as PillarStatus };
            return (
              <Link
                key={p.key}
                href={p.href}
                className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-emerald-500/50 hover:bg-slate-900/70"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="font-semibold text-slate-100">{p.label}</span>
                  </div>
                  <StatusPill status={s.status} sub={s.sub} />
                </div>
                <p className="mb-3 text-sm text-slate-400">{p.desc}</p>
                <code className="mt-auto truncate font-mono text-[11px] text-slate-500 group-hover:text-emerald-300/80">
                  {p.endpoint}
                </code>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-12">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
          AEVION Cross-Module Insights
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          AI видит данные через границы модулей. Иллюстративные примеры.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {INSIGHTS.map((it) => (
            <div
              key={it.title}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
            >
              <div className="mb-2 text-2xl">{it.emoji}</div>
              <h3 className="mb-2 font-semibold text-emerald-100">{it.title}</h3>
              <p className="mb-3 text-sm text-slate-300">{it.body}</p>
              <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                {it.src}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Глубже в экосистему</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/modules"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-300"
            >
              📦 Все модули AEVION
            </Link>
            <Link
              href="/globus"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-300"
            >
              🌐 Globus · карта присутствия
            </Link>
            <Link
              href="/pitch"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-300"
            >
              🎤 Pitch · для инвесторов
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
