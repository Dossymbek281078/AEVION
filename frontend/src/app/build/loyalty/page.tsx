"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { useBuildAuth } from "@/lib/build/auth";
import { buildApi, type TierKey } from "@/lib/build/api";
import { useI18n } from "@/lib/i18n";

type TiersCatalogItem = Awaited<ReturnType<typeof buildApi.loyaltyTiers>>["items"][number];
type LoyaltyMe = Awaited<ReturnType<typeof buildApi.loyaltyMe>>;
type CashbackData = Awaited<ReturnType<typeof buildApi.loyaltyCashback>>;

// Visual identity per tier — kept in the frontend so we can theme the
// cards without hauling palette decisions into the API surface.
const TIER_THEME: Record<TierKey, { bg: string; ring: string; text: string; chip: string; emoji: string }> = {
  DEFAULT: {
    bg: "from-slate-800/60 to-slate-900/60",
    ring: "border-white/10",
    text: "text-slate-300",
    chip: "bg-white/10 text-slate-300",
    emoji: "🪨",
  },
  BRONZE: {
    bg: "from-amber-900/30 to-slate-900/60",
    ring: "border-amber-700/40",
    text: "text-amber-200",
    chip: "bg-amber-700/30 text-amber-100",
    emoji: "🥉",
  },
  SILVER: {
    bg: "from-slate-500/15 to-slate-900/60",
    ring: "border-slate-400/40",
    text: "text-slate-100",
    chip: "bg-slate-400/30 text-slate-100",
    emoji: "🥈",
  },
  GOLD: {
    bg: "from-yellow-500/15 to-amber-900/30",
    ring: "border-yellow-400/40",
    text: "text-yellow-100",
    chip: "bg-yellow-500/25 text-yellow-100",
    emoji: "🥇",
  },
  PLATINUM: {
    bg: "from-fuchsia-500/15 via-cyan-500/10 to-slate-900/60",
    ring: "border-fuchsia-400/50",
    text: "text-fuchsia-100",
    chip: "bg-fuchsia-500/25 text-fuchsia-100",
    emoji: "💎",
  },
};

