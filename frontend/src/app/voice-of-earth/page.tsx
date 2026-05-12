"use client";

import Link from "next/link";
import { useState } from "react";

type Track = {
  id: string;
  title: string;
  lang: string;
  flag: string;
  contributor: string;
  qright: string;
};

const TRACKS: Track[] = [
  { id: "t1", title: "Ona — Aitkan dunie", lang: "kk", flag: "🇰🇿", contributor: "A. Bektur", qright: "QRIGHT-4821" },
  { id: "t2", title: "Vento del Mediterraneo", lang: "it", flag: "🇮🇹", contributor: "V. Rossi", qright: "QRIGHT-5093" },
  { id: "t3", title: "Ишь, как поёт", lang: "ru", flag: "🇷🇺", contributor: "M. Sidorov", qright: "QRIGHT-5147" },
  { id: "t4", title: "Tabasco Sunset", lang: "en", flag: "🇺🇸", contributor: "J. Carter", qright: "QRIGHT-5208" },
  { id: "t5", title: "夜空の手紙", lang: "ja", flag: "🇯🇵", contributor: "K. Tanaka", qright: "QRIGHT-5311" },
  { id: "t6", title: "Quiet River", lang: "qu", flag: "🏔", contributor: "M. Vargas", qright: "QRIGHT-5402" },
];

const LANGS = [
  { code: "kk", name: "Қазақша" },
  { code: "ru", name: "Русский" },
  { code: "en", name: "English" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "日本語" },
  { code: "qu", name: "Runa Simi" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "zh", name: "中文" },
  { code: "ar", name: "العربية" },
  { code: "pt", name: "Português" },
];

const JSONLD = {
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  name: "Voices of Earth",
  description: "Multi-language music project with QRight authorship and open 60/20/20 royalty splits.",
  genre: ["World", "Multilingual"],
  url: "https://aevion.app/voice-of-earth",
};

export default function VoiceOfEarthPage() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState("kk");
  const [contributor, setContributor] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  function submitTrack(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !contributor.trim()) {
      setToast("Заполни название и контрибьютора");
      setTimeout(() => setToast(null), 2400);
      return;
    }
    const voe = "VOE-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    setToast(`Заявка принята · ${voe} · авторство уйдёт в QRight после модерации`);
    setTitle("");
    setLang("kk");
    setContributor("");
    setTimeout(() => setToast(null), 3600);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-sky-50 text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />

      <header className="border-b border-sky-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-sm">
          <Link href="/" className="text-sky-700 hover:text-sky-900 font-medium">← AEVION</Link>
          <div className="flex items-center gap-2 text-slate-500">
            <span className="font-semibold text-slate-900">VoE</span>
            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs">MVP</span>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-block px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-medium mb-5">
          Music · Multi-language · Authorship
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-5">
          Voices of Earth, <span className="text-sky-600">one song.</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Каждый трек — на своём языке. Авторство фиксируется через QRight, роялти распределяются открыто
          по схеме <strong className="text-slate-900">60 / 20 / 20</strong> (lead / feat / AEVION).
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-6">Tracks Gallery</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRACKS.map((t) => {
            const isPlaying = playing === t.id;
            return (
              <article key={t.id} className="rounded-2xl bg-white border border-sky-100 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{t.flag}</span>
                    <span className="text-xs uppercase tracking-wider text-slate-500">{t.lang}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-mono">{t.qright}</span>
                </div>
                <h3 className="text-lg font-semibold mb-1 leading-tight">{t.title}</h3>
                <p className="text-sm text-slate-500 mb-4">{t.contributor} · 3:42</p>

                <button
                  onClick={() => setPlaying(isPlaying ? null : t.id)}
                  className={`w-full mb-4 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isPlaying ? "bg-sky-600 text-white" : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                  }`}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? "⏸ Pause" : "▶ Play preview"}
                </button>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">Royalty split</div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-sky-500" style={{ width: "60%" }} title="Lead 60%" />
                    <div className="bg-emerald-400" style={{ width: "20%" }} title="Feat 20%" />
                    <div className="bg-amber-400" style={{ width: "20%" }} title="AEVION 20%" />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
                    <span>Lead 60</span>
                    <span>Feat 20</span>
                    <span>AEVION 20</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-white border border-sky-100 p-8 shadow-sm">
          <h2 className="text-2xl font-bold mb-2">Submit a track</h2>
          <p className="text-sm text-slate-500 mb-6">
            Заявка получит временный VOE-ID. После модерации авторство уходит в QRight, сплит — по умолчанию 60/20/20.
          </p>
          <form onSubmit={submitTrack} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none text-sm"
            />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none text-sm bg-white"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
              ))}
            </select>
            <input
              type="text"
              value={contributor}
              onChange={(e) => setContributor(e.target.value)}
              placeholder="Contributor name"
              className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none text-sm"
            />
            <div className="md:col-span-3">
              <button
                type="submit"
                className="w-full md:w-auto px-6 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition"
              >
                Submit · generate VOE-ID
              </button>
            </div>
          </form>
          {toast && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-sm">
              {toast}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold mb-6">Royalty 60 / 20 / 20</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white border border-sky-100 p-6">
            <div className="text-4xl font-bold text-sky-600 mb-1">60%</div>
            <div className="font-semibold mb-1">Lead author</div>
            <div className="text-sm text-slate-500">Тот, кто пишет основу — мелодию, текст, продакшн.</div>
          </div>
          <div className="rounded-2xl bg-white border border-emerald-100 p-6">
            <div className="text-4xl font-bold text-emerald-500 mb-1">20%</div>
            <div className="font-semibold mb-1">Featured contributors</div>
            <div className="text-sm text-slate-500">Соавторы, вокалисты, ремиксёры — все, кто внёс ощутимую долю.</div>
          </div>
          <div className="rounded-2xl bg-white border border-amber-100 p-6">
            <div className="text-4xl font-bold text-amber-500 mb-1">20%</div>
            <div className="font-semibold mb-1">AEVION platform</div>
            <div className="text-sm text-slate-500">Инфраструктура, QRight, дистрибуция, маркетинг проекта.</div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold mb-6">Related</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/qright" className="rounded-2xl bg-white border border-sky-100 p-5 hover:border-sky-300 transition">
            <div className="font-semibold mb-1">QRight →</div>
            <div className="text-sm text-slate-500">Реестр авторства: каждый VoE-трек фиксируется здесь.</div>
          </Link>
          <Link href="/awards" className="rounded-2xl bg-white border border-sky-100 p-5 hover:border-sky-300 transition">
            <div className="font-semibold mb-1">AEVION Awards →</div>
            <div className="text-sm text-slate-500">Площадка релизов музыки — куда идут эпизоды VoE.</div>
          </Link>
          <Link href="/globus" className="rounded-2xl bg-white border border-sky-100 p-5 hover:border-sky-300 transition">
            <div className="font-semibold mb-1">Globus →</div>
            <div className="text-sm text-slate-500">Карта мира с языковыми точками — где звучит каждый трек.</div>
          </Link>
        </div>
      </section>

      <footer className="border-t border-sky-100 bg-white/60">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
          <span>© AEVION · Voices of Earth · MVP demo · треки — заглушки</span>
          <span className="font-mono">voice-of-earth</span>
        </div>
      </footer>
    </main>
  );
}
