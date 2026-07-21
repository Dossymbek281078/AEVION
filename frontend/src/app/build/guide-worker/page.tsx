import type { Metadata } from "next";
import Link from "next/link";
import { getServerT } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "QBuild — гайд для соискателя",
  description:
    "Как найти работу на AEVION QBuild: заполнить профиль, найти вакансии, откликнуться, пройти оплачиваемое пробное задание и получить найм — бесплатно для соискателя.",
};

type Step = {
  n: number;
  title: string;
  body: React.ReactNode;
  cta?: { label: string; href: string };
};

export default async function WorkerGuidePage() {
  const { t } = await getServerT();

  const STEPS: Step[] = [
    {
      n: 1,
      title: t("build.guideWorker.step1Title"),
      body: (
        <>
          {t("build.guideWorker.step1Intro")}<b>{t("build.guideWorker.step1Skill")}</b>
          {t("build.guideWorker.step1Trust")}
          <span className="text-emerald-300">{t("build.guideWorker.step1VerifiedBadge")}</span>
          {t("build.guideWorker.step1Note")}{" "}
          <code className="text-slate-400">/build/u/…</code>.
        </>
      ),
      cta: { label: t("build.guideWorker.step1CtaLabel"), href: "/build/profile" },
    },
    {
      n: 2,
      title: t("build.guideWorker.step2Title"),
      body: (
        <>
          {t("build.guideWorker.step2Intro")}<b>{t("build.guideWorker.step2Free")}</b>
          {t("build.guideWorker.step2End")}
        </>
      ),
      cta: { label: t("build.guideWorker.step2CtaLabel"), href: "/build/vacancies" },
    },
    {
      n: 3,
      title: t("build.guideWorker.step3Title"),
      body: (
        <>
          {t("build.guideWorker.step3Intro")}<b>{t("build.guideWorker.step3QuickApply")}</b>
          {t("build.guideWorker.step3Middle")}
          <b>{t("build.guideWorker.step3AiScore")}</b>
          {t("build.guideWorker.step3End")}
        </>
      ),
    },
    {
      n: 4,
      title: t("build.guideWorker.step4Title"),
      body: <>{t("build.guideWorker.step4Body")}</>,
    },
    {
      n: 5,
      title: t("build.guideWorker.step5Title"),
      body: (
        <>
          {t("build.guideWorker.step5Intro")}<b>{t("build.guideWorker.step5Trial")}</b>
          {t("build.guideWorker.step5Middle")}<i>{t("build.guideWorker.step5Paid")}</i>
          {t("build.guideWorker.step5End")}
        </>
      ),
    },
    {
      n: 6,
      title: t("build.guideWorker.step6Title"),
      body: <>{t("build.guideWorker.step6Body")}</>,
      cta: { label: t("build.guideWorker.step6CtaLabel"), href: "/build/messages" },
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/build" className="text-xs text-slate-400 hover:underline">
          {t("build.guideWorker.backToBuild")}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold text-white">
          {t("build.guideWorker.pageTitle")}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {t("build.guideWorker.pageSubtitle")}
        </p>

        {/* How it works in 30 seconds */}
        <section className="mt-6 rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-emerald-400/5 to-transparent p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-200">
            {t("build.guideWorker.howItWorksTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            {t("build.guideWorker.howItWorksIntro")}<b>{t("build.guideWorker.howItWorksFree")}</b>
            {t("build.guideWorker.howItWorksBody")}<b>{t("build.guideWorker.howItWorksCashback")}</b>
            {t("build.guideWorker.howItWorksNoFee")}
          </p>
        </section>

        {/* Steps */}
        <ol className="mt-8 space-y-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950">
                  {s.n}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-white">{s.title}</h3>
                  <div className="mt-1 text-sm leading-relaxed text-slate-300">
                    {s.body}
                  </div>
                  {s.cta && (
                    <Link
                      href={s.cta.href}
                      className="mt-3 inline-flex rounded-md border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25"
                    >
                      {s.cta.label}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* Job alerts tip */}
        <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="text-base font-semibold text-white">{t("build.guideWorker.tipTitle")}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {t("build.guideWorker.tipBody")}
          </p>
        </section>

        {/* CTA */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/build/vacancies"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            {t("build.guideWorker.ctaFindJobs")}
          </Link>
          <Link
            href="/build/profile"
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
          >
            {t("build.guideWorker.ctaFillProfile")}
          </Link>
        </div>

        <p className="mt-8 text-[11px] text-slate-500">
          {t("build.guideWorker.footerIntro")}{" "}
          <Link href="/build/guide" className="text-emerald-300 underline">
            {t("build.guideWorker.footerEmployerGuideLink")}
          </Link>
          {t("build.guideWorker.footerFaqIntro")}{" "}
          <Link href="/build/help" className="text-emerald-300 underline">
            /build/help
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
