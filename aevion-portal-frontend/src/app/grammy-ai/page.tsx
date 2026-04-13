"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

type Me = {
  id: string;
  email: string;
  createdAt: string;
};

type CreatedQRight = {
  id: string;
  title: string;
  contentHash: string;
  signature: string | null;
  createdAt: string;
};

function emailToOwnerName(email: string) {
  const raw = email.split("@")[0] || "";
  const safe = raw.replace(/[^a-zA-Z0-9\-_]+/g, " ").trim();
  return safe ? safe : "Участник";
}

export default function GrammyAiPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [proofValid, setProofValid] = useState<boolean | null>(null);
  const [verifyingProof, setVerifyingProof] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [created, setCreated] = useState<CreatedQRight | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(title.trim() && description.trim());
  }, [title, description]);

  useEffect(() => {
    const loadMe = async () => {
      try {
        setErr(null);
        const t = localStorage.getItem("aevion_token") || "";
        if (!t) {
          setMe(null);
          return;
        }

        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Не удалось получить пользователя");

        setMe(data as Me);
      } catch (e: any) {
        setMe(null);
        setErr(e?.message || "Ошибка авторизации");
      } finally {
        setLoadingMe(false);
      }
    };

    loadMe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!me) {
      setErr("Нужно войти, чтобы подать участие.");
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    setErr(null);
    setCreated(null);
    setProofValid(null);

    try {
      const token = localStorage.getItem("aevion_token") || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const signHeaders: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        signHeaders.Authorization = `Bearer ${token}`;
      }

      const ownerName = emailToOwnerName(me.email);

      const res = await fetch(`${API_BASE}/api/qright/objects`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `Grammy AI: ${title.trim()}`,
          kind: "grammy",
          description: description.trim(),
          ownerName,
          ownerEmail: me.email,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Ошибка создания QRight");
      }

      const createdObj = data as CreatedQRight;

      // Для демонстрации сразу подписываем объект.
      const signRes = await fetch(
        `${API_BASE}/api/qright/objects/${createdObj.id}/sign`,
        { method: "POST", headers: signHeaders }
      );
      if (signRes.ok) {
        const signed = await signRes.json().catch(() => null);
        setVerifyingProof(true);
        try {
          if (signed?.signature) {
            const verifyRes = await fetch(`${API_BASE}/api/qsign/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                payload: { contentHash: createdObj.contentHash },
                signature: signed.signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => null);
            if (!verifyRes.ok) {
              throw new Error(verifyData?.error || "Ошибка verify");
            }
            setProofValid(Boolean(verifyData?.valid));
          }
        } finally {
          setVerifyingProof(false);
        }
        setCreated({
          ...createdObj,
          signature: signed?.signature ?? createdObj.signature,
        });
      } else {
        // Даже если подпись не удалась — запись уже создана.
        setCreated(createdObj);
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Grammy AI</h1>
          <p style={{ color: "#666", marginTop: 0 }}>
            Музыкальные участия и защита авторства (через QRight).
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/" style={{ color: "#0a5" }}>
            Globus
          </Link>
          <Link href="/qright" style={{ color: "#0a5" }}>
            QRight
          </Link>
          <Link href="/auth" style={{ color: "#0a5" }}>
            Auth
          </Link>
        </div>
      </div>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 14,
          marginTop: 18,
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Подать участие</h2>

        {loadingMe ? (
          <div style={{ color: "#666" }}>Проверяем логин…</div>
        ) : me ? (
          <div style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
            Залогинены как: <b>{me.email}</b>
          </div>
        ) : (
          <div style={{ color: "crimson", fontSize: 13, marginBottom: 12 }}>
            Вы не залогинены. Нажмите `Auth` и вернитесь сюда.
          </div>
        )}

        {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название (например 'Транс-чейн саундтрек')"
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание идеи/участия (что создаём и зачем)"
            rows={6}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              fontFamily: "monospace",
            }}
          />

          <button
            type="submit"
            disabled={!me || !canSubmit || submitting}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #111",
              background: !me || !canSubmit ? "#888" : "#111",
              color: "#fff",
              width: 220,
            }}
          >
            {submitting ? "Отправка..." : "Отправить участие"}
          </button>
        </form>
      </section>

      {created ? (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 14,
            marginTop: 18,
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Готово</h2>
          <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
            QRight объект создан{created.signature ? " и подписан" : ""}.
          </div>
          {verifyingProof ? (
            <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
              Проверяем верификацию подписи...
            </div>
          ) : proofValid === null ? null : (
            <div
              style={{
                color: proofValid ? "#0a5" : "crimson",
                fontWeight: 800,
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              Подпись: {proofValid ? "валидна" : "невалидна"}
            </div>
          )}
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#666" }}>
            id: {created.id}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#666" }}>
            contentHash: {created.contentHash}
          </div>
        </section>
      ) : null}
    </main>
  );
}

