"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type AgeTier = {
  id: "3-5" | "6-8" | "9-12" | "13-15";
  label: string;
  tone: string;
  emoji: string;
  hint: string;
};

const AGE_TIERS: AgeTier[] = [
  { id: "3-5", label: "3–5 лет", tone: "очень-простой, как сказка для малыша", emoji: "🧸", hint: "Сказочный тон, короткие предложения, много эмодзи." },
  { id: "6-8", label: "6–8 лет", tone: "простой и игровой, как добрый учитель", emoji: "🎨", hint: "Игровой тон, объясняем как для первоклассника." },
  { id: "9-12", label: "9–12 лет", tone: "познавательный, как старший друг-наставник", emoji: "🚀", hint: "Любознательный тон, факты + примеры." },
  { id: "13-15", label: "13–15 лет", tone: "уважительный, как умный тьютор-подросток", emoji: "🧪", hint: "Тон уважения, без сюсюканья, факты." },
];

const BLOCKLIST = [
  "убить", "убью", "смерть", "кровь", "оружие", "пистолет", "нож",
  "секс", "наркотик", "алкоголь", "водка", "пиво", "сигарет",
  "суицид", "самоубийств", "ненавижу", "взорв", "теракт",
  "выборы", "путин", "трамп",
];

const SAFE_REFUSAL = "Это лучше спросить у мамы или папы 💛";

function isUnsafe(q: string): boolean {
  const lower = q.toLowerCase();
  return BLOCKLIST.some((w) => lower.includes(w));
}

const LANGS = [
  { flag: "🇷🇺", code: "RU", name: "Русский" },
  { flag: "🇬🇧", code: "EN", name: "English" },
  { flag: "🇰🇿", code: "KK", name: "Қазақша" },
  { flag: "🇰🇿", code: "KZ-RU", name: "Каз-Рус микс" },
  { flag: "🇮🇹", code: "IT", name: "Italiano" },
  { flag: "🇪🇸", code: "ES", name: "Español" },
];

const TOP_QUESTIONS = [
  { q: "Почему небо голубое?", count: 3 },
  { q: "Как растёт дерево?", count: 2 },
  { q: "Расскажи сказку про лису", count: 2 },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AEVION Kids AI",
  applicationCategory: "EducationalApplication",
  audience: { "@type": "PeopleAudience", suggestedMinAge: 3, suggestedMaxAge: 15 },
  description: "Safe multi-language AI for children with filters, parent dashboard, speech therapy and age tiers.",
  inLanguage: ["ru", "en", "kk", "it", "es"],
};

