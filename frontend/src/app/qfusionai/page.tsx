"use client";

import Link from "next/link";
import { useState } from "react";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import FusionPlayground, { type RouteResult } from "./components/FusionPlayground";
import ProvidersPanel from "./components/ProvidersPanel";
import RequestCard from "./components/RequestCard";

export default function QFusionAIPage() {
  const [refreshTick, setRefreshTick] = useState(0);

  function handleResult(_r: RouteResult) {
    // Trigger stats refresh after each successful routing
    setRefreshTick((t) => t + 1);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#010801",
      color: "#aaccaa",
      fontFamily: "monospace",
    }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid #0d1f0d",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#010a01",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ color: "#446644", textDecoration: "none", fontSize: 13 }}>
            ← AEVION
          </Link>
          <span style={{ color: "#1a2a1a" }}>·</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            <span style={{ color: "#00ff88" }}>Q</span>
            <span style={{ color: "#88aa88" }}>FusionAI</span>
          </span>
          <span style={{
            fontSize: 10,
            background: "#002200",
            color: "#00ff88",
            padding: "2px 8px",
            borderRadius: 20,
            border: "1px solid #00ff8833",
            letterSpacing: 1,
          }}>
            MVP
          </span>
        </div>
        <Link
          href="/api-backend/api/qfusionai/openapi.json"
          target="_blank"
          style={{ color: "#446644", fontSize: 12, textDecoration: "none" }}
        >
          OpenAPI →
        </Link>
      </header>

      {/* Hero */}
      <section style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "60px 24px 40px",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-block",
          padding: "4px 14px",
          background: "#002200",
          border: "1px solid #00ff8833",
          borderRadius: 20,
          color: "#00ff8888",
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 20,
        }}>
          Hybrid AI Engine
        </div>

        <h1 style={{
          fontSize: "clamp(32px, 6vw, 56px)",
          fontWeight: 900,
          lineHeight: 1.1,
          margin: "0 0 16px",
          letterSpacing: -1,
          color: "#cceecc",
        }}>
          Один запрос.{" "}
          <span style={{
            background: "linear-gradient(90deg, #00ff88, #00ccff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Лучший провайдер.
          </span>
        </h1>

        <p style={{
          fontSize: 16,
          color: "#557755",
          maxWidth: 560,
          margin: "0 auto 28px",
          lineHeight: 1.7,
        }}>
          QFusionAI автоматически выбирает лучшего AI-провайдера для каждого
          запроса по стратегии: скорость, качество, стоимость или авторежим.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { label: "5 провайдеров", color: "#00ff88" },
            { label: "4 стратегии", color: "#00ccff" },
            { label: "Автовыбор", color: "#cc88ff" },
            { label: "Live stats", color: "#ffcc00" },
          ].map((badge) => (
            <span
              key={badge.label}
              style={{
                padding: "5px 14px",
                background: `${badge.color}11`,
                border: `1px solid ${badge.color}33`,
                color: badge.color,
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </section>

      {/* Main content: Playground + Side panels */}
      <section style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 24px 60px",
        display: "grid",
        gridTemplateColumns: "1fr 280px",
        gap: 20,
        alignItems: "start",
      }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Playground header */}
          <div>
            <h2 style={{ color: "#88cc88", fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>
              Fusion Playground
            </h2>
            <p style={{ color: "#446644", fontSize: 12, margin: 0 }}>
              POST{" "}
              <code style={{ color: "#00ff8888" }}>/api/qfusionai/route</code>{" "}
              — выберите стратегию, введите запрос, получите ответ с метаданными решения.
            </p>
          </div>

          <FusionPlayground onResult={handleResult} />

          {/* Stats mini-dashboard */}
          <RequestCard refreshTick={refreshTick} />
        </div>

        {/* Right column: Providers panel */}
        <div style={{ position: "sticky", top: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <h2 style={{ color: "#88cc88", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
              Провайдеры
            </h2>
            <p style={{ color: "#446644", fontSize: 11, margin: 0 }}>
              Статус в реальном времени
            </p>
          </div>
          <ProvidersPanel />

          {/* Strategy legend */}
          <div style={{
            marginTop: 14,
            background: "#030a03",
            border: "1px solid #1a2a1a",
            borderRadius: 10,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <span style={{ color: "#446644", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
              Стратегии
            </span>
            {[
              { id: "speed", color: "#00ccff", desc: "Первый быстрый провайдер (Gemini→OpenAI→...)" },
              { id: "quality", color: "#cc88ff", desc: "Лучший для рассуждений (Anthropic→...)" },
              { id: "cost", color: "#ffcc00", desc: "Самый дешёвый (DeepSeek→Gemini→...)" },
              { id: "auto", color: "#00ff88", desc: "Авто: короткий→speed, длинный→quality" },
            ].map((s) => (
              <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{
                  color: s.color,
                  fontFamily: "monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 50,
                  flexShrink: 0,
                }}>
                  {s.id}
                </span>
                <span style={{ color: "#446644", fontSize: 11, lineHeight: 1.4 }}>
                  {s.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 32px" }}>
        <MvpConceptBoard
          moduleId="qfusionai"
          noun="concept/messages"
          accent="sky"
          sectionTitle="Fusion routing concept board"
          sectionHint="Какие критерии должен учитывать роутер при выборе AI-провайдера? Что важнее: latency, cost, quality?"
          titleField="idea"
          summaryField="rationale"
          fields={[
            { key: "idea", label: "Идея / критерий", placeholder: "напр.: streaming-first routing", required: true },
            { key: "rationale", label: "Зачем это критерий", type: "textarea", placeholder: "Какой use-case это разблокирует" },
            { key: "author", label: "Псевдоним (необязательно)", placeholder: "anon" },
          ]}
        />
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #0d1f0d",
        padding: "20px 24px",
        textAlign: "center",
        color: "#223322",
        fontSize: 11,
      }}>
        AEVION QFusionAI · Hybrid AI Engine · v2.0.0-mvp
      </footer>
    </div>
  );
}
