
"use client";
import { useEffect, useState, FormEvent } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

type Account = { id: string; owner: string; balance: number; createdAt: string };

export default function QTradePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [owner, setOwner] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("100");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => { try { const res = await fetch(`${API_BASE}/api/qtrade/accounts`); const data = await res.json(); setAccounts(data.items || []); } catch { setErr("Backend недоступен"); } };
  useEffect(() => { load(); }, []);

  const createAccount = async (e: FormEvent) => {
    e.preventDefault(); if (!owner.trim()) return; setErr(null);
    await fetch(`${API_BASE}/api/qtrade/accounts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner }) });
    setOwner(""); setShowCreate(false); setSuccess("Счёт создан!"); setTimeout(() => setSuccess(null), 3000); load();
  };

  const topup = async () => {
    if (!from) return; setErr(null);
    await fetch(`${API_BASE}/api/qtrade/topup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: from, amount: Number(amount) }) });
    setSuccess("Пополнено!"); setTimeout(() => setSuccess(null), 3000); load();
  };

  const transfer = async () => {
    if (!from || !to) return; setErr(null);
    const res = await fetch(`${API_BASE}/api/qtrade/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, to, amount: Number(amount) }) });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setErr(data?.error || "Ошибка перевода"); return; }
    setSuccess("Перевод выполнен!"); setTimeout(() => setSuccess(null), 3000); load();
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" as const };
  const selectStyle = { ...inputStyle, background: "#fff" };

  return (
    <div style={{ minHeight: "calc(100vh - 49px)", background: "linear-gradient(180deg, #f0fdfa 0%, #e6f9f0 100%)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#0d9488", marginBottom: 4 }}>💱 QTrade</h1>
            <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>Счета, пополнение и переводы</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} style={{
            padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
            background: showCreate ? "#e2e8f0" : "linear-gradient(135deg, #0d9488, #0f766e)", color: showCreate ? "#475569" : "#fff",
          }}>
            {showCreate ? "Отмена" : "+ Новый счёт"}
          </button>
        </div>

        {err && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14, marginBottom: 20 }}>{err}</div>}
        {success && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 14, marginBottom: 20 }}>{success}</div>}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0d9488" }}>{accounts.length}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Счетов</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#16a34a" }}>{totalBalance.toLocaleString()}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Общий баланс</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#2563eb" }}>AEVION</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Валюта</div>
          </div>
        </div>

        {/* Create account */}
        {showCreate && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Создать счёт</h2>
            <form onSubmit={createAccount} style={{ display: "flex", gap: 12 }}>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Имя владельца" style={{ ...inputStyle, flex: 1 }} />
              <button type="submit" disabled={!owner.trim()} style={{
                padding: "12px 24px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: owner.trim() ? "pointer" : "default",
                background: owner.trim() ? "linear-gradient(135deg, #0d9488, #0f766e)" : "#e2e8f0", color: owner.trim() ? "#fff" : "#94a3b8",
              }}>Создать</button>
            </form>
          </div>
        )}

        {/* Operations */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Операции</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Откуда</label>
              <select value={from} onChange={(e) => setFrom(e.target.value)} style={selectStyle}>
                <option value="">Выберите счёт</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.owner} ({a.balance})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Куда</label>
              <select value={to} onChange={(e) => setTo(e.target.value)} style={selectStyle}>
                <option value="">Выберите счёт</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.owner} ({a.balance})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 6 }}>Сумма</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={topup} disabled={!from} style={{
              padding: "12px 24px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: from ? "pointer" : "default",
              background: from ? "linear-gradient(135deg, #16a34a, #15803d)" : "#e2e8f0", color: from ? "#fff" : "#94a3b8",
            }}>Пополнить</button>
            <button onClick={transfer} disabled={!from || !to} style={{
              padding: "12px 24px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: from && to ? "pointer" : "default",
              background: from && to ? "linear-gradient(135deg, #0d9488, #0f766e)" : "#e2e8f0", color: from && to ? "#fff" : "#94a3b8",
            }}>Перевести</button>
          </div>
        </div>

        {/* Accounts */}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#475569", marginBottom: 16 }}>Счета ({accounts.length})</h2>
        {accounts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏦</div>
            <p style={{ color: "#94a3b8" }}>Пока нет счетов. Создайте первый!</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {accounts.map((a) => (
              <div key={a.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{a.owner}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>ID: {a.id.slice(0, 8)}... · {new Date(a.createdAt).toLocaleDateString("ru-RU")}</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0d9488" }}>{a.balance.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}