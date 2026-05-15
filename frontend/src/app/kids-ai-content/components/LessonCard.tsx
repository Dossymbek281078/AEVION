"use client";

import React from "react";

export interface LessonSummary {
  id: number;
  title: string;
  description: string;
  age_min: number;
  age_max: number;
  language: "ru" | "en" | "kz";
  category: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  math: "🔢",
  animals: "🐾",
  nature: "🌿",
  language: "🔤",
  art: "🎨",
  history: "🏛",
  science: "🔬",
};

interface Props {
  lesson: LessonSummary;
  onOpen: (id: number) => void;
  completed?: boolean;
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "2px solid #fde68a",
  borderRadius: 24,
  padding: 20,
  cursor: "pointer",
  transition: "transform 0.15s ease, box-shadow 0.15s ease",
  boxShadow: "0 2px 8px rgba(245, 158, 11, 0.08)",
  textAlign: "left",
  fontFamily: "inherit",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#78350f",
  lineHeight: 1.3,
  margin: 0,
};

const descStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#92400e",
  lineHeight: 1.5,
  margin: 0,
};

const metaStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#a16207",
  marginTop: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const badgeStyle: React.CSSProperties = {
  background: "#fef3c7",
  padding: "3px 10px",
  borderRadius: 999,
  fontWeight: 600,
};

const doneBadge: React.CSSProperties = {
  background: "#d1fae5",
  color: "#065f46",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};

export default function LessonCard({ lesson, onOpen, completed }: Props) {
  const emoji = CATEGORY_EMOJI[lesson.category] ?? "📘";
  return (
    <button
      type="button"
      style={cardStyle}
      onClick={() => onOpen(lesson.id)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(245, 158, 11, 0.18)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(245, 158, 11, 0.08)";
      }}
    >
      <div style={{ fontSize: 36 }}>{emoji}</div>
      <h3 style={titleStyle}>{lesson.title}</h3>
      <p style={descStyle}>{lesson.description}</p>
      <div style={metaStyle}>
        <span style={badgeStyle}>
          {lesson.age_min}–{lesson.age_max} лет
        </span>
        {completed ? <span style={doneBadge}>✓ Пройден</span> : null}
      </div>
    </button>
  );
}
