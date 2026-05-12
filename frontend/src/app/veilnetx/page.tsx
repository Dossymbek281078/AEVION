"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = { phase: string; eta: string; version: string; waitlistCount: number };

const FEATURES = [
  { t: "🧅 Tor-routed", d: "Каждый запрос проходит минимум 3 узла Tor — никто не знает источник + назначение одновременно." },
  { t: "🔇 No logs", d: "Серверы не пишут access-логи. Соглашение публикуется в audit report ежеквартально." },
  { t: "🪪 No KYC", d: "Регистрация — anonymous wallet или одноразовый код. Без email, без телефона." },
  { t: "🛡 Anti-fingerprint", d: "Подмена User-Agent, canvas, WebGL, fonts. Все соединения выглядят как обычный Chrome." },
  { t: "📂 Open-source", d: "Все клиенты (CLI, Electron desktop, mobile) — на GitHub под GPLv3. Воспроизводимые билды." },
  { t: "⚡ Wireguard fast-path", d: "Для not-paranoid режима — прямой WG-туннель без Tor (10x быстрее, без скрытия источника)." },
];

function StatusPill() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api-backend/api/veilnetx/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Status | null) => {
        if (cancelled || !data) return;
        setS({ phase: data.phase, eta: data.eta, version: data.version, waitlistCount: data.waitlistCount });
      })
      .catch((err) => {
        console.warn("[veilnetx/page] status probe failed", err instanceof Error ? err.message : err);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="flex flex-wrap gap-2 text-[11px] font-mono">
      <span className="bg-cyan-950/40 border border-cyan-800 text-cyan-300 px-2.5 py-1 rounded-full">
        phase: {s?.phase ?? "…"}
      </span>
      <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
        eta: {s?.eta ?? "…"}
      </span>
      <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
        v{s?.version ?? "…"}
      </span>
      <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
        waitlist: {s?.waitlistCount ?? "…"}
      </span>
    </div>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api-backend/api/veilnetx/waitlist", {
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
        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
      />
      <button
        type="submit"
        disabled={busy || !email}
        className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-sm font-semibold"
      >
        {busy ? "…" : "Join waitlist"}
      </button>
      {msg && (
        <div
          className={`text-xs sm:basis-full ${
            msg.kind === "ok" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {msg.text}
        </div>
      )}
    </form>
  );
}

export default function VeilNetXLanding() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION VeilNetX",
            applicationCategory: "SecurityApplication",
            operatingSystem: "Linux, macOS, Windows, iOS, Android",
            description:
              "Privacy proxy with Tor-routing, no logs, no KYC, anti-fingerprinting, and open-source clients.",
            url: "https://aevion.app/veilnetx",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: FEATURES.map(f => f.t),
            publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
          }),
        }}
      />

      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">← AEVION</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">
            <span className="text-cyan-400">V</span>eilNetX
          </h1>
          <span className="text-[10px] bg-cyan-900 text-cyan-300 px-2 py-0.5 rounded-full">PRE-LAUNCH</span>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-6">
        <div className="inline-block px-3 py-1 bg-cyan-900/40 border border-cyan-800 rounded-full text-xs text-cyan-300 font-semibold uppercase tracking-wider">
          Privacy network · Tor-routed
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">
          Privacy that{" "}
          <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            actually exists.
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
          Не «обещаем» приватность — её невозможно у нас отнять. Серверы не пишут
          логи. KYC нет. Tor-routing включён по умолчанию. Клиенты open-source с
          воспроизводимыми билдами.
        </p>
        <StatusPill />
        <div className="space-y-2 pt-2">
          <div className="text-sm text-slate-400">
            Запуск Q4 2026. Подпишитесь — уведомим первыми.
          </div>
          <WaitlistForm />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="https://api.aevion.app/api/veilnetx/status"
            className="px-5 py-2.5 border border-slate-700 hover:bg-slate-900 rounded-lg text-sm font-semibold"
          >
            Live status JSON →
          </Link>
          <Link
            href="https://github.com/Dossymbek281078/AEVION"
            className="px-5 py-2.5 border border-slate-700 hover:bg-slate-900 rounded-lg text-sm font-semibold"
          >
            Watch on GitHub →
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <h2 className="text-3xl font-black">Принципы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FEATURES.map(f => (
            <div key={f.t} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-lg font-bold mb-2">{f.t}</div>
              <div className="text-sm text-slate-400 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 space-y-6 text-center border-t border-slate-800">
        <h2 className="text-3xl font-black">Threat model</h2>
        <div className="text-left grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          <div className="bg-emerald-950/30 border border-emerald-800 rounded-xl p-5">
            <div className="text-emerald-400 font-bold mb-2">✅ Защищает от</div>
            <ul className="text-sm text-slate-300 space-y-1.5">
              <li>· Глобальный пассивный наблюдатель (ISP, государственный пакетный сниффер)</li>
              <li>· Контент-цензура (DPI, SNI-блокировки)</li>
              <li>· Browser fingerprinting</li>
              <li>· Утечки DNS / WebRTC</li>
            </ul>
          </div>
          <div className="bg-red-950/30 border border-red-800 rounded-xl p-5">
            <div className="text-red-400 font-bold mb-2">⚠ НЕ защищает от</div>
            <ul className="text-sm text-slate-300 space-y-1.5">
              <li>· Malware / keylogger на вашем устройстве</li>
              <li>· Логин в Google + посещение запрещённого сайта (де-анонимизация)</li>
              <li>· Targeted attack на сам Tor (NSA-level)</li>
              <li>· Социальная инженерия</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
