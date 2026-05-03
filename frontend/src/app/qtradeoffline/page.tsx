"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiUrl } from "@/lib/apiBase";

/* ============================================================
 * QTradeOffline — offline-first P2P payments в AEV.
 *
 * MVP-сценарий:
 *   1) Создаёшь wallet (ECDSA P-256 keypair, хранится в localStorage).
 *   2) Регистрируешь публичный ключ онлайн → начисляется airdrop 100 AEV.
 *   3) Отключаешься от сети, нажимаешь Send → подписываешь transfer
 *      приватным ключом → передаёшь получателю текстовый код / QR.
 *   4) Получатель верифицирует подпись локально, добавляет в свой ledger.
 *   5) Когда любая сторона онлайн — батч /sync применяет переводы к ledger.
 * ============================================================ */

type WalletJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  d?: string; // private — только в локальном хранилище
};

type StoredWallet = {
  id: string;
  publicKeyJwk: WalletJwk;
  privateKeyJwk: WalletJwk;
  balance: number;
  createdAt: number;
};

type LedgerEntry = {
  kind: "outgoing" | "incoming";
  from: string;
  to: string;
  amount: number;
  nonce: string;
  timestamp: number;
  publicKeyJwk: WalletJwk;
  signature: string;
  status: "pending" | "claimed" | "synced" | "rejected";
  reason?: string;
};

type ActiveTab = "send" | "receive" | "history" | "wallets" | "sync";

const LS_WALLETS = "aevion:qtradeoffline:wallets:v1";
const LS_ACTIVE = "aevion:qtradeoffline:active:v1";
const LS_LEDGER = "aevion:qtradeoffline:ledger:v1";

/* ----- crypto helpers ----- */

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalJson((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}
async function jwkAddress(jwk: WalletJwk): Promise<string> {
  const compact = canonicalJson({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(compact));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "AEV-" + hex.slice(0, 16).toUpperCase();
}
async function importPrivateKey(jwk: WalletJwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}
async function importPublicKey(jwk: WalletJwk) {
  return crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } as JsonWebKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}
async function signTransfer(
  wallet: StoredWallet,
  payload: {
    from: string;
    to: string;
    amount: number;
    nonce: string;
    timestamp: number;
  },
): Promise<string> {
  const key = await importPrivateKey(wallet.privateKeyJwk);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(canonicalJson(payload)),
  );
  return bufToB64(sig);
}
async function verifyTransfer(t: {
  from: string;
  to: string;
  amount: number;
  nonce: string;
  timestamp: number;
  publicKeyJwk: WalletJwk;
  signature: string;
}): Promise<boolean> {
  try {
    const pub = await importPublicKey(t.publicKeyJwk);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      b64ToBuf(t.signature),
      new TextEncoder().encode(
        canonicalJson({
          from: t.from,
          to: t.to,
          amount: t.amount,
          nonce: t.nonce,
          timestamp: t.timestamp,
        }),
      ),
    );
  } catch {
    return false;
  }
}
function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function encodeTransferToken(t: object): string {
  const json = JSON.stringify(t);
  return "AEVOFL1." + btoa(unescape(encodeURIComponent(json)));
}
function decodeTransferToken(token: string): unknown {
  const trimmed = token.trim();
  const i = trimmed.indexOf("AEVOFL1.");
  if (i < 0) throw new Error("token prefix missing");
  const b64 = trimmed.slice(i + "AEVOFL1.".length).split(/\s/)[0];
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

/* ----- localStorage helpers ----- */

function readWallets(): StoredWallet[] {
  if (typeof window === "undefined") return [];
  try {
    const s = window.localStorage.getItem(LS_WALLETS);
    return s ? (JSON.parse(s) as StoredWallet[]) : [];
  } catch {
    return [];
  }
}
function writeWallets(arr: StoredWallet[]) {
  window.localStorage.setItem(LS_WALLETS, JSON.stringify(arr));
}
function readLedger(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const s = window.localStorage.getItem(LS_LEDGER);
    return s ? (JSON.parse(s) as LedgerEntry[]) : [];
  } catch {
    return [];
  }
}
function writeLedger(arr: LedgerEntry[]) {
  window.localStorage.setItem(LS_LEDGER, JSON.stringify(arr));
}

