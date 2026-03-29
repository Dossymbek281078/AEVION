"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { PipelineSteps } from "@/components/PipelineSteps";
import { Wave1Nav } from "@/components/Wave1Nav";
import { bureauUrlFocusObject, qsignUrlForQRightObject } from "@/lib/wave1Payload";
import { apiUrl } from "@/lib/apiBase";

type RightObject = {
  id: string;
  title: string;
  kind: string;
  description: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerUserId?: string;
  country?: string;
  city?: string;
  contentHash: string;
  createdAt: string;
};

export default function QRightPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<RightObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("idea");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [listMineOnly, setListMineOnly] = useState(false);
  const TOKEN_KEY = "aevion_auth_token_v1";

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return {};
      return { Authorization: `Bearer ${raw}` };
    } catch {
      return {};
    }
  };

  useEffect(() => {
    // Optional prefill for "place for realization" from Globus node clicks.
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("country");
    const ci = sp.get("city");
    const prefTitle = sp.get("title");
    const prefDesc = sp.get("description");
    if (c) setCountry(c);
    if (ci) setCity(ci);
    if (prefTitle) setTitle(prefTitle);
    if (prefDesc) setDescription(prefDesc);
  }, []);

  useEffect(() => {
    // If user is logged in, prefill owner fields from Auth (/api/auth/me).
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return;

      fetch(apiUrl("/api/auth/me"), {
        method: "GET",
        headers: { Authorization: `Bearer ${raw}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.user) return;
          const u = data.user as { name: string; email: string };
          setOwnerName((n) => n || u.name);
          setOwnerEmail((e) => e || u.email);
        })
        .catch(() => null);
    } catch {
      // ignore
    }
  }, []);

  const load = async (mineFlag: boolean) => {
    try {
      setLoading(true);
      setErr(null);
      const qs = mineFlag ? "?mine=1" : "";
      const res = await fetch(`${apiUrl("/api/qright/objects")}${qs}`, {
        headers: { ...authHeaders() },
      });
      if (res.status === 401) {
        setListMineOnly(false);
        throw new Error("Sign in via Auth to see your records only");
      }
      if (!res.ok) throw new Error("Failed to load QRight registry");
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
        setErr("Backend недоступен. Запустите Globus API (порт 4001) — фронт по умолчанию ходит через прокси /api-backend.");
      } else {
        setErr(m);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(listMineOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable enough for this page
  }, [listMineOnly]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setErr("Название и описание обязательны");
      return;
    }

    try {
      setSaving(true);
      setErr(null);

      const res = await fetch(apiUrl("/api/qright/objects"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          title,
          kind,
          description,
          ownerName: ownerName || undefined,
          ownerEmail: ownerEmail || undefined,
          country: country || undefined,
          city: city || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Ошибка при регистрации объекта");
      }

      setTitle("");
      setDescription("");
      setOwnerName("");
      setOwnerEmail("");
      setCountry("");
      setCity("");
      setKind("idea");

      showToast("Object registered in QRight", "success");
      await load(listMineOnly);
    } catch (e) {
      showToast((e as Error).message, "error");
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <ProductPageShell>
      <Wave1Nav />
      <PipelineSteps current="qright" />
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>QRight</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>
        Digital IP registration: register your work → get a cryptographic hash → store in registry. Then sign and certify in one click.
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 760 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Title *</div>
          <input
            placeholder="Name of your work (e.g. 'My AI Music Track')"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Type</div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
          >
            <option value="idea">Idea / Concept</option>
            <option value="code">Code / Software</option>
            <option value="design">Design / Visual</option>
            <option value="music">Music / Audio</option>
            <option value="text">Text / Article</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Description *</div>
          <textarea
            placeholder="Describe your work — what it is, what makes it unique"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
          />
        </div>

        <div className="aevion-form-grid" style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Author name (optional)</div>
            <input
              placeholder="Your name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Author email (optional)</div>
            <input
              placeholder="your@email.com"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
          />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>Country (optional)</div>
            <input
              placeholder="e.g. Kazakhstan"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>City (optional)</div>
            <input
              placeholder="e.g. Astana"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: "1px solid rgba(15,23,42,0.15)", borderRadius: 10, fontSize: 14 }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            border: "none",
            background: saving ? "#94a3b8" : "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            cursor: saving ? "default" : "pointer",
            fontWeight: 900,
            fontSize: 15,
            boxShadow: saving ? "none" : "0 4px 14px rgba(13,148,136,0.35)",
          }}
        >
          {saving ? "Saving..." : "Register object"}
        </button>

        {err && <div style={{ color: "crimson" }}>{err}</div>}
      </form>

      <hr style={{ margin: "24px 0" }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: 18, margin: 0 }}>QRight Registry ({items.length})</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={listMineOnly}
            onChange={(e) => setListMineOnly(e.target.checked)}
          />
          Только мои (нужен вход в Auth)
        </label>
      </div>

      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((x) => (
            <div key={x.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#666" }}>
                {x.kind} • {new Date(x.createdAt).toLocaleString()}
              </div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{x.title}</div>
              <div style={{ marginTop: 6 }}>{x.description}</div>
              {x.country || x.city ? (
                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                  Location: {x.city ? x.city : "—"}
                  {x.country ? `, ${x.country}` : ""}
                </div>
              ) : null}
              {x.ownerName || x.ownerEmail || x.ownerUserId ? (
                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                  Владелец: {x.ownerName || "—"}
                  {x.ownerEmail ? ` · ${x.ownerEmail}` : ""}
                  {x.ownerUserId ? ` · id ${x.ownerUserId.slice(0, 8)}…` : ""}
                </div>
              ) : null}
              <div style={{ fontSize: 11, color: "#666", marginTop: 6, wordBreak: "break-all" }}>
                hash: {x.contentHash}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link
                  href={qsignUrlForQRightObject(x)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Открыть в QSign
                </Link>
                <Link
                  href={bureauUrlFocusObject(x)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #0a5",
                    color: "#0a5",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  IP Bureau (фокус)
                </Link>
                <Link
                  href={`/planet?title=${encodeURIComponent(x.title)}&productKey=${encodeURIComponent(`planet_qright_${x.kind}`)}`}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #0f766e",
                    color: "#0f766e",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  🌍 Planet
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      </ProductPageShell>
    </main>
  );
}