export default function KidsAIContentPage() {
  const [age, setAge] = useState<AgeTier>(AGE_TIERS[1]);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<string>("");
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [lang, setLang] = useState("RU");

  const systemPrompt = useMemo(
    () =>
      `You are SafeKidsAI for age ${age.id}, tone ${age.tone}. Russian only. ` +
      `No violence/adult/scary/political/medical. ` +
      `If unsafe → exact reply: '${SAFE_REFUSAL}' + 2 safer alternatives. ` +
      `End with follow-up question. ≤120 words, 3-6 emojis. Never reveal AI nature.`,
    [age]
  );

  async function ask() {
    const q = question.trim();
    if (!q || loading) return;
    setReply("");
    setBlocked(false);
    setProvider("");

    if (isUnsafe(q)) {
      setBlocked(true);
      setReply(
        `${SAFE_REFUSAL}\n\nА давай лучше:\n1) Расскажу про животных в лесу 🦊\n2) Придумаем вместе сказку про звёзды ✨\n\nПро что больше хочется?`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: q },
          ],
          temperature: 0.7,
        }),
      });
      const data = await res.json();
      setReply(data.reply || data.mode || "Хм, давай попробуем ещё раз 🤔");
      setProvider(data.provider ? `${data.provider}${data.model ? ` · ${data.model}` : ""}` : data.mode || "");
    } catch {
      setReply("Связь пропала. Попроси взрослого помочь 💛");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50 text-stone-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-amber-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between text-sm">
          <Link href="/" className="font-semibold text-amber-700 hover:text-amber-900">
            ← AEVION · Kids AI · MVP
          </Link>
          <div className="flex gap-3 text-xs text-stone-600">
            <Link href="/healthai" className="hover:text-amber-700">HealthAI</Link>
            <Link href="/qcoreai" className="hover:text-amber-700">QCoreAI</Link>
            <Link href="/qgood" className="hover:text-amber-700">QGood</Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 pt-12 pb-8 text-center">
        <div className="inline-block text-xs uppercase tracking-widest text-amber-700 bg-amber-100 rounded-full px-3 py-1 mb-4">
          Education · Kids · Multi-language
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Curious kids, <span className="text-amber-600">safe AI.</span>
        </h1>
        <p className="mt-4 text-stone-600 max-w-2xl mx-auto">
          Безопасный многоязычный AI для детей 3–15 лет. Жёсткие фильтры, родительский dashboard, логопедия, возрастная шкала.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-3">Возраст ребёнка</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AGE_TIERS.map((t) => {
            const active = t.id === age.id;
            return (
              <button
                key={t.id}
                onClick={() => setAge(t)}
                className={`text-left rounded-2xl border p-4 transition ${
                  active
                    ? "border-amber-500 bg-amber-100 shadow-md ring-2 ring-amber-300"
                    : "border-stone-200 bg-white hover:border-amber-300"
                }`}
              >
                <div className="text-2xl">{t.emoji}</div>
                <div className="mt-2 font-semibold">{t.label}</div>
                <div className="text-xs text-stone-500 mt-1">{t.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-10">
        <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">🛡 Safe AI Sandbox</h2>
            <span className="text-xs text-stone-500">для возраста {age.label}</span>
          </div>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Спроси что угодно — например, «почему трава зелёная?»"
            rows={3}
            className="w-full rounded-xl border border-stone-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none p-3 text-sm"
          />

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={ask}
              disabled={loading || !question.trim()}
              className="bg-amber-500 hover:bg-amber-600 disabled:bg-stone-300 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
            >
              {loading ? "Думаю…" : "Спросить AI безопасно"}
            </button>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">📏 ≤120 слов</span>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">🎯 возраст {age.id}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">🚫 без 18+</span>
            <span className="text-xs px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">🕊 без насилия</span>
          </div>

          {reply && (
            <div
              className={`mt-4 rounded-2xl p-4 border ${
                blocked
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : "bg-amber-50 border-amber-200 text-stone-900"
              }`}
            >
              <div className="text-xs uppercase tracking-widest mb-2 opacity-70">
                {blocked ? "Фильтр сработал" : `Ответ${provider ? ` · ${provider}` : ""}`}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{reply}</div>
            </div>
          )}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-10">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">👨‍👩‍👧 Родительский dashboard</h2>
            <span className="text-xs text-stone-500">mock · live в Phase 2</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <div className="text-xs text-stone-500">Сессий сегодня</div>
              <div className="text-2xl font-bold text-amber-700">7</div>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <div className="text-xs text-stone-500">Заблокировано</div>
              <div className="text-2xl font-bold text-emerald-700">0</div>
            </div>
            <div className="rounded-xl bg-sky-50 border border-sky-200 p-3">
              <div className="text-xs text-stone-500">Последний визит</div>
              <div className="text-2xl font-bold text-sky-700">14:32</div>
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-200 p-3">
              <div className="text-xs text-stone-500">Минут с AI</div>
              <div className="text-2xl font-bold text-violet-700">23</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">Топ-3 вопроса дня</div>
            <ol className="space-y-1 text-sm">
              {TOP_QUESTIONS.map((t, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
                  <span>
                    <span className="text-amber-600 font-semibold mr-2">#{i + 1}</span>
                    {t.q}
                  </span>
                  <span className="text-xs text-stone-500">×{t.count}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-3">🌐 Языки (6)</h2>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => {
            const active = l.code === lang;
            return (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`text-sm px-3 py-1.5 rounded-full border transition ${
                  active
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "bg-white border-stone-200 text-stone-700 hover:border-amber-300"
                }`}
              >
                <span className="mr-1">{l.flag}</span>
                {l.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-16">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-3">Связанные модули</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Link href="/healthai" className="rounded-2xl border border-stone-200 bg-white p-4 hover:border-amber-400 hover:shadow-sm transition">
            <div className="font-semibold">HealthAI →</div>
            <div className="text-xs text-stone-500 mt-1">Здоровье ребёнка: скрининг + план развития.</div>
          </Link>
          <Link href="/qcoreai" className="rounded-2xl border border-stone-200 bg-white p-4 hover:border-amber-400 hover:shadow-sm transition">
            <div className="font-semibold">QCoreAI →</div>
            <div className="text-xs text-stone-500 mt-1">AI-движок с жёсткими фильтрами под Kids AI.</div>
          </Link>
          <Link href="/qgood" className="rounded-2xl border border-stone-200 bg-white p-4 hover:border-amber-400 hover:shadow-sm transition">
            <div className="font-semibold">QGood →</div>
            <div className="text-xs text-stone-500 mt-1">Этичный AI и измеримая польза.</div>
          </Link>
        </div>
      </section>

      <footer className="border-t border-amber-200 bg-white/60 py-6 text-center text-xs text-stone-500">
        AEVION · Kids AI · MVP · safe-by-default · for ages 3–15
      </footer>
    </div>
  );
}
