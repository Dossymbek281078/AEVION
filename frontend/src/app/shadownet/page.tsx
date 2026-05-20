"use client";

import Link from "next/link";
import { useState } from "react";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import { PaddleUpgradeButton } from "@/components/PaddleUpgradeButton";
import ThreatModelSelector from "./components/ThreatModelSelector";
import RoutingSimulator from "./components/RoutingSimulator";
import PrivacyScore from "./components/PrivacyScore";
import EncryptedPostForm from "./components/EncryptedPostForm";
import PostReader from "./components/PostReader";

export default function ShadowNetPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AEVION ShadowNet",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    description:
      "Conceptual privacy simulator — threat models, routing simulator, privacy score, and end-to-end encrypted posts.",
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
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
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
            simulator
          </span>
        </div>
      </header>

      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 20px 50px" }}>
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
          conceptual · educational · in-browser
        </p>
        <h1
          style={{
            fontSize: "56px",
            fontWeight: 700,
            color: "#e9d5ff",
            lineHeight: 1.1,
            margin: "0 0 22px 0",
            textShadow: "0 0 40px rgba(168,85,247,0.4)",
          }}
        >
          ShadowNet —{" "}
          <span style={{ color: "#a855f7" }}>concept privacy simulator</span>
        </h1>
        <p
          style={{
            color: "#c4b5fd",
            fontSize: "17px",
            maxWidth: "760px",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Не реальный VPN, а образовательный симулятор приватности. Threat-model
          selector, симулятор маршрутизации через 3-7 хопов, калькулятор privacy
          score и end-to-end зашифрованные посты — всё с криптографией в браузере,
          сервер видит только ciphertext.
        </p>
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
          1. threat model selector
        </h2>
        <p style={{ color: "#a78bfa", fontSize: "13px", margin: "0 0 22px 0" }}>
          Выбери, от кого хочешь защититься — получишь описание угрозы и
          конкретные рекомендации.
        </p>
        <ThreatModelSelector />
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
          2. routing simulator
        </h2>
        <p style={{ color: "#a78bfa", fontSize: "13px", margin: "0 0 22px 0" }}>
          Симуляция onion-маршрута: 3-7 хопов через разные страны, расчёт суммарной
          задержки и anonymity score.
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
          3. privacy score calculator
        </h2>
        <p style={{ color: "#a78bfa", fontSize: "13px", margin: "0 0 22px 0" }}>
          Отметь активные защитные слои — получишь итоговый score и weakest link.
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
          4. end-to-end encrypted posts
        </h2>
        <p style={{ color: "#a78bfa", fontSize: "13px", margin: "0 0 22px 0" }}>
          AES-GCM 256 + PBKDF2 в браузере. Сервер хранит только ciphertext, iv и
          salt — без пароля прочитать невозможно.
        </p>
        <div
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
            related:
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
        <PaddleUpgradeButton variant="banner" appId="shadownet" label="ShadowNet Pro — максимальная приватность, 14 дней бесплатно" />
      </div>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 32px" }}>
        <MvpConceptBoard
          moduleId="shadownet"
          noun="concept/messages"
          accent="teal"
          sectionTitle="Privacy network concept board"
          sectionHint="Какие threat models не покрыты? Какие protocols стоит симулировать?"
          titleField="idea"
          summaryField="rationale"
          fields={[
            { key: "idea", label: "Идея / threat / protocol", placeholder: "напр.: квантовая угроза для текущих ciphers", required: true },
            { key: "rationale", label: "Почему это важно", type: "textarea", placeholder: "Какие attack-vectors это закрывает" },
            { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
          ]}
        />
      </section>
    </main>
  );
}
