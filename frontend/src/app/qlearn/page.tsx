"use client";

import { useState, useEffect, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { catalogWithToken } from "@/lib/aevionCatalog";

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

const CATEGORIES = [
  { id: "", name: "All" },
  { id: "tech", name: "Technology" },
  { id: "business", name: "Business" },
  { id: "design", name: "Design" },
  { id: "music", name: "Music" },
  { id: "language", name: "Language" },
  { id: "other", name: "Other" },
];

const LEVELS = [
  { id: "", name: "All levels" },
  { id: "beginner", name: "Beginner" },
  { id: "intermediate", name: "Intermediate" },
  { id: "advanced", name: "Advanced" },
];

const LEVEL_COLORS: Record<string, { bg: string; fg: string }> = {
  beginner: { bg: "#dcfce7", fg: "#15803d" },
  intermediate: { bg: "#fef3c7", fg: "#92400e" },
  advanced: { bg: "#fee2e2", fg: "#991b1b" },
};

const CATEGORY_ICONS: Record<string, string> = {
  tech: "💻",
  business: "📊",
  design: "🎨",
  music: "🎵",
  language: "🌍",
  other: "📚",
};

function LevelBadge({ level }: { level: string }) {
  const colors = LEVEL_COLORS[level] ?? { bg: "#f1f5f9", fg: "#475569" };
  return (
    <span
      style={{
        background: colors.bg,
        color: colors.fg,
        borderRadius: 5,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "capitalize",
      }}
    >
      {level}
    </span>
  );
}

function CourseCard({
  course,
  onEnroll,
  bookmarked,
  onToggleBookmark,
}: {
  course: Course;
  onEnroll: (id: string) => void;
  bookmarked: boolean;
  onToggleBookmark: (id: string) => void;
}) {
  const icon = CATEGORY_ICONS[course.category] ?? "📚";
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "box-shadow 0.15s",
        position: "relative",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleBookmark(course.id); }}
        aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
        title={bookmarked ? "Remove bookmark" : "Add bookmark"}
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 20,
          lineHeight: 1,
          color: bookmarked ? "#f59e0b" : "#cbd5e1",
          padding: 2,
        }}
      >
        {bookmarked ? "★" : "☆"}
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingRight: 28 }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <LevelBadge level={course.level} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", lineHeight: 1.3 }}>
        {course.title}
      </div>
      {course.description && (
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, flex: 1 }}>
          {course.description.slice(0, 110)}{course.description.length > 110 ? "..." : ""}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#94a3b8" }}>
        {course.enrollmentCount} enrolled
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <span
          style={{
            fontWeight: 800,
            fontSize: 16,
            color: course.price === 0 ? "#0d9488" : "#0f172a",
          }}
        >
          {course.price === 0 ? "Free" : `$${(course.price / 100).toFixed(0)}`}
        </span>
        <button
          onClick={() => onEnroll(course.id)}
          style={{
            padding: "7px 16px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Enroll
        </button>
      </div>
    </div>
  );
}

interface StreakInfo {
  current: number;
  longest: number;
  totalDays: number;
  activeToday?: boolean;
  lastActiveAt: string | null;
}

interface ContinueLearningItem {
  enrollmentId: string;
  courseId: string;
  progress: number;
  lastActivityAt: string;
  hasCertificate: boolean;
  course: {
    id: string;
    title: string;
    category: string;
    level: string;
    description: string;
  } | null;
}

interface ProgressOverview {
  summary: {
    total: number;
    inProgress: number;
    notStarted: number;
    completed: number;
    avgProgress: number;
  };
  continueLearning: ContinueLearningItem[];
  notStarted: ContinueLearningItem[];
  completed: ContinueLearningItem[];
}

interface BookmarkItem {
  courseId: string;
  bookmarkedAt: string;
  course: {
    id: string;
    title: string;
    description: string;
    category: string;
    level: string;
    price: number;
    enrollmentCount: number;
  } | null;
}

