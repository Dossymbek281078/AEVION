"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { getAuthHeaders, isAuthenticated } from "@/lib/auth";
import { catalog } from "@/lib/aevionCatalog";
import { categoryLook } from "../categories";

// Страница одного события. До неё карточка в списке никуда не вела: описание
// пряталось за «Details ▼» и ссылки на событие не существовало — ни поделиться,
// ни открыть из поиска. Поля берутся из публичной выдачи `/events/:id`, которая
// перечисляет их явно; ничего сверх этого списка здесь не ждём.

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

function formatRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const date = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const from = start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (!endIso) return `${date}, ${from}`;
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  const to = end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `${date}, ${from} – ${to}`;
  const endDate = end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `${date}, ${from} – ${endDate}, ${to}`;
}

export default function QEventDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [event, setEvent] = useState<QEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [rsvping, setRsvping] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  // Токен читаем в эффекте, а не при рендере: на сервере его нет, и разметка
  // сервера разошлась бы с первой отрисовкой в браузере.
  useEffect(() => setSignedIn(isAuthenticated()), []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/qevents/events/${encodeURIComponent(id)}`), {
        cache: "no-store",
      });
      if (res.status === 404) {
        setMissing(true);
        return;
      }
      if (!res.ok) return;
      const json = (await res.json()) as { event?: QEvent };
      if (json.event) setEvent(json.event);
      else setMissing(true);
    } catch {
      // Сеть отвалилась — оставляем экран загрузки-ошибки ниже.
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRSVP() {
    if (!event) return;
    setRsvping(true);
    setRsvpError(null);
    try {
      const res = await fetch(apiUrl(`/api/qevents/events/${encodeURIComponent(event.id)}/rsvp`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        // Молчаливый провал здесь дороже всего: человек нажал и не понял,
        // записался он или нет.
        setRsvpError(
          res.status === 401
            ? "Sign in to RSVP."
            : res.status === 409
              ? "This event is full."
              : "Could not RSVP. Please try again.",
        );
        return;
      }
      const json = (await res.json()) as { status: string; attendeeCount: number };
      setRsvpStatus(json.status);
      setEvent({ ...event, attendeeCount: json.attendeeCount });
    } catch {
      setRsvpError("Could not RSVP. Please try again.");
    } finally {
      setRsvping(false);
    }
  }

  if (loading) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell maxWidth={780}>
          <div style={{ padding: "60px 0", textAlign: "center", color: "#94a3b8" }}>Loading event…</div>
        </ProductPageShell>
      </>
    );
  }

  if (missing || !event) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell maxWidth={780}>
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
              Event not found
            </h1>
            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 15 }}>
              It may have been removed, or the link is wrong.
            </p>
            <Link
              href="/qevents"
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
              All events
            </Link>
          </div>
        </ProductPageShell>
      </>
    );
  }

  const look = categoryLook(event.category);
  const isPast = new Date(event.startAt) < new Date();
  const seatsLeft = Math.max(0, event.capacity - event.attendeeCount);
  const isGoing = rsvpStatus === "going";

  return (
    <>
      <Wave1Nav />
      <ProductPageShell maxWidth={780}>
        <Link
          href="/qevents"
          style={{ display: "inline-block", marginBottom: 16, color: "#6366f1", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          ← All events
        </Link>

        <div
          style={{
            height: 140,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${look.bg} 0%, ${look.fg}22 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            marginBottom: 20,
          }}
        >
          {look.icon}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span
            style={{
              background: look.bg,
              color: look.fg,
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "capitalize",
            }}
          >
            {event.category}
          </span>
          {isPast && (
            <span style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
              Past event
            </span>
          )}
        </div>

        <h1 style={{ margin: "0 0 14px", fontSize: 30, lineHeight: 1.2, fontWeight: 800, color: "#0f172a" }}>
          {event.title}
        </h1>

        <dl
          style={{
            margin: "0 0 22px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
          }}
        >
          <Fact label="When" value={formatRange(event.startAt, event.endAt)} />
          <Fact label="Where" value={event.location} />
          <Fact label="Price" value={event.price === 0 ? "Free" : `$${event.price}`} />
          <Fact
            label="Seats"
            value={`${event.attendeeCount} of ${event.capacity} taken${seatsLeft === 0 ? " — full" : ""}`}
          />
        </dl>

        {event.description && (
          <p style={{ margin: "0 0 26px", fontSize: 16, lineHeight: 1.7, color: "#334155", whiteSpace: "pre-wrap" }}>
            {event.description}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {!isPast && signedIn && (
            <button
              onClick={handleRSVP}
              disabled={rsvping || isGoing}
              style={{
                background: isGoing ? "#dcfce7" : "#0f172a",
                color: isGoing ? "#15803d" : "#fff",
                border: isGoing ? "1px solid #86efac" : "none",
                borderRadius: 10,
                padding: "12px 22px",
                fontWeight: 700,
                fontSize: 15,
                cursor: rsvping || isGoing ? "default" : "pointer",
              }}
            >
              {rsvping ? "…" : isGoing ? "You are going ✓" : "RSVP"}
            </button>
          )}
          {!isPast && !signedIn && (
            <Link
              href="/auth"
              style={{
                background: "#0f172a",
                color: "#fff",
                borderRadius: 10,
                padding: "12px 22px",
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              Sign in to RSVP
            </Link>
          )}
          <a
            href={catalog.qevents.icsUrl(event.id)}
            style={{
              background: "#fff",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "12px 20px",
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            Add to calendar
          </a>
        </div>

        {rsvpError && (
          <p style={{ margin: "12px 0 0", color: "#b91c1c", fontSize: 14, fontWeight: 600 }}>{rsvpError}</p>
        )}
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
