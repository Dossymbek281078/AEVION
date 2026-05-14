"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

export type RelatedModule = {
  id: string;       // route slug, e.g. "psyapp-deps" or "healthai"
  title: string;    // "PsyApp" or "HealthAI"
  summary: string;  // one-line teaser
};

export type PlanningLandingProps = {
  id: string;            // backend module id, e.g. "qgood"
  code: string;          // short code, e.g. "QGOOD"
  highlightLetter: string; // first letter for color accent, e.g. "Q"
  highlightColor: string; // tailwind color name, e.g. "emerald"
  badge: "IDEA" | "PLANNING" | "RESEARCH" | "PRE-LAUNCH";
  heroTagline: string;   // "Mental Health · AI"
  heroTitle: string;     // "Mind, supported."
  heroAccent: string;    // gradient-accent words, e.g. "supported."
  heroSubtitle: string;  // paragraph below title
  features: { t: string; d: string }[];
  relatedModules?: RelatedModule[];
};

type Status = {
  phase: string;
  eta: string;
  waitlistCount: number;
  principles?: string[];
  milestones?: { id: string; label: string; status: string }[];
};

const COLORS: Record<string, { pill: string; pillText: string; accent: string; from: string; to: string; btn: string; btnHover: string; ring: string }> = {
  emerald: { pill: "bg-emerald-900/40 border-emerald-800", pillText: "text-emerald-300", accent: "text-emerald-400", from: "from-emerald-400", to: "to-teal-400", btn: "bg-emerald-700", btnHover: "hover:bg-emerald-600", ring: "focus:border-emerald-600" },
  cyan: { pill: "bg-cyan-900/40 border-cyan-800", pillText: "text-cyan-300", accent: "text-cyan-400", from: "from-cyan-400", to: "to-blue-400", btn: "bg-cyan-700", btnHover: "hover:bg-cyan-600", ring: "focus:border-cyan-600" },
  amber: { pill: "bg-amber-900/40 border-amber-800", pillText: "text-amber-300", accent: "text-amber-400", from: "from-amber-400", to: "to-orange-400", btn: "bg-amber-700", btnHover: "hover:bg-amber-600", ring: "focus:border-amber-600" },
  rose: { pill: "bg-rose-900/40 border-rose-800", pillText: "text-rose-300", accent: "text-rose-400", from: "from-rose-400", to: "to-pink-400", btn: "bg-rose-700", btnHover: "hover:bg-rose-600", ring: "focus:border-rose-600" },
  violet: { pill: "bg-violet-900/40 border-violet-800", pillText: "text-violet-300", accent: "text-violet-400", from: "from-violet-400", to: "to-fuchsia-400", btn: "bg-violet-700", btnHover: "hover:bg-violet-600", ring: "focus:border-violet-600" },
  sky: { pill: "bg-sky-900/40 border-sky-800", pillText: "text-sky-300", accent: "text-sky-400", from: "from-sky-400", to: "to-indigo-400", btn: "bg-sky-700", btnHover: "hover:bg-sky-600", ring: "focus:border-sky-600" },
};

