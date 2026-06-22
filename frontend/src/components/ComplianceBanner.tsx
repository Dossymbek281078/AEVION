"use client";

import { useI18n } from "@/lib/i18n";

/**
 * License/compliance notice bar for modules that mirror regulated services
 * (banking, payments, cards, trading, health, legal). AEVION ships these as
 * demonstrations on a public domain — the banner makes the non-licensed,
 * non-advice nature explicit before the user interacts.
 *
 * Self-contained EN/RU/KK copy (falls back to EN for other locales) so it
 * needs no per-locale key plumbing. Solid amber bar so it stays readable on
 * both light and dark module themes.
 */
type Variant = "financial" | "trading" | "medical" | "legal";

const TEXT: Record<Variant, { en: string; ru: string; kk: string }> = {
  financial: {
    en: "Demonstration only. AEVION is not a licensed bank, payment institution, or e-money issuer. No real funds or payments are processed — for evaluation and educational use.",
    ru: "Только демонстрация. AEVION не является лицензированным банком, платёжной организацией или эмитентом электронных денег. Реальные средства и платежи не обрабатываются — для ознакомления и обучения.",
    kk: "Тек көрсетілім. AEVION лицензияланған банк, төлем ұйымы немесе электрондық ақша эмитенті емес. Нақты қаражат пен төлемдер өңделмейді — тек таныстыру және оқу мақсатында.",
  },
  trading: {
    en: "Demonstration only. Not investment advice and not a licensed securities or trading service. AEV and all instruments shown are simulated / test-net. Nothing here is an offer to buy or sell any financial instrument.",
    ru: "Только демонстрация. Не является инвестиционным советом, лицензированным брокерским или торговым сервисом. AEV и все инструменты — симуляция / тестовая сеть. Это не оферта на покупку или продажу финансовых инструментов.",
    kk: "Тек көрсетілім. Инвестициялық кеңес немесе лицензияланған брокерлік қызмет емес. AEV және барлық құралдар — симуляция / тест желісі. Бұл қаржы құралдарын сатып алуға не сатуға ұсыныс емес.",
  },
  medical: {
    en: "For informational and educational purposes only. Not medical, psychological, or health advice and not a substitute for a licensed professional. In an emergency, contact your local emergency services.",
    ru: "Только в информационных и образовательных целях. Не является медицинской, психологической или врачебной рекомендацией и не заменяет лицензированного специалиста. В экстренной ситуации обратитесь в службы экстренной помощи.",
    kk: "Тек ақпараттық және оқу мақсатында. Медициналық, психологиялық немесе дәрігерлік кеңес емес және лицензияланған маманды алмастырмайды. Төтенше жағдайда жедел жәрдем қызметіне хабарласыңыз.",
  },
  legal: {
    en: "Demonstration only. Documents and signatures generated here are not legal advice and may not be legally binding without independent qualified review and applicable accreditation.",
    ru: "Только демонстрация. Создаваемые документы и подписи не являются юридической консультацией и могут не иметь юридической силы без независимой квалифицированной проверки и соответствующей аккредитации.",
    kk: "Тек көрсетілім. Жасалатын құжаттар мен қолтаңбалар заңды кеңес емес және тиісті тәуелсіз сараптамасыз әрі аккредитациясыз заңды күші болмауы мүмкін.",
  },
};

export default function ComplianceBanner({ variant }: { variant: Variant }) {
  const { lang } = useI18n();
  const copy = TEXT[variant];
  const text = (copy as Record<string, string>)[lang] ?? copy.en;

  return (
    <div
      role="note"
      className="w-full border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-[11px] leading-snug text-amber-900"
    >
      <span className="mx-auto block max-w-4xl">
        <span aria-hidden className="mr-1">⚠️</span>
        {text}
      </span>
    </div>
  );
}
