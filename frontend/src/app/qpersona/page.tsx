"use client";

import Link from "next/link";
import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type StyleProfile = {
  avgMsgLength?: number | string;
  emojiRate?: number | string;
  sentenceRhythm?: string;
  topWords?: string[];
  tone?: string;
  raw?: string;
};

type ChatResponse = {
  reply?: string;
  provider?: string;
  model?: string;
  mode?: string;
  error?: string;
};

const SAMPLE_MESSAGES = `привет, как сам? я тут опять застрял в проде, бэк лагает 🙃
завтра созвон в 11, успею? мне б ещё кофе и часа три тишины
короч, я думаю мы релизим в пятницу — без ревью никак, но в целом ок`;

const SAMPLE_TASK = "Ответь коллеге, что задача займёт ещё пару дней, попроси не дёргать.";

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fence && fence[1]) candidates.push(fence[1].trim());
  candidates.push(raw.trim());
  const slice = raw.match(/\{[\s\S]*\}/);
  if (slice) candidates.push(slice[0]);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      /* try next */
    }
  }
  return null;
}

function readReply(data: ChatResponse): string {
  return (data?.reply ?? "").toString();
}

export default function QPersonaMvpPage() {
  const [samples, setSamples] = useState(SAMPLE_MESSAGES);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const [analyzeMeta, setAnalyzeMeta] = useState<{ provider?: string; model?: string; mode?: string } | null>(null);

  const [task, setTask] = useState(SAMPLE_TASK);
  const [reply, setReply] = useState<string>("");
  const [replyMeta, setReplyMeta] = useState<{ provider?: string; model?: string; mode?: string } | null>(null);
  const [replying, setReplying] = useState(false);
  const [replyErr, setReplyErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function analyze() {
    setAnalyzing(true);
    setAnalyzeErr(null);
    setProfile(null);
    setAnalyzeMeta(null);
    try {
      const system =
        "You are a writing-style analyst. Read the provided messages and extract the author's signature style. " +
        "Return ONLY a JSON object — no prose, no markdown fence — with keys: " +
        "avgMsgLength (number, words per message), emojiRate (string like '0.3 per msg'), " +
        "sentenceRhythm (short string: 'short & punchy' / 'long flowing' / 'mixed'), " +
        "topWords (array of 5 most characteristic non-stop words), tone (short string).";
      const user = `Analyze these messages and return the JSON profile:\n\n${samples.trim()}`;
      const res = await fetch(apiUrl("/api/qcoreai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.4,
        }),
      });
      const data: ChatResponse = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const rawReply = readReply(data);
      const json = extractJson(rawReply);
      if (json) {
        setProfile({
          avgMsgLength: json.avgMsgLength as number | string | undefined,
          emojiRate: json.emojiRate as number | string | undefined,
          sentenceRhythm: json.sentenceRhythm as string | undefined,
          topWords: Array.isArray(json.topWords) ? (json.topWords as string[]) : undefined,
          tone: json.tone as string | undefined,
          raw: rawReply,
        });
      } else {
        setProfile({ raw: rawReply });
      }
      setAnalyzeMeta({ provider: data.provider, model: data.model, mode: data.mode });
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  async function generate() {
    setReplying(true);
    setReplyErr(null);
    setReply("");
    setReplyMeta(null);
    setCopied(false);
    try {
      const styleBlock = profile
        ? `Style profile (mimic faithfully):\n${JSON.stringify(
            {
              avgMsgLength: profile.avgMsgLength,
              emojiRate: profile.emojiRate,
              sentenceRhythm: profile.sentenceRhythm,
              topWords: profile.topWords,
              tone: profile.tone,
            },
            null,
            2,
          )}\n\nOriginal samples for reference:\n${samples.trim()}`
        : `Reference samples:\n${samples.trim()}`;

      const system =
        "You are an AI doppelganger. Write the reply in the SAME voice, rhythm, vocabulary, and emoji habits as the author. " +
        "Do not break character. Do not explain. Output only the message text, in Russian when the author writes in Russian. " +
        styleBlock;

      const res = await fetch(apiUrl("/api/qcoreai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: task.trim() },
          ],
          temperature: 0.8,
        }),
      });
      const data: ChatResponse = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReply(readReply(data));
      setReplyMeta({ provider: data.provider, model: data.model, mode: data.mode });
    } catch (e) {
      setReplyErr(e instanceof Error ? e.message : String(e));
    } finally {
      setReplying(false);
    }
  }

  async function copyReply() {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AEVION QPersona",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Web",
            description:
              "AI Personality Twin: paste your messages, get a style profile, then let the doppelganger reply in your voice.",
            url: "https://aevion.app/qpersona",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              "Text style cloning from a handful of messages",
              "Style profile (length, rhythm, emoji rate, top words, tone)",
              "Doppelganger reply generator",
              "QSign-auditable outputs",
            ],
            publisher: { "@type": "Organization", name: "AEVION", url: "https://aevion.app" },
          }),
        }}
      />

      <header className="border-b border-rose-900/40 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3 text-sm">
          <Link href="/" className="text-slate-400 hover:text-rose-400 transition-colors">
            ← AEVION
          </Link>
          <span className="text-slate-600">·</span>
          <span className="font-semibold text-rose-400">QPersona</span>
          <span className="text-slate-600">·</span>
          <span className="px-2 py-0.5 rounded bg-rose-700/30 border border-rose-700/60 text-rose-300 text-[11px] font-mono uppercase tracking-wider">
            MVP
          </span>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 pt-14 pb-10">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight">
          Your AI <span className="text-rose-400">doppelganger.</span>
        </h1>
        <p className="mt-5 text-lg text-slate-300 max-w-2xl">
          Вставьте 3+ ваших сообщения. Модель извлечёт стиль — длину фраз, ритм, эмодзи, словарь, тон — и ответит за
          вас так, как ответили бы вы. Без долгого «промпт-инжиниринга».
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-10">
        <div className="rounded-2xl border border-rose-900/50 bg-slate-900/60 p-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-bold text-rose-300">1 · Style Analyzer</h2>
            <span className="text-xs text-slate-500">3+ сообщений · разделяйте новой строкой</span>
          </div>
          <textarea
            value={samples}
            onChange={(e) => setSamples(e.target.value)}
            rows={6}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:border-rose-600"
            placeholder="Вставьте ваши сообщения здесь…"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <span className="text-xs text-slate-500">{samples.length} символов</span>
            <button
              type="button"
              onClick={analyze}
              disabled={analyzing || samples.trim().length < 20}
              className="px-5 py-2 bg-rose-700 hover:bg-rose-600 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-sm font-semibold transition-colors"
            >
              {analyzing ? "Анализирую…" : "Проанализировать стиль"}
            </button>
          </div>

          {analyzeErr && (
            <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-sm text-red-300">
              {analyzeErr}
            </div>
          )}

          {profile && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
              <ProfileCell label="Средняя длина" value={profile.avgMsgLength} />
              <ProfileCell label="Эмодзи" value={profile.emojiRate} />
              <ProfileCell label="Ритм" value={profile.sentenceRhythm} />
              <ProfileCell label="Тон" value={profile.tone} />
              <ProfileCell
                label="Топ-слова"
                value={Array.isArray(profile.topWords) ? profile.topWords.join(", ") : undefined}
              />
              {!profile.avgMsgLength && !profile.tone && profile.raw && (
                <div className="col-span-2 md:col-span-5 p-3 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 whitespace-pre-wrap">
                  {profile.raw}
                </div>
              )}
              {analyzeMeta && (analyzeMeta.provider || analyzeMeta.mode) && (
                <div className="col-span-2 md:col-span-5 text-[11px] text-slate-500 font-mono">
                  {analyzeMeta.provider ?? analyzeMeta.mode} {analyzeMeta.model ? `· ${analyzeMeta.model}` : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-12">
        <div className="rounded-2xl border border-rose-900/50 bg-slate-900/60 p-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-bold text-rose-300">2 · Reply Generator</h2>
            <span className="text-xs text-slate-500">
              {profile ? "Стиль загружен" : "Без профиля — fallback на сэмплы"}
            </span>
          </div>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:border-rose-600"
            placeholder="Что нужно ответить? Опишите задачу…"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <span className="text-xs text-slate-500">{task.length} символов</span>
            <button
              type="button"
              onClick={generate}
              disabled={replying || task.trim().length < 5}
              className="px-5 py-2 bg-rose-700 hover:bg-rose-600 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg text-sm font-semibold transition-colors"
            >
              {replying ? "Генерирую…" : "Ответить как я"}
            </button>
          </div>

          {replyErr && (
            <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-sm text-red-300">
              {replyErr}
            </div>
          )}

          {reply && (
            <div className="mt-4 rounded-xl border border-rose-700/40 bg-slate-950 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400">doppelganger</span>
                <button
                  type="button"
                  onClick={copyReply}
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  {copied ? "Скопировано ✓" : "Скопировать"}
                </button>
              </div>
              <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{reply}</p>
              {replyMeta && (replyMeta.provider || replyMeta.mode) && (
                <div className="mt-3 text-[11px] text-slate-500 font-mono">
                  {replyMeta.provider ?? replyMeta.mode} {replyMeta.model ? `· ${replyMeta.model}` : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-20">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Связано в AEVION</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <RelatedCard
            href="/qcoreai"
            title="QCoreAI"
            desc="AI engine + история диалогов — топливо для клонирования стиля QPersona."
          />
          <RelatedCard
            href="/deepsan"
            title="DeepSan"
            desc="Задачи-состояния → исполняет QPersona вашим стилем."
          />
          <RelatedCard
            href="/qsign"
            title="QSign"
            desc="Подпись каждого ответа аватара — аудит и анти-deepfake защита."
          />
        </div>
      </section>
    </main>
  );
}

function ProfileCell({ label, value }: { label: string; value?: number | string }) {
  return (
    <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-rose-300 font-semibold break-words">
        {value !== undefined && value !== null && value !== "" ? String(value) : "—"}
      </div>
    </div>
  );
}

function RelatedCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-800 hover:border-rose-700/60 bg-slate-900/40 hover:bg-slate-900/80 p-4 transition-colors"
    >
      <div className="text-rose-400 font-bold">{title}</div>
      <div className="mt-1 text-xs text-slate-400 leading-relaxed">{desc}</div>
    </Link>
  );
}
