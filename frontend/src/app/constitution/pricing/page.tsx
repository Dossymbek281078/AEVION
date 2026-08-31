"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFunnel } from "@/lib/useFunnel";
import { useI18n } from "@/lib/i18n";
import { PageTracking } from "@/components/PageTracking";

type Tier = {
  id: "free" | "pro" | "team";
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
};

export default function ConstitutionPricingPage() {
  const { t } = useI18n();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Касса возвращает сюда с ?stub=1, когда платёжный провайдер не настроен.
  // До 29.08.2026 страница этот признак не читала: человек нажимал «Купить»,
  // молча оказывался на той же странице и не понимал, что произошло. Нажал бы
  // ещё раз — и снова ничего. Такая поломка не падает и никем не видна.
  //
  // Признак берётся в useEffect, а не из useSearchParams: страница не обязана
  // из-за него оборачиваться в Suspense, а до гидратации показывать нечего.
  const [payUnavailable, setPayUnavailable] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPayUnavailable(new URLSearchParams(window.location.search).get("stub") === "1");
  }, []);
  const [showWaitlist, setShowWaitlist] = useState<boolean>(false);
  const { track } = useFunnel();

  const TIERS: Tier[] = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      period: "forever",
      tagline: t("constitution.pricing.tier.free.tagline"),
      features: [
        t("constitution.pricing.tier.free.feature.saved"),
        t("constitution.pricing.tier.free.feature.aiAdvisor"),
        t("constitution.pricing.tier.free.feature.pdf"),
        t("constitution.pricing.tier.free.feature.controls"),
        t("constitution.pricing.tier.free.feature.academy"),
        t("constitution.pricing.tier.free.feature.localStorage"),
      ],
      cta: t("constitution.pricing.tier.free.cta"),
      ctaHref: "/constitution",
    },
    {
      id: "pro",
      name: "Pro",
      price: "$9",
      period: t("constitution.pricing.tier.period.monthly"),
      tagline: t("constitution.pricing.tier.pro.tagline"),
      features: [
        t("constitution.pricing.tier.pro.feature.saves"),
        t("constitution.pricing.tier.pro.feature.aiAdvisor"),
        t("constitution.pricing.tier.pro.feature.pdf"),
        t("constitution.pricing.tier.pro.feature.embed"),
        t("constitution.pricing.tier.pro.feature.analytics"),
        t("constitution.pricing.tier.pro.feature.support"),
        t("constitution.pricing.tier.pro.feature.allFree"),
      ],
      cta: "Upgrade to Pro →",
      ctaHref: "https://aevion.gumroad.com/l/pyiaz",
      highlight: true,
    },
    {
      id: "team",
      name: "Team",
      price: "$49",
      period: t("constitution.pricing.tier.period.monthly"),
      tagline: t("constitution.pricing.tier.team.tagline"),
      features: [
        t("constitution.pricing.tier.team.feature.seats"),
        t("constitution.pricing.tier.team.feature.admin"),
        t("constitution.pricing.tier.team.feature.shared"),
        t("constitution.pricing.tier.team.feature.csv"),
        t("constitution.pricing.tier.team.feature.embed"),
        t("constitution.pricing.tier.team.feature.academy"),
        t("constitution.pricing.tier.team.feature.support"),
        t("constitution.pricing.tier.team.feature.allPro"),
      ],
      cta: "Get Team →",
      ctaHref: "https://aevion.gumroad.com/l/wjvquw",
    },
  ];

  const FAQS: Array<{ q: string; a: string }> = [
    {
      q: t("constitution.pricing.faq.diffProFree.q"),
      a: t("constitution.pricing.faq.diffProFree.a"),
    },
    {
      q: t("constitution.pricing.faq.cancelAnytime.q"),
      a: t("constitution.pricing.faq.cancelAnytime.a"),
    },
    {
      q: t("constitution.pricing.faq.teamSeats.q"),
      a: t("constitution.pricing.faq.teamSeats.a"),
    },
    {
      q: t("constitution.pricing.faq.qsign.q"),
      a: t("constitution.pricing.faq.qsign.a"),
    },
    {
      q: t("constitution.pricing.faq.education.q"),
      a: t("constitution.pricing.faq.education.a"),
    },
    {
      q: t("constitution.pricing.faq.aiNotWorking.q"),
      a: t("constitution.pricing.faq.aiNotWorking.a"),
    },
    {
      q: t("constitution.pricing.faq.dataStored.q"),
      a: t("constitution.pricing.faq.dataStored.a"),
    },
    {
      q: t("constitution.pricing.faq.grant.q"),
      a: t("constitution.pricing.faq.grant.a"),
    },
    {
      q: t("constitution.pricing.faq.selfHost.q"),
      a: t("constitution.pricing.faq.selfHost.a"),
    },
    {
      q: t("constitution.pricing.faq.embed.q"),
      a: t("constitution.pricing.faq.embed.a"),
    },
  ];

  useEffect(() => { track("page_view", { source: "pricing" }); }, [track]);

  // Waitlist modal triggers: 30s on page OR exit-intent (mouseleave at top)
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = !!window.localStorage.getItem("constitution.waitlist.dismissed");
    } catch { /* ignore */ }
    if (dismissed) return;
    const timer = window.setTimeout(() => setShowWaitlist(true), 30_000);
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 5) setShowWaitlist(true);
    };
    document.addEventListener("mouseleave", onMouseLeave);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  const closeWaitlist = () => {
    setShowWaitlist(false);
    try {
      window.localStorage.setItem("constitution.waitlist.dismissed", new Date().toISOString());
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1736] via-[#131f3d] to-[#050a1a] text-[#e7ecf8] p-6">
      {/* Общий замер платформы. Свою подробную воронку модуль ведёт сам
          (useFunnel → /api/constitution/funnel/track), но она отдельная: в
          сводке платформы посещения Конституции не появлялись ВООБЩЕ, хотя
          это страница с кнопкой покупки. Два канала намеренно: этот отвечает
          на «сколько человек пришло на AEVION и сколько ушло платить»,
          складывать их между собой нельзя. */}
      <PageTracking page="constitution-pricing" />
      {payUnavailable ? (
        <div
          role="status"
          className="mx-auto mb-6 max-w-3xl rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100"
        >
          <strong className="block mb-1">{t("constitution.pay.unavailableTitle")}</strong>
          {t("constitution.pay.unavailableBody")}
        </div>
      ) : null}
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 text-center">
          <Link href="/constitution" className="text-[#d4af37] hover:underline text-sm">
            ← Constitution
          </Link>
          <h1 className="text-3xl md:text-5xl font-bold mt-2 text-[#d4af37]">
            Constitution Pricing
          </h1>
          <p className="text-[#9aa3c0] mt-3 max-w-2xl mx-auto">
            {t("constitution.pricing.header.subtitle")}
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-[#0b1736]/60 border rounded-2xl p-6 ${
                tier.highlight
                  ? "border-fuchsia-400/60 ring-2 ring-fuchsia-400/30 scale-[1.02]"
                  : "border-[#d4af37]/25"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-[#0b1736] text-xs font-bold px-3 py-1 rounded-full">
                  ★ MOST POPULAR
                </div>
              )}
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-[#9aa3c0]">
                  {tier.name}
                </div>
                <div className="mt-2 flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-[#d4af37]">{tier.price}</span>
                  <span className="text-sm text-[#9aa3c0]">{tier.period}</span>
                </div>
                <div className="text-sm text-[#f5d27a] mt-2">{tier.tagline}</div>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span className="text-[#e7ecf8]">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={tier.ctaHref}
                target={tier.id !== "free" ? "_blank" : undefined}
                rel={tier.id !== "free" ? "noopener noreferrer" : undefined}
                onClick={() => {
                  if (tier.id !== "free") track("upgrade_click", { tier: tier.id });
                }}
                className={`mt-6 block text-center px-4 py-3 rounded-lg font-bold transition ${
                  tier.highlight
                    ? "bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-[#0b1736] hover:opacity-90"
                    : "border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10"
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </section>

        <section className="bg-[#0b1736]/40 border border-[#d4af37]/15 rounded-xl p-6 mb-12">
          <h2 className="text-xl font-bold text-[#f5d27a] mb-4 text-center">
            Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#d4af37]/20">
                  <th className="text-left py-2 text-[#9aa3c0] font-normal">Feature</th>
                  <th className="py-2 text-[#d4af37]">Free</th>
                  <th className="py-2 text-[#f472b6]">Pro</th>
                  <th className="py-2 text-cyan-300">Team</th>
                </tr>
              </thead>
              <tbody className="text-[#e7ecf8]">
                <CompareRow feature={t("constitution.pricing.compare.feature.saved")} free="5" pro="♾" team="♾" />
                <CompareRow feature={t("constitution.pricing.compare.feature.aiAdvisor")} free="10" pro="♾" team="♾" />
                <CompareRow feature={t("constitution.pricing.compare.feature.pdfWatermark")} free="—" pro="✓" team="✓" />
                <CompareRow feature={t("constitution.pricing.compare.feature.themes")} free="—" pro="✓" team="✓" />
                <CompareRow feature={t("constitution.pricing.compare.feature.embed")} free="watermarked" pro="clean" team="branded" />
                <CompareRow feature="Seats" free="1" pro="1" team="5+" />
                <CompareRow feature="Admin dashboard" free="—" pro="—" team="✓" />
                <CompareRow feature="Shared scenarios" free="—" pro="—" team="✓" />
                <CompareRow feature={t("constitution.pricing.compare.feature.csv")} free="—" pro="✓" team="✓" />
                <CompareRow feature="Priority support" free="—" pro="Email" team="Slack" />
                <CompareRow feature="Real-time collab" free="✓" pro="✓" team="✓" />
                <CompareRow feature={t("constitution.pricing.compare.feature.certificate")} free="✓" pro="✓" team="✓" />
                <CompareRow feature="Planet publish" free="✓" pro="✓" team="✓" />
                <CompareRow feature="Public REST API" free="✓ (240/min)" pro="✓ (240/min)" team="✓ (1200/min)" />
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[#f5d27a] mb-4 text-center">FAQ</h2>
          <div className="max-w-3xl mx-auto space-y-2">
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={i}
                  className="bg-[#0b1736]/60 border border-[#d4af37]/20 rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full text-left px-4 py-3 flex justify-between items-center hover:bg-[#d4af37]/5"
                  >
                    <span className="font-medium">{faq.q}</span>
                    <span className="text-[#d4af37] text-xl flex-shrink-0 ml-3">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 text-sm text-[#9aa3c0] leading-relaxed border-t border-[#d4af37]/10">
                      <div className="pt-3">{faq.a}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-12 text-center text-xs text-[#9aa3c0]">
          <p>
            {t("constitution.pricing.footer.disclaimer")}{" "}
            <a href="mailto:support@aevion.app" className="text-[#d4af37] hover:underline">
              support@aevion.app
            </a>
            .
          </p>
        </footer>
      </div>
      {showWaitlist && <WaitlistModal onClose={closeWaitlist} />}
    </div>
  );
}

function WaitlistModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("constitution.pricing.waitlist.emailInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api-backend/api/constitution/waitlist/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "pricing-modal" }),
      });
      if (!r.ok) {
        const bodyText = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}: ${bodyText.slice(0, 120)}`);
      }
      // Ручка подписки честно называет, КУДА легла запись: "postgres" —
      // сохранена, всё остальное значит запасное хранилище в памяти процесса,
      // которое не переживёт перезапуск. Раньше здесь читался только код
      // ответа, и человек получал подтверждение для потерянной подписки —
      // ровно тот же дефект, что был у общей формы приёма адресов.
      const data = (await r.json().catch(() => ({}))) as { storage?: string };
      if ((data.storage ?? "postgres") !== "postgres") {
        setError(
          "Адрес приняли, но сохранить его насовсем сейчас не вышло — это на нашей стороне. Отправьте ещё раз через минуту.",
        );
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "subscribe_failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="bg-[#0b1736] border border-fuchsia-400/40 rounded-xl p-6 max-w-md w-full">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-3xl mb-2">📨</div>
            <h3 className="text-xl font-bold text-fuchsia-300">
              {t("constitution.pricing.waitlist.title")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9aa3c0] hover:text-white text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {!done ? (
          <>
            <p className="text-sm text-[#9aa3c0] mb-4">
              {t("constitution.pricing.waitlist.body")}
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={120}
              className="w-full bg-[#050a1a] border border-fuchsia-400/30 rounded px-3 py-2 text-sm mb-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            {error && (
              <div className="text-xs text-rose-400 mb-2">{error}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-sm px-3 py-1.5 rounded border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
              >
                {t("constitution.pricing.waitlist.notNow")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !email.includes("@")}
                className="px-4 py-1.5 rounded bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-[#0b1736] font-bold text-sm disabled:opacity-40"
              >
                {busy ? "..." : t("constitution.pricing.waitlist.subscribe")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-emerald-300 mb-3">
              {t("constitution.pricing.waitlist.done")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm"
            >
              {t("constitution.pricing.waitlist.close")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CompareRow({
  feature,
  free,
  pro,
  team,
}: {
  feature: string;
  free: string;
  pro: string;
  team: string;
}) {
  return (
    <tr className="border-b border-[#d4af37]/10">
      <td className="py-2 text-[#9aa3c0]">{feature}</td>
      <td className="text-center py-2 font-mono">{free}</td>
      <td className="text-center py-2 font-mono text-[#f472b6]">{pro}</td>
      <td className="text-center py-2 font-mono text-cyan-300">{team}</td>
    </tr>
  );
}
