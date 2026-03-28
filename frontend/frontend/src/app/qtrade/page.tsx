"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

type Account = {
  id: string;
  owner: string;
  balance: number;
  createdAt: string;
};

type Transfer = {
  id: string;
  from: string;
  to: string;
  amount: number;
  createdAt: string;
};

type Operation = {
  id: string;
  kind: "topup" | "transfer";
  amount: number;
  from: string | null;
  to: string;
  createdAt: string;
};

type Summary = {
  accounts: number;
  transfers: number;
  operations: number;
  totalBalance: number;
  totalTransferVolume: number;
  totalTopupVolume: number;
};

export default function QTradePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [owner, setOwner] = useState("");
  const [topupAccount, setTopupAccount] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("0");

  const accountLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, `${a.owner} (${a.balance})`);
    return (id: string) => m.get(id) ?? id;
  }, [accounts]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const [accRes, txRes, opRes, sumRes] = await Promise.all([
        fetch(apiUrl("/api/qtrade/accounts")),
        fetch(apiUrl("/api/qtrade/transfers")),
        fetch(apiUrl("/api/qtrade/operations")),
        fetch(apiUrl("/api/qtrade/summary")),
      ]);
      const failed: string[] = [];
      if (accRes.ok) {
        const accData = await accRes.json().catch(() => ({}));
        setAccounts(accData.items || []);
      } else {
        setAccounts([]);
        failed.push("счета");
      }
      if (txRes.ok) {
        const txData = await txRes.json().catch(() => ({}));
        setTransfers(txData.items || []);
      } else {
        setTransfers([]);
        failed.push("переводы");
      }
      if (opRes.ok) {
        const opData = await opRes.json().catch(() => ({}));
        setOperations(opData.items || []);
      } else {
        setOperations([]);
        failed.push("операции");
      }
      if (sumRes.ok) {
        const sumData = await sumRes.json().catch(() => null);
        setSummary(sumData);
      } else {
        setSummary(null);
        failed.push("метрики");
      }
      if (failed.length) {
        setErr(`Не удалось загрузить: ${failed.join(" и ")}. Запустите backend (4001).`);
      }
    } catch {
      setAccounts([]);
      setTransfers([]);
      setOperations([]);
      setSummary(null);
      setErr("Сеть: backend недоступен или не запущен");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!owner.trim()) {
      setErr("owner обязателен");
      return;
    }
    setErr(null);

    const res = await fetch(apiUrl("/api/qtrade/accounts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner }),
    });

    if (!res.ok) {
      setErr("Ошибка создания счёта");
      return;
    }

    setOwner("");
    await load();
  };

  const topup = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const a = Number(topupAmount);
    if (!topupAccount || !Number.isFinite(a) || a <= 0) {
      setErr("Выбери счёт и сумму > 0");
      return;
    }

    const res = await fetch(apiUrl("/api/qtrade/topup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: topupAccount, amount: a }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setErr(data?.error || "Ошибка пополнения");
      return;
    }

    setTopupAmount("");
    await load();
  };

  const transfer = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    const a = Number(amount);
    if (!from || !to || !Number.isFinite(a) || a <= 0) {
      setErr("Заполни from/to и amount > 0");
      return;
    }

    const res = await fetch(apiUrl("/api/qtrade/transfer"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, amount: a }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setErr(data?.error || "Ошибка перевода");
      return;
    }

    await load();
  };

  return (
    <main>
      <ProductPageShell maxWidth={1000}>
      <Wave1Nav />
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>QTrade</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>
        Счета, пополнение и переводы (MVP). Данные сохраняются на диск backend (
        <code style={{ fontSize: 13 }}>.aevion-data/qtrade.json</code>
        , или каталог <code style={{ fontSize: 13 }}>AEVION_DATA_DIR</code>
        ).
      </div>

      <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
        {[
          { href: "/api/qtrade/accounts.csv", label: "Счета CSV" },
          { href: "/api/qtrade/transfers.csv", label: "Переводы CSV" },
          { href: "/api/qtrade/operations.csv", label: "Операции CSV" },
        ].map((x) => (
          <a
            key={x.href}
            href={apiUrl(x.href)}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #334155",
              color: "#334155",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 13,
              background: "#fff",
            }}
          >
            {x.label}
          </a>
        ))}
      </div>

      {err && <div style={{ color: "crimson", marginBottom: 12 }}>{err}</div>}

      {summary ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Всего баланса</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{summary.totalBalance}</div>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Topup volume</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{summary.totalTopupVolume}</div>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Transfer volume</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{summary.totalTransferVolume}</div>
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Операций</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{summary.operations}</div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Создать счёт</h2>
          <form onSubmit={createAccount} style={{ display: "grid", gap: 10 }}>
            <input
              placeholder="Owner (например AEVION Test)"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <button
              type="submit"
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                width: 180,
              }}
            >
              Создать
            </button>
          </form>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Пополнить</h2>
          <form onSubmit={topup} style={{ display: "grid", gap: 10 }}>
            <select
              value={topupAccount}
              onChange={(e) => setTopupAccount(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">Счёт</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.owner} — {a.balance} [{a.id}]
                </option>
              ))}
            </select>
            <input
              placeholder="Сумма"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              type="number"
              min={0}
              step="any"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <button
              type="submit"
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #0369a1",
                background: "#0369a1",
                color: "#fff",
                width: 180,
              }}
            >
              Пополнить
            </button>
          </form>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Перевод</h2>
          <form onSubmit={transfer} style={{ display: "grid", gap: 10 }}>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">From account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.owner} ({a.balance}) [{a.id}]
                </option>
              ))}
            </select>

            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">To account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.owner} ({a.balance}) [{a.id}]
                </option>
              ))}
            </select>

            <input
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />

            <button
              type="submit"
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #0a5",
                background: "#0a5",
                color: "#fff",
                width: 180,
              }}
            >
              Перевести
            </button>
          </form>
        </section>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h2 style={{ fontSize: 18, marginBottom: 10 }}>
        Счета ({accounts.length})
      </h2>

      {loading ? (
        <div>Загрузка…</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {accounts.map((a) => (
            <div
              key={a.id}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>
                {new Date(a.createdAt).toLocaleString()}
              </div>
              <div style={{ fontWeight: 700 }}>{a.owner}</div>
              <div>balance: {a.balance}</div>
              <div style={{ fontSize: 11, color: "#666" }}>{a.id}</div>
            </div>
          ))}
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2 style={{ fontSize: 18, marginBottom: 10 }}>
        Переводы ({transfers.length})
      </h2>

      {loading ? null : transfers.length === 0 ? (
        <div style={{ color: "#888" }}>Пока нет переводов.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {transfers.map((t) => (
            <div
              key={t.id}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 16px",
                alignItems: "baseline",
              }}
            >
              <span style={{ color: "#666", fontSize: 12 }}>
                {new Date(t.createdAt).toLocaleString()}
              </span>
              <span>
                <strong>{accountLabel(t.from)}</strong>
                <span style={{ color: "#888", margin: "0 6px" }}>→</span>
                <strong>{accountLabel(t.to)}</strong>
              </span>
              <span style={{ fontWeight: 700 }}>{t.amount}</span>
              <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>
                {t.id}
              </span>
            </div>
          ))}
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2 style={{ fontSize: 18, marginBottom: 10 }}>
        Операции ({operations.length})
      </h2>

      {loading ? null : operations.length === 0 ? (
        <div style={{ color: "#888" }}>Пока нет операций.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {operations.map((op) => (
            <div
              key={op.id}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 16px",
                alignItems: "baseline",
              }}
            >
              <span style={{ color: "#666", fontSize: 12 }}>
                {new Date(op.createdAt).toLocaleString()}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: op.kind === "topup" ? "#0369a1" : "#166534",
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                {op.kind}
              </span>
              <span>
                {op.kind === "topup" ? (
                  <>
                    + в <strong>{accountLabel(op.to)}</strong>
                  </>
                ) : (
                  <>
                    <strong>{accountLabel(op.from || "")}</strong>
                    <span style={{ color: "#888", margin: "0 6px" }}>→</span>
                    <strong>{accountLabel(op.to)}</strong>
                  </>
                )}
              </span>
              <span style={{ fontWeight: 700 }}>{op.amount}</span>
              <span style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>
                {op.id}
              </span>
            </div>
          ))}
        </div>
      )}
      </ProductPageShell>
    </main>
  );
}
