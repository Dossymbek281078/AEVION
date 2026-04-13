

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

type QRightObject = { id: string; title: string; description: string; kind: string; contentHash: string; ownerName: string | null; ownerEmail: string | null; signature: string | null; createdAt: string };

function shortHash(h: string) { return h && h.length > 16 ? `${h.slice(0, 10)}...${h.slice(-6)}` : h || ""; }

export default function AevionIpBureauPage() {
  const [items, setItems] = useState<QRightObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [validMap, setValidMap] = useState<Record<string, boolean>>({});

  const getAuth = () => { try { const t = localStorage.getItem("aevion_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; } };

  useEffect(() => {
    (async () => {
      try { setLoading(true);
        const res = await fetch(`${API_BASE}/api/qright/objects/signed`, { headers: getAuth() });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Ошибка загрузки");
        setItems((data?.items || []) as QRightObject[]);
      } catch (e: any) { setErr(e?.message); } finally { setLoading(false); }
    })();
  }, []);

  const verifyOne = async (it: QRightObject) => {
    if (!it.signature) return;
    setVerifyingId(it.id);
    try {
      const res = await fetch(`${API_BASE}/api/qsign/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload: { contentHash: it.contentHash }, signature: it.signature }) });
      const data = await res.json().catch(() => null);
      setValidMap((p) => ({ ...p, [it.id]: res.ok && Boolean(data?.valid) }));
    } catch { setValidMap((p) => ({ ...p, [it.id]: false })); } finally { setVerifyingId(null); }
  };

  return (
    <div style={{ minHeight: "calc(100vh - 49px)", background: "linear-gradient(180deg, #f0f4ff 0%, #e8ecf8 100%)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#7c3aed", marginBottom: 4 }}>🏛️ AEVION IP Bureau</h1>
            <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>Электронное патентное бюро — сертификаты на базе подписанного QRight</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/qright" style={{ padding: "8px 16px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", textDecoration: "none", color: "#16a34a", fontWeight: 600, fontSize: 13 }}>📜 QRight</Link>
            <Link href="/qsign" style={{ padding: "8px 16px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", textDecoration: "none", color: "#2563eb", fontWeight: 600, fontSize: 13 }}>✍️ QSign</Link>
          </div>
        </div>

        {err && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14, marginBottom: 20 }}>{err}</div>}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#7c3aed" }}>{items.length}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Сертификатов</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#16a34a" }}>{Object.values(validMap).filter(Boolean).length}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Проверено</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "20px", border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#2563eb" }}>HMAC</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Тип подписи</div>
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#475569", marginBottom: 16 }}>Подписанные объекты ({items.length})</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Загрузка...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p style={{ color: "#94a3b8" }}>Пока нет сертификатов. Создайте объект в <Link href="/qright" style={{ color: "#16a34a", fontWeight: 600 }}>QRight</Link> и подпишите его.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((it) => (
              <div key={it.id} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: 0 }}>{it.title}</h3>
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, background: "#f0fdf4", color: "#16a34a", fontSize: 12, fontWeight: 600 }}>{it.kind}</span>
                      <span style={{ padding: "3px 10px", borderRadius: 20, background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 600 }}>✓ Подписан</span>
                      {typeof validMap[it.id] === "boolean" && (
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: validMap[it.id] ? "#dcfce7" : "#fee2e2", color: validMap[it.id] ? "#16a34a" : "#dc2626" }}>
                          {validMap[it.id] ? "✓ Валидна" : "✗ Невалидна"}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(it.createdAt).toLocaleDateString("ru-RU")}</span>
                </div>

                {(it.ownerName || it.ownerEmail) && (
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 10 }}>
                    Автор: <b>{it.ownerName || it.ownerEmail}</b>
                  </div>
                )}

                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#f8fafc", fontSize: 12, color: "#64748b", display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <span>Hash: <code style={{ color: "#1e293b" }}>{shortHash(it.contentHash)}</code></span>
                  <span>Sig: <code style={{ color: "#7c3aed" }}>{shortHash(it.signature || "")}</code></span>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                  <button onClick={() => verifyOne(it)} disabled={verifyingId === it.id} style={{
                    padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: verifyingId === it.id ? "default" : "pointer",
                    background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff",
                  }}>
                    {verifyingId === it.id ? "Проверяем..." : "Проверить подпись"}
                  </button>
                  <button disabled style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", fontSize: 13, cursor: "default" }}>
                    PDF сертификат (скоро)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 13, color: "#64748b" }}>
          Подпись выставляется только сервером и не перезаписывается. Невозможно подделать подпись без серверного секрета.
        </div>
      </div>
    </div>
  );
}