function StatusPill({ moduleId, color }: { moduleId: string; color: string }) {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/${moduleId}/status`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Status | null) => {
        if (cancelled || !data) return;
        setS(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [moduleId]);
  const c = COLORS[color] ?? COLORS.emerald;
  return (
    <div className="flex flex-wrap gap-2 text-[11px] font-mono">
      <span className={`${c.pill} ${c.pillText} border px-2.5 py-1 rounded-full`}>phase: {s?.phase ?? "…"}</span>
      <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full">eta: {s?.eta ?? "…"}</span>
      <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full">waitlist: {s?.waitlistCount ?? "…"}</span>
    </div>
  );
}

type EtaInfo = {
  eta: string;
  etaDate: string | null;
  daysUntil: number | null;
  weeksUntil: number | null;
  isPast: boolean;
  tbd: boolean;
};

function formatLaunchDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Live countdown to launch. Renders nothing for TBD modules. Updates every
 * 60s so the day-count stays accurate if the user keeps the page open
 * across midnight.
 */
function EtaCountdown({ moduleId, color }: { moduleId: string; color: string }) {
  const [info, setInfo] = useState<EtaInfo | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/${moduleId}/eta`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: EtaInfo | null) => {
        if (cancelled || !data) return;
        setInfo(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!info || info.tbd || !info.etaDate) return null;

  const c = COLORS[color] ?? COLORS.emerald;
  const targetMs = new Date(info.etaDate).getTime();
  const liveDays = Math.round((targetMs - now) / 86_400_000);

  if (info.isPast || liveDays < 0) {
    return (
      <div className="text-xs text-slate-500 font-mono">
        запуск ожидался: {formatLaunchDate(info.etaDate)} · уточняем дату
      </div>
    );
  }

  const weeks = Math.round(liveDays / 7);
  const months = Math.round(liveDays / 30);
  const bigNumber = liveDays >= 90 ? months : liveDays >= 21 ? weeks : liveDays;
  const unit = liveDays >= 90 ? "мес." : liveDays >= 21 ? "нед." : liveDays === 1 ? "день" : "дн.";

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className={`text-3xl font-black tabular-nums ${c.accent}`}>{bigNumber}</div>
      <div className="text-slate-400 leading-tight">
        <div className="text-xs uppercase tracking-wider text-slate-500">{unit} до запуска</div>
        <div className="text-xs text-slate-500">
          цель: {formatLaunchDate(info.etaDate)} ({info.eta})
        </div>
      </div>
    </div>
  );
}

type ShareState = "idle" | "shared" | "copied" | "error";

/**
 * Share button — uses Web Share API when available (mobile), falls back to
 * a Twitter intent + clipboard copy on desktop.
 */
function ShareButton({
  moduleId,
  code,
  heroTitle,
  color,
}: {
  moduleId: string;
  code: string;
  heroTitle: string;
  color: string;
}) {
  const c = COLORS[color] ?? COLORS.emerald;
  const [state, setState] = useState<ShareState>("idle");

  async function onClick() {
    const shareUrl =
      typeof window !== "undefined" ? window.location.origin + "/" + moduleId : `https://aevion.app/${moduleId}`;
    const shareText = `AEVION ${code} — ${heroTitle}. Жду запуск:`;

    // Prefer native share (mobile / supported browsers)
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `AEVION ${code}`, text: shareText, url: shareUrl });
        setState("shared");
        return;
      } catch (err) {
        // AbortError (user cancelled) → silently ignore, no state change
        if (err instanceof DOMException && err.name === "AbortError") return;
        // fall through to fallback
      }
    }

    // Fallback: open Twitter intent + copy URL
    const tweetUrl =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(shareText) +
      "&url=" +
      encodeURIComponent(shareUrl);

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setState("copied");
      }
    } catch {
      setState("error");
    }

    if (typeof window !== "undefined") {
      window.open(tweetUrl, "_blank", "noopener,noreferrer");
    }
  }

  // Reset state back to idle after a short delay so the user can share again
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);

  const label =
    state === "shared"
      ? "Спасибо!"
      : state === "copied"
        ? "Ссылка скопирована"
        : state === "error"
          ? "Не удалось"
          : "Поделиться";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-2.5 ${c.btn} ${c.btnHover} text-white rounded-lg text-sm font-semibold inline-flex items-center gap-2`}
      aria-label="Поделиться этим лендингом"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {label}
    </button>
  );
}

function WaitlistForm({ moduleId, color }: { moduleId: string; color: string }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const c = COLORS[color] ?? COLORS.emerald;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(apiUrl(`/api/${moduleId}/waitlist`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ kind: "err", text: data?.error || `HTTP ${r.status}` });
        return;
      }
      setMsg({
        kind: "ok",
        text: data.alreadyJoined
          ? "Вы уже в списке. Уведомим при запуске."
          : "Готово — вы в списке. Уведомим при запуске.",
      });
      setEmail("");
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-md">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="you@domain.com"
        className={`flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none ${c.ring}`}
      />
      <button
        type="submit"
        disabled={busy || !email}
        className={`px-4 py-2 ${c.btn} ${c.btnHover} disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-sm font-semibold`}
      >
        {busy ? "…" : "Join waitlist"}
      </button>
      {msg && (
        <div className={`text-xs sm:basis-full ${msg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>
          {msg.text}
        </div>
      )}
    </form>
  );
}

