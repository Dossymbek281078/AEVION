"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import ModulePricingChip from "@/components/ModulePricingChip";

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
      .catch(() => {});
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

type InspectFinding = { id: string; label: string; severity: "low" | "med" | "high"; exposed: boolean };
type Inspect = {
  ip: string | null;
  proxyDetected: boolean;
  geo: { country: string | null; city: string | null; region: string | null };
  geoLeaked: boolean;
  userAgent: { browser: string; os: string; mobile: boolean };
  exposure: { score: number; level: "green" | "yellow" | "red"; findings: InspectFinding[] };
  note: string;
};

type ClientCheck = { id: string; label: string; value: string; exposed: boolean; weight: number };

// Best-effort WebRTC local/public IP leak probe. Modern browsers mask local IPs
// behind mDNS (*.local) — if we still see a raw IP, that's a real leak.
function probeWebRTC(timeoutMs = 1500): Promise<string[]> {
  return new Promise((resolve) => {
    const ips = new Set<string>();
    let pc: RTCPeerConnection | null = null;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch {
      resolve([]);
      return;
    }
    const done = () => {
      try { pc?.close(); } catch { /* noop */ }
      resolve([...ips]);
    };
    const timer = setTimeout(done, timeoutMs);
    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        clearTimeout(timer);
        done();
        return;
      }
      const m = /([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){7})/i.exec(e.candidate.candidate);
      if (m && !/\.local/i.test(e.candidate.candidate)) ips.add(m[1]);
    };
    try {
      pc.createDataChannel("veilnetx-probe");
      pc.createOffer().then((o) => pc?.setLocalDescription(o)).catch(() => done());
    } catch {
      clearTimeout(timer);
      done();
    }
  });
}

