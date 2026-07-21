import type { Metadata } from "next";
import Link from "next/link";
import styles from "./guide.module.css";
import { getServerT } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "QBuild — гайд для работодателя",
  description:
    "Как нанимать на AEVION QBuild: разместить проект и вакансию бесплатно, отсмотреть отклики с AI-скорингом, дать пробное задание и заплатить только за найм.",
};

type Step = {
  n: number;
  title: string;
  body: React.ReactNode;
  cta?: { label: string; href: string };
};

const TIERS = [
  { tier: "Default", hires: "0", fee: "12%", cashback: "2%" },
  { tier: "Bronze", hires: "3", fee: "10%", cashback: "2.5%" },
  { tier: "Silver", hires: "10", fee: "8%", cashback: "3%" },
  { tier: "Gold", hires: "25", fee: "6%", cashback: "4%" },
  { tier: "Platinum", hires: "50", fee: "4%", cashback: "5%" },
];

export default async function GuidePage() {
  const { t } = await getServerT();

  const STEPS: Step[] = [
    {
      n: 1,
      title: t("build.guide.step1Title"),
      body: (
        <>
          {t("build.guide.step1Body1")}
          <span className={styles.accent}>{t("build.guide.step1Badge")}</span>
          {t("build.guide.step1Body2")}
        </>
      ),
      cta: { label: t("build.guide.step1Cta"), href: "/build/profile" },
    },
    {
      n: 2,
      title: t("build.guide.step2Title"),
      body: (
        <>
          {t("build.guide.step2Body1")}
          <b>{t("build.guide.step2Free")}</b>.
        </>
      ),
      cta: { label: t("build.guide.step2Cta"), href: "/build/create-project" },
    },
    {
      n: 3,
      title: t("build.guide.step3Title"),
      body: (
        <>
          {t("build.guide.step3Body1")}
          <b>{t("build.guide.step3AddVacancy")}</b>
          {t("build.guide.step3Body2")}
          <b>{t("build.guide.step3FreeAnyPlan")}</b>.
        </>
      ),
    },
    {
      n: 4,
      title: t("build.guide.step4Title"),
      body: (
        <>
          {t("build.guide.step4Intro")}
          <ul>
            <li>
              <b>{t("build.guide.step4Item1Bold")}</b>
              {t("build.guide.step4Item1Text")}
            </li>
            <li>
              <b>{t("build.guide.step4Item2Bold")}</b>
              {t("build.guide.step4Item2Text")}
            </li>
            <li>
              <b>{t("build.guide.step4Item3Bold")}</b>
              {t("build.guide.step4Item3Text1")}
              <i>{t("build.guide.step4Item3Italic")}</i>
              {t("build.guide.step4Item3Text2")}
            </li>
            <li>
              {t("build.guide.step4Item4Text1")}
              <b>{t("build.guide.step4Item4Bold")}</b>
              {t("build.guide.step4Item4Text2")}
            </li>
          </ul>
        </>
      ),
      cta: { label: t("build.guide.step4Cta"), href: "/build/talent" },
    },
    {
      n: 5,
      title: t("build.guide.step5Title"),
      body: (
        <>
          {t("build.guide.step5Body1")}
          <b>{t("build.guide.step5NoWall")}</b>
          {t("build.guide.step5Body2")}
        </>
      ),
      cta: { label: t("build.guide.step5Cta"), href: "/build/messages" },
    },
    {
      n: 6,
      title: t("build.guide.step6Title"),
      body: (
        <>
          {t("build.guide.step6Body1")}
          <b>{t("build.guide.step6PayPerHire")}</b>
          {t("build.guide.step6Body2")}
          <b>{t("build.guide.step6BaseFee")}</b>
          {t("build.guide.step6Body3")}
          <b>{t("build.guide.step6Falls")}</b>
          {t("build.guide.step6Body4")}
          <b>{t("build.guide.step6MinFee")}</b>
          {t("build.guide.step6Body5")}
          <b>{t("build.guide.step6Cashback")}</b>
          {t("build.guide.step6Body6")}
        </>
      ),
    },
  ];

  return (
    <main className={styles.guide}>
      <div className={styles.sheet}>
        <div className={styles.topRule} />
        <div className={styles.folio}>
          <Link href="/build" className={styles.back}>
            ← QBuild
          </Link>
          <span className={styles.live}>{t("build.guide.live")}</span>
          <span>{t("build.guide.edition")}</span>
        </div>

        <div className={styles.nameplate}>
          <div className={styles.kicker}>{t("build.guide.kicker")}</div>
          <h1>{t("build.guide.title")}</h1>
          <div className={styles.subhead}>{t("build.guide.subhead")}</div>
        </div>
        <div className={styles.ruleDouble} />

        <div className={styles.ledeBand}>
          <div className={styles.dateline}>
            <div className={styles.place}>
              <span>{t("build.guide.cityLabel")}</span> {t("build.guide.placeTagline")}
            </div>
            <p className={styles.lede}>
              {t("build.guide.ledePart1")}
              <b>{t("build.guide.ledeFree")}</b>
              {t("build.guide.ledePart2")}
              <b>{t("build.guide.ledeOnlyHire")}</b>
              {t("build.guide.ledePart3")}
            </p>
          </div>
          <div className={styles.numbers}>
            <div className={styles.cap}>{t("build.guide.termsCap")}</div>
            <div className={styles.row}>
              <span>{t("build.guide.termVacancyPost")}</span>
              <span className={styles.free}>0&#8202;₽</span>
            </div>
            <div className={styles.row}>
              <span>{t("build.guide.termHireFeeBase")}</span>
              <span>12%</span>
            </div>
            <div className={styles.row}>
              <span>{t("build.guide.termHireFeeMin")}</span>
              <span className={styles.free}>4%</span>
            </div>
            <div className={styles.row}>
              <span>{t("build.guide.termCashbackUpTo")}</span>
              <span>5%</span>
            </div>
          </div>
        </div>

        <div className={styles.stepsHead}>
          <span className={styles.mark}>№</span>
          <h2>{t("build.guide.stepsHeading")}</h2>
        </div>
        <ol className={styles.steps}>
          {STEPS.map((s) => (
            <li key={s.n}>
              <h3>{s.title}</h3>
              <div className={styles.body}>
                {s.body}
                {s.cta && (
                  <Link href={s.cta.href} className={styles.stepCta}>
                    {s.cta.label}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className={styles.ratesBand}>
          <div className={styles.ratesCap}>{t("build.guide.loyaltyCap")}</div>
          <p className={styles.ratesSub}>{t("build.guide.loyaltySub")}</p>
          <div className={styles.tblWrap}>
            <table className={styles.rates}>
              <thead>
                <tr>
                  <th>{t("build.guide.thTier")}</th>
                  <th>{t("build.guide.thHires")}</th>
                  <th>Hire-fee</th>
                  <th>{t("build.guide.thCashback")}</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t2) => (
                  <tr key={t2.tier}>
                    <th>{t2.tier}</th>
                    <td className={styles.num}>{t2.hires}</td>
                    <td className={styles.fee}>{t2.fee}</td>
                    <td className={styles.num}>{t2.cashback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.cta}>
          <div className={styles.lead}>{t("build.guide.finalCtaLead")}</div>
          <div className={styles.btns}>
            <Link href="/build/create-project" className={`${styles.btn} ${styles.btnPrimary}`}>
              {t("build.guide.finalCtaProject")}
            </Link>
            <Link href="/build/onboarding" className={`${styles.btn} ${styles.btnGhost}`}>
              {t("build.guide.finalCtaChecklist")}
            </Link>
            <Link href="/build/help" className={`${styles.btn} ${styles.btnGhost}`}>
              {t("build.guide.finalCtaFaq")}
            </Link>
          </div>
        </div>

        <div className={styles.colophon}>
          <span>{t("build.guide.colophonTagline")}</span>
          <span>
            {t("build.guide.colophonAskWorker")}
            <Link href="/build/guide-worker">{t("build.guide.colophonWorkerGuideLink")}</Link>
          </span>
          <Link href="/build">aevion.vercel.app/build</Link>
        </div>
      </div>
    </main>
  );
}
