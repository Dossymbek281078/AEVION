"use client";

import Link from "next/link";
import { useState } from "react";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import ModulePricingChip from "@/components/ModulePricingChip";
import { PaddleUpgradeButton } from "@/components/PaddleUpgradeButton";
import ThreatModelSelector from "./components/ThreatModelSelector";
import RoutingSimulator from "./components/RoutingSimulator";
import PrivacyScore from "./components/PrivacyScore";
import EncryptedPostForm from "./components/EncryptedPostForm";
import PostReader from "./components/PostReader";
import StatsStrip from "./components/StatsStrip";
import { useShadowT } from "./i18n";

export default function ShadowNetPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { t } = useShadowT();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AEVION ShadowNet",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    description:
      "Educational privacy simulator — threat models, route simulation, privacy score and passphrase-encrypted notes.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    url: "https://aevion.app/shadownet",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #000000 0%, #0a0014 50%, #000000 100%)",
        color: "#e9d5ff",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header
        style={{
          borderBottom: "1px solid rgba(168,85,247,0.2)",
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
          position: "sticky",
          top: 'var(--aevion-header-h, 0px)',
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "14px",
            fontSize: "13px",
            fontFamily: "monospace",
          }}
        >
          <Link href="/" style={{ color: "#a855f7", textDecoration: "none" }}>
            ← AEVION
          </Link>
          <span style={{ color: "#6b21a8" }}>·</span>
          <span style={{ color: "#e9d5ff", fontWeight: 600 }}>ShadowNet</span>
          <span style={{ color: "#6b21a8" }}>·</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              border: "1px solid rgba(168,85,247,0.5)",
              color: "#a855f7",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
            }}
          >
            {t("page.badge")}
          </span>
          <span style={{ flex: 1 }} />
          <ModulePricingChip moduleId="shadownet" theme="dark" />
        </div>
      </header>

      {/* 147 (18.10.2026): на 390×844 герой начинался с поля 80 px, h1 389..527, первая кнопка выбора угрозы на ~911 —
          за кадром. Класс aevion-geroj-sekciya на ≤768 режет верхнее поле до 24 px; абзац героя — после выбора угрозы. */}
      <section className="aevion-geroj-sekciya" style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 20px 50px" }}>
        <p
          style={{
            color: "#a855f7",
            fontSize: "11px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            marginBottom: "14px",
            fontFamily: "monospace",
          }}
        >
          {t("page.eyebrow")}
        </p>
        {/* 144г (18.10.2026): 56 px моноширинным на 390 — заголовок 389..758 (370 px), первое действие за кадром;
            класс aevion-h1-geroj (globals.css) на ≤768 даёт 30 px. */}
        <h1
          className="aevion-h1-geroj"
          style={{
            fontSize: "56px",
            fontWeight: 700,
            color: "#e9d5ff",
            lineHeight: 1.1,
            margin: "0 0 22px 0",
            textShadow: "0 0 40px rgba(168,85,247,0.4)",
          }}
        >
          {t("page.h1a")}{" "}
          <span style={{ color: "#a855f7" }}>{t("page.h1b")}</span>
        </h1>
      </section>

      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 20px 40px" }}>
        <h2
          style={{
            fontSize: "22px",
            color: "#e9d5ff",
            margin: "0 0 8px 0",
            fontFamily: "monospace",
          }}
        >
          {t("page.s1Title")}
        </h2>
        <p style={{ color: "#a78bfa", fontSize: "13px", margin: "0 0 22px 0" }}>
          {t("page.s1Hint")}
        </p>
        <ThreatModelSelector />
        <p
          style={{
            color: "#c4b5fd",
            fontSize: "17px",
            maxWidth: "760px",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {t("page.about")}
        </p>
      </section>
      {/* 144в (18.10.2026): полоса чисел — после первого действия гостя (выбор модели угроз): на 390×844 первая кнопка
          стояла на ~1457 при кадре 844 (замер на проде 627d18515). */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 20px 30px" }}>
        <StatsStrip />
      </section>

      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 20px 40px" }}>
        <h2
          style={{
            fontSize: "22px",
            color: "#e9d5ff",
            margin: "0 0 8px 0",
            fontFamily: "monospace",
          }}
        >
          {t("page.s2Title")}
        </h2>
        <p style={{ color: "#a78bfa", fontSize: "13px", margin: "0 0 22px 0" }}>
          {t("page.s2Hint")}
        </p>
        <RoutingSimulator />
      </section>

      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 20px 40px" }}>
        <h2
          style={{
            fontSize: "22px",
            color: "#e9d5ff",
            margin: "0 0 8px 0",
            fontFamily: "monospace",
          }}
        >
          {t("page.s3Title")}
        </h2>
        <p style={{ color: "#a78bfa", fontSize: "13px", margin: "0 0 22px 0" }}>
          {t("page.s3Hint")}
        </p>
        <PrivacyScore />
      </section>

      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 20px 40px" }}>
        <h2
          style={{
            fontSize: "22px",
            color: "#e9d5ff",
            margin: "0 0 8px 0",
            fontFamily: "monospace",
          }}
        >
          {t("page.s4Title")}
        </h2>
        <p style={{ color: "#a78bfa", fontSize: "13px", margin: "0 0 22px 0" }}>
          {t("page.s4Hint")}
        </p>
        {/* 28.10: data-stack-mobile — на 390 форма и читалка стояли в две колонки по ~150 px (кадр post-ru-390x844) */}
        <div data-stack-mobile=""
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          <EncryptedPostForm onPosted={() => setRefreshKey((k) => k + 1)} />
          <PostReader refreshKey={refreshKey} />
        </div>
      </section>

      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 20px 80px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            paddingTop: "30px",
            borderTop: "1px solid rgba(168,85,247,0.15)",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "#a78bfa",
              fontFamily: "monospace",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginRight: "8px",
              alignSelf: "center",
            }}
          >
            {t("page.related")}
          </span>
          {[
            { href: "/veilnetx", label: "VeilNetX" },
            { href: "/quantum-shield", label: "Quantum Shield" },
            { href: "/qsign", label: "QSign" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "8px 14px",
                borderRadius: "5px",
                border: "1px solid rgba(168,85,247,0.4)",
                color: "#e9d5ff",
                textDecoration: "none",
                fontSize: "12px",
                fontFamily: "monospace",
              }}
            >
              {l.label} →
            </Link>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 16px" }}>
        <PaddleUpgradeButton variant="banner" appId="shadownet" />
      </div>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 32px" }}>
        <MvpConceptBoard
          moduleId="shadownet"
          noun="concept/messages"
          accent="teal"
          sectionTitle={t("page.boardTitle")}
          sectionHint={t("page.boardHint")}
          titleField="idea"
          summaryField="rationale"
          fields={[
            { key: "idea", label: t("page.boardIdea"), placeholder: t("page.boardIdeaPh"), required: true },
            { key: "rationale", label: t("page.boardWhy"), type: "textarea", placeholder: t("page.boardWhyPh") },
            { key: "author", label: t("page.boardAuthor"), placeholder: "anon" },
          ]}
        />
      </section>
    </main>
  );
}