function StreakBadge({ streak }: { streak: StreakInfo }) {
  if (streak.current === 0 && streak.longest === 0) return null;
  const flameColor = streak.activeToday ? "#f97316" : "#94a3b8";
  return (
    <div
      title={`Longest: ${streak.longest} day${streak.longest === 1 ? "" : "s"} · Total active: ${streak.totalDays}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        background: streak.activeToday ? "#fff7ed" : "#f1f5f9",
        border: `1px solid ${streak.activeToday ? "#fed7aa" : "#e2e8f0"}`,
        color: streak.activeToday ? "#9a3412" : "#475569",
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      <span style={{ fontSize: 16, color: flameColor }}>🔥</span>
      <span>{streak.current}-day streak</span>
    </div>
  );
}

function ContinueCard({
  item,
  onResume,
}: {
  item: ContinueLearningItem;
  onResume: (courseId: string) => void;
}) {
  const icon = item.course ? CATEGORY_ICONS[item.course.category] ?? "📚" : "📚";
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #f0fdfa 0%, #faf5ff 100%)",
        border: "1px solid #ccfbf1",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", flex: 1, lineHeight: 1.3 }}>
          {item.course?.title ?? "Untitled course"}
        </div>
      </div>
      <div
        style={{
          height: 6,
          background: "#e2e8f0",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${item.progress}%`,
            height: "100%",
            background: "linear-gradient(90deg, #0d9488, #7c3aed)",
            transition: "width 0.3s",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{item.progress}%</span>
        <button
          onClick={() => onResume(item.courseId)}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            border: "none",
            background: "#0d9488",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Resume
        </button>
      </div>
    </div>
  );
}

interface CreateCourseForm {
  title: string;
  description: string;
  category: string;
  level: string;
  price: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aevion_auth_token");
}

export default function QLearnPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateCourseForm>({
    title: "",
    description: "",
    category: "tech",
    level: "beginner",
    price: "0",
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [progress, setProgress] = useState<ProgressOverview | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedLevel) params.set("level", selectedLevel);
      const res = await fetch(apiUrl(`/api/qlearn/courses?${params}`));
      const data = await res.json();
      setCourses(data.courses || []);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedLevel]);

  const fetchPersonal = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setStreak(null);
      setProgress(null);
      setBookmarks([]);
      return;
    }
    const client = catalogWithToken(token);
    // Each call is awaited independently with allSettled so a single
    // failed sub-endpoint doesn't drop the other two. Behaviour
    // preserved: state setters only fire on success, errors swallowed.
    const [sRes, pRes, bRes] = await Promise.allSettled([
      client.qlearn.streak(),
      client.qlearn.progress(),
      client.qlearn.bookmarks(),
    ]);
    if (sRes.status === "fulfilled") {
      setStreak(sRes.value as unknown as StreakInfo);
    }
    if (pRes.status === "fulfilled") {
      setProgress(pRes.value as unknown as ProgressOverview);
    }
    if (bRes.status === "fulfilled") {
      const data = bRes.value as unknown as { bookmarks?: BookmarkItem[]; items?: BookmarkItem[] };
      setBookmarks(data.bookmarks || data.items || []);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchPersonal();
  }, [fetchPersonal]);

  const bookmarkedIds = new Set(bookmarks.map((b) => b.courseId));

  const handleToggleBookmark = async (courseId: string) => {
    const token = getToken();
    if (!token) {
      setNotice("Sign in to bookmark courses.");
      return;
    }
    const isBookmarked = bookmarkedIds.has(courseId);
    const client = catalogWithToken(token);
    try {
      if (isBookmarked) {
        await client.qlearn.unbookmark(courseId);
      } else {
        await client.qlearn.bookmark(courseId);
      }
      fetchPersonal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bookmark action failed";
      // SDK throws on non-OK status; reuse same notice copy as before.
      setNotice(msg.startsWith("AevionCatalog") ? "Bookmark action failed" : msg);
    }
  };

  const handleResume = (courseId: string) => {
    // Anchor / scroll to course in main grid; no dedicated detail page yet.
    const el = document.getElementById(`course-${courseId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    else setNotice("Course not in current view — clear filters to find it.");
  };

  const handleEnroll = async (courseId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token") : null;
    if (!token) {
      setNotice("Sign in to enroll in courses.");
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/qlearn/courses/${courseId}/enroll`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotice("Successfully enrolled!");
        fetchCourses();
        fetchPersonal();
      } else {
        const d = await res.json();
        setNotice(d.error || "Enrollment failed");
      }
    } catch {
      setNotice("Network error");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("aevion_auth_token") : null;
    if (!token) { setFormError("Sign in to create a course"); return; }
    if (!form.title.trim()) { setFormError("Title is required"); return; }
    setCreating(true);
    try {
      const res = await fetch(apiUrl("/api/qlearn/me/courses"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          level: form.level,
          price: Number(form.price) * 100,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(d.error || "Failed to create"); return; }
      setShowModal(false);
      setForm({ title: "", description: "", category: "tech", level: "beginner", price: "0" });
      fetchCourses();
    } catch {
      setFormError("Network error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px 80px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
                QLearn
              </h1>
              <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                Learn tech, business, design and more — at your own pace
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {streak && <StreakBadge streak={streak} />}
              {bookmarks.length > 0 && (
                <button
                  onClick={() => setShowBookmarks((v) => !v)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid #e2e8f0",
                    background: showBookmarks ? "#fef3c7" : "#fff",
                    color: "#92400e",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  ★ {bookmarks.length} bookmark{bookmarks.length === 1 ? "" : "s"}
                </button>
              )}
              <button
                onClick={() => setShowModal(true)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                + Create course
              </button>
            </div>
          </div>

          {/* Continue learning */}
          {progress && progress.continueLearning.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Continue learning
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {progress.summary.inProgress} in progress · avg {progress.summary.avgProgress}%
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
                  gap: 12,
                }}
              >
                {progress.continueLearning.map((item) => (
                  <ContinueCard key={item.enrollmentId} item={item} onResume={handleResume} />
                ))}
              </div>
            </div>
          )}

          {/* Bookmarks panel */}
          {showBookmarks && bookmarks.length > 0 && (
            <div
              style={{
                marginBottom: 28,
                padding: 16,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#92400e", margin: 0 }}>
                  ★ My bookmarks
                </h2>
                <button
                  onClick={() => setShowBookmarks(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#92400e", fontWeight: 700 }}
                >
                  Close
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bookmarks.map((b) => (
                  <div
                    key={b.courseId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 12px",
                      background: "#fff",
                      borderRadius: 8,
                      border: "1px solid #fde68a",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 18 }}>
                        {b.course ? CATEGORY_ICONS[b.course.category] ?? "📚" : "📚"}
                      </span>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.course?.title ?? "Untitled"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleResume(b.courseId)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          color: "#0f172a",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleToggleBookmark(b.courseId)}
                        title="Remove bookmark"
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid #fca5a5",
                          background: "#fff",
                          color: "#b91c1c",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notice */}
          {notice && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                padding: "10px 16px",
                marginBottom: 20,
                color: "#166534",
                fontSize: 14,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              {notice}
              <button onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontWeight: 700 }}>
                x
              </button>
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 16,
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "20px clamp(16px, 4vw, 28px)",
                  width: "100%",
                  maxWidth: 480,
                  maxHeight: "90vh",
                  overflowY: "auto",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 18, color: "#0f172a", marginBottom: 20 }}>
                  Create a new course
                </div>
                <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    placeholder="Course title *"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, boxSizing: "border-box", width: "100%" }}
                  />
                  <textarea
                    placeholder="Description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, resize: "vertical", boxSizing: "border-box", width: "100%" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, minWidth: 0 }}
                    >
                      {CATEGORIES.slice(1).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={form.level}
                      onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, minWidth: 0 }}
                    >
                      {LEVELS.slice(1).map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="number"
                    placeholder="Price in USD (0 = free)"
                    value={form.price}
                    min="0"
                    step="0.01"
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, boxSizing: "border-box", width: "100%" }}
                  />
                  {formError && <div style={{ color: "#dc2626", fontSize: 13 }}>{formError}</div>}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button
                      type="submit"
                      disabled={creating}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 8,
                        border: "none",
                        background: creating ? "#e2e8f0" : "#0d9488",
                        color: creating ? "#94a3b8" : "#fff",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: creating ? "not-allowed" : "pointer",
                      }}
                    >
                      {creating ? "Creating..." : "Create course"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); setFormError(null); }}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: "pointer",
                        color: "#64748b",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Category tabs + level filter */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  border: selectedCategory === c.id ? "2px solid #0d9488" : "2px solid #e2e8f0",
                  background: selectedCategory === c.id ? "#f0fdfa" : "#fff",
                  color: selectedCategory === c.id ? "#0d9488" : "#374151",
                  fontWeight: selectedCategory === c.id ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {c.id && CATEGORY_ICONS[c.id] ? `${CATEGORY_ICONS[c.id]} ` : ""}
                {c.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLevel(l.id)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 16,
                  border: selectedLevel === l.id ? "2px solid #7c3aed" : "2px solid #e2e8f0",
                  background: selectedLevel === l.id ? "#faf5ff" : "#fff",
                  color: selectedLevel === l.id ? "#7c3aed" : "#374151",
                  fontWeight: selectedLevel === l.id ? 700 : 500,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {l.name}
              </button>
            ))}
          </div>

          {/* Course grid */}
          {loading ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "60px 0", fontSize: 15 }}>
              Loading courses...
            </div>
          ) : courses.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "60px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                No courses yet
              </div>
              <div style={{ fontSize: 14 }}>Be the first to create one!</div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
                gap: 20,
              }}
            >
              {courses.map((c) => (
                <div key={c.id} id={`course-${c.id}`}>
                  <CourseCard
                    course={c}
                    onEnroll={handleEnroll}
                    bookmarked={bookmarkedIds.has(c.id)}
                    onToggleBookmark={handleToggleBookmark}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </ProductPageShell>
    </>
  );
}
