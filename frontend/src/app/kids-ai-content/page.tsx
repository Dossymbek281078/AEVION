"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import MvpConceptBoard from "@/components/MvpConceptBoard";
import LanguageSelector, { type KidsLang } from "./components/LanguageSelector";
import LessonCard, { type LessonSummary } from "./components/LessonCard";
import LessonDetail from "./components/LessonDetail";

/**
 * Kids AI Content — MVP catalogue.
 *
 * Flow:
 *   1. Visitor picks a language (RU / EN / KZ).
 *   2. Cards are fetched from /api/kids-ai/lessons?lang=... and grouped by
 *      age tier so a 5-year-old isn't shown a 9-12 chapter on Egypt.
 *   3. Clicking a card opens LessonDetail (full content_md + AskAi).
 *   4. "I finished" button POSTs to /api/kids-ai/progress and persists a
 *      pseudonym (childAlias) + completed lesson IDs in localStorage so
 *      we can show a "✓ Пройден" badge without re-fetching on reload.
 */

const PAGE_BG = "linear-gradient(180deg, #fef3c7 0%, #ffffff 40%, #fef3c7 100%)";

const wrapStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: PAGE_BG,
  color: "#1c1917",
  fontFamily:
    '"Nunito", "Comfortaa", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const headerStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.85)",
  borderBottom: "1px solid #fde68a",
  padding: "14px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  position: "sticky",
  top: 0,
  zIndex: 10,
  backdropFilter: "blur(8px)",
};

const heroStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: "48px 20px 24px",
  textAlign: "center",
};

const heroTitleStyle: React.CSSProperties = {
  fontSize: 42,
  fontWeight: 800,
  color: "#78350f",
  margin: 0,
  lineHeight: 1.15,
};

const heroSubtitle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 18,
  color: "#92400e",
  lineHeight: 1.6,
};

const gridStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "0 20px 60px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 20,
};

const tierStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "12px 20px 0",
};

const tierTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "#a16207",
  marginBottom: 12,
};

const aliasBoxStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto 24px",
  padding: "0 20px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  justifyContent: "center",
  fontSize: 14,
  color: "#92400e",
  flexWrap: "wrap",
};

const inputStyle: React.CSSProperties = {
  border: "2px solid #fde68a",
  background: "#ffffff",
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 14,
  fontFamily: "inherit",
  color: "#78350f",
};

const emptyStyle: React.CSSProperties = {
  maxWidth: 600,
  margin: "20px auto",
  padding: 30,
  textAlign: "center",
  background: "#ffffff",
  border: "2px dashed #fde68a",
  borderRadius: 24,
  color: "#92400e",
};

const heroEmoji: React.CSSProperties = {
  fontSize: 60,
  marginBottom: 12,
};

const ALIAS_KEY = "kidsai_alias";
const PROGRESS_KEY = "kidsai_progress_v1";

function readAlias(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ALIAS_KEY) ?? "";
}

function readProgress(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x) => typeof x === "number"));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function suggestAlias(): string {
  const animals = ["tiger", "fox", "bunny", "panda", "owl", "lion", "dolphin"];
  const a = animals[Math.floor(Math.random() * animals.length)];
  const n = Math.floor(Math.random() * 900) + 100;
  return `${a}${n}`;
}