/* =============== Page =============== */

export default function QTradeOfflinePage() {
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [tab, setTab] = useState<ActiveTab>("send");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  /* hydrate from localStorage */
  useEffect(() => {
    const ws = readWallets();
    setWallets(ws);
    const stored = window.localStorage.getItem(LS_ACTIVE);
    setActiveId(stored && ws.find((w) => w.id === stored) ? stored : ws[0]?.id ?? null);
    setLedger(readLedger());
  }, []);

  /* persist */
  useEffect(() => {
    if (wallets.length > 0) writeWallets(wallets);
  }, [wallets]);
  useEffect(() => {
    if (activeId) window.localStorage.setItem(LS_ACTIVE, activeId);
  }, [activeId]);
  useEffect(() => {
    writeLedger(ledger);
  }, [ledger]);

  const active = useMemo(
    () => wallets.find((w) => w.id === activeId) ?? null,
    [wallets, activeId],
  );

  const flash = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 3200);
  };

  /* === wallet ops === */

  const createWallet = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const pubJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as WalletJwk;
      const privJwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as WalletJwk;
      const id = await jwkAddress(pubJwk);
      const w: StoredWallet = {
        id,
        publicKeyJwk: pubJwk,
        privateKeyJwk: privJwk,
        balance: 0,
        createdAt: Date.now(),
      };
      // Регистрируемся на бэкенде для airdrop, ошибку не блокируем — wallet продолжит жить offline.
      try {
        const r = await fetch(apiUrl("/api/qtradeoffline/wallet/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKeyJwk: pubJwk }),
        });
        if (r.ok) {
          const data = await r.json();
          if (typeof data?.wallet?.balance === "number") {
            w.balance = data.wallet.balance;
          }
        }
      } catch {
        /* offline — продолжаем без airdrop */
      }
      setWallets((prev) => [...prev, w]);
      setActiveId(id);
      flash("ok", `Wallet ${id} ready (${w.balance} AEV)`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Wallet generation failed");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const removeWallet = (id: string) => {
    if (!window.confirm(`Remove wallet ${id}? Private key will be lost.`)) return;
    setWallets((prev) => prev.filter((w) => w.id !== id));
    if (activeId === id) {
      const remaining = wallets.filter((w) => w.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  };

  /* === send (offline) === */

  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("10");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const issueOfflinePayment = async () => {
    if (!active) return flash("err", "No active wallet");
    const amount = Number(sendAmount);
    if (!Number.isFinite(amount) || amount <= 0) return flash("err", "Amount must be > 0");
    if (amount > active.balance) return flash("err", "Insufficient balance");
    if (!sendTo.startsWith("AEV-") || sendTo.length < 10)
      return flash("err", "Recipient must be AEV-...");
    if (sendTo === active.id) return flash("err", "Cannot send to self");

    setBusy(true);
    try {
      const nonce = randomNonce();
      const timestamp = Date.now();
      const payload = { from: active.id, to: sendTo, amount, nonce, timestamp };
      const signature = await signTransfer(active, payload);
      const token = encodeTransferToken({
        ...payload,
        publicKeyJwk: active.publicKeyJwk,
        signature,
      });

      // Локально списываем баланс и пишем в ledger как pending до sync.
      setWallets((prev) =>
        prev.map((w) => (w.id === active.id ? { ...w, balance: w.balance - amount } : w)),
      );
      setLedger((prev) => [
        {
          kind: "outgoing",
          from: active.id,
          to: sendTo,
          amount,
          nonce,
          timestamp,
          publicKeyJwk: active.publicKeyJwk,
          signature,
          status: "pending",
        },
        ...prev,
      ]);

      setIssuedToken(token);
      flash("ok", `Signed offline transfer ${amount} AEV → ${sendTo.slice(0, 12)}…`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Sign failed");
    } finally {
      setBusy(false);
    }
  };

  const copyIssuedToken = async () => {
    if (!issuedToken) return;
    try {
      await navigator.clipboard.writeText(issuedToken);
      flash("ok", "Token copied. Send it to recipient.");
    } catch {
      flash("err", "Clipboard blocked");
    }
  };

  /* === receive (offline) === */

  const [pasteToken, setPasteToken] = useState("");
  const [pastePreview, setPastePreview] = useState<{
    ok: boolean;
    note: string;
    parsed?: {
      from: string;
      to: string;
      amount: number;
      nonce: string;
      timestamp: number;
      publicKeyJwk: WalletJwk;
      signature: string;
    };
  } | null>(null);

  const previewIncoming = async () => {
    setPastePreview(null);
    try {
      const parsed = decodeTransferToken(pasteToken) as {
        from: string;
        to: string;
        amount: number;
        nonce: string;
        timestamp: number;
        publicKeyJwk: WalletJwk;
        signature: string;
      };
      if (!parsed?.from || !parsed?.to || !parsed?.signature)
        throw new Error("malformed payload");
      const senderAddr = await jwkAddress(parsed.publicKeyJwk);
      if (senderAddr !== parsed.from) throw new Error("address ↔ pubkey mismatch");
      const ok = await verifyTransfer(parsed);
      if (!ok) throw new Error("signature invalid");
      setPastePreview({
        ok: true,
        note: `Verified: ${parsed.amount} AEV from ${parsed.from} → ${parsed.to}`,
        parsed,
      });
    } catch (err) {
      setPastePreview({
        ok: false,
        note: err instanceof Error ? err.message : "parse error",
      });
    }
  };

  const claimIncoming = async () => {
    if (!pastePreview?.ok || !pastePreview.parsed) return;
    if (!active) return flash("err", "No active wallet");
    const { parsed } = pastePreview;
    if (parsed.to !== active.id)
      return flash("err", `Token addressed to ${parsed.to}, not active wallet`);
    if (ledger.some((e) => e.nonce === parsed.nonce))
      return flash("err", "Token already claimed (nonce replay)");

    setLedger((prev) => [
      {
        kind: "incoming",
        from: parsed.from,
        to: parsed.to,
        amount: parsed.amount,
        nonce: parsed.nonce,
        timestamp: parsed.timestamp,
        publicKeyJwk: parsed.publicKeyJwk,
        signature: parsed.signature,
        status: "claimed",
      },
      ...prev,
    ]);
    setWallets((prev) =>
      prev.map((w) =>
        w.id === active.id ? { ...w, balance: w.balance + parsed.amount } : w,
      ),
    );
    setPasteToken("");
    setPastePreview(null);
    flash("ok", `+${parsed.amount} AEV claimed offline`);
  };

  /* === sync === */

  const [syncReport, setSyncReport] = useState<string | null>(null);

  const runSync = async () => {
    if (!active) return flash("err", "No active wallet");
    const pending = ledger.filter(
      (e) => e.status === "pending" || e.status === "claimed",
    );
    if (pending.length === 0) return flash("ok", "Nothing to sync");
    setBusy(true);
    try {
      const transfers = pending.map((e) => ({
        from: e.from,
        to: e.to,
        amount: e.amount,
        nonce: e.nonce,
        timestamp: e.timestamp,
        publicKeyJwk: e.publicKeyJwk,
        signature: e.signature,
      }));
      const r = await fetch(apiUrl("/api/qtradeoffline/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfers }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as {
        results: Array<{ nonce: string; status: "applied" | "rejected"; reason?: string }>;
      };
      const map = new Map(data.results.map((x) => [x.nonce, x]));
      setLedger((prev) =>
        prev.map((e) => {
          const r2 = map.get(e.nonce);
          if (!r2) return e;
          if (r2.status === "applied") return { ...e, status: "synced" };
          return { ...e, status: "rejected", reason: r2.reason };
        }),
      );
      const applied = data.results.filter((x) => x.status === "applied").length;
      const rejected = data.results.length - applied;
      setSyncReport(
        `Sync complete: ${applied} applied${rejected ? `, ${rejected} rejected` : ""}.`,
      );
      flash("ok", `Sync: ${applied}/${data.results.length}`);
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  /* === render === */

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
            QTradeOffline
          </h1>
          <span style={subtitleStyle}>offline-first AEV payments</span>
        </div>
        <a href="/" style={backLinkStyle}>
          ← Back to AEVION
        </a>
      </header>

      <section style={walletCardStyle}>
        {active ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={addressLabelStyle}>WALLET</div>
                <code style={addressStyle}>{active.id}</code>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={addressLabelStyle}>BALANCE</div>
                <div style={balanceStyle}>{active.balance.toLocaleString()} <span style={{ fontSize: 14, color: "#94a3b8" }}>AEV</span></div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
              Created {new Date(active.createdAt).toLocaleString()} · {wallets.length} wallet
              {wallets.length === 1 ? "" : "s"} on this device
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 12 }}>
              You have no AEV wallet on this device yet. Create one to start sending offline.
            </div>
            <button onClick={createWallet} disabled={busy} style={primaryBtn}>
              {busy ? "…" : "Create wallet (free 100 AEV airdrop)"}
            </button>
          </div>
        )}
      </section>

      {active ? (
        <>
          <nav style={tabsStyle}>
            {(["send", "receive", "history", "wallets", "sync"] as ActiveTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{ ...tabBtn, ...(tab === t ? tabBtnActive : {}) }}
              >
                {t === "send"
                  ? "Send offline"
                  : t === "receive"
                    ? "Receive"
                    : t === "history"
                      ? "History"
                      : t === "wallets"
                        ? "Wallets"
                        : "Sync"}
              </button>
            ))}
          </nav>

          <section style={panelStyle}>
            {tab === "send" ? (
              <div>
                <div style={panelTitleStyle}>Sign an offline payment</div>
                <p style={panelHintStyle}>
                  No internet needed. Recipient gets a token; they verify and claim locally.
                  Funds settle on the AEVION ledger when either party comes online and runs Sync.
                </p>
                <label style={fieldLabel}>Recipient address</label>
                <input
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value.trim())}
                  placeholder="AEV-XXXXXXXXXXXXXXXX"
                  style={inputStyle}
                  spellCheck={false}
                />
                <label style={fieldLabel}>Amount (AEV)</label>
                <input
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="10"
                  inputMode="decimal"
                  style={inputStyle}
                />
                <button onClick={issueOfflinePayment} disabled={busy} style={primaryBtn}>
                  {busy ? "Signing…" : "Sign offline payment"}
                </button>

                {issuedToken ? (
                  <div style={tokenBoxStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "#86efac" }}>
                        OFFLINE TOKEN — share this with recipient
                      </span>
                      <button onClick={copyIssuedToken} style={ghostBtn}>Copy</button>
                    </div>
                    <code style={tokenCodeStyle}>{issuedToken}</code>
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "receive" ? (
              <div>
                <div style={panelTitleStyle}>Receive an offline payment</div>
                <p style={panelHintStyle}>
                  Paste the token shared by sender. Verification runs locally — no server contact required.
                </p>
                <label style={fieldLabel}>Paste offline token</label>
                <textarea
                  value={pasteToken}
                  onChange={(e) => setPasteToken(e.target.value)}
                  placeholder="AEVOFL1.…"
                  rows={4}
                  style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", resize: "vertical" }}
                  spellCheck={false}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={previewIncoming} disabled={!pasteToken || busy} style={ghostBtn}>
                    Verify token
                  </button>
                  {pastePreview?.ok ? (
                    <button onClick={claimIncoming} disabled={busy} style={primaryBtn}>
                      Claim {pastePreview.parsed?.amount} AEV
                    </button>
                  ) : null}
                </div>
                {pastePreview ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: pastePreview.ok ? "rgba(134,239,172,0.1)" : "rgba(248,113,113,0.12)",
                      border: `1px solid ${pastePreview.ok ? "rgba(134,239,172,0.3)" : "rgba(248,113,113,0.3)"}`,
                      color: pastePreview.ok ? "#86efac" : "#f87171",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {pastePreview.ok ? "✓" : "✗"} {pastePreview.note}
                  </div>
                ) : null}
              </div>
            ) : null}

            {tab === "history" ? (
              <div>
                <div style={panelTitleStyle}>History</div>
                {ledger.length === 0 ? (
                  <p style={panelHintStyle}>No transfers yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ledger.map((e) => (
                      <div key={e.nonce} style={historyRowStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 16,
                              color: e.kind === "incoming" ? "#86efac" : "#fbbf24",
                              flex: "0 0 auto",
                            }}
                          >
                            {e.kind === "incoming" ? "↓" : "↑"}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f8" }}>
                              {e.kind === "incoming" ? "+" : "−"}{e.amount} AEV
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {e.kind === "incoming" ? `from ${e.from}` : `to ${e.to}`}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                          <span style={statusPill(e.status)}>{e.status}</span>
                          <div style={{ fontSize: 10, color: "#7a8fb0", marginTop: 2 }}>
                            {new Date(e.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {tab === "wallets" ? (
              <div>
                <div style={panelTitleStyle}>Wallets on this device</div>
                <p style={panelHintStyle}>
                  Switch wallets to act as different parties for demo (e.g. Alice ↔ Bob on the
                  same browser, or use private window for Bob).
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {wallets.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        background: w.id === activeId ? "rgba(108,214,255,0.12)" : "rgba(20,28,46,0.6)",
                        border: `1px solid ${w.id === activeId ? "rgba(108,214,255,0.4)" : "rgba(120,160,220,0.18)"}`,
                        borderRadius: 8,
                        gap: 8,
                      }}
                    >
                      <button
                        onClick={() => setActiveId(w.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#e2e8f8",
                          textAlign: "left",
                          flex: 1,
                          minWidth: 0,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <code style={{ fontSize: 12, fontWeight: 700 }}>{w.id}</code>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{w.balance} AEV</div>
                      </button>
                      <button onClick={() => removeWallet(w.id)} style={dangerBtn} title="Remove">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={createWallet} disabled={busy} style={{ ...ghostBtn, marginTop: 10 }}>
                  + New wallet
                </button>
              </div>
            ) : null}

            {tab === "sync" ? (
              <div>
                <div style={panelTitleStyle}>Sync to AEVION ledger</div>
                <p style={panelHintStyle}>
                  Pushes all pending and claimed offline transfers to the network. The server
                  re-verifies every signature, rejects nonce replays and double-spends.
                </p>
                <div style={{ marginTop: 8, marginBottom: 14, fontSize: 13, color: "#cbd5e1" }}>
                  Pending in queue:{" "}
                  <b style={{ color: "#fbbf24" }}>
                    {ledger.filter((e) => e.status === "pending" || e.status === "claimed").length}
                  </b>{" "}
                  · synced:{" "}
                  <b style={{ color: "#86efac" }}>
                    {ledger.filter((e) => e.status === "synced").length}
                  </b>
                </div>
                <button onClick={runSync} disabled={busy} style={primaryBtn}>
                  {busy ? "Syncing…" : "Sync now"}
                </button>
                {syncReport ? (
                  <div style={{ marginTop: 12, fontSize: 13, color: "#86efac" }}>{syncReport}</div>
                ) : null}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {toast ? (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.kind === "ok" ? "rgba(20,46,30,0.95)" : "rgba(46,20,20,0.95)",
            border: `1px solid ${toast.kind === "ok" ? "rgba(134,239,172,0.5)" : "rgba(248,113,113,0.5)"}`,
            color: toast.kind === "ok" ? "#86efac" : "#f87171",
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            zIndex: 99,
            backdropFilter: "blur(8px)",
          }}
        >
          {toast.text}
        </div>
      ) : null}
    </main>
  );
}

/* =============== styles =============== */

const pageStyle: CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "32px 20px 80px",
  color: "#e2e8f8",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};
const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 20,
};
const subtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "#94a3b8",
  fontWeight: 600,
  letterSpacing: "0.02em",
};
const backLinkStyle: CSSProperties = {
  fontSize: 13,
  color: "#94a3b8",
  textDecoration: "none",
};
const walletCardStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(108,214,255,0.08), rgba(20,28,46,0.6))",
  border: "1px solid rgba(108,214,255,0.32)",
  borderRadius: 14,
  padding: "16px 18px",
  marginBottom: 18,
};
const addressLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#7a8fb0",
  textTransform: "uppercase",
  marginBottom: 4,
};
const addressStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "#e2e8f8",
  letterSpacing: "0.01em",
};
const balanceStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#6cd6ff",
};
const tabsStyle: CSSProperties = {
  display: "flex",
  gap: 4,
  marginBottom: 14,
  flexWrap: "wrap",
};
const tabBtn: CSSProperties = {
  padding: "8px 14px",
  background: "rgba(20,28,46,0.6)",
  border: "1px solid rgba(120,160,220,0.18)",
  color: "#94a3b8",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const tabBtnActive: CSSProperties = {
  background: "rgba(108,214,255,0.16)",
  border: "1px solid rgba(108,214,255,0.4)",
  color: "#e2e8f8",
};
const panelStyle: CSSProperties = {
  background: "rgba(12,18,32,0.7)",
  border: "1px solid rgba(120,160,220,0.18)",
  borderRadius: 14,
  padding: "18px 20px",
};
const panelTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  marginBottom: 6,
  color: "#e2e8f8",
};
const panelHintStyle: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 14,
  lineHeight: 1.5,
};
const fieldLabel: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  color: "#7a8fb0",
  textTransform: "uppercase",
  marginTop: 8,
  marginBottom: 6,
};
const inputStyle: CSSProperties = {
  width: "100%",
  background: "rgba(20,28,46,0.7)",
  border: "1px solid rgba(120,160,220,0.25)",
  color: "#e2e8f8",
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 13,
  marginBottom: 8,
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const primaryBtn: CSSProperties = {
  background: "linear-gradient(180deg, #6cd6ff, #4cc1ff)",
  color: "#0a0e1a",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "inherit",
  marginTop: 10,
};
const ghostBtn: CSSProperties = {
  background: "transparent",
  color: "#cbd5e1",
  border: "1px solid rgba(120,160,220,0.32)",
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const dangerBtn: CSSProperties = {
  background: "transparent",
  color: "#f87171",
  border: "1px solid rgba(248,113,113,0.4)",
  width: 28,
  height: 28,
  borderRadius: 8,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 0,
};
const tokenBoxStyle: CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  background: "rgba(20,46,30,0.4)",
  border: "1px solid rgba(134,239,172,0.3)",
  borderRadius: 10,
};
const tokenCodeStyle: CSSProperties = {
  display: "block",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 11,
  color: "#cbd5e1",
  wordBreak: "break-all",
  lineHeight: 1.45,
};
const historyRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  background: "rgba(20,28,46,0.5)",
  border: "1px solid rgba(120,160,220,0.14)",
  borderRadius: 8,
  gap: 10,
};
const statusPill = (status: LedgerEntry["status"]): CSSProperties => {
  const colors: Record<LedgerEntry["status"], string> = {
    pending: "#fbbf24",
    claimed: "#86efac",
    synced: "#6cd6ff",
    rejected: "#f87171",
  };
  const c = colors[status];
  return {
    fontSize: 10,
    fontWeight: 800,
    color: c,
    border: `1px solid ${c}66`,
    padding: "2px 8px",
    borderRadius: 999,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };
};
