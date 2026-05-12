"use client";

import { useState, useEffect, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

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

function CourseCard({ course, onEnroll }: { course: Course; onEnroll: (id: string) => void }) {
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
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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

interface CreateCourseForm {
  title: string;
  description: string;
  category: string;
  level: string;
  price: string;
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

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

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
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
                QLearn
              </h1>
              <p style={{ color: "#64748b", margin: 0, fontSize: 15 }}>
                Learn tech, business, design and more — at your own pace
              </p>
            </div>
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
                padding: 24,
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 28,
                  width: "100%",
                  maxWidth: 480,
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
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                  />
                  <textarea
                    placeholder="Description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, resize: "vertical" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                    >
                      {CATEGORIES.slice(1).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={form.level}
                      onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
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
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
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
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 20,
              }}
            >
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} onEnroll={handleEnroll} />
              ))}
            </div>
          )}
        </div>
      </ProductPageShell>
    </>
  );
}