export default function LoyaltyPage() {
  const { t } = useI18n();
  const token = useBuildAuth((s) => s.token);
  const [tiers, setTiers] = useState<TiersCatalogItem[]>([]);
  const [me, setMe] = useState<LoyaltyMe | null>(null);
  const [cashback, setCashback] = useState<CashbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      buildApi.loyaltyTiers(),
      token ? buildApi.loyaltyMe().catch(() => null) : Promise.resolve(null),
      token ? buildApi.loyaltyCashback().catch(() => null) : Promise.resolve(null),
    ])
      .then(([t, m, c]) => {
        if (cancelled) return;
        setTiers(t.items);
        setMe(m);
        setCashback(c);
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <BuildShell>
      <Hero />

      {error && (
        <p className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {loading && <p className="mt-6 text-sm text-slate-400">Loading tiers…</p>}

      {!loading && me && <CurrentStatus me={me} cashback={cashback} />}
      {!loading && !token && <UnauthHint />}

      {!loading && tiers.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-white">{t("build.loyalty.tiersHeading")}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {t("build.loyalty.tiersSubheading")}
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-5 md:grid-cols-2 sm:grid-cols-1">
            {tiers.map((t) => (
              <TierCard
                key={t.key}
                tier={t}
                isCurrent={me?.tier.key === t.key}
                isReached={me ? me.hires >= t.minHires : false}
              />
            ))}
          </div>
        </section>
      )}

      <Investors />
      <Faq />
    </BuildShell>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-emerald-500/5 to-slate-900 px-6 py-10 sm:px-10 sm:py-14">
      <div className="text-xs font-bold uppercase tracking-wider text-fuchsia-300">
        AEV · Loyalty Program
      </div>
      <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
        {t("build.loyalty.heroHeadline")}
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
        {t("build.loyalty.heroBodyPre")}
        <span className="font-semibold text-fuchsia-200">{t("build.loyalty.heroBodyHighlight1")}</span>
        {t("build.loyalty.heroBodyMid1")}
        <span className="font-semibold text-emerald-200">{t("build.loyalty.heroBodyHighlight2")}</span>
        {t("build.loyalty.heroBodyMid2")}
        <span className="font-semibold text-cyan-200">{t("build.loyalty.heroBodyHighlight3")}</span>
        {t("build.loyalty.heroBodyMid3")}
        <span className="font-semibold text-amber-200">{t("build.loyalty.heroBodyHighlight4")}</span>
        {t("build.loyalty.heroBodyEnd")}
      </p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <Badge>5 tiers · automatic</Badge>
        <Badge>{t("build.loyalty.badgeCashback")}</Badge>
        <Badge>{t("build.loyalty.badgeHireFee")}</Badge>
        <Badge>{t("build.loyalty.badgeSubDiscount")}</Badge>
        <Badge>{t("build.loyalty.badgeBoostSlots")}</Badge>
      </div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200">
      {children}
    </span>
  );
}

function CurrentStatus({ me, cashback }: { me: LoyaltyMe; cashback: CashbackData | null }) {
  const { t } = useI18n();
  const theme = TIER_THEME[me.tier.key];

  return (
    <section
      className={`mt-8 rounded-2xl border bg-gradient-to-br ${theme.bg} ${theme.ring} px-6 py-7`}
    >
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex-1 min-w-[240px]">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t("build.loyalty.currentTierLabel")}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-5xl">{theme.emoji}</span>
            <h2 className={`text-3xl font-bold ${theme.text}`}>{me.tier.label}</h2>
            <span className="text-xs text-slate-400">{t("build.loyalty.hiresCount", { hires: me.hires })}</span>
          </div>

          {me.next ? (
            <div className="mt-5">
              <div className="flex items-end justify-between text-xs">
                <span className="text-slate-400">
                  {t("build.loyalty.toNextTierPrefix", { label: me.next.label })}{" "}
                  <span className="font-semibold text-white">{me.next.hiresToNext}</span>{" "}
                  {t("build.loyalty.toNextTierSuffix")}
                </span>
                <span className="text-slate-400">{me.next.progressPct}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-fuchsia-400 to-cyan-400 transition-all"
                  style={{ width: `${me.next.progressPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {t("build.loyalty.nextTierStats", {
                  label: me.next.label,
                  hireFeePct: me.next.hireFeePct,
                  cashback: (me.next.cashbackBps / 100).toFixed(1),
                })}
                {me.next.subDiscountBps > 0 &&
                  t("build.loyalty.nextTierSubDiscount", { pct: me.next.subDiscountBps / 100 })}
              </p>
            </div>
          ) : (
            <p className="mt-5 text-xs text-fuchsia-200">
              {t("build.loyalty.maxTierReached")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Hire-fee" value={`${me.tier.hireFeePct}%`} hint="Pay-per-Hire" />
          <Stat label="Cashback" value={`${(me.tier.cashbackBps / 100).toFixed(1)}%`} hint={t("build.loyalty.statHintCashback")} />
          <Stat label="Sub. discount" value={me.tier.subDiscountBps > 0 ? `−${me.tier.subDiscountBps / 100}%` : "—"} hint={t("build.loyalty.statHintSubDiscount")} />
          <Stat label="Boost +" value={me.tier.boostSlotsBonus > 0 ? `+${me.tier.boostSlotsBonus}` : "—"} hint={t("build.loyalty.statHintBoost")} />
        </div>
      </div>

      {cashback && cashback.entries > 0 && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-300">{t("build.loyalty.cashbackAccrued")}</div>
              <div className="mt-1 text-2xl font-bold text-emerald-200">
                {cashback.totalAev.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} AEV
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-300">{t("build.loyalty.cashbackOrders")}</div>
              <div className="mt-1 text-2xl font-bold text-emerald-200">{cashback.entries}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-300">{t("build.loyalty.cashbackCurrentRate")}</div>
              <div className="mt-1 text-2xl font-bold text-emerald-200">
                {(cashback.cashbackBps / 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-emerald-200/70">
            {t("build.loyalty.cashbackWithdrawPre")}{" "}
            <Link href="/build/pricing" className="underline">
              /build/pricing
            </Link>
            {t("build.loyalty.cashbackWithdrawPost")}
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-slate-500">{hint}</div>
    </div>
  );
}

function UnauthHint() {
  const { t } = useI18n();
  return (
    <section className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm text-slate-200">
      <p>
        {t("build.loyalty.unauthPre")}{" "}
        <Link href="/build/profile" className="font-semibold text-emerald-300 underline">
          {t("build.loyalty.unauthLinkText")}
        </Link>
        {t("build.loyalty.unauthPost")}
      </p>
    </section>
  );
}

function TierCard({
  tier,
  isCurrent,
  isReached,
}: {
  tier: TiersCatalogItem;
  isCurrent: boolean;
  isReached: boolean;
}) {
  const { t } = useI18n();
  const theme = TIER_THEME[tier.key];
  return (
    <div
      className={`flex flex-col rounded-xl border p-4 transition ${
        isCurrent
          ? `${theme.ring} bg-gradient-to-br ${theme.bg} ring-2 ring-fuchsia-400/50`
          : isReached
            ? `${theme.ring} bg-gradient-to-br ${theme.bg} opacity-95`
            : "border-white/10 bg-white/5 opacity-70"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-2xl">{theme.emoji}</div>
        {isCurrent && (
          <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">
            {t("build.loyalty.tierBadgeCurrent")}
          </span>
        )}
        {!isCurrent && isReached && (
          <span className="rounded-full bg-emerald-500/30 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200">
            {t("build.loyalty.tierBadgeReached")}
          </span>
        )}
      </div>
      <div className={`mt-2 text-lg font-bold ${theme.text}`}>{tier.label}</div>
      <div className="text-xs text-slate-400">{t("build.loyalty.tierMinHires", { minHires: tier.minHires })}</div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-md bg-black/30 px-2 py-1.5">
          <div className="text-[10px] uppercase text-slate-400">Hire-fee</div>
          <div className="text-base font-bold text-white">{tier.hireFeePct}%</div>
        </div>
        <div className="rounded-md bg-black/30 px-2 py-1.5">
          <div className="text-[10px] uppercase text-slate-400">Cashback</div>
          <div className="text-base font-bold text-emerald-300">
            {(tier.cashbackBps / 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <ul className="mt-4 flex-1 space-y-1.5 text-xs text-slate-300">
        {tier.perks.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-fuchsia-400" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Investors() {
  const { t } = useI18n();
  return (
    <section className="mt-12 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-slate-900 px-6 py-8 sm:px-10">
      <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
        Why this is a moat — investor view
      </div>
      <h2 className="mt-2 text-2xl font-bold text-white">
        {t("build.loyalty.investorsTitle")}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Insight
          icon="🧩"
          title={t("build.loyalty.insight1Title")}
          body={t("build.loyalty.insight1Body")}
        />
        <Insight
          icon="🚀"
          title={t("build.loyalty.insight2Title")}
          body={t("build.loyalty.insight2Body")}
        />
        <Insight
          icon="🛡️"
          title="Defensible data"
          body={t("build.loyalty.insight3Body")}
        />
        <Insight
          icon="💸"
          title={t("build.loyalty.insight4Title")}
          body={t("build.loyalty.insight4Body")}
        />
      </div>
      <Link
        href="/build/why-aevion"
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-bold text-cyan-950 hover:bg-cyan-400"
      >
        {t("build.loyalty.investorsCta")}
      </Link>
    </section>
  );
}

function Insight({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-2xl">{icon}</div>
      <div className="mt-1 text-sm font-bold text-white">{title}</div>
      <p className="mt-1 text-xs text-slate-400">{body}</p>
    </div>
  );
}

function Faq() {
  const { t } = useI18n();
  const items: { q: string; a: string }[] = [
    {
      q: t("build.loyalty.faqQ1"),
      a: t("build.loyalty.faqA1"),
    },
    {
      q: t("build.loyalty.faqQ2"),
      a: t("build.loyalty.faqA2"),
    },
    {
      q: t("build.loyalty.faqQ3"),
      a: t("build.loyalty.faqA3"),
    },
    {
      q: t("build.loyalty.faqQ4"),
      a: t("build.loyalty.faqA4"),
    },
    {
      q: t("build.loyalty.faqQ5"),
      a: t("build.loyalty.faqA5"),
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
              <span className="mr-2 text-fuchsia-300 group-open:rotate-90 inline-block transition">›</span>
              {it.q}
            </summary>
            <p className="mt-2 pl-4 text-slate-400">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
