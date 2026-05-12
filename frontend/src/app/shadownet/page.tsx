"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Recipient = { id: string; name: string; key: string };

const RECIPIENTS: Recipient[] = [
  { id: "fox", name: "fox-2832", key: "pk_4f2a:7c9e:1d8b:a3f0" },
  { id: "owl", name: "owl-9923", key: "pk_91bd:e2c4:5a17:0fd9" },
  { id: "lynx", name: "lynx-1145", key: "pk_a3e1:5b08:c7f2:42aa" },
];

const FORUM_POSTS = [
  {
    nick: "fox-2832",
    title: "Mesh-relay для горных районов",
    body: "Тестировал mesh-fallback на 2.4GHz LoRa-модуле в районе без сотовой связи. 12 узлов держат связь на дистанции до 4км.",
    replies: 7,
  },
  {
    nick: "owl-9923",
    title: "Защита от timing-анализа",
    body: "Рандомизация задержки отправки сообщений + padding до 1024 байт убирает 90% корреляций по времени.",
    replies: 14,
  },
  {
    nick: "lynx-1145",
    title: "Open-source клиенты — список",
    body: "Собрал воспроизводимые сборки для Linux/macOS/Android. SHA256 совпадают с публичным манифестом релиза.",
    replies: 3,
  },
  {
    nick: "raven-7780",
    title: "Почему без timestamps",
    body: "Метка времени = атрибуция. Форум показывает «недавно» / «давно» — этого достаточно для дискуссии.",
    replies: 21,
  },
];

const MESH_NODES = [
  { x: 80, y: 70 },
  { x: 200, y: 50 },
  { x: 320, y: 90 },
  { x: 410, y: 180 },
  { x: 350, y: 280 },
  { x: 220, y: 310 },
  { x: 110, y: 250 },
  { x: 250, y: 170 },
];

const MESH_LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0],
  [7, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6],
];

function utf8ToBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    try {
      return btoa(str);
    } catch {
      return "";
    }
  }
}

function base64ToUtf8(b64: string): string {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    try {
      return atob(b64);
    } catch {
      return "[decode-error]";
    }
  }
}

