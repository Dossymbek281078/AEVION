"use client";

import React, { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import AskAi from "./AskAi";

interface LessonFull {
  id: number;
  title: string;
  description: string;
  age_min: number;
  age_max: number;
  language: "ru" | "en" | "kz";
  category: string;
  content_md: string;
  ai_prompt: string | null;
}

interface Props {
  lessonId: number;
  childAlias: string;
  onBack: () => void;
  onCompleted: (lessonId: number) => void;
  completed: boolean;
}

const wrapStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "0 16px",
};

const backBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#92400e",
  cursor: "pointer",
  fontSize: 15,
  marginBottom: 16,
  padding: 0,
  fontFamily: "inherit",
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#78350f",
  margin: "0 0 8px 0",
  lineHeight: 1.2,
};

const descStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#92400e",
  marginBottom: 20,
};

const contentStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "2px solid #fde68a",
  borderRadius: 24,
  padding: 24,
  fontSize: 17,
  lineHeight: 1.7,
  color: "#1c1917",
};

const completeBtn: React.CSSProperties = {
  marginTop: 20,
  padding: "12px 28px",
  borderRadius: 999,
  border: "none",
  background: "#10b981",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 16,
  cursor: "pointer",
  fontFamily: "inherit",
};

const doneBtn: React.CSSProperties = {
  ...completeBtn,
  background: "#a7f3d0",
  color: "#065f46",
  cursor: "default",
};

const loadingStyle: React.CSSProperties = {
  ...wrapStyle,
  padding: 40,
  textAlign: "center",
  color: "#92400e",
  fontSize: 18,
};

/**
 * Minimal Markdown renderer. Covers what our seed lessons actually use:
 * # H1 / ## H2, **bold**, `code`, > blockquote, simple tables (| a | b |),
 * unordered and ordered lists, blank-line paragraphs. Not a full spec —
 * lessons are authored to fit this subset.
 */
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  function renderInline(s: string): React.ReactNode {
    // Split on bold and code spans. Order matters: code first so ** inside ` is ignored.
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (m.index > cursor) parts.push(s.slice(cursor, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) {
        parts.push(<strong key={`b${key++}`}>{tok.slice(2, -2)}</strong>);
      } else {
        parts.push(
          <code
            key={`c${key++}`}
            style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 6 }}
          >
            {tok.slice(1, -1)}
          </code>,
        );
      }
      cursor = m.index + tok.length;
    }
    if (cursor < s.length) parts.push(s.slice(cursor));
    return parts.length ? parts : s;
  }

  while (i < lines.length) {
    const line = lines[i];

    // H1 / H2 / H3
    if (/^### /.test(line)) {
      out.push(
        <h3 key={key++} style={{ fontSize: 18, color: "#78350f", marginTop: 18 }}>
          {renderInline(line.slice(4))}
        </h3>,
      );
      i++;
      continue;
    }
    if (/^## /.test(line)) {
      out.push(
        <h2 key={key++} style={{ fontSize: 22, color: "#78350f", marginTop: 22 }}>
          {renderInline(line.slice(3))}
        </h2>,
      );
      i++;
      continue;
    }
    if (/^# /.test(line)) {
      out.push(
        <h1 key={key++} style={{ fontSize: 26, color: "#78350f", marginTop: 24 }}>
          {renderInline(line.slice(2))}
        </h1>,
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        buf.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <blockquote
          key={key++}
          style={{
            borderLeft: "4px solid #f59e0b",
            margin: "14px 0",
            padding: "8px 14px",
            background: "#fffbeb",
            color: "#78350f",
            fontStyle: "italic",
          }}
        >
          {renderInline(buf.join(" "))}
        </blockquote>,
      );
      continue;
    }

    // Table (very loose detection)
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s\-:|]+\|\s*$/.test(lines[i + 1])) {
      const header = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(
          lines[i]
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim()),
        );
        i++;
      }
      out.push(
        <table
          key={key++}
          style={{
            borderCollapse: "collapse",
            margin: "14px 0",
            width: "100%",
          }}
        >
          <thead>
            <tr>
              {header.map((h, j) => (
                <th
                  key={j}
                  style={{
                    borderBottom: "2px solid #fbbf24",
                    padding: "6px 10px",
                    background: "#fef3c7",
                    textAlign: "left",
                  }}
                >
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td
                    key={ci}
                    style={{ borderBottom: "1px solid #fde68a", padding: "6px 10px" }}
                  >
                    {renderInline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      out.push(
        <ol key={key++} style={{ paddingLeft: 24, margin: "10px 0" }}>
          {items.map((it, idx) => (
            <li key={idx} style={{ margin: "4px 0" }}>
              {renderInline(it)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Unordered list
    if (/^[\-\*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-\*]\s/.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul key={key++} style={{ paddingLeft: 24, margin: "10px 0" }}>
          {items.map((it, idx) => (
            <li key={idx} style={{ margin: "4px 0" }}>
              {renderInline(it)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Blank line → paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-blank lines)
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|>\s|[\-\*]\s|\d+\.\s|\s*\|)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(
      <p key={key++} style={{ margin: "10px 0" }}>
        {renderInline(buf.join(" "))}
      </p>,
    );
  }

  return out;
}

export default function LessonDetail({
  lessonId,
  childAlias,
  onBack,
  onCompleted,
  completed,
}: Props) {
  const [lesson, setLesson] = useState<LessonFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLesson(null);
    fetch(apiUrl(`/api/kids-ai/lessons/${lessonId}`))
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { lesson: LessonFull };
        if (!cancelled) setLesson(data.lesson);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить урок");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function markComplete() {
    if (!lesson || marking || completed) return;
    setMarking(true);
    try {
      await fetch(apiUrl("/api/kids-ai/progress"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childAlias,
          lessonId: lesson.id,
          score: 100,
        }),
      });
      onCompleted(lesson.id);
    } catch {
      // swallow — backend persistence is optional for MVP
      onCompleted(lesson.id);
    } finally {
      setMarking(false);
    }
  }

  if (error) {
    return (
      <div style={loadingStyle}>
        <button type="button" style={backBtn} onClick={onBack}>
          ← Назад к урокам
        </button>
        <p>Не получилось загрузить урок: {error}</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div style={loadingStyle}>
        <button type="button" style={backBtn} onClick={onBack}>
          ← Назад к урокам
        </button>
        <p>Загружаем... ✨</p>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <button type="button" style={backBtn} onClick={onBack}>
        ← Назад к урокам
      </button>
      <h1 style={titleStyle}>{lesson.title}</h1>
      <p style={descStyle}>{lesson.description}</p>

      <div style={contentStyle}>{renderMarkdown(lesson.content_md)}</div>

      <button
        type="button"
        style={completed ? doneBtn : completeBtn}
        onClick={() => void markComplete()}
        disabled={marking || completed}
      >
        {completed ? "✓ Урок пройден" : marking ? "..." : "Я прошёл урок 🎉"}
      </button>

      <AskAi lessonId={lesson.id} lang={lesson.language} />
    </div>
  );
}
