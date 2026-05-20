"use client";

import { useState } from "react";
import { decryptPayload } from "./cryptoHelpers";

interface Post {
  id: number;
  alias: string;
  ciphertext: string;
  iv: string;
  salt: string;
  size_bytes: number;
  created_at: string;
}

interface DecryptedRow {
  id: number;
  text: string | null;
  error: string | null;
}

interface Props {
  refreshKey?: number;
}

export default function PostReader({ refreshKey }: Props) {
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [decrypted, setDecrypted] = useState<Map<number, DecryptedRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPosts() {
    if (!alias || !/^[a-zA-Z0-9_-]{2,64}$/.test(alias)) {
      setError("invalid alias");
      return;
    }
    setLoading(true);
    setError(null);
    setDecrypted(new Map());
    try {
      const r = await fetch(
        `/api-backend/api/shadownet/posts/${encodeURIComponent(alias)}`,
      );
      const j = await r.json();
      if (j && j.success) {
        setPosts(j.data);
      } else {
        setError(j?.error || "fetch failed");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function decryptAll() {
    if (!password) {
      setError("password required");
      return;
    }
    setDecrypting(true);
    setError(null);
    const next = new Map<number, DecryptedRow>();
    for (const p of posts) {
      try {
        const text = await decryptPayload(
          { ciphertext: p.ciphertext, iv: p.iv, salt: p.salt },
          password,
        );
        next.set(p.id, { id: p.id, text, error: null });
      } catch {
        next.set(p.id, {
          id: p.id,
          text: null,
          error: "wrong password or corrupted",
        });
      }
    }
    setDecrypted(next);
    setDecrypting(false);
  }

  async function deletePost(id: number) {
    if (!confirm(`Delete post ${id}?`)) return;
    try {
      const r = await fetch(`/api-backend/api/shadownet/posts/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias }),
      });
      const j = await r.json();
      if (j && j.success) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        setDecrypted((prev) => {
          const n = new Map(prev);
          n.delete(id);
          return n;
        });
      } else {
        setError(j?.error || "delete failed");
      }
    } catch (e) {
      setError(String(e));
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(0,0,0,0.5)",
    border: "1px solid rgba(168,85,247,0.4)",
    borderRadius: "6px",
    padding: "10px 12px",
    color: "#e9d5ff",
    fontFamily: "monospace",
    fontSize: "13px",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    color: "#a855f7",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "6px",
    fontFamily: "monospace",
  };

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.6)",
        border: "1px solid rgba(168,85,247,0.4)",
        borderRadius: "10px",
        padding: "20px",
      }}
    >
      <h3 style={{ color: "#e9d5ff", fontSize: "16px", margin: "0 0 16px 0", fontFamily: "monospace" }}>
        read &amp; decrypt
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
        <div>
          <label style={labelStyle}>alias</label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="your handle"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="for decryption"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button
          onClick={fetchPosts}
          disabled={loading}
          style={{
            background: "transparent",
            color: "#a855f7",
            border: "1px solid #a855f7",
            padding: "9px 18px",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontSize: "11px",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "fetching…" : `fetch posts (${refreshKey ?? 0})`}
        </button>
        <button
          onClick={decryptAll}
          disabled={decrypting || posts.length === 0}
          style={{
            background: "#a855f7",
            color: "#000",
            border: "none",
            padding: "9px 18px",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: decrypting ? "wait" : "pointer",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontSize: "11px",
            opacity: decrypting || posts.length === 0 ? 0.4 : 1,
          }}
        >
          {decrypting ? "decrypting…" : "decrypt all"}
        </button>
      </div>

      {error && (
        <div style={{ color: "#fca5a5", fontSize: "12px", fontFamily: "monospace", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      {posts.length === 0 && !loading && (
        <div style={{ color: "#6b21a8", fontSize: "12px", fontFamily: "monospace" }}>
          no posts yet for this alias.
        </div>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {posts.map((p) => {
          const dec = decrypted.get(p.id);
          return (
            <div
              key={p.id}
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(168,85,247,0.25)",
                borderRadius: "6px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  color: "#a78bfa",
                  marginBottom: "8px",
                  fontFamily: "monospace",
                  letterSpacing: "0.05em",
                }}
              >
                <span>id #{p.id} · {p.size_bytes}B · {new Date(p.created_at).toLocaleString()}</span>
                <button
                  onClick={() => deletePost(p.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontFamily: "monospace",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  delete
                </button>
              </div>
              {dec?.text != null ? (
                <div style={{ color: "#e9d5ff", fontSize: "13px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {dec.text}
                </div>
              ) : dec?.error ? (
                <div style={{ color: "#fca5a5", fontSize: "12px", fontFamily: "monospace" }}>
                  {dec.error}
                </div>
              ) : (
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "10px",
                    color: "#6b21a8",
                    wordBreak: "break-all",
                    maxHeight: "60px",
                    overflow: "hidden",
                  }}
                >
                  {p.ciphertext.slice(0, 200)}…
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