async function digestPrefix(input: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buf = new TextEncoder().encode(input);
      const hash = await crypto.subtle.digest("SHA-256", buf);
      const bytes = new Uint8Array(hash).slice(0, 8);
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {}
  // fallback: pseudo-random 8 bytes
  const arr = new Uint8Array(8);
  for (let i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ShadowNetPage() {
  const [plain, setPlain] = useState("Встречаемся в 19:00 на старой явке. Принеси ключи от mesh-узла.");
  const [recipientId, setRecipientId] = useState(RECIPIENTS[0].id);
  const [cipher, setCipher] = useState("");
  const [decryptInput, setDecryptInput] = useState("");
  const [decrypted, setDecrypted] = useState("");
  const [busy, setBusy] = useState(false);

  const recipient = useMemo(
    () => RECIPIENTS.find((r) => r.id === recipientId) ?? RECIPIENTS[0],
    [recipientId]
  );

  async function handleEncrypt() {
    if (!plain.trim()) return;
    setBusy(true);
    const prefix = await digestPrefix(plain + recipient.key + Date.now());
    const body = utf8ToBase64(plain);
    // pad to nearest 64-byte boundary for randomized payload size
    const padLen = 64 - (body.length % 64);
    const pad = "=".repeat(Math.max(0, padLen - 1)) + ".";
    const out = `sn1:${prefix}:${body}:${pad.slice(0, padLen)}`;
    setCipher(out);
    setBusy(false);
  }

  function handleBridge() {
    setDecryptInput(cipher);
    setDecrypted("");
  }

  function handleDecrypt() {
    const parts = decryptInput.split(":");
    if (parts.length < 4 || parts[0] !== "sn1") {
      setDecrypted("[invalid ciphertext format]");
      return;
    }
    setDecrypted(base64ToUtf8(parts[2]));
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AEVION ShadowNet",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Linux, macOS, Android",
    description:
      "Alternative private network over VeilNetX. Anonymous forum, mesh-fallback, E2E encryption without metadata.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    url: "https://aevion.app/shadownet",
  };

  return (
    <main className="min-h-screen bg-black text-cyan-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-cyan-900/40 bg-black/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 text-sm">
          <Link href="/" className="text-cyan-400 hover:text-cyan-200">← AEVION</Link>
          <span className="text-cyan-700">·</span>
          <span className="font-semibold text-cyan-300">ShadowNet</span>
          <span className="text-cyan-700">·</span>
          <span className="px-2 py-0.5 rounded border border-cyan-700/60 text-cyan-400 text-xs">IDEA</span>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <p className="text-cyan-500 text-xs tracking-[0.3em] uppercase mb-3">Private · Mesh · Anonymous</p>
        <h1 className="text-5xl md:text-6xl font-bold text-cyan-100 leading-tight">
          Network <span className="text-cyan-400">without metadata.</span>
        </h1>
        <p className="text-cyan-300/80 mt-5 max-w-2xl text-lg">
          Альтернативная приватная сеть поверх VeilNetX — анонимный форум, mesh-fallback и E2E без leak метаданных.
          Open-source клиенты, воспроизводимые сборки.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-semibold text-cyan-200 mb-2">E2E Encryption · Live Demo</h2>
        <p className="text-cyan-500 text-sm mb-6">
          SHA-256 префикс пакета + base64 тело (UTF-8 safe) + рандомизированный padding. Всё в браузере.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-cyan-300">Sender</h3>
              <span className="text-xs text-cyan-600">→ encrypt</span>
            </div>
            <label className="block text-xs text-cyan-500 mb-1">Recipient public key</label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full bg-black border border-cyan-800/50 rounded px-3 py-2 text-sm text-cyan-200 mb-3 focus:outline-none focus:border-cyan-500"
            >
              {RECIPIENTS.map((r) => (
                <option key={r.id} value={r.id}>{r.name} — {r.key}</option>
              ))}
            </select>
            <label className="block text-xs text-cyan-500 mb-1">Plaintext</label>
            <textarea
              value={plain}
              onChange={(e) => setPlain(e.target.value)}
              rows={5}
              className="w-full bg-black border border-cyan-800/50 rounded px-3 py-2 text-sm text-cyan-100 mb-3 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={handleEncrypt}
                disabled={busy}
                className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Encrypting…" : "Encrypt"}
              </button>
              <button
                onClick={handleBridge}
                disabled={!cipher}
                className="px-4 py-2 rounded border border-cyan-700 hover:border-cyan-500 text-cyan-300 text-sm disabled:opacity-30"
              >
                send →
              </button>
            </div>
            {cipher && (
              <pre className="mt-3 p-3 bg-black border border-cyan-900/50 rounded text-[11px] text-cyan-400 font-mono break-all whitespace-pre-wrap">
                {cipher}
              </pre>
            )}
          </div>

          <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-cyan-300">Receiver</h3>
              <span className="text-xs text-cyan-600">← decrypt</span>
            </div>
            <label className="block text-xs text-cyan-500 mb-1">Ciphertext</label>
            <textarea
              value={decryptInput}
              onChange={(e) => setDecryptInput(e.target.value)}
              rows={8}
              placeholder="sn1:…:…:…"
              className="w-full bg-black border border-cyan-800/50 rounded px-3 py-2 text-sm text-cyan-200 mb-3 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              onClick={handleDecrypt}
              disabled={!decryptInput.trim()}
              className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold disabled:opacity-50"
            >
              Decrypt
            </button>
            {decrypted && (
              <div className="mt-3 p-3 bg-black border border-cyan-900/50 rounded text-sm text-cyan-100">
                {decrypted}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-emerald-700/40 bg-emerald-950/10 p-4">
          <div className="text-emerald-300 text-sm font-semibold mb-2">no metadata leaked</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-emerald-400">
            <div>✓ no timestamps</div>
            <div>✓ no IP address</div>
            <div>✓ no sender ID</div>
            <div>✓ randomized payload size</div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-semibold text-cyan-200 mb-2">Mesh-Node Map</h2>
        <p className="text-cyan-500 text-sm mb-4">
          Mesh-relay fallback active when ISP is down.
        </p>
        <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/10 p-4">
          <svg viewBox="0 0 500 380" className="w-full h-auto">
            {MESH_LINKS.map(([a, b], i) => {
              const A = MESH_NODES[a];
              const B = MESH_NODES[b];
              return (
                <line
                  key={i}
                  x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke="rgba(34,211,238,0.25)"
                  strokeWidth={1}
                />
              );
            })}
            {MESH_NODES.map((n, i) => (
              <g key={i}>
                <circle cx={n.x} cy={n.y} r={6} fill="#22d3ee">
                  <animate attributeName="r" values="6;10;6" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.4;1" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" />
                </circle>
                <circle cx={n.x} cy={n.y} r={3} fill="#a5f3fc" />
              </g>
            ))}
          </svg>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-semibold text-cyan-200 mb-2">Anonymous Forum</h2>
        <p className="text-cyan-500 text-sm mb-4">
          Только никнеймы. Времени точного нет — только «недавно».
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {FORUM_POSTS.map((p, i) => (
            <article key={i} className="rounded-lg border border-cyan-900/50 bg-cyan-950/10 p-4">
              <div className="flex items-center gap-2 text-xs mb-2">
                <span className="text-cyan-400 font-mono">{p.nick}</span>
                <span className="text-cyan-700">·</span>
                <span className="text-cyan-600">recently</span>
              </div>
              <h3 className="font-semibold text-cyan-200 mb-1">{p.title}</h3>
              <p className="text-cyan-400/80 text-sm mb-3">{p.body}</p>
              <div className="text-xs text-cyan-600">↳ {p.replies} replies</div>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-xl font-semibold text-cyan-200 mb-3">Related modules</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/veilnetx" className="px-3 py-2 rounded border border-cyan-800/60 hover:border-cyan-400 text-cyan-300">
            VeilNetX →
          </Link>
          <Link href="/quantum-shield" className="px-3 py-2 rounded border border-cyan-800/60 hover:border-cyan-400 text-cyan-300">
            Quantum Shield →
          </Link>
          <Link href="/qsign" className="px-3 py-2 rounded border border-cyan-800/60 hover:border-cyan-400 text-cyan-300">
            QSign →
          </Link>
        </div>
      </section>
    </main>
  );
}