function MilestoneList({ moduleId }: { moduleId: string }) {
  const [items, setItems] = useState<Status["milestones"]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/${moduleId}/status`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Status | null) => {
        if (cancelled || !data?.milestones) return;
        setItems(data.milestones);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [moduleId]);
  if (!items || !items.length) return null;
  return (
    <div className="space-y-2">
      {items.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
        >
          <span className="text-sm">{m.label}</span>
          <span className="text-[10px] font-mono uppercase text-slate-500">{m.status}</span>
        </div>
      ))}
    </div>
  );
}

function buildJsonLd(props: PlanningLandingProps) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `AEVION ${props.code}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: props.heroSubtitle,
    url: `https://aevion.app/${props.id}`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: props.features.map((f) => f.t),
    publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
    softwareVersion: "preview",
    releaseNotes: `Status: ${props.badge}. Live status: https://api.aevion.app/api/${props.id}/status`,
  };
}

export default function PlanningLanding(props: PlanningLandingProps) {
  const c = COLORS[props.highlightColor] ?? COLORS.emerald;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(props)) }}
      />
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">← AEVION</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">
            <span className={c.accent}>{props.highlightLetter}</span>
            {props.code.slice(1)}
          </h1>
          <span className={`text-[10px] ${c.pill} ${c.pillText} px-2 py-0.5 rounded-full`}>{props.badge}</span>
        </div>
        <Link
          href="https://github.com/Dossymbek281078/AEVION"
          className="text-xs text-slate-400 hover:text-white"
        >
          GitHub →
        </Link>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-6">
        <div className={`inline-block px-3 py-1 ${c.pill} ${c.pillText} rounded-full text-xs font-semibold uppercase tracking-wider`}>
          {props.heroTagline}
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">
          {props.heroTitle.replace(props.heroAccent, "")}
          <span className={`bg-gradient-to-r ${c.from} ${c.to} bg-clip-text text-transparent`}>
            {props.heroAccent}
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">{props.heroSubtitle}</p>
        <StatusPill moduleId={props.id} color={props.highlightColor} />
        <EtaCountdown moduleId={props.id} color={props.highlightColor} />
        <div className="space-y-2 pt-2">
          <div className="text-sm text-slate-400">Уведомим при запуске. Без спама, отписка одним кликом.</div>
          <WaitlistForm moduleId={props.id} color={props.highlightColor} />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <ShareButton
            moduleId={props.id}
            code={props.code}
            heroTitle={props.heroTitle}
            color={props.highlightColor}
          />
          <Link
            href={`https://api.aevion.app/api/${props.id}/status`}
            className="px-5 py-2.5 border border-slate-700 hover:bg-slate-900 rounded-lg text-sm font-semibold"
          >
            Live status JSON →
          </Link>
          <Link
            href={`https://api.aevion.app/api/${props.id}/openapi.json`}
            className="px-5 py-2.5 border border-slate-700 hover:bg-slate-900 rounded-lg text-sm font-semibold"
          >
            OpenAPI spec
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <h2 className="text-3xl font-black">Принципы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {props.features.map((f) => (
            <div key={f.t} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-lg font-bold mb-2">{f.t}</div>
              <div className="text-sm text-slate-400 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-6 border-t border-slate-800">
        <h2 className="text-3xl font-black">Roadmap</h2>
        <MilestoneList moduleId={props.id} />
      </section>

      {props.relatedModules && props.relatedModules.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-12 space-y-6 border-t border-slate-800">
          <h2 className="text-3xl font-black">Связано в AEVION</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {props.relatedModules.map((m) => (
              <Link
                key={m.id}
                href={`/${m.id}`}
                className="block bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-5 transition-colors"
              >
                <div className="text-lg font-bold mb-1">{m.title}</div>
                <div className="text-sm text-slate-400 leading-relaxed">{m.summary}</div>
                <div className={`text-xs ${c.accent} mt-2`}>→ Открыть</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