export default function KidsAiContentPage() {
  const [lang, setLang] = useState<KidsLang>("ru");
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [alias, setAlias] = useState("");
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  // Init alias + progress from localStorage on mount only.
  useEffect(() => {
    let a = readAlias();
    if (!a) {
      a = suggestAlias();
      try {
        localStorage.setItem(ALIAS_KEY, a);
      } catch {
        // sandboxed / disabled storage — fine, alias is in memory
      }
    }
    setAlias(a);
    setCompleted(readProgress());
  }, []);

  // Load lessons whenever language changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLessons([]);
    fetch(apiUrl(`/api/kids-ai/lessons?lang=${lang}&limit=50`))
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { lessons: LessonSummary[] };
        if (!cancelled) setLessons(data.lessons ?? []);
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const onCompleted = useCallback((id: number) => {
    setCompleted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const tiers = useMemo(() => {
    const youngLabel =
      lang === "en" ? "Ages 5–8" : lang === "kz" ? "5–8 жас" : "5–8 лет";
    const olderLabel =
      lang === "en" ? "Ages 9–12" : lang === "kz" ? "9–12 жас" : "9–12 лет";
    const young = lessons.filter((l) => l.age_max <= 8);
    const older = lessons.filter((l) => l.age_min >= 9);
    return [
      { label: youngLabel, items: young },
      { label: olderLabel, items: older },
    ].filter((g) => g.items.length > 0);
  }, [lessons, lang]);

  function updateAlias(next: string) {
    const trimmed = next.trim().slice(0, 32);
    setAlias(trimmed);
    try {
      if (trimmed) localStorage.setItem(ALIAS_KEY, trimmed);
    } catch {
      // ignore
    }
  }

  if (activeId !== null) {
    return (
      <div style={wrapStyle}>
        <header style={headerStyle}>
          <Link href="/" style={{ color: "#92400e", textDecoration: "none", fontWeight: 700 }}>
            ← AEVION · Kids AI
          </Link>
          <span style={{ fontSize: 13, color: "#a16207" }}>👤 {alias}</span>
        </header>
        <div style={{ padding: "30px 0 60px" }}>
          <LessonDetail
            lessonId={activeId}
            childAlias={alias || "anon"}
            onBack={() => setActiveId(null)}
            onCompleted={onCompleted}
            completed={completed.has(activeId)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <header style={headerStyle}>
        <Link href="/" style={{ color: "#92400e", textDecoration: "none", fontWeight: 700 }}>
          ← AEVION · Kids AI
        </Link>
        <span style={{ fontSize: 13, color: "#a16207" }}>
          {completed.size > 0
            ? `🌟 Пройдено: ${completed.size}`
            : "🛡 Безопасно для детей"}
        </span>
      </header>

      <section style={heroStyle}>
        <div style={heroEmoji}>🦊📚✨</div>
        <h1 style={heroTitleStyle}>Учимся весело и безопасно</h1>
        <p style={heroSubtitle}>
          Детские уроки на русском, английском и казахском. С AI-помощником,
          который объяснит непонятное простыми словами.
        </p>
      </section>

      <LanguageSelector value={lang} onChange={setLang} />

      <div style={aliasBoxStyle}>
        <span>👤 Твой ник в приложении:</span>
        <input
          type="text"
          value={alias}
          onChange={(e) => updateAlias(e.target.value)}
          maxLength={32}
          style={inputStyle}
          aria-label="Псевдоним ребёнка"
        />
      </div>

      {loading ? (
        <div style={emptyStyle}>
          <p style={{ margin: 0, fontSize: 18 }}>Подбираем уроки… ✨</p>
        </div>
      ) : tiers.length === 0 ? (
        <div style={emptyStyle}>
          <p style={{ margin: 0, fontSize: 18 }}>
            На этом языке уроков пока нет. Выбери другой язык выше! 🌈
          </p>
        </div>
      ) : (
        tiers.map((tier) => (
          <div key={tier.label}>
            <div style={tierStyle}>
              <div style={tierTitleStyle}>{tier.label}</div>
            </div>
            <div style={gridStyle}>
              {tier.items.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onOpen={(id) => setActiveId(id)}
                  completed={completed.has(lesson.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 32px" }}>
        <MvpConceptBoard
          moduleId="kids-ai-content"
          noun="concept/messages"
          accent="rose"
          sectionTitle="Kids learning concept board"
          sectionHint="Какие темы для детских уроков нужны? Какие safe-defaults важны для разных возрастов?"
          titleField="idea"
          summaryField="rationale"
          fields={[
            { key: "idea", label: "Идея урока / темы", placeholder: "напр.: финансовая грамотность 7-9 лет", required: true },
            { key: "rationale", label: "Почему это важно", type: "textarea", placeholder: "Что ребёнок поймёт после этого урока" },
            { key: "author", label: "Псевдоним (необязательно)", placeholder: "родитель / педагог / anon" },
          ]}
        />
      </section>

      <footer
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "30px 20px",
          textAlign: "center",
          color: "#a16207",
          fontSize: 13,
          borderTop: "1px solid #fde68a",
        }}
      >
        AEVION · Kids AI · MVP · safe-by-default · ages 5–12
      </footer>
    </div>
  );
}