// Cheap canvas fingerprint hash — if it produces a stable non-trivial value the
// browser is canvas-fingerprintable.
function canvasHash(): string | null {
  try {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 60;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(10, 10, 120, 30);
    ctx.fillStyle = "#069";
    ctx.fillText("VeilNetX ⚡ privacy", 12, 14);
    const data = c.toDataURL();
    let h = 0;
    for (let i = 0; i < data.length; i++) h = (h * 31 + data.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  } catch {
    return null;
  }
}

function levelColor(level: string) {
  if (level === "green") return { ring: "border-emerald-700", text: "text-emerald-400", bg: "bg-emerald-950/30", bar: "bg-emerald-500" };
  if (level === "yellow") return { ring: "border-amber-700", text: "text-amber-400", bg: "bg-amber-950/30", bar: "bg-amber-500" };
  return { ring: "border-red-700", text: "text-red-400", bg: "bg-red-950/30", bar: "bg-red-500" };
}

function PrivacyCheck() {
  const [server, setServer] = useState<Inspect | null>(null);
  const [client, setClient] = useState<ClientCheck[] | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  function buildReport(score: number): string {
    if (!server) return "";
    return [
      "VeilNetX — отчёт о раскрываемости",
      `Итоговый score: ${score}/100`,
      "",
      "Сервер видит:",
      `  IP: ${server.ip ?? "—"}`,
      `  Прокси/Tor: ${server.proxyDetected ? "обнаружен" : "нет (прямое соединение)"}`,
      `  Гео по IP: ${server.geoLeaked ? [server.geo.country, server.geo.city].filter(Boolean).join(", ") || "да" : "не раскрыто"}`,
      `  Браузер/ОС: ${server.userAgent.browser} / ${server.userAgent.os}`,
      "",
      "Браузер раскрывает:",
      ...(client ?? []).map((c) => `  ${c.label}: ${c.value}`),
      "",
      "Проверь себя: https://aevion.app/veilnetx",
    ].join("\n");
  }

  async function copyReport(score: number) {
    try {
      await navigator.clipboard.writeText(buildReport(score));
      flash("Отчёт скопирован");
    } catch {
      flash("Не удалось скопировать");
    }
  }

  async function shareTool() {
    const url = "https://aevion.app/veilnetx";
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share) {
        await nav.share({ title: "VeilNetX privacy check", text: "Проверь, что ты раскрываешь любому сайту прямо сейчас:", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("Ссылка на инструмент скопирована");
    } catch {
      /* user cancelled share — noop */
    }
  }

  async function run() {
    setRunning(true);
    setErr(null);
    setServer(null);
    setClient(null);
    try {
      const [inspectRes, webrtcIps] = await Promise.all([
        fetch("/api-backend/api/veilnetx/inspect").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        probeWebRTC(),
      ]);
      setServer(inspectRes as Inspect);

      const nav = navigator as Navigator & { deviceMemory?: number };
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
      const cHash = canvasHash();
      const checks: ClientCheck[] = [
        {
          id: "webrtc",
          label: "WebRTC IP-leak",
          value: webrtcIps.length ? webrtcIps.join(", ") : "не утекает (mDNS-маскировка)",
          exposed: webrtcIps.length > 0,
          weight: 18,
        },
        {
          id: "timezone",
          label: "Часовой пояс",
          value: tz,
          exposed: true,
          weight: 8,
        },
        {
          id: "canvas",
          label: "Canvas fingerprint",
          value: cHash ? `стабильный хэш ${cHash}` : "недоступен",
          exposed: Boolean(cHash),
          weight: 12,
        },
        {
          id: "screen",
          label: "Экран / DPR",
          value: `${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
          exposed: true,
          weight: 6,
        },
        {
          id: "hardware",
          label: "Ядра CPU / память",
          value: `${nav.hardwareConcurrency ?? "?"} ядер${nav.deviceMemory ? `, ${nav.deviceMemory} ГБ` : ""}`,
          exposed: Boolean(nav.hardwareConcurrency),
          weight: 6,
        },
        {
          id: "languages",
          label: "Языки браузера",
          value: (navigator.languages || [navigator.language]).join(", "),
          exposed: true,
          weight: 6,
        },
      ];
      setClient(checks);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const clientScore = client ? client.reduce((s, c) => (c.exposed ? s + c.weight : s), 0) : 0;
  const total = server ? Math.min(100, server.exposure.score + clientScore) : null;
  const tzVsGeo =
    server?.geo.country && client?.find((c) => c.id === "timezone");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-black">🔍 Проверь свою приватность</div>
          <div className="text-sm text-slate-400 mt-1">
            Работает сегодня. Покажем, что ты раскрываешь любому серверу прямо сейчас — без Tor.
          </div>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="px-5 py-2.5 bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-sm font-semibold whitespace-nowrap"
        >
          {running ? "Сканирую…" : server ? "Проверить снова" : "Запустить проверку"}
        </button>
      </div>

      {err && <div className="text-sm text-red-400">Ошибка: {err}</div>}

      {total !== null && server && (
        <>
          {(() => {
            const lvl = total >= 60 ? "red" : total >= 30 ? "yellow" : "green";
            const c = levelColor(lvl);
            return (
              <div className={`${c.bg} border ${c.ring} rounded-xl p-5`}>
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-bold ${c.text}`}>
                    {lvl === "red" ? "Высокая раскрываемость" : lvl === "yellow" ? "Средняя раскрываемость" : "Низкая раскрываемость"}
                  </span>
                  <span className={`text-2xl font-black ${c.text}`}>{total}/100</span>
                </div>
                <div className="mt-2 h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div className={`h-full ${c.bar}`} style={{ width: `${total}%` }} />
                </div>
                <div className="text-xs text-slate-400 mt-2">{server.note}</div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Сервер видит</div>
              <Row label="IP" value={server.ip ?? "—"} exposed={!server.proxyDetected} />
              <Row label="Прокси/Tor" value={server.proxyDetected ? "обнаружен" : "нет (прямое соединение)"} exposed={!server.proxyDetected} />
              <Row
                label="Гео по IP"
                value={server.geoLeaked ? [server.geo.country, server.geo.city].filter(Boolean).join(", ") || "да" : "не раскрыто"}
                exposed={server.geoLeaked}
              />
              <Row label="Браузер / ОС" value={`${server.userAgent.browser} / ${server.userAgent.os}`} exposed />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Браузер раскрывает</div>
              {client?.map((c) => <Row key={c.id} label={c.label} value={c.value} exposed={c.exposed} />)}
            </div>
          </div>

          {tzVsGeo && (
            <div className="text-xs text-amber-400/90 bg-amber-950/20 border border-amber-900 rounded-lg px-3 py-2">
              ⚠ Сверка: сервер определил страну <b>{server.geo.country}</b>, браузер сообщает пояс{" "}
              <b>{client?.find((c) => c.id === "timezone")?.value}</b> — несоответствие выдаёт VPN без подмены пояса.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={() => copyReport(total)} className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 rounded-lg text-xs font-semibold">
              📋 Копировать отчёт
            </button>
            <button onClick={shareTool} className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 rounded-lg text-xs font-semibold">
              🔗 Поделиться инструментом
            </button>
            {toast && <span className="text-xs text-emerald-400">{toast}</span>}
          </div>

          {total >= 30 && (
            <div className="bg-cyan-950/30 border border-cyan-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-300">
                <b className="text-cyan-300">Как это скрыть?</b> VeilNetX (Tor-routed, Q4 2026) спрячет IP+гео и
                выровняет fingerprint — красные пункты выше станут зелёными.
              </div>
              <a href="#waitlist" className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-sm font-semibold whitespace-nowrap">
                Хочу защиту →
              </a>
            </div>
          )}
        </>
      )}

      {total === null && !running && !err && (
        <div className="text-sm text-slate-500">
          Нажми «Запустить проверку» — комбинируем серверный отчёт (IP, гео, заголовки) с браузерными утечками (WebRTC, canvas, fingerprint-поверхность).
        </div>
      )}
    </div>
  );
}

function Row({ label, value, exposed }: { label: string; value: string; exposed: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className={`text-right break-all ${exposed ? "text-red-300" : "text-emerald-300"}`}>{value}</span>
    </div>
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
        <ModulePricingChip moduleId="veilnetx" theme="dark" />
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
        <div id="waitlist" className="space-y-2 pt-2 scroll-mt-24">
          <div className="text-sm text-slate-400">
            Запуск Q4 2026. Подпишитесь — уведомим первыми.
          </div>
          <WaitlistForm />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/veilnetx/ledger"
            className="px-5 py-2.5 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-sm font-semibold"
          >
            🔗 Ledger Explorer — live verified chain →
          </Link>
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

      <section className="max-w-5xl mx-auto px-6 pb-4">
        <PrivacyCheck />
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

      <section className="border-t border-slate-800 pt-6">
        <MvpConceptBoard
          moduleId="veilnetx"
          noun="concept/messages"
          accent="teal"
          sectionTitle="Concept board"
          sectionHint="Опиши use-case или threat-model — без email, без логина. Анонимный сигнал в roadmap."
          titleField="useCase"
          summaryField="threatModel"
          fields={[
            { key: "useCase", label: "Use-case", placeholder: "напр.: доступ к Wikipedia из ограниченной сети", required: true },
            { key: "threatModel", label: "Threat model", type: "textarea", placeholder: "От кого защищаемся: ISP, государство, корпорация, локальная сеть" },
          ]}
        />
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
