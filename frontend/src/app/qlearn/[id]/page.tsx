"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { getAuthHeaders, isAuthenticated } from "@/lib/auth";
import { LEVEL_COLORS, CATEGORY_ICONS } from "../courseLook";

// Страница одного курса. До неё «открыть курс» просто прокручивало список к
// нужной карточке — комментарий в коде так и говорил: «отдельной страницы пока
// нет». Программа занятий не показывалась нигде.

interface Course {
  id: string;
  authorId: string;
  title: string;
  description: string;
  category: string;
  level: string;
  price: number;
  isPublic: boolean;
  enrollmentCount: number;
  createdAt: string;
}

interface Lesson {
  id: string;
  title: string;
  order: number;
  duration: number;
}

function totalMinutes(lessons: Lesson[]): number {
  return lessons.reduce((sum, l) => sum + (Number.isFinite(l.duration) ? l.duration : 0), 0);
}

function durationLabel(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default function QLearnCourseDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [enrollError, setEnrollError] = useState("");

  // Токен читаем в эффекте: на сервере его нет, и разметка сервера разошлась бы
  // с первой отрисовкой в браузере.
  useEffect(() => setSignedIn(isAuthenticated()), []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/qlearn/courses/${encodeURIComponent(id)}`), { cache: "no-store" });
      if (res.status === 404) {
        setMissing(true);
        return;
      }
      if (!res.ok) return;
      const json = (await res.json()) as { course?: Course; lessons?: Lesson[] };
      if (json.course) {
        setCourse(json.course);
        setLessons(json.lessons ?? []);
      } else {
        setMissing(true);
      }
    } catch {
      // Сеть отвалилась — ниже покажется экран «не найдено».
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleEnroll() {
    if (!course) return;
    setEnrolling(true);
    setEnrollError("");
    try {
      const res = await fetch(apiUrl(`/api/qlearn/courses/${encodeURIComponent(course.id)}/enroll`), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        setEnrollError(
          res.status === 401
            ? "Sign in to enroll."
            : res.status === 404
              ? "This course is no longer available."
              : "Could not enroll. Please try again.",
        );
        return;
      }
      setEnrolled(true);
      setCourse({ ...course, enrollmentCount: course.enrollmentCount + 1 });
    } catch {
      setEnrollError("Could not enroll. Please try again.");
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell maxWidth={780}>
          <div style={{ padding: "60px 0", textAlign: "center", color: "#94a3b8" }}>Loading course…</div>
        </ProductPageShell>
      </>
    );
  }

  if (missing || !course) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell maxWidth={780}>
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
              Course not found
            </h1>
            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 15 }}>
              It may have been unpublished, or the link is wrong.
            </p>
            <Link
              href="/qlearn"
              style={{
                display: "inline-block",
                background: "#0f172a",
                color: "#fff",
                borderRadius: 8,
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              All courses
            </Link>
          </div>
        </ProductPageShell>
      </>
    );
  }

  const levelColors = LEVEL_COLORS[course.level] ?? LEVEL_COLORS.beginner;
  const minutes = totalMinutes(lessons);

  return (
    <>
      <Wave1Nav />
      <ProductPageShell maxWidth={780}>
        <Link
          href="/qlearn"
          style={{ display: "inline-block", marginBottom: 16, color: "#6366f1", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          ← All courses
        </Link>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>{CATEGORY_ICONS[course.category] ?? "📘"}</span>
          <span
            style={{
              background: levelColors.bg,
              color: levelColors.fg,
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "capitalize",
            }}
          >
            {course.level}
          </span>
          <span style={{ fontSize: 13, color: "#94a3b8", textTransform: "capitalize" }}>{course.category}</span>
        </div>

        <h1 style={{ margin: "0 0 14px", fontSize: 30, lineHeight: 1.2, fontWeight: 800, color: "#0f172a" }}>
          {course.title}
        </h1>

        <dl
          style={{
            margin: "0 0 22px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 14,
          }}
        >
          <Fact label="Price" value={course.price === 0 ? "Free" : `$${course.price}`} />
          <Fact label="Lessons" value={lessons.length > 0 ? String(lessons.length) : "Not published yet"} />
          <Fact label="Total length" value={durationLabel(minutes)} />
          <Fact label="Enrolled" value={String(course.enrollmentCount)} />
        </dl>

        {course.description && (
          <p style={{ margin: "0 0 26px", fontSize: 16, lineHeight: 1.7, color: "#334155", whiteSpace: "pre-wrap" }}>
            {course.description}
          </p>
        )}

        {lessons.length > 0 && (
          <section style={{ marginBottom: 26 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Syllabus</h2>
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {lessons.map((lesson, i) => (
                <li
                  key={lesson.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "baseline",
                    padding: "10px 0",
                    borderBottom: i === lessons.length - 1 ? "none" : "1px solid #f1f5f9",
                  }}
                >
                  <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, minWidth: 22 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 15, color: "#0f172a" }}>{lesson.title}</span>
                  <span style={{ color: "#94a3b8", fontSize: 13, whiteSpace: "nowrap" }}>
                    {lesson.duration > 0 ? `${lesson.duration} min` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div>
          {enrolled ? (
            <p style={{ margin: 0, color: "#15803d", fontWeight: 700, fontSize: 16 }}>
              You are enrolled ✓ — the course is in “My learning”.
            </p>
          ) : signedIn ? (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              style={{
                background: enrolling ? "#c7d2fe" : "#0f172a",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 24px",
                fontWeight: 700,
                fontSize: 15,
                cursor: enrolling ? "not-allowed" : "pointer",
              }}
            >
              {enrolling ? "Enrolling…" : course.price === 0 ? "Enroll for free" : `Enroll — $${course.price}`}
            </button>
          ) : (
            <Link
              href="/auth"
              style={{
                display: "inline-block",
                background: "#0f172a",
                color: "#fff",
                borderRadius: 10,
                padding: "12px 24px",
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              Sign in to enroll
            </Link>
          )}
          {enrollError && (
            <p style={{ margin: "10px 0 0", color: "#b91c1c", fontSize: 14, fontWeight: 600 }}>{enrollError}</p>
          )}
        </div>
      </ProductPageShell>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </dt>
      <dd style={{ margin: "4px 0 0", fontSize: 15, color: "#0f172a", lineHeight: 1.5 }}>{value}</dd>
    </div>
  );
}
