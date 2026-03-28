"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";

import { apiUrl } from "@/lib/apiBase";

export default function QSignPage() {
  const { showToast } = useToast();
  const [payloadText, setPayloadText] = useState('{ "hello": "AEVION" }');
  const [signature, setSignature] = useState("");
  const [verifySignature, setVerifySignature] = useState("");
  const [result, setResult] = useState("");
  const [payloadOrigin, setPayloadOrigin] = useState<string | null>(null);

  // Deep link from Globus / module pages: /qsign?payload=<encodeURIComponent(JSON)>
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const raw = sp.get("payload");
      if (!raw) return;
      const decoded = decodeURIComponent(raw);
      JSON.parse(decoded);
      setPayloadText(decoded);
      setPayloadOrigin("deep link (QRight / Globus)");
    } catch {
      // ignore malformed payload param
    }
  }, []);

  const sign = async () => {
    setResult("");
    try {
      const payload = JSON.parse(payloadText);

      const res = await fetch(apiUrl("/api/qsign/sign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(`Ошибка подписи: ${(data as { error?: string }).error || res.status}`);
        return;
      }
      setSignature((data as { signature?: string }).signature || "");
      setResult(JSON.stringify(data, null, 2));
      showToast("Payload подписан", "success");
    } catch (e: any) {
      setResult("Ошибка подписи: " + (e?.message || String(e)));
      showToast("Ошибка подписи", "error");
    }
  };

  const verify = async () => {
    setResult("");
    try {
      const payload = JSON.parse(payloadText);

      const res = await fetch(apiUrl("/api/qsign/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          signature: verifySignature || signature,
        }),
      });

      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      if (data.valid) showToast("Подпись VALID", "success");
      else showToast("Подпись INVALID", "error");
    } catch (e: any) {
      setResult("Ошибка проверки: " + e.message);
      showToast("Ошибка проверки", "error");
    }
  };

  return (
    <main>
      <ProductPageShell maxWidth={900}>
      <Wave1Nav />
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>QSign</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Подпись и проверка целостности данных (HMAC-SHA256). Payload с QRight совпадает с тем, что подписывает IP Bureau.
      </p>

      {payloadOrigin ? (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(15,118,110,0.25)",
            background: "rgba(15,118,110,0.06)",
            fontSize: 13,
            color: "#0f766e",
            fontWeight: 600,
          }}
        >
          Payload получен из: {payloadOrigin}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Link href="/qright" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #0f172a", textDecoration: "none", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>
          ← QRight
        </Link>
        <Link href="/bureau" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #0f172a", textDecoration: "none", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>
          IP Bureau →
        </Link>
        <Link href="/planet" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #0f766e", textDecoration: "none", color: "#0f766e", fontWeight: 700, fontSize: 13 }}>
          🌍 Planet
        </Link>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Payload (JSON)</div>
          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            rows={8}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              fontFamily: "monospace",
            }}
          />
        </div>

        <button
          onClick={sign}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            width: 160,
          }}
        >
          Подписать
        </button>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Подпись</div>
          <input
            value={signature}
            readOnly
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ccc",
              fontSize: 12,
            }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            Подпись для проверки (необязательно)
          </div>
          <input
            value={verifySignature}
            onChange={(e) => setVerifySignature(e.target.value)}
            placeholder="Оставь пустым — возьмётся подпись выше"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ccc",
              fontSize: 12,
            }}
          />
        </div>

        <button
          onClick={verify}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #0a5",
            background: "#0a5",
            color: "#fff",
            width: 160,
          }}
        >
          Проверить
        </button>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Результат</div>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            {result || "—"}
          </pre>
        </div>
      </div>
      </ProductPageShell>
    </main>
  );
}
