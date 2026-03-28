"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
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
        throw new Error("Войдите в Auth, чтобы видеть «только мои» записи");
      }
      if (!res.ok) throw new Error("Не удалось загрузить реестр QRight");
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

      showToast("Объект зарегистрирован в QRight", "success");
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
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>QRight</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>
        Электронное патентирование (MVP): регистрация объекта → хэш → запись в реестр. Дальше — подпись и бюро в один клик.
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 760 }}>
        <input
          placeholder="Название *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />

        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        >
          <option value="idea">idea</option>
          <option value="code">code</option>
          <option value="design">design</option>
          <option value="music">music</option>
          <option value="text">text</option>
          <option value="other">other</option>
        </select>

        <textarea
          placeholder="Описание *"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <input
            placeholder="Имя автора (опционально)"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          <input
            placeholder="Email автора (опционально)"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <input
            placeholder="Страна (опционально)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          <input
            placeholder="Город (опционально)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #111",
            background: saving ? "#999" : "#111",
            color: "#fff",
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Сохранение..." : "Зарегистрировать объект"}
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
        <h2 style={{ fontSize: 18, margin: 0 }}>Реестр QRight ({items.length})</h2>
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
