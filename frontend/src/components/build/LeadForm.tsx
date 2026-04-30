"use client";

import { useState } from "react";
import { buildApi, BuildApiError } from "@/lib/build/api";

const COPY = {
  ru: {
    title: "Получайте обновления QBuild",
    body: "Мы запускаемся в новых городах раз в 2 недели. Оставьте email — мы напишем, когда будем у вас.",
    emailPh: "you@email.com",
    cityPh: "Город (опционально)",
    submit: "Подписаться",
    done: "Готово — скоро напишем 👋",
    already: "Этот email уже в списке.",
  },
  en: {
    title: "Get QBuild updates",
    body: "We launch in new cities every 2 weeks. Drop your email — we'll write when we land near you.",
    emailPh: "you@email.com",
    cityPh: "City (optional)",
    submit: "Subscribe",
    done: "All set — we'll be in touch 👋",
    already: "This email is already on the list.",
  },
};

export function LeadForm({ lang }: { lang: "ru" | "en" }) {
  const t = COPY[lang];
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"new" | "already" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await buildApi.submitLead({
        email: email.trim(),
        city: city.trim() || undefined,
        locale: lang,
        source: "why-aevion",
      });
      setDone(r.alreadyExists ? "already" : "new");
    } catch (err) {
      const e = err as BuildApiError;
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-b border-white/5 px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{t.title}</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-300">{t.body}</p>
        {done ? (
          <p className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {done === "already" ? t.already : t.done}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPh}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t.cityPh}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {busy ? "…" : t.submit}
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
      </div>
    </section>
  );
}
