"use client";

/**
 * /pricing/provisioning — самообслуживание истории подписок.
 *
 * Цель UX: пользователь, прошедший stub-checkout или вернувшийся из почты,
 * может ввести свой email и убедиться, что подписка реально провизилась.
 * Также показывает «пульс» (общая стата провизий) — социальный proof.
 *
 * Privacy: backend маскирует email и не возвращает stripeSessionId публично.
 * Тёмная тема, Tailwind, мобильно-дружелюбная.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

type TierId = "free" | "pro" | "business" | "enterprise";
type BillingPeriod = "monthly" | "annual";
type HistoryStatus = "active" | "trial" | "expired";

interface HistoryItem {
  id: string;
  ts: string;
  tierId: TierId;
  period: BillingPeriod;
  seats: number;
  modules: string[];
  trialDays: number;
  validUntil: string | null;
  amountUsd: number | null;
  promoCode: string | null;
  source: string | null;
  daysLeft: number | null;
  status: HistoryStatus;
  emailMasked: string;
}

interface HistoryResp {
  email: string;
  count: number;
  truncated: boolean;
  items: HistoryItem[];
}

interface StatsResp {
  total: number;
  byTier: Record<TierId, number>;
  last7d: number;
  trialsActive: number;
  recent: Array<{ id: string; ts: string; tierId: TierId; period: BillingPeriod; trial: boolean }>;
}

const TIER_LABEL: Record<TierId, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

const TIER_COLOR: Record<TierId, string> = {
  free: "text-slate-300 bg-slate-700/40 ring-slate-500/40",
  pro: "text-teal-200 bg-teal-500/15 ring-teal-400/40",
  business: "text-sky-200 bg-sky-500/15 ring-sky-400/40",
  enterprise: "text-amber-200 bg-amber-500/15 ring-amber-400/40",
};

const STATUS_COLOR: Record<HistoryStatus, string> = {
  active: "text-emerald-200 bg-emerald-500/15 ring-emerald-400/40",
  trial: "text-amber-200 bg-amber-500/15 ring-amber-400/40",
  expired: "text-rose-200 bg-rose-500/15 ring-rose-400/40",
};

const STATUS_LABEL: Record<HistoryStatus, string> = {
  active: "Активна",
  trial: "Триал",
  expired: "Истекла",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ProvisioningPage() {
  const [email, setEmail] = useState<string>("");
  const [submittedEmail, setSubmittedEmail] = useState<string>("");
  const [history, setHistory] = useState<HistoryResp | null>(null);
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Подтянем агрегат при mount — это публично и быстро.
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/pricing/provisioning/stats"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: StatsResp) => {
        if (!cancelled) setStats(j);
      })
      .catch(() => {
        // тихо — stats не критичны
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lookup = useCallback(async (rawEmail: string) => {
    const e = rawEmail.trim().toLowerCase();
    if (!e || !e.includes("@") || e.length < 5) {
      setError("Введите корректный email");
      return;
    }
    setLoading(true);
    setError(null);
    setHistory(null);
    try {
      const url = apiUrl(`/api/pricing/provisioning/history?email=${encodeURIComponent(e)}`);
      const r = await fetch(url);
      const j = (await r.json()) as HistoryResp | { error: string };
      if (!r.ok || "error" in j) {
        setError("error" in j ? j.error : `HTTP ${r.status}`);
        return;
      }
      setHistory(j as HistoryResp);
      setSubmittedEmail(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    void lookup(email);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ProductPageShell maxWidth={920}>
        <div className="mb-4">
          <Link
            href="/pricing"
            className="text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            ← Все тарифы
          </Link>
        </div>

        <header className="mb-8">
          <div className="text-[10px] font-extrabold tracking-[0.18em] text-teal-300/90 mb-2">
            AEVION · PROVISIONING
          </div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight tracking-tight text-slate-50">
            История подписки
          </h1>
          <p className="mt-3 text-sm md:text-[15px] text-slate-400 leading-relaxed">
            Введите email, на который оформили подписку, чтобы проверить статус, оставшийся
            триал-период и состав модулей. Без логина — для тех, кто пришёл по ссылке из письма.
          </p>
        </header>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
            <StatCard label="Всего подписок" value={stats.total.toLocaleString("ru-RU")} />
            <StatCard label="За 7 дней" value={`+${stats.last7d}`} accent="teal" />
            <StatCard label="Активных триалов" value={stats.trialsActive.toString()} accent="amber" />
            <StatCard
              label="Pro · Business"
              value={`${stats.byTier.pro ?? 0} · ${stats.byTier.business ?? 0}`}
              accent="sky"
            />
          </div>
        )}

        {/* Lookup form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 backdrop-blur-sm"
        >
          <label
            htmlFor="provisioning-email"
            className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2"
          >
            Email подписки
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="provisioning-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-[15px] text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20 transition"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-teal-900/40 hover:from-teal-400 hover:to-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Ищем…" : "Найти"}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            Мы маскируем email в ответе. История ограничена 100 последними записями. Сессии Stripe
            доступны только администраторам.
          </p>
          {error && (
            <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error === "missing_email" && "Введите email"}
              {error === "invalid_email" && "Введите корректный email"}
              {error === "history_failed" && "Не удалось получить историю. Попробуйте позже."}
              {!["missing_email", "invalid_email", "history_failed"].includes(error) && error}
            </div>
          )}
        </form>

        {/* Results */}
        {history && (
          <section className="mt-8">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-100">
                Подписки для <span className="text-teal-300">{history.email}</span>
              </h2>
              <span className="text-xs text-slate-500">
                {history.count} {history.count === 1 ? "запись" : "записей"}
                {history.truncated && " (обрезано)"}
              </span>
            </div>

            {history.count === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-8 text-center text-sm text-slate-400">
                Подписок с таким email не найдено. Возможно, вы ещё не активировали тариф или
                ошиблись в email. <br />
                <Link href="/pricing" className="text-teal-300 hover:text-teal-200 font-semibold">
                  Выбрать тариф →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {history.items.map((item) => (
                  <SubscriptionCard key={item.id} item={item} />
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void lookup(submittedEmail)}
                className="text-xs font-bold text-teal-300 hover:text-teal-200"
              >
                ↻ Обновить
              </button>
              <Link href="/qright" className="text-xs font-bold text-slate-300 hover:text-slate-100">
                Открыть QRight →
              </Link>
              <Link href="/pricing" className="text-xs font-bold text-slate-400 hover:text-slate-200">
                Изменить тариф
              </Link>
            </div>
          </section>
        )}

        {/* Recent ticker (если истории нет — показываем «пульс») */}
        {!history && stats && stats.recent.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 mb-3">
              Недавние активации
            </h2>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800/70 overflow-hidden">
              {stats.recent.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                >
                  <span className="text-slate-500">{formatDate(r.ts)}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${TIER_COLOR[r.tierId]}`}
                    >
                      {TIER_LABEL[r.tierId]}
                    </span>
                    <span className="text-slate-400">
                      {r.period === "annual" ? "годовая" : "месячная"}
                    </span>
                    {r.trial && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40">
                        triаl
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </ProductPageShell>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string;
  accent?: "slate" | "teal" | "amber" | "sky";
}) {
  const accentRing = {
    slate: "ring-slate-700/50",
    teal: "ring-teal-500/30",
    amber: "ring-amber-500/30",
    sky: "ring-sky-500/30",
  }[accent];
  const accentText = {
    slate: "text-slate-100",
    teal: "text-teal-200",
    amber: "text-amber-200",
    sky: "text-sky-200",
  }[accent];
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 ring-1 ${accentRing}`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-black ${accentText}`}>{value}</div>
    </div>
  );
}

function SubscriptionCard({ item }: { item: HistoryItem }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ring-1 ${TIER_COLOR[item.tierId]}`}
          >
            {TIER_LABEL[item.tierId]}
          </span>
          <span className="text-xs text-slate-400">
            {item.period === "annual" ? "годовая" : "месячная"} · {item.seats}{" "}
            {item.seats === 1 ? "место" : "мест"}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${STATUS_COLOR[item.status]}`}
          >
            {STATUS_LABEL[item.status]}
          </span>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-500">Создана</div>
          <div className="text-xs font-bold text-slate-300">{formatDate(item.ts)}</div>
        </div>
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
        <div>
          <dt className="text-slate-500">Действует до</dt>
          <dd className="font-bold text-slate-100">{formatDate(item.validUntil)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Осталось</dt>
          <dd className="font-bold text-slate-100">
            {item.daysLeft !== null ? `${item.daysLeft} дн.` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Сумма</dt>
          <dd className="font-bold text-slate-100">
            {item.amountUsd !== null ? `$${item.amountUsd.toLocaleString("ru-RU")}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Источник</dt>
          <dd className="font-bold text-slate-100 truncate" title={item.source ?? ""}>
            {item.source ?? "—"}
          </dd>
        </div>
      </dl>

      {item.modules.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Модули
          </div>
          <div className="flex flex-wrap gap-1.5">
            {item.modules.map((m) => (
              <span
                key={m}
                className="px-2 py-0.5 rounded-md bg-slate-800/80 text-[10px] font-semibold text-slate-300 ring-1 ring-slate-700/60"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {item.promoCode && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-amber-200 bg-amber-500/10 px-2 py-1 rounded-md ring-1 ring-amber-500/30">
          <span className="font-bold">Промо:</span>
          <code className="font-mono">{item.promoCode}</code>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
        <code className="font-mono">{item.id}</code>
        <span>{item.emailMasked}</span>
      </div>
    </article>
  );
}
