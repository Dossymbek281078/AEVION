"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function SignButton() {
  const params = useSearchParams();
  const payload = params.get("payload") ?? "";
  const token = params.get("token") ?? "";

  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSign() {
    if (!payload || !token) {
      setState("error");
      setErrorMsg("Missing payload or token.");
      return;
    }
    setState("loading");
    try {
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        parsedPayload = payload;
      }
      const res = await fetch("/api/qsign/v2/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payload: parsedPayload }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || `HTTP ${res.status}`);
      }
      const signResponse = await res.json();
      window.parent.postMessage({ type: "qsign:signed", data: signResponse }, "*");
      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  const bgColor =
    state === "success"
      ? "#047857"
      : state === "error"
        ? "#b91c1c"
        : state === "loading"
          ? "#475569"
          : "#0b1120";

  const label =
    state === "success"
      ? "Signed"
      : state === "loading"
        ? "Signing…"
        : "Sign with AEVION QSign";

  return (
    <div
      style={{
        margin: 0,
        padding: 8,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        background: "transparent",
      }}
    >
      <button
        onClick={handleSign}
        disabled={state === "loading" || state === "success"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 18px",
          borderRadius: 8,
          border: "none",
          background: bgColor,
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          cursor: state === "loading" || state === "success" ? "default" : "pointer",
          letterSpacing: "0.02em",
          transition: "background 0.2s",
          opacity: state === "loading" ? 0.8 : 1,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: "linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 11,
            color: "#0b1120",
            flexShrink: 0,
          }}
        >
          A
        </span>
        {label}
      </button>

      {state === "error" && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "#b91c1c",
            maxWidth: 300,
            wordBreak: "break-word",
          }}
        >
          {errorMsg}
        </div>
      )}

      {state === "success" && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#047857" }}>
          Signature posted to parent frame.
        </div>
      )}
    </div>
  );
}

export default function QSignEmbedSignPage() {
  return (
    <Suspense>
      <SignButton />
    </Suspense>
  );
}
