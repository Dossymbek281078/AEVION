"use client";
import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

export default function QSignPage() {
  const [activeTab, setActiveTab] = useState<"shield" | "keys" | "verify" | "history">("shield");
  const [userId] = useState("test-user-1");
  const [publicKey, setPublicKey] = useState("");
  const [keyCreated, setKeyCreated] = useState("");
  const [payloadText, setPayloadText] = useState('{\n  "title": "My Invention",\n  "description": "A revolutionary idea"\n}');
  const [witness, setWitness] = useState("");
  const [loading, setLoading] = useState(false);
  const [signResult, setSignResult] = useState<any>(null);
  const [verifyRecordId, setVerifyRecordId] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const headers = { "x-user-id": userId, "Content-Type": "application/json" };

  const loadKeys = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qsign/keys`, { headers: { "x-user-id": userId } });
      const data = await res.json();
      setPublicKey(data.publicKey || "");
      setKeyCreated(data.createdAt || "");
    } catch {}
  };

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qsign/signatures`, { headers: { "x-user-id": userId } });
      const data = await res.json();
      setSignatures(data.items || []);
    } catch {}
  };

  useEffect(() => { loadKeys(); }, []);
  useEffect(() => { if (activeTab === "history") loadHistory(); }, [activeTab]);

  const signQuantum = async () => {
    setLoading(true); setErr(null); setSuccess(null); setSignResult(null);
    try {
      const payload = JSON.parse(payloadText);
      const res = await fetch(`${API_BASE}/api/qsign/sign/quantum`, {
        method: "POST", headers,
        body: JSON.stringify({ payload, witness: witness.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSignResult(data);
      setSuccess("Quantum Shield подпись создана!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  const verifyQuantum = async () => {
    setLoading(true); setErr(null); setVerifyResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/qsign/verify/quantum`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: verifyRecordId }),
      });
      setVerifyResult(await res.json());
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" };

  const tabs = [
    { key: "shield", label: "🛡️ Quantum Shield" },
    { key: "keys", label: "🔑 Ключи" },
    { key: "verify", label: "🔍 Проверка" },
    { key: "history", label: "📋 История" },
  ];

  return (
    <div style={{ minHeight: "calc(100vh - 49px)", background: "linear-gradient(180deg, #f0f4ff 0%, #e8ecf8 100%)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, background: "linear-gradient(135deg, #2563eb, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>
            QSign Quantum Shield
          </h1>
          <p style={{ color: "#64748b", fontSize: 15, marginBottom: 12 }}>Трёхслойная криптографическая защита авторства</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ padding: "5px 14px", borderRadius: 20, background: "#dbeafe", color: "#2563eb", fontSize: 12, fontWeight: 600 }}>🔐 Ed25519</span>
            <span style={{ padding: "5px 14px", borderRadius: 20, background: "#f3e8ff", color: "#7c3aed", fontSize: 12, fontWeight: 600 }}>🧩 Shamir 3-of-2</span>
            <span style={{ padding: "5px 14px", borderRadius: 20, background: "#dcfce7", color: "#16a34a", fontSize: 12, fontWeight: 600 }}>⏰ Timestamp</span>
            <span style={{ padding: "5px 14px", borderRadius: 20, background: "#fef3c7", color: "#d97706", fontSize: 12, fontWeight: 600 }}>🛡️ Невзламываемая</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "#fff", borderRadius: 12, padding: 4, border: "1px solid #e2e8f0" }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setActiveTab(t.key as any); setErr(null); }} style={{
              flex: 1, padding: "10px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: activeTab === t.key ? "linear-gradient(135deg, #2563eb, #7c3aed)" : "transparent",
              color: activeTab === t.key ? "#fff" : "#64748b",
            }}>{t.label}</button>
          ))}
        </div>

        {err && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>{err}</div>}
        {success && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 14, marginBottom: 16 }}>{success}</div>}

        {/* Quantum Shield tab */}
        {activeTab === "shield" && (
          <div>
            {/* How it works */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>Как работает Quantum Shield?</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ padding: 16, borderRadius: 12, background: "#eff6ff", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 4 }}>Слой 1: Ed25519</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Криптографическая подпись вашим уникальным ключом</div>
                </div>
                <div style={{ padding: 16, borderRadius: 12, background: "#faf5ff", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🧩</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 4 }}>Слой 2: Shamir</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Подпись разбита на 3 части. Нужны 2 из 3 для проверки</div>
                </div>
                <div style={{ padding: 16, borderRadius: 12, background: "#f0fdf4", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⏰</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>Слой 3: Timestamp</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Точное время подписи невозможно подделать</div>
                </div>
              </div>
            </div>

            {/* Sign form */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Подписать с Quantum Shield</h3>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Данные для подписи (JSON)</label>
                  <textarea value={payloadText} onChange={(e) => setPayloadText(e.target.value)} rows={5} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, resize: "vertical" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Свидетель (опционально)</label>
                  <input value={witness} onChange={(e) => setWitness(e.target.value)} placeholder="email или ID свидетеля" style={inputStyle} />
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Третий держатель шарда. По умолчанию: aevion-witness</div>
                </div>
                <button onClick={signQuantum} disabled={loading} style={{
                  padding: "14px 28px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", width: "100%",
                  background: loading ? "#a5b4fc" : "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#fff",
                }}>
                  {loading ? "Подписываем..." : "🛡️ Подписать Quantum Shield"}
                </button>
              </div>
            </div>

            {/* Result */}
            {signResult && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "2px solid #86efac", marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>✅</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a" }}>Quantum Shield подпись создана</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Алгоритм: {signResult.algorithm}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Record ID (для проверки)</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <code style={{ fontSize: 13, color: "#1e293b", flex: 1 }}>{signResult.id}</code>
                      <button onClick={() => { navigator.clipboard.writeText(signResult.id); setVerifyRecordId(signResult.id); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, cursor: "pointer" }}>Copy</button>
                    </div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Хеш данных</div>
                    <code style={{ fontSize: 12, color: "#1e293b", wordBreak: "break-all" }}>{signResult.payloadHash}</code>
                  </div>

                  <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Шарды подписи</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {signResult.shards?.holders?.map((h: any) => (
                        <div key={h.index} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: h.index === 1 ? "#eff6ff" : h.index === 2 ? "#faf5ff" : "#fefce8" }}>
                          <span style={{ width: 24, height: 24, borderRadius: "50%", background: h.index === 1 ? "#2563eb" : h.index === 2 ? "#7c3aed" : "#d97706", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{h.index}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{h.holder}</div>
                            <code style={{ fontSize: 10, color: "#94a3b8" }}>{h.shard}</code>
                          </div>
                          <span style={{ fontSize: 11, color: h.index === 1 ? "#2563eb" : h.index === 2 ? "#7c3aed" : "#d97706" }}>
                            {h.index === 1 ? "Автор" : h.index === 2 ? "AEVION" : "Свидетель"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
                      Для проверки подлинности нужны любые 2 из 3 шардов
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keys tab */}
        {activeTab === "keys" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Ваш публичный ключ Ed25519</h2>
            {publicKey ? (
              <div>
                <div style={{ padding: 16, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all", marginBottom: 12 }}>{publicKey}</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button onClick={() => navigator.clipboard.writeText(publicKey)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, cursor: "pointer" }}>📋 Копировать</button>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Создан: {keyCreated ? new Date(keyCreated).toLocaleString("ru-RU") : "—"}</span>
                </div>
                <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 13, color: "#16a34a" }}>
                  Приватный ключ хранится зашифрованным. Публичный ключ можно передать для проверки подписей.
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                <button onClick={loadKeys} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Создать ключи</button>
              </div>
            )}
          </div>
        )}

        {/* Verify tab */}
        {activeTab === "verify" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Проверить Quantum Shield подпись</h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Record ID</label>
                <input value={verifyRecordId} onChange={(e) => setVerifyRecordId(e.target.value)} placeholder="cmn8u294q..." style={{ ...inputStyle, fontFamily: "monospace" }} />
              </div>
              <button onClick={verifyQuantum} disabled={loading || !verifyRecordId} style={{
                padding: "13px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 600, cursor: verifyRecordId ? "pointer" : "default", width: 280,
                background: verifyRecordId ? "linear-gradient(135deg, #2563eb, #7c3aed)" : "#e2e8f0", color: verifyRecordId ? "#fff" : "#94a3b8",
              }}>
                {loading ? "Проверяем..." : "🔍 Проверить подлинность"}
              </button>
            </div>

            {verifyResult && (
              <div style={{
                marginTop: 20, padding: 20, borderRadius: 14,
                background: verifyResult.valid ? "#f0fdf4" : "#fef2f2",
                border: `2px solid ${verifyResult.valid ? "#86efac" : "#fca5a5"}`,
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: verifyResult.valid ? "#16a34a" : "#dc2626", marginBottom: 12 }}>
                  {verifyResult.valid ? "✅ ПОДЛИННОСТЬ ПОДТВЕРЖДЕНА" : "❌ ПОДПИСЬ НЕВАЛИДНА"}
                </div>
                {verifyResult.valid && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {["ed25519", "shamir", "timestamp"].map((layer) => (
                        <div key={layer} style={{
                          padding: "10px", borderRadius: 10, textAlign: "center",
                          background: verifyResult.layers?.[layer] === "PASS" ? "#dcfce7" : "#fee2e2",
                        }}>
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{verifyResult.layers?.[layer] === "PASS" ? "✅" : "❌"}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", textTransform: "uppercase" }}>{layer}</div>
                          <div style={{ fontSize: 11, color: verifyResult.layers?.[layer] === "PASS" ? "#16a34a" : "#dc2626" }}>{verifyResult.layers?.[layer]}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: 12, borderRadius: 10, background: "#fff", fontSize: 13, color: "#475569" }}>
                      <div>Подписал: <b>{verifyResult.signedBy}</b></div>
                      <div>Дата: <b>{verifyResult.signedAt ? new Date(verifyResult.signedAt).toLocaleString("ru-RU") : "—"}</b></div>
                      <div>Алгоритм: <b>{verifyResult.algorithm}</b></div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Hash: {verifyResult.payloadHash}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {activeTab === "history" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>История подписей ({signatures.length})</h2>
              <button onClick={loadHistory} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, cursor: "pointer" }}>Обновить</button>
            </div>
            {signatures.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📝</div>
                Нет подписей. Создайте первую на вкладке Quantum Shield.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {signatures.map((s: any) => (
                  <div key={s.id} style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600, background: s.algorithm?.includes("Shamir") ? "#f3e8ff" : "#dbeafe", color: s.algorithm?.includes("Shamir") ? "#7c3aed" : "#2563eb" }}>{s.algorithm}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569" }}>Hash: <code>{s.payloadHash?.slice(0, 20)}...</code></div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(s.createdAt).toLocaleString("ru-RU")}</div>
                    </div>
                    <button onClick={() => { setVerifyRecordId(s.id); setActiveTab("verify"); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, cursor: "pointer", color: "#2563eb", fontWeight: 600 }}>
                      Проверить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}