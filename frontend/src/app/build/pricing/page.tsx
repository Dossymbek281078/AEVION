"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import {
  buildApi,
  type BuildPlan,
  type BuildSubscription,
  type BuildOrderRow,
  type PlanKey,
} from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

type Cycle = "MONTHLY" | "YEARLY";
const YEARLY_DISCOUNT = 0.2; // 20% off → 2 months free

// HH baseline numbers used in the comparison table. These are *order-of-
// magnitude* — public price lists shift, so we keep the language honest
// ("starts at", "from"). The point of the table is the gap, not exact ₽.
const HH_COMPARE = {
  vacancyPost: "от 4 990 ₽",
  resumeDb: "от 50 000 ₽/мес",
  hireFee: "15–25% (агентство)",
  hiddenFees: "паки, бусты, продление",
};

export default function PricingPage() {
  const token = useBuildAuth((s) => s.token);

  const [plans, setPlans] = useState<BuildPlan[]>([]);
  const [sub, setSub] = useState<BuildSubscription | null>(null);
  const [orders, setOrders] = useState<BuildOrderRow[]>([]);
  const [cycle, setCycle] = useState<Cycle>("MONTHLY");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<PlanKey | null>(null);

  const refreshOrders = async () => {
    if (!token) return;
    try {
      const r = await buildApi.myOrders();
      setOrders(r.items);
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      buildApi.listPlans(),
      token ? buildApi.mySubscription().catch(() => ({ subscription: null })) : Promise.resolve({ subscription: null }),
      token ? buildApi.myOrders().catch(() => ({ items: [] as BuildOrderRow[], total: 0 })) : Promise.resolve({ items: [] as BuildOrderRow[], total: 0 }),
    ])
      .then(([p, s, o]) => {
        if (cancelled) return;
        setPlans(p.items);
        setSub(s.subscription);
        setOrders(o.items);
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function start(planKey: PlanKey) {
    if (!token) {
      window.location.href = "/build/profile";
      return;
    }
    setBusyKey(planKey);
    try {
      const r = await buildApi.startSubscription(planKey);
      setSub(r.subscription);
      await refreshOrders();
      if (r.subscription.status === "PENDING") {
        // Auto-scroll the user to the order ledger so they see the
        // Pay button immediately after Choose-plan.
        setTimeout(() => {
          document.getElementById("orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyKey(null);
    }
  }

  async function pay(orderId: string) {
    try {
      await buildApi.payOrder(orderId);
      const [s, o] = await Promise.all([
        buildApi.mySubscription().catch(() => ({ subscription: null })),
        buildApi.myOrders().catch(() => ({ items: [] as BuildOrderRow[], total: 0 })),
      ]);
      setSub(s.subscription);
      setOrders(o.items);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const formatted = useMemo(() => {
    return plans.map((p) => {
      const monthly = p.priceMonthly;
      const yearly = Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT));
      return { ...p, yearly };
    });
  }, [plans]);

  return (
    <BuildShell>
      <Hero />

      <div className="mt-8 mb-6 flex flex-col items-center gap-3">
        <CycleToggle cycle={cycle} setCycle={setCycle} />
        <p className="text-xs text-slate-500">
          Yearly billing = 2 months free. No long-term lock-in — cancel anytime, keep posted vacancies live to end of period.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-slate-400">Loading plans…</p>}

      {!loading && (
        <div className="grid gap-4 lg:grid-cols-4">
          {formatted.map((p) => (
            <PlanCard
              key={p.key}
              plan={p}
              cycle={cycle}
              isCurrent={sub?.planKey === p.key && sub.status === "ACTIVE"}
              busy={busyKey === p.key}
              onStart={() => start(p.key)}
            />
          ))}
        </div>
      )}

      <LoyaltyBanner />

      <ComparisonTable plans={plans} />
      <AddOns />
      {token && orders.length > 0 && <OrdersLedger orders={orders} onPay={pay} />}
      <Faq />
    </BuildShell>
  );
}

function LoyaltyBanner() {
  const token = useBuildAuth((s) => s.token);
  const [data, setData] = useState<Awaited<ReturnType<typeof buildApi.loyaltyMe>> | null>(null);
  const [cashback, setCashback] = useState<Awaited<ReturnType<typeof buildApi.loyaltyCashback>> | null>(null);
  useEffect(() => {
    if (!token) return;
    buildApi.loyaltyMe().then(setData).catch(() => {});
    buildApi.loyaltyCashback().then(setCashback).catch(() => {});
  }, [token]);

  return (
    <section className="mt-12 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-slate-900 to-slate-900 px-6 py-8 sm:px-10">
      <div className="text-xs font-bold uppercase tracking-wider text-fuchsia-300">
        Loyalty · pay only when you hire
      </div>
      <h2 className="mt-2 text-2xl font-bold text-white">
        Чем больше нанимаете — тем меньше комиссия
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">
        Pay-per-Hire начинается с <span className="font-semibold text-fuchsia-200">12%</span> (vs HH-агентство 15–25%) и снижается по мере того, как кандидаты выходят на работу. Плюс <span className="font-semibold text-fuchsia-200">2% AEV cashback</span> на каждый PAID заказ — copyуется в ваш AEV-кошелёк.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          { hires: 0, pct: 12, label: "Default" },
          { hires: 3, pct: 10, label: "Bronze" },
          { hires: 10, pct: 8, label: "Silver" },
          { hires: 25, pct: 6, label: "Gold" },
        ].map((t) => {
          const reached = data ? data.hires >= t.hires : false;
          const current = data ? data.hireFeePct === t.pct : t.hires === 0;
          return (
            <div
              key={t.hires}
              className={`rounded-xl border p-4 text-sm ${
                current
                  ? "border-fuchsia-400 bg-fuchsia-500/15 text-white"
                  : reached
                    ? "border-fuchsia-500/40 bg-fuchsia-500/5 text-fuchsia-100"
                    : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wider">
                {t.label}
                {current && <span className="ml-1 text-fuchsia-200">— ваш уровень</span>}
              </div>
              <div className="mt-1 text-3xl font-bold">{t.pct}%</div>
              <div className="text-xs text-slate-400">
                {t.hires === 0 ? "С первого найма" : `с ${t.hires} наймов`}
              </div>
            </div>
          );
        })}
      </div>
      {data && (
        <div className="mt-4 text-xs text-fuchsia-100/80">
          У вас уже {data.hires} закрытых наймов на платформе.
          {data.nextTierAt != null &&
            ` До следующего уровня (${(data.nextTierBps! / 100).toFixed(0)}%) — ещё ${data.nextTierAt - data.hires}.`}
        </div>
      )}
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
        💎 +2% AEV cashback на любой платёж
      </div>
      {cashback && cashback.entries > 0 && (
        <div className="mt-4 grid gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-300">Earned cashback</div>
            <div className="mt-1 text-2xl font-bold text-emerald-200">
              {cashback.totalAev.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} AEV
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-300">PAID-заказов</div>
            <div className="mt-1 text-2xl font-bold text-emerald-200">{cashback.entries}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-300">Текущая ставка</div>
            <div className="mt-1 text-2xl font-bold text-emerald-200">
              {(cashback.cashbackBps / 100).toFixed(0)}%
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function OrdersLedger({
  orders,
  onPay,
}: {
  orders: BuildOrderRow[];
  onPay: (id: string) => void;
}) {
  return (
    <section id="orders" className="mt-12">
      <h2 className="text-lg font-bold text-white">Your orders</h2>
      <p className="mt-1 text-sm text-slate-400">
        Subscription starts and boost charges land here. Use «Pay (test)» below to flip a pending order to PAID — that's the stub
        for the future Stripe / YooKassa webhook.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2.5">Created</th>
              <th className="px-4 py-2.5">Kind</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((o) => {
              const tone =
                o.status === "PAID"
                  ? "text-emerald-300"
                  : o.status === "PENDING"
                    ? "text-amber-300"
                    : "text-slate-400";
              return (
                <tr key={o.id} className="text-slate-200">
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">{o.kind}</td>
                  <td className="px-4 py-2.5">
                    {o.amount > 0 ? `${o.amount.toLocaleString("ru-RU")} ${o.currency}` : "—"}
                  </td>
                  <td className={`px-4 py-2.5 font-semibold ${tone}`}>{o.status}</td>
                  <td className="px-4 py-2.5 text-right">
                    {o.status === "PENDING" && o.amount > 0 && (
                      <button
                        onClick={() => onPay(o.id)}
                        className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                      >
                        Pay (test)
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 px-6 py-10 sm:px-10 sm:py-14">
      <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
        QBuild · pricing
      </div>
      <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
        Платите за результат, а не за паки
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
        В отличие от HH, у нас все резюме видны на любом тарифе. Free Forever — навсегда. Pay-per-Hire — 0 ₽ до того как кандидат вышел на работу. Pro и Agency — ровно те функции, которые написаны в карточке: без скрытых платежей за &laquo;поднятие&raquo; и &laquo;премиум-объявление&raquo;.
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <Badge>0 ₽ за публикацию вакансии</Badge>
        <Badge>База резюме во всех тарифах</Badge>
        <Badge>Loyalty: 12% → 6% по мере наймов</Badge>
        <Badge>2% AEV cashback на каждый PAID заказ</Badge>
        <Badge>Cancel anytime</Badge>
      </div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
      {children}
    </span>
  );
}

function CycleToggle({
  cycle,
  setCycle,
}: {
  cycle: Cycle;
  setCycle: (c: Cycle) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-xs">
      <button
        onClick={() => setCycle("MONTHLY")}
        className={`rounded-full px-4 py-1.5 transition ${
          cycle === "MONTHLY" ? "bg-emerald-500 text-emerald-950 font-semibold" : "text-slate-300"
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => setCycle("YEARLY")}
        className={`rounded-full px-4 py-1.5 transition ${
          cycle === "YEARLY" ? "bg-emerald-500 text-emerald-950 font-semibold" : "text-slate-300"
        }`}
      >
        Yearly · −20%
      </button>
    </div>
  );
}

function PlanCard({
  plan,
  cycle,
  isCurrent,
  busy,
  onStart,
}: {
  plan: BuildPlan & { yearly: number };
  cycle: Cycle;
  isCurrent: boolean;
  busy: boolean;
  onStart: () => void;
}) {
  const isPro = plan.key === "PRO";
  const isPPH = plan.key === "PPHIRE";
  const showPrice = !isPPH;
  const priceMonthly = cycle === "YEARLY" ? Math.round(plan.yearly / 12) : plan.priceMonthly;

  return (
    <div
      className={`flex flex-col rounded-xl border p-5 ${
        isPro ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20" : "border-white/10 bg-white/5"
      }`}
    >
      {isPro && (
        <div className="mb-3 inline-flex w-fit rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-950">
          Most popular
        </div>
      )}
      <div className="text-sm font-bold uppercase tracking-wider text-slate-400">{plan.name}</div>
      <div className="mt-1 text-xs text-slate-400">{plan.tagline}</div>

      <div className="mt-5 flex items-baseline gap-2">
        {isPPH ? (
          <>
            <div className="text-3xl font-extrabold text-white">0 ₽</div>
            <div className="text-xs text-slate-400">upfront · 12% от оклада на найме</div>
          </>
        ) : showPrice && plan.priceMonthly === 0 ? (
          <>
            <div className="text-3xl font-extrabold text-white">Free</div>
            <div className="text-xs text-slate-400">forever</div>
          </>
        ) : (
          <>
            <div className="text-3xl font-extrabold text-white">
              {priceMonthly.toLocaleString("ru-RU")} ₽
            </div>
            <div className="text-xs text-slate-400">/ month</div>
          </>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-200">
        {plan.features.map((f, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onStart}
        disabled={busy || isCurrent}
        className={`mt-6 rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
          isCurrent
            ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : isPro
              ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              : "border border-white/10 bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {busy ? "…" : isCurrent ? "✓ Current plan" : plan.priceMonthly === 0 ? "Start free" : "Choose plan"}
      </button>
    </div>
  );
}

function ComparisonTable({ plans }: { plans: BuildPlan[] }) {
  if (plans.length === 0) return null;
  const free = plans.find((p) => p.key === "FREE");
  const pro = plans.find((p) => p.key === "PRO");
  const agency = plans.find((p) => p.key === "AGENCY");
  const pph = plans.find((p) => p.key === "PPHIRE");
  if (!free || !pro || !agency || !pph) return null;

  const rows: { label: string; hh: string; free: string; pro: string; agency: string; pph: string }[] = [
    { label: "Публикация вакансии", hh: HH_COMPARE.vacancyPost, free: "✓ бесплатно", pro: "✓", agency: "✓", pph: "✓" },
    { label: "Доступ к резюме / поиск кандидатов", hh: HH_COMPARE.resumeDb, free: "5 поисков / мес", pro: "∞", agency: "∞", pph: "∞" },
    { label: "Активных вакансий одновременно", hh: "по тарифу", free: "1", pro: "10", agency: "∞", pph: "∞" },
    { label: "Boost / премиум-размещение", hh: "от 1 000 ₽ за раз", free: "—", pro: "5 / мес", agency: "20 / мес", pph: "—" },
    { label: "Месячная плата", hh: "5 000–80 000 ₽", free: "0 ₽", pro: "4 990 ₽", agency: "14 990 ₽", pph: "0 ₽" },
    { label: "Комиссия с найма", hh: HH_COMPARE.hireFee, free: "0%", pro: "0%", agency: "0%", pph: "12%" },
    { label: "Скрытые платежи", hh: HH_COMPARE.hiddenFees, free: "нет", pro: "нет", agency: "нет", pph: "нет" },
    { label: "Public/share-страница вакансии", hh: "—", free: "✓", pro: "✓", agency: "✓ white-label", pph: "✓" },
    { label: "Cancel anytime", hh: "по договору", free: "—", pro: "✓", agency: "✓", pph: "✓" },
  ];

  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold text-white">Сравнение с HeadHunter</h2>
      <p className="mt-1 text-sm text-slate-400">
        Цифры HH — публичные тарифы на 2026-04. Реальные суммы зависят от региона и условий аккаунт-менеджера.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Параметр</th>
              <th className="px-4 py-3 text-rose-300">HH</th>
              <th className="px-4 py-3">Free</th>
              <th className="px-4 py-3 text-emerald-300">Pro</th>
              <th className="px-4 py-3">Agency</th>
              <th className="px-4 py-3">Pay-per-Hire</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.label} className="text-slate-200">
                <td className="px-4 py-3 font-medium">{r.label}</td>
                <td className="px-4 py-3 text-rose-200/80">{r.hh}</td>
                <td className="px-4 py-3 text-slate-300">{r.free}</td>
                <td className="px-4 py-3 text-emerald-200">{r.pro}</td>
                <td className="px-4 py-3 text-slate-300">{r.agency}</td>
                <td className="px-4 py-3 text-slate-300">{r.pph}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddOns() {
  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold text-white">Add-ons (доступны на любом тарифе)</h2>
      <p className="mt-1 text-sm text-slate-400">
        Не привязаны к подписке — берёте, когда нужно.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <AddOnCard
          title="Boost-вакансия"
          price="990 ₽"
          desc="Топ ленты на 7 дней + значок &laquo;featured&raquo;. 5-pack — 3 990 ₽ (на 17% дешевле)."
        />
        <AddOnCard
          title="Talent Day Pass"
          price="490 ₽"
          desc="Безлимит поиска кандидатов на 24 часа. Для разовых задач — без подписки."
        />
        <AddOnCard
          title="Verified Employer"
          price="2 990 ₽ / год"
          desc="Бейдж проверенного работодателя + повышенный приоритет в фиде. Проверка через AEVION QSign."
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Add-ons появятся в &laquo;Account → Billing&raquo; во время beta. Сейчас все add-ons бесплатно по запросу — пишите{" "}
        <Link href="/build/messages" className="text-emerald-300 underline">
          в чат поддержки
        </Link>
        .
      </p>
    </section>
  );
}

function AddOnCard({ title, price, desc }: { title: string; price: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-bold text-white">{title}</div>
      <div className="mt-1 text-2xl font-extrabold text-emerald-300">{price}</div>
      <p className="mt-2 text-xs text-slate-400">{desc}</p>
    </div>
  );
}

function Faq() {
  const items: { q: string; a: string }[] = [
    {
      q: "Чем Pay-per-Hire реально отличается от HH-агентства?",
      a: "12% от месячного оклада нового сотрудника против 15–25% у классических кадровых агентств и связки HH+рекрутер. Деньги хранятся в эскроу до выхода кандидата на первый рабочий день — если он не вышел, возврат 100%.",
    },
    {
      q: "Почему Free навсегда, а не 30 дней?",
      a: "Маленькой команде нужна одна вакансия раз в полгода. Заставлять её платить — глупо. Free Forever нужен, чтобы вы пользовались QBuild как телефоном: он есть, когда нужен.",
    },
    {
      q: "Что входит в boost-вакансию?",
      a: "7 дней закрепления в топе фида /build/vacancies (по дате создания и без учёта boost-конкурентов в это время). Значок &laquo;featured&raquo; в карточке. Аналитика просмотров.",
    },
    {
      q: "Я уже на Pro. Можно подключить Pay-per-Hire?",
      a: "Можно совместить: Pro даёт безлимит поиска, PPH — структуру оплаты найма. Включите PPH в настройках конкретной вакансии — это не отменит Pro.",
    },
    {
      q: "Что если я не нашёл кандидата за месяц?",
      a: "На Free и PPH ничего не теряете. На Pro/Agency можно либо поставить на паузу (вакансия скрыта, плата идёт), либо отменить — поданные вакансии живут до конца оплаченного периода.",
    },
  ];
  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold text-white">FAQ</h2>
      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <details
            key={it.q}
            className="group rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
          >
            <summary className="cursor-pointer list-none font-semibold text-slate-200 marker:hidden">
              <span className="mr-2 text-emerald-300 group-open:rotate-90 inline-block transition">›</span>
              {it.q}
            </summary>
            <p className="mt-2 pl-4 text-slate-400">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
