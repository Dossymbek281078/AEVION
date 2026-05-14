"use client";

import { useState, useEffect, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QEvent {
  id: string;
  organizerId: string;
  title: string;
  description: string | null;
  category: string;
  location: string;
  startAt: string;
  endAt: string | null;
  capacity: number;
  price: number;
  attendeeCount: number;
  isPublic: boolean;
  coverUrl: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getAuthSub(): string | null {
  if (typeof window === "undefined") return null;
  const token =
    localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

const CATEGORY_ICONS: Record<string, string> = {
  tech: "💻",
  business: "📊",
  art: "🎨",
  music: "🎵",
  sports: "⚽",
  education: "📚",
  networking: "🤝",
  other: "🎉",
};

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  tech: { bg: "#eff6ff", fg: "#2563eb" },
  business: { bg: "#f0fdf4", fg: "#15803d" },
  art: { bg: "#fce7f3", fg: "#be185d" },
  music: { bg: "#fff7ed", fg: "#c2410c" },
  sports: { bg: "#ecfdf5", fg: "#059669" },
  education: { bg: "#f5f3ff", fg: "#7c3aed" },
  networking: { bg: "#fef2f2", fg: "#b91c1c" },
  other: { bg: "#f1f5f9", fg: "#475569" },
};

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? { bg: "#f1f5f9", fg: "#475569" };
  const icon = CATEGORY_ICONS[category] ?? "🎉";
  return (
    <span
      style={{
        background: color.bg,
        color: color.fg,
        borderRadius: 20,
        padding: "3px 10px",
        fontSize: 12,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {icon} {category}
    </span>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  currentUserId,
  onRSVP,
  isPast,
}: {
  event: QEvent;
  currentUserId: string | null;
  onRSVP: (id: string, status: string, attendeeCount: number) => void;
  isPast: boolean;
}) {
  const [rsvping, setRsvping] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  function handleIcsDownload() {
    // Trigger native browser download via direct navigation
    window.location.href = apiUrl(`/api/qevents/events/${event.id}/ics`);
  }

  async function handleRSVP() {
    if (!currentUserId) return;
    setRsvping(true);
    try {
      const resp = await fetch(apiUrl(`/api/qevents/events/${event.id}/rsvp`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
      });
      if (!resp.ok) return;
      const { status, attendeeCount } = await resp.json() as { status: string; attendeeCount: number };
      setRsvpStatus(status);
      onRSVP(event.id, status, attendeeCount);
    } catch {
      // ignore
    } finally {
      setRsvping(false);
    }
  }

  const isGoing = rsvpStatus === "going";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Cover placeholder */}
      <div
        style={{
          height: 100,
          background: `linear-gradient(135deg, ${CATEGORY_COLORS[event.category]?.bg ?? "#f1f5f9"} 0%, ${
            CATEGORY_COLORS[event.category]?.fg ?? "#64748b"
          }22 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
        }}
      >
        {CATEGORY_ICONS[event.category] ?? "🎉"}
      </div>

      <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Category + date */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <CategoryBadge category={event.category} />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatEventDate(event.startAt)}</span>
        </div>

        {/* Title */}
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", lineHeight: 1.3, marginBottom: 8 }}>
          {event.title}
        </div>

        {/* Location + price */}
        <div style={{ display: "flex", gap: 12, fontSize: 13, color: "#64748b", marginBottom: 10, flexWrap: "wrap" }}>
          <span>📍 {event.location}</span>
          <span>{event.price === 0 ? "Free" : `$${event.price}`}</span>
          <span>👥 {event.attendeeCount}/{event.capacity}</span>
        </div>

        {/* Description toggle */}
        {event.description && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", fontSize: 12, fontWeight: 600, padding: 0, textAlign: "left", marginBottom: 10 }}
          >
            {showDetails ? "Hide details ▲" : "Details ▼"}
          </button>
        )}

        {showDetails && event.description && (
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
            {event.description}
          </p>
        )}

        {/* Actions */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {!isPast && currentUserId && (
            <button
              onClick={handleRSVP}
              disabled={rsvping}
              style={{
                width: "100%",
                background: isGoing ? "#dcfce7" : "#0f172a",
                color: isGoing ? "#15803d" : "#fff",
                border: isGoing ? "1px solid #86efac" : "none",
                borderRadius: 8,
                padding: "9px",
                fontWeight: 700,
                cursor: rsvping ? "not-allowed" : "pointer",
                fontSize: 14,
                transition: "all 0.15s",
              }}
            >
              {rsvping ? "..." : isGoing ? "Going ✓" : "RSVP"}
            </button>
          )}
          {!isPast && !currentUserId && (
            <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
              Sign in to RSVP
            </div>
          )}
          {isPast && (
            <div
              style={{
                fontSize: 12,
                color: "#94a3b8",
                textAlign: "center",
                background: "#f1f5f9",
                borderRadius: 8,
                padding: "8px",
                fontWeight: 600,
              }}
            >
              Past event
            </div>
          )}
          <button
            onClick={handleIcsDownload}
            title="Download .ics file to add this event to your calendar"
            style={{
              width: "100%",
              background: "#fff",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "8px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.15s",
            }}
          >
            📅 Add to calendar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Event Modal ───────────────────────────────────────────────────────

function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: (event: QEvent) => void }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "tech",
    location: "Online",
    startAt: "",
    endAt: "",
    capacity: "100",
    price: "0",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.startAt) {
      setError("Title and start date are required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const resp = await fetch(apiUrl("/api/qevents/me/events"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          ...form,
          capacity: parseInt(form.capacity) || 100,
          price: parseInt(form.price) || 0,
          endAt: form.endAt || undefined,
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({})) as { error?: string };
        setError(j.error ?? "Failed to create");
        return;
      }
      const { event } = await resp.json() as { event: QEvent };
      onCreated(event);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const CATEGORIES = ["tech", "business", "art", "music", "sports", "education", "networking", "other"];

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: 12,
    background: "#fff",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
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
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 20, color: "#0f172a" }}>
          Create Event
        </div>
        <form onSubmit={handleSubmit}>
          <input placeholder="Event title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Location (default: Online)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={inputStyle} />
          <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>Start date & time *</label>
          <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} style={inputStyle} />
          <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>End date & time</label>
          <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} style={inputStyle} />
          <input placeholder="Capacity (default: 100)" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} style={inputStyle} />
          <input placeholder="Price in USD (0 = free)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inputStyle} />
          {error && <p style={{ color: "#ef4444", margin: "0 0 12px", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                flex: 1,
                background: busy ? "#c7d2fe" : "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px",
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {busy ? "Creating..." : "Create Event"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "#f1f5f9",
                color: "#64748b",
                border: "none",
                borderRadius: 8,
                padding: "10px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "tech", label: "Tech" },
  { id: "business", label: "Business" },
  { id: "art", label: "Art" },
  { id: "music", label: "Music" },
  { id: "sports", label: "Sports" },
  { id: "education", label: "Education" },
  { id: "networking", label: "Networking" },
];

type WhenFilter = "upcoming" | "past";

export default function QEventsPage() {
  const [events, setEvents] = useState<QEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [when, setWhen] = useState<WhenFilter>("upcoming");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const currentUserId = getAuthSub();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      params.set("when", when);
      const url = `${apiUrl("/api/qevents/events")}?${params.toString()}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json() as { events: QEvent[] };
        setEvents(data.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [category, when]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function handleRSVP(eventId: string, _status: string, attendeeCount: number) {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, attendeeCount } : e)),
    );
  }

  function handleCreated(event: QEvent) {
    setEvents((prev) => [event, ...prev]);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    background: active ? "#6366f1" : "#f1f5f9",
    color: active ? "#fff" : "#64748b",
    transition: "all 0.15s",
  });

  return (
    <>
      <Wave1Nav />
      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
      <ProductPageShell>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, color: "#0f172a" }}>
              QEvents
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 15 }}>
              Discover and RSVP to upcoming events in the AEVION ecosystem.
            </p>
          </div>
          {currentUserId && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 24px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 15,
              }}
            >
              + Create Event
            </button>
          )}
        </div>

        {/* Time tabs (Upcoming / Past) */}
        <div
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            borderRadius: 10,
            padding: 4,
            marginBottom: 16,
            gap: 4,
          }}
          role="tablist"
          aria-label="Time filter"
        >
          {(["upcoming", "past"] as WhenFilter[]).map((w) => {
            const active = when === w;
            return (
              <button
                key={w}
                role="tab"
                aria-selected={active}
                onClick={() => setWhen(w)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  background: active ? "#0f172a" : "transparent",
                  color: active ? "#fff" : "#64748b",
                  transition: "all 0.15s",
                }}
              >
                {w === "upcoming" ? "🔜 Upcoming" : "📜 Past"}
              </button>
            );
          })}
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              style={tabStyle(category === cat.id)}
              onClick={() => setCategory(cat.id)}
            >
              {CATEGORY_ICONS[cat.id] ?? ""} {cat.label}
            </button>
          ))}
        </div>

        {/* Events grid */}
        {loading && (
          <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
            Loading events...
          </p>
        )}
        {!loading && events.length === 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 60,
              textAlign: "center",
              color: "#94a3b8",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {when === "upcoming" ? "🎉" : "📜"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              {when === "upcoming" ? "No upcoming events" : "No past events"}
            </div>
            <div style={{ fontSize: 14 }}>
              {when === "upcoming"
                ? "Be the first to create an event!"
                : "Past events will appear here once they end."}
            </div>
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
            gap: 20,
          }}
        >
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              currentUserId={currentUserId}
              onRSVP={handleRSVP}
              isPast={when === "past"}
            />
          ))}
        </div>
      </ProductPageShell>
    </>
  );
}
