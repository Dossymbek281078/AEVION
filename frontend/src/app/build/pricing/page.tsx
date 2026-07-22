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
import { useToast } from "@/components/build/Toast";
import { useI18n } from "@/lib/i18n";

type Cycle = "MONTHLY" | "YEARLY";
const YEARLY_DISCOUNT = 0.2; // 20% off → 2 months free

export default function PricingPage() {
  const token = useBuildAuth((s) => s.token);

  const [plans, setPlans] = useState<BuildPlan[]>([]);
  const [sub, setSub] = useState<BuildSubscription | null>(null);
  const [orders, setOrders] = useState<BuildOrderRow[]>([]);
  const [tierDiscountBps, setTierDiscountBps] = useState(0);
  const [tierLabel, setTierLabel] = useState<string | null>(null);
  const [cycle, setCycle] = useState<Cycle>("MONTHLY");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<PlanKey | null>(null);
  const toast = useToast();

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
      token ? buildApi.loyaltyMe().catch(() => null) : Promise.resolve(null),
    ])
      .then(([p, s, o, l]) => {
        if (cancelled) return;
        setPlans(p.items);
        setSub(s.subscription);
        setOrders(o.items);
        if (l?.tier) {
          setTierDiscountBps(l.tier.subDiscountBps);
          setTierLabel(l.tier.label);
        }
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
      toast.error((e as Error).message);
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
      toast.success("Order paid ✓");
    } catch (e) {
      toast.error((e as Error).message);
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
              tierDiscountBps={tierDiscountBps}
              tierLabel={tierLabel}
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

function ClaimCashbackButton({ onClaimed }: { onClaimed: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function claim() {
    setBusy(true);
    setMsg(null);
    try {
      // Reuse a stable per-browser deviceId for the AEV bridge.
      let deviceId = typeof window !== "undefined" ? localStorage.getItem("aev-device-id") : null;
      if (!deviceId) {
        deviceId = `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
        if (typeof window !== "undefined") localStorage.setItem("aev-device-id", deviceId);
      }
      const r = await buildApi.claimCashback(deviceId);
      if (r.claimedRows === 0) {
        setMsg(t("build.pricing.cashback.allClaimed"));
      } else {
        setMsg(
          t("build.pricing.cashback.claimedResult", {
            amount: r.claimedAev.toLocaleString("ru-RU", { maximumFractionDigits: 4 }),
            count: r.claimedRows,
          }),
        );
      }
      onClaimed();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={claim}
        disabled={busy}
        className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? "…" : "💎 Claim AEV → wallet"}
      </button>
      {msg && <span className="text-xs text-emerald-200/80">{msg}</span>}
    </div>
  );
}

function LoyaltyBanner() {
  const { t } = useI18n();
  const token = useBuildAuth((s) => s.token);
  const [data, setData] = useState<Awaited<ReturnType<typeof buildApi.loyaltyMe>> | null>(null);
  const [cashback, setCashback] = useState<Awaited<ReturnType<typeof buildApi.loyaltyCashback>> | null>(null);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof buildApi.loyaltyTiers>>["items"]>([]);
  useEffect(() => {
    buildApi.loyaltyTiers().then((r) => setCatalog(r.items)).catch(() => {});
    if (!token) return;
    buildApi.loyaltyMe().then(setData).catch(() => {});
    buildApi.loyaltyCashback().then(setCashback).catch(() => {});
  }, [token]);

  const visibleTiers = catalog.length > 0 ? catalog : [];

  return (
    <section className="mt-12 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-slate-900 to-slate-900 px-6 py-8 sm:px-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-fuchsia-300">
            Loyalty · 5 tiers, automatic
          </div>
          <h2 className="mt-2 text-2xl font-bold text-white">
            {t("build.pricing.loyalty.headline")}
          </h2>
        </div>
        <Link
          href="/build/loyalty"
          className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
        >
          {t("build.pricing.loyalty.allBenefits")}
        </Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        {t("build.pricing.loyalty.introPre")} <span className="font-semibold text-fuchsia-200">12%</span>{t("build.pricing.loyalty.introMid1")} <span className="font-semibold text-fuchsia-200">4%</span>{t("build.pricing.loyalty.introMid2")} <span className="font-semibold text-emerald-200">2% → 5%</span>{t("build.pricing.loyalty.introMid3")} <span className="font-semibold text-cyan-200">−25%</span>{t("build.pricing.loyalty.introEnd")}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {visibleTiers.map((tier) => {
          const reached = data ? data.hires >= tier.minHires : false;
          const current = data ? data.tier?.key === tier.key : tier.minHires === 0;
          return (
            <div
              key={tier.key}
              className={`rounded-xl border p-4 text-sm ${
                current
                  ? "border-fuchsia-400 bg-fuchsia-500/15 text-white"
                  : reached
                    ? "border-fuchsia-500/40 bg-fuchsia-500/5 text-fuchsia-100"
                    : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wider">
                {tier.label}
                {current && <span className="ml-1 text-fuchsia-200">{t("build.pricing.loyalty.youTag")}</span>}
              </div>
              <div className="mt-1 text-3xl font-bold">{tier.hireFeePct}%</div>
              <div className="text-xs text-slate-400">
                {tier.minHires === 0
                  ? t("build.pricing.loyalty.fromFirstHire")
                  : t("build.pricing.loyalty.fromNHires", { count: tier.minHires })}
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                  +{(tier.cashbackBps / 100).toFixed(1)}% cashback
                </span>
                {tier.subDiscountBps > 0 && (
                  <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-cyan-200">
                    −{tier.subDiscountBps / 100}% sub
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {data && (
        <div className="mt-4 text-xs text-fuchsia-100/80">
          {t("build.pricing.loyalty.progressPre", { hires: data.hires })}{" "}
          <span className="font-semibold text-white">{data.tier.label}</span>
          {data.next &&
            t("build.pricing.loyalty.progressNext", {
              label: data.next.label,
              hiresToNext: data.next.hiresToNext,
              progressPct: data.next.progressPct,
            })}
        </div>
      )}
      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
        💎 {data ? `+${(data.tier.cashbackBps / 100).toFixed(1)}%` : "+2%"} {t("build.pricing.loyalty.cashbackOnAnyPayment")}
      </div>
      {cashback && cashback.entries > 0 && (
        <div className="mt-4 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-300">Earned cashback</div>
              <div className="mt-1 text-2xl font-bold text-emerald-200">
                {cashback.totalAev.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} AEV
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-300">{t("build.pricing.loyalty.paidOrders")}</div>
              <div className="mt-1 text-2xl font-bold text-emerald-200">{cashback.entries}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-300">{t("build.pricing.loyalty.currentRate")}</div>
              <div className="mt-1 text-2xl font-bold text-emerald-200">
                {(cashback.cashbackBps / 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <ClaimCashbackButton onClaimed={() => {
            buildApi.loyaltyCashback().then(setCashback).catch(() => {});
          }} />
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
        Subscription and boost charges. Pending orders are confirmed automatically via the payment provider webhook.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full sm:min-w-[640px] text-left text-sm">
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
                        Pay
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
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 px-6 py-10 sm:px-10 sm:py-14">
      <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
        QBuild · pricing
      </div>
      <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
        {t("build.pricing.hero.title")}
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
        {t("build.pricing.hero.subtitle")}
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <Badge>{t("build.pricing.hero.badge1")}</Badge>
        <Badge>{t("build.pricing.hero.badge2")}</Badge>
        <Badge>{t("build.pricing.hero.badge3")}</Badge>
        <Badge>{t("build.pricing.hero.badge4")}</Badge>
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
  tierDiscountBps,
  tierLabel,
}: {
  plan: BuildPlan & { yearly: number };
  cycle: Cycle;
  isCurrent: boolean;
  busy: boolean;
  onStart: () => void;
  tierDiscountBps: number;
  tierLabel: string | null;
}) {
  const { t } = useI18n();
  const isPro = plan.key === "PRO";
  const isPPH = plan.key === "PPHIRE";
  const showPrice = !isPPH;
  const baseMonthly = cycle === "YEARLY" ? Math.round(plan.yearly / 12) : plan.priceMonthly;
  // Apply loyalty-tier discount on top of yearly cycle. Both stack
  // multiplicatively: yearly already gives ~17% off, tier shaves more.
  const discountFactor =
    tierDiscountBps > 0 ? Math.max(0, 10000 - tierDiscountBps) / 10000 : 1;
  const priceMonthly =
    plan.priceMonthly > 0 ? Math.round(baseMonthly * discountFactor) : baseMonthly;
  const hasDiscount =
    plan.priceMonthly > 0 && tierDiscountBps > 0 && priceMonthly < baseMonthly;

  return (
    <div
      className={`flex flex-col rounded-xl border p-5 ${
        isPro ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20" : "border-white/10 bg-white/5"
      }`}
    >
      {isPro && (
        <div className="mb-3 inline-flex w-fit rounded-full bg-emerald-500 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-950">
          Most popular
        </div>
      )}
      <div className="text-sm font-bold uppercase tracking-wider text-slate-400">{plan.name}</div>
      <div className="mt-1 text-xs text-slate-400">{plan.tagline}</div>

      <div className="mt-5 flex items-baseline gap-2">
        {isPPH ? (
          <>
            <div className="text-3xl font-extrabold text-white">0 ₽</div>
            <div className="text-xs text-slate-400">{t("build.pricing.plan.pphUpfront")}</div>
          </>
        ) : showPrice && plan.priceMonthly === 0 ? (
          <>
            <div className="text-3xl font-extrabold text-white">Free</div>
            <div className="text-xs text-slate-400">forever</div>
          </>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-extrabold text-white">
                {priceMonthly.toLocaleString("ru-RU")} ₽
              </div>
              {hasDiscount && (
                <div className="text-sm text-slate-500 line-through">
                  {baseMonthly.toLocaleString("ru-RU")}
                </div>
              )}
              <div className="text-xs text-slate-400">/ month</div>
            </div>
            {hasDiscount && tierLabel && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-1 text-xs font-semibold text-fuchsia-200">
                <span>{tierLabel} −{tierDiscountBps / 100}%</span>
              </div>
            )}
          </div>
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
  const { t } = useI18n();
  if (plans.length === 0) return null;
  const free = plans.find((p) => p.key === "FREE");
  const pro = plans.find((p) => p.key === "PRO");
  const agency = plans.find((p) => p.key === "AGENCY");
  const pph = plans.find((p) => p.key === "PPHIRE");
  if (!free || !pro || !agency || !pph) return null;

  const rows: { id: string; label: string; hh: string; free: string; pro: string; agency: string; pph: string }[] = [
    {
      id: "vacancyPost",
      label: t("build.pricing.compare.row.vacancyPost.label"),
      hh: t("build.pricing.compare.row.vacancyPost.hh"),
      free: t("build.pricing.compare.row.vacancyPost.free"),
      pro: "✓",
      agency: "✓",
      pph: "✓",
    },
    {
      id: "resumeDb",
      label: t("build.pricing.compare.row.resumeDb.label"),
      hh: t("build.pricing.compare.row.resumeDb.hh"),
      free: t("build.pricing.compare.row.resumeDb.free"),
      pro: "∞",
      agency: "∞",
      pph: "∞",
    },
    {
      id: "activeVacancies",
      label: t("build.pricing.compare.row.activeVacancies.label"),
      hh: t("build.pricing.compare.row.activeVacancies.hh"),
      free: "1",
      pro: "10",
      agency: "∞",
      pph: "∞",
    },
    {
      id: "boost",
      label: t("build.pricing.compare.row.boost.label"),
      hh: t("build.pricing.compare.row.boost.hh"),
      free: "—",
      pro: t("build.pricing.compare.row.boost.pro"),
      agency: t("build.pricing.compare.row.boost.agency"),
      pph: "—",
    },
    {
      id: "monthlyFee",
      label: t("build.pricing.compare.row.monthlyFee.label"),
      hh: "5 000–80 000 ₽",
      free: "0 ₽",
      pro: "4 990 ₽",
      agency: "14 990 ₽",
      pph: "0 ₽",
    },
    {
      id: "hireFee",
      label: t("build.pricing.compare.row.hireFee.label"),
      hh: t("build.pricing.compare.row.hireFee.hh"),
      free: "0%",
      pro: "0%",
      agency: "0%",
      pph: "12%",
    },
    {
      id: "hiddenFees",
      label: t("build.pricing.compare.row.hiddenFees.label"),
      hh: t("build.pricing.compare.row.hiddenFees.hh"),
      free: t("build.pricing.compare.row.hiddenFees.value"),
      pro: t("build.pricing.compare.row.hiddenFees.value"),
      agency: t("build.pricing.compare.row.hiddenFees.value"),
      pph: t("build.pricing.compare.row.hiddenFees.value"),
    },
    {
      id: "publicPage",
      label: t("build.pricing.compare.row.publicPage.label"),
      hh: "—",
      free: "✓",
      pro: "✓",
      agency: "✓ white-label",
      pph: "✓",
    },
    {
      id: "cancelAnytime",
      label: "Cancel anytime",
      hh: t("build.pricing.compare.row.cancelAnytime.hh"),
      free: "—",
      pro: "✓",
      agency: "✓",
      pph: "✓",
    },
  ];

  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold text-white">{t("build.pricing.compare.heading")}</h2>
      <p className="mt-1 text-sm text-slate-400">
        {t("build.pricing.compare.disclaimer")}
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full sm:min-w-[720px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">{t("build.pricing.compare.header.parameter")}</th>
              <th className="px-4 py-3 text-rose-300">HH</th>
              <th className="px-4 py-3">Free</th>
              <th className="px-4 py-3 text-emerald-300">Pro</th>
              <th className="px-4 py-3">Agency</th>
              <th className="px-4 py-3">Pay-per-Hire</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.id} className="text-slate-200">
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
  const { t } = useI18n();
  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold text-white">{t("build.pricing.addOns.heading")}</h2>
      <p className="mt-1 text-sm text-slate-400">
        {t("build.pricing.addOns.subheading")}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <AddOnCard
          title={t("build.pricing.addOns.boost.title")}
          price="990 ₽"
          desc={t("build.pricing.addOns.boost.desc")}
        />
        <AddOnCard
          title="Talent Day Pass"
          price="490 ₽"
          desc={t("build.pricing.addOns.talentPass.desc")}
        />
        <AddOnCard
          title="Verified Employer"
          price={t("build.pricing.addOns.verifiedEmployer.price")}
          desc={t("build.pricing.addOns.verifiedEmployer.desc")}
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {t("build.pricing.addOns.footerPre")}{" "}
        <Link href="/build/messages" className="text-emerald-300 underline">
          {t("build.pricing.addOns.footerLink")}
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
  const { t } = useI18n();
  const items: { id: string; q: string; a: string }[] = [
    {
      id: "vsAgency",
      q: t("build.pricing.faq.vsAgency.q"),
      a: t("build.pricing.faq.vsAgency.a"),
    },
    {
      id: "whyFreeForever",
      q: t("build.pricing.faq.whyFreeForever.q"),
      a: t("build.pricing.faq.whyFreeForever.a"),
    },
    {
      id: "whatsInBoost",
      q: t("build.pricing.faq.whatsInBoost.q"),
      a: t("build.pricing.faq.whatsInBoost.a"),
    },
    {
      id: "proPlusPph",
      q: t("build.pricing.faq.proPlusPph.q"),
      a: t("build.pricing.faq.proPlusPph.a"),
    },
    {
      id: "noHireInMonth",
      q: t("build.pricing.faq.noHireInMonth.q"),
      a: t("build.pricing.faq.noHireInMonth.a"),
    },
  ];
  return (
    <section className="mt-12">
      <h2 className="text-lg font-bold text-white">FAQ</h2>
      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <details
            key={it.id}
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
