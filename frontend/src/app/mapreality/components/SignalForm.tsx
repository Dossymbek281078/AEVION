"use client";

import { useState } from "react";

type Category = "need" | "event" | "request";

export type SignalFormProps = {
  authorAlias: string;
  onSubmitted: () => void;
};

const CATEGORIES: Array<{ id: Category; label: string; color: string }> = [
  { id: "need", label: "Need", color: "#bae6fd" },
  { id: "event", label: "Event", color: "#fef08a" },
  { id: "request", label: "Request", color: "#bbf7d0" },
];

export function SignalForm({ authorAlias, onSubmitted }: SignalFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("need");
  const [country, setCountry] = useState("KZ");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function tryGeolocate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setMsg("Geolocation not available in this browser");
      return;
    }
    setMsg("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
        setMsg("Location captured");
      },
      (err) => setMsg(`Location denied: ${err.message}`),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const alias = authorAlias.trim();
    if (!alias) {
      setMsg("Set your author alias first (top of page)");
      return;
    }
    if (!title.trim() || !description.trim() || !country.trim()) {
      setMsg("Title, description, country are required");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        category,
        country: country.trim().toUpperCase(),
        authorAlias: alias,
      };
      if (city.trim()) body.city = city.trim();
      if (lat) body.lat = Number(lat);
      if (lng) body.lng = Number(lng);

      const r = await fetch("/api/mapreality/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as { id?: number; error?: string };
      if (!r.ok) {
        setMsg(data.error ?? `error ${r.status}`);
        return;
      }
      setMsg(`Signal #${data.id} published`);
      setTitle("");
      setDescription("");
      setCity("");
      setLat("");
      setLng("");
      onSubmitted();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        background: "rgba(15, 23, 42, 0.65)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        borderRadius: 16,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f1f5f9", margin: 0 }}>Publish a signal</h2>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>MVP · public, in-memory if DB unavailable</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 999,
                border: "1px solid",
                borderColor: active ? c.color : "rgba(148, 163, 184, 0.25)",
                background: active ? c.color : "transparent",
                color: active ? "#0f172a" : "#cbd5e1",
                cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        placeholder="Title (e.g. Need 3 GPs for week of May 20)"
        maxLength={200}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        style={inputStyle}
      />

      <textarea
        placeholder="Describe the need / event / request in detail (max 2000 chars)"
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={4}
        style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input
          type="text"
          placeholder="Country (KZ, RU, US...)"
          maxLength={64}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="City (optional)"
          maxLength={80}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "stretch" }}>
        <input
          type="text"
          placeholder="lat (optional)"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="lng (optional)"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={tryGeolocate}
          style={{
            padding: "8px 12px",
            fontSize: 12,
            background: "rgba(186, 230, 253, 0.15)",
            color: "#bae6fd",
            border: "1px solid rgba(186, 230, 253, 0.35)",
            borderRadius: 8,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Use my location
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            background: "#bae6fd",
            color: "#075985",
            border: "none",
            borderRadius: 10,
            padding: "9px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Publishing…" : "Publish signal"}
        </button>
        {msg && <span style={{ fontSize: 12, color: "#cbd5e1" }}>{msg}</span>}
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  fontSize: 13,
  background: "rgba(2, 6, 23, 0.6)",
  color: "#e2e8f0",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: 8,
  outline: "none",
  fontFamily: "inherit",
};